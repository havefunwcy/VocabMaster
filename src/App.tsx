import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { WordItem, WordProgress, Rating, State, UserSettings, DeckMetadata } from './types';
import { StorageService, isWordInDeck } from './utils/storage';
import { DECKS, INITIAL_WORDS } from './data/wordbanks';
import { defaultFsrs } from './algorithms/fsrs';
import { CognitiveEngine, CognitiveState } from './algorithms/cognitive';
import { Navbar, TabType } from './components/Navbar';
import { FlashcardRecall } from './components/FlashcardRecall';
import { AudioWalkman } from './components/AudioWalkman';
import { ContextCloze } from './components/ContextCloze';
import { SpellingQuiz } from './components/SpellingQuiz';
import { SpeedReview } from './components/SpeedReview';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { WordListManager } from './components/WordListManager';
import { SettingsModal } from './components/SettingsModal';
import { CheckCircle2, Sparkles, PlusCircle, ArrowRight, RotateCw, BookOpen, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getWordListIndex, getDeckListSummaries, DEFAULT_WORDS_PER_LIST, repartitionDeckWords } from './utils/listManager';
import { TactileSoundService } from './utils/soundEffects';

interface UndoHistoryEntry {
  wordId: string;
  wordText: string;
  prevProgress: WordProgress;
  wasCram: boolean;
  prevFlashcardIndex: number;
}

export function App() {
  const [words, setWords] = useState<WordItem[]>(() => StorageService.loadWords());
  const [decks, setDecks] = useState<DeckMetadata[]>(() => StorageService.loadDecks());
  const [progressMap, setProgressMap] = useState<Record<string, WordProgress>>(() => StorageService.loadProgress());
  const [settings, setSettings] = useState<UserSettings>(() => StorageService.loadSettings());
  const [activeTab, setActiveTab] = useState<TabType>('flashcard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 会话认知追踪
  const [sessionStartTime] = useState<number>(Date.now());
  const [sessionLatencies, setSessionLatencies] = useState<number[]>([]);
  const [sessionResults, setSessionResults] = useState<boolean[]>([]);

  // 各学习模式独立索引与强化轮状态
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [clozeIndex, setClozeIndex] = useState(0);
  const [spellingIndex, setSpellingIndex] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [cramQueue, setCramQueue] = useState<{ word: WordItem; progress: WordProgress }[]>([]);
  const [isCramActive, setIsCramActive] = useState(false);
  const [undoHistory, setUndoHistory] = useState<UndoHistoryEntry[]>([]);
  const unitScrollRef = useRef<HTMLDivElement>(null);

  // 当切换 List 分卷或词库时，自动将当前选中的单元滑块平滑居中滚入可视区域
  useEffect(() => {
    const container = unitScrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector('[data-unit-active="true"]') as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [settings.activeListIndex, settings.activeDeckId, activeTab]);

  // 同步硬件按键微音效开关与全局轻触反馈
  useEffect(() => {
    TactileSoundService.setEnabled(settings.tactileSoundEnabled !== false);
  }, [settings.tactileSoundEnabled]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest('.neu-btn, .neu-btn-sm');
      if (btn && !(btn as HTMLButtonElement).disabled) {
        TactileSoundService.playKeyClick();
      }
    };
    window.addEventListener('click', handleGlobalClick, { capture: true });
    return () => window.removeEventListener('click', handleGlobalClick, { capture: true });
  }, []);

  // 全局暗色模式系统/手动偏好监听与响应
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    const theme = settings.theme || 'system';
    if (theme === 'dark') {
      applyTheme(true);
    } else if (theme === 'light') {
      applyTheme(false);
    } else {
      // 跟随操作系统深色模式
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings.theme]);

  // 保存进度和设置变更
  const updateSettings = (partial: Partial<UserSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    StorageService.saveSettings(updated);
  };

  const saveProgressState = (newMap: Record<string, WordProgress>) => {
    setProgressMap(newMap);
    StorageService.saveProgress(newMap);
  };

  // 1. 筛选出当前词库中的词汇与短语
  const activeDeck = useMemo(() => {
    return decks.find(d => d.id === settings.activeDeckId) || decks[0];
  }, [decks, settings.activeDeckId]);

  const activeDeckWords = useMemo(() => {
    if (!activeDeck) return [];
    return words.filter(w => isWordInDeck(w, activeDeck));
  }, [words, activeDeck]);

  const now = Date.now();

  // 当前词库的各个 List 分卷统计概要
  const deckListSummaries = useMemo(() => {
    return getDeckListSummaries(
      activeDeckWords,
      activeDeck?.wordsPerList || DEFAULT_WORDS_PER_LIST,
      progressMap,
      now
    );
  }, [activeDeckWords, activeDeck, progressMap, now]);

  // 按用户选择的 List 筛选待学单词 (若为 'all' 或未指定则学习整书全部词汇)
  const activeStudyWords = useMemo(() => {
    if (!settings.activeListIndex || settings.activeListIndex === 'all') {
      return activeDeckWords;
    }
    const targetIdx = Number(settings.activeListIndex);
    return activeDeckWords.filter(w => {
      const idx = getWordListIndex(w, activeDeckWords, activeDeck?.wordsPerList || DEFAULT_WORDS_PER_LIST);
      return idx === targetIdx;
    });
  }, [activeDeckWords, settings.activeListIndex, activeDeck]);

  // 切换词库或切换 List 时重置所有模式的当前索引与强化轮
  useEffect(() => {
    setFlashcardIndex(0);
    setClozeIndex(0);
    setSpellingIndex(0);
    setSpeedIndex(0);
    setIsCramActive(false);
    setCramQueue([]);
    setUndoHistory([]);
  }, [settings.activeDeckId, settings.activeListIndex]);

  // 2. 统计待复习 (Due) 与新词 (New) - 基于当前选修的词汇范围 (整书或指定 List)
  const dueWordPairs = useMemo(() => {
    return activeStudyWords
      .map(w => ({ word: w, progress: StorageService.getOrCreateWordProgress(w.id, progressMap) }))
      .filter(({ progress }) => progress.state !== State.New && progress.nextReview <= now && progress.reps > 0);
  }, [activeStudyWords, progressMap, now]);

  const newWordPairs = useMemo(() => {
    return activeStudyWords
      .map(w => ({ word: w, progress: StorageService.getOrCreateWordProgress(w.id, progressMap) }))
      .filter(({ progress }) => progress.state === State.New || progress.reps === 0);
  }, [activeStudyWords, progressMap]);

  // 全量练习与巩固候选池（按稳定性由低到高排序，优先巩固最薄弱词汇）
  const practiceCards = useMemo(() => {
    if (activeStudyWords.length === 0) return [];
    return activeStudyWords
      .map(w => ({ word: w, progress: StorageService.getOrCreateWordProgress(w.id, progressMap) }))
      .sort((a, b) => {
        // 已学的排在前面，优先巩固
        if (a.progress.reps > 0 && b.progress.reps === 0) return -1;
        if (a.progress.reps === 0 && b.progress.reps > 0) return 1;
        // 稳定性越低，遗忘风险越高，排在越前面
        return a.progress.stability - b.progress.stability;
      });
  }, [activeStudyWords, progressMap]);

  // 3. 构建科学交错队列 (标准日常 FSRS 队列)
  const standardStudyQueue = useMemo(() => {
    const reviews = [...dueWordPairs];
    const news = newWordPairs.slice(0, settings.dailyNewWords);
    return CognitiveEngine.interleaveCards(reviews, news, 40);
  }, [dueWordPairs, newWordPairs, settings.dailyNewWords]);

  // 闪卡最终活跃队列 (支持学有余力强化轮)
  const flashcardQueue = isCramActive && cramQueue.length > 0 ? cramQueue : standardStudyQueue;
  const safeFlashcardIndex = flashcardQueue.length > 0 ? Math.min(flashcardIndex, flashcardQueue.length - 1) : 0;
  const currentFlashcard = flashcardQueue[safeFlashcardIndex] || null;

  // 巩固练习队列 (语境填空 / 听写拼写 / 极限速刷：日常队列优先，若日常队列已完成则无缝切换到当前词库全量词汇池巩固，绝不出现空白阻断！)
  const clozeQueue = standardStudyQueue.length > 0 ? standardStudyQueue : practiceCards;
  const currentClozeCard = clozeQueue[clozeIndex % Math.max(1, clozeQueue.length)] || null;

  const spellingQueue = standardStudyQueue.length > 0 ? standardStudyQueue : practiceCards;
  const currentSpellingCard = spellingQueue[spellingIndex % Math.max(1, spellingQueue.length)] || null;

  const speedQueue = standardStudyQueue.length > 0 ? standardStudyQueue : practiceCards;
  const currentSpeedCard = speedQueue[speedIndex % Math.max(1, speedQueue.length)] || null;

  // 单词速听（随身听模式）曲目队列：按当前选定分卷/整书顺序排列
  const walkmanCards = useMemo(() => {
    return activeStudyWords.map(w => ({
      word: w,
      progress: StorageService.getOrCreateWordProgress(w.id, progressMap),
    }));
  }, [activeStudyWords, progressMap]);

  // 学有余力逻辑：若有新词则增加新词配额；若词库已全学过，则智能筛选出 10 个最低稳定性词汇开启强化巩固轮
  const handleLearnMore = () => {
    if (newWordPairs.length > 0) {
      const addCount = Math.min(10, newWordPairs.length);
      updateSettings({ dailyNewWords: settings.dailyNewWords + addCount });
      setIsCramActive(false);
      setFlashcardIndex(0);
      confetti({ particleCount: 50, spread: 60 });
    } else {
      // 当前词库新词已全部学过：提取稳定性最低/最需复习的 10 个词作为强化轮
      const cramBatch = practiceCards.slice(0, 10);
      if (cramBatch.length > 0) {
        setCramQueue(cramBatch);
        setIsCramActive(true);
        setFlashcardIndex(0);
        confetti({ particleCount: 60, spread: 70 });
      } else {
        setActiveTab('decks');
      }
    }
  };

  // 4. 计算当前会话认知状态
  const sessionMinutes = (Date.now() - sessionStartTime) / (1000 * 60);
  const cognitiveState = useMemo(() => {
    return CognitiveEngine.evaluateSession(sessionLatencies, sessionResults, sessionMinutes);
  }, [sessionLatencies, sessionResults, sessionMinutes]);

  // 处理评分评级（核心 FSRS 演进与认知数据更新）
  const handleRateCard = useCallback((
    cardToRate: { word: WordItem; progress: WordProgress },
    rating: Rating,
    latencyMs: number,
    mode: 'flashcard' | 'cloze' | 'spelling' | 'speed'
  ) => {
    const { word, progress } = cardToRate;

    // 播放答题微音效反馈
    if (rating === Rating.Again) {
      TactileSoundService.playError();
    } else {
      TactileSoundService.playSuccess();
    }

    // 如果是闪卡模式，记录撤销快照
    if (mode === 'flashcard') {
      setUndoHistory(prev => [
        ...prev.slice(-19),
        {
          wordId: word.id,
          wordText: word.word,
          prevProgress: { ...progress, history: [...(progress.history || [])] },
          wasCram: isCramActive,
          prevFlashcardIndex: safeFlashcardIndex,
        }
      ]);
    }

    const { nextProgress } = defaultFsrs.reviewCard(
      progress,
      rating,
      latencyMs,
      settings,
      mode
    );

    // 更新持久化进度
    const updatedMap = {
      ...progressMap,
      [word.id]: nextProgress,
    };
    saveProgressState(updatedMap);

    // 记录认知指标
    const isSuccess = rating !== Rating.Again;
    setSessionLatencies(prev => [...prev, latencyMs]);
    setSessionResults(prev => [...prev, isSuccess]);

    // 闪卡队列流动与完成彩带
    if (mode === 'flashcard') {
      if (isCramActive) {
        // 强化巩固轮为固定数组队列，按序递增索引
        if (safeFlashcardIndex >= cramQueue.length - 1) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
          setFlashcardIndex(0);
          setIsCramActive(false);
          setCramQueue([]);
        } else {
          setFlashcardIndex(safeFlashcardIndex + 1);
        }
      } else {
        // 标准日常队列 (standardStudyQueue)：已评分卡片会自动移出待学队列，下一张卡片自动顶替至当前索引 0，不递增索引以免跳词！
        if (standardStudyQueue.length <= 1) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
        setFlashcardIndex(0);
      }
    }
  }, [progressMap, settings, safeFlashcardIndex, cramQueue.length, standardStudyQueue.length, isCramActive]);

  // 撤销上一次闪卡评分 (Ctrl+Z)
  const handleUndoLastRating = useCallback(() => {
    if (undoHistory.length === 0) return;
    const lastEntry = undoHistory[undoHistory.length - 1];
    setUndoHistory(prev => prev.slice(0, -1));

    const updatedMap = {
      ...progressMap,
      [lastEntry.wordId]: lastEntry.prevProgress,
    };
    saveProgressState(updatedMap);

    setSessionLatencies(prev => prev.slice(0, -1));
    setSessionResults(prev => prev.slice(0, -1));

    if (lastEntry.wasCram) {
      setFlashcardIndex(lastEntry.prevFlashcardIndex);
    } else {
      setFlashcardIndex(0);
    }
  }, [undoHistory, progressMap]);

  // 切换星标/生词本
  const handleToggleStar = (wordId: string) => {
    const currentProg = StorageService.getOrCreateWordProgress(wordId, progressMap);
    const updated = {
      ...progressMap,
      [wordId]: {
        ...currentProg,
        isStarred: !currentProg.isStarred,
      }
    };
    saveProgressState(updated);
  };

  // 重置单词记忆进度
  const handleResetWordProgress = (wordId: string) => {
    const currentProg = StorageService.getOrCreateWordProgress(wordId, progressMap);
    const updated = {
      ...progressMap,
      [wordId]: {
        ...currentProg,
        state: State.New,
        stability: 0.5,
        difficulty: 5.0,
        reps: 0,
        lapses: 0,
        nextReview: 0,
        lastReview: 0,
        history: [],
      }
    };
    saveProgressState(updated);
  };

  // 导入自定义词汇或短语
  const handleImportWords = (newWords: WordItem[], targetDeckId?: string) => {
    const assignedDeckId = targetDeckId || settings.activeDeckId;
    const currentDeck = decks.find(d => d.id === assignedDeckId);

    const processed = newWords.map(w => {
      const deckId = w.deckId || assignedDeckId;
      const tags = [...(w.tags || [])];
      if (currentDeck && !tags.includes(currentDeck.name)) {
        tags.push(currentDeck.name);
      }
      if (currentDeck && currentDeck.category === 'phrases' && !tags.includes('短语')) {
        tags.push('短语');
      }
      return {
        ...w,
        deckId,
        tags,
      };
    });

    const merged = [...processed, ...words];
    setWords(merged);
    StorageService.saveWords(merged);

    // 自动切换到目标词库以便立即看到
    if (targetDeckId && targetDeckId !== settings.activeDeckId) {
      updateSettings({ activeDeckId: targetDeckId });
    }

    confetti({ particleCount: 50, spread: 60 });
  };

  // 完整备份还原
  const handleRestoreBackup = (data: { words?: WordItem[]; decks?: DeckMetadata[]; progressMap?: Record<string, WordProgress> }) => {
    if (data.words && Array.isArray(data.words)) {
      setWords(data.words);
      StorageService.saveWords(data.words);
    }
    if (data.decks && Array.isArray(data.decks)) {
      setDecks(data.decks);
      StorageService.saveDecks(data.decks);
    }
    if (data.progressMap && typeof data.progressMap === 'object') {
      setProgressMap(data.progressMap);
      StorageService.saveProgress(data.progressMap);
    }
    confetti({ particleCount: 80, spread: 80 });
  };

  // 单独添加单词或短语
  const handleAddWordOrPhrase = (item: WordItem) => {
    const merged = [item, ...words];
    setWords(merged);
    StorageService.saveWords(merged);

    // 动态同步所属词库的总词数
    const targetDeckId = item.deckId || settings.activeDeckId;
    const updatedDecks = decks.map(d => {
      if (d.id === targetDeckId || (item.tags && item.tags.includes(d.name))) {
        return { ...d, totalWords: d.totalWords + 1 };
      }
      return d;
    });
    setDecks(updatedDecks);
    StorageService.saveDecks(updatedDecks);

    confetti({ particleCount: 35, spread: 50 });
  };

  // 创建新词库 / 短语库
  const handleCreateDeck = (newDeck: Omit<DeckMetadata, 'totalWords'>) => {
    const deckWithMeta: DeckMetadata = {
      ...newDeck,
      totalWords: 0,
      isCustom: true
    };
    const updated = [...decks, deckWithMeta];
    setDecks(updated);
    StorageService.saveDecks(updated);
    updateSettings({ activeDeckId: deckWithMeta.id });
    confetti({ particleCount: 40, spread: 60 });
  };

  // 编辑词书基本信息（名称、简介、类别、图标、配色、置顶、每组容量及可选自动重新均分 List）
  const handleUpdateDeck = (updatedDeck: DeckMetadata, repartitionNow?: boolean) => {
    const oldDeck = decks.find(d => d.id === updatedDeck.id);
    const nextDecks = decks
      .map(d => (d.id === updatedDeck.id ? updatedDeck : d))
      .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    setDecks(nextDecks);
    StorageService.saveDecks(nextDecks);

    // 若词书名称变更或勾选了重新均分 List，同步更新归属词汇的标签与分卷序号
    const nameChanged = Boolean(oldDeck && oldDeck.name !== updatedDeck.name);
    if (nameChanged || (repartitionNow && updatedDeck.wordsPerList)) {
      let nextWords = words;
      if (oldDeck && nameChanged) {
        nextWords = nextWords.map(w => {
          if (!isWordInDeck(w, oldDeck)) return w;
          const updatedTags = w.tags.map(t => (t === oldDeck.name ? updatedDeck.name : t));
          return {
            ...w,
            deckId: w.deckId || updatedDeck.id,
            tags: updatedTags,
          };
        });
      }
      if (repartitionNow && updatedDeck.wordsPerList) {
        nextWords = repartitionDeckWords(nextWords, updatedDeck.id, updatedDeck.wordsPerList);
      }
      setWords(nextWords);
      StorageService.saveWords(nextWords);
    }
  };

  // 删除词库（支持官方词库与自定义词库）
  const handleDeleteDeck = (deckId: string) => {
    const targetDeck = decks.find(d => d.id === deckId);
    if (!targetDeck) return;

    // 1. 记录已删除的词库 ID，防止页面刷新后内置词库被自动补全
    StorageService.markDeckDeleted(deckId);

    // 2. 清理该词库内的词条
    const remainingWords = words.filter(w => !isWordInDeck(w, targetDeck));
    setWords(remainingWords);
    StorageService.saveWords(remainingWords);

    // 3. 清理已删除词条对应的复习进度
    const remainingWordIds = new Set(remainingWords.map(w => w.id));
    const newProgressMap: Record<string, WordProgress> = {};
    let progressChanged = false;
    for (const [id, prog] of Object.entries(progressMap)) {
      if (remainingWordIds.has(id)) {
        newProgressMap[id] = prog;
      } else {
        progressChanged = true;
      }
    }
    if (progressChanged) {
      setProgressMap(newProgressMap);
      StorageService.saveProgress(newProgressMap);
    }

    // 4. 从当前词库列表中移除
    const remainingDecks = decks.filter(d => d.id !== deckId);
    setDecks(remainingDecks);
    StorageService.saveDecks(remainingDecks);

    // 5. 若删除的是当前选中的活跃词库，自动切换到剩余的首个词库
    if (settings.activeDeckId === deckId) {
      const nextActiveId = remainingDecks.length > 0 ? remainingDecks[0].id : '';
      updateSettings({ activeDeckId: nextActiveId });
    }
  };

  // 恢复所有被删除的官方内置词库
  const handleRestoreOfficialDecks = () => {
    const currentDeckIds = new Set(decks.map(d => d.id));
    const missingDecks = DECKS.filter(d => !currentDeckIds.has(d.id));
    if (missingDecks.length === 0) return;

    // 1. 从 deletedDeckIds 中撤销标记
    missingDecks.forEach(d => StorageService.unmarkDeckDeleted(d.id));

    // 2. 补回官方词库元数据
    const updatedDecks = [...decks, ...missingDecks];
    setDecks(updatedDecks);
    StorageService.saveDecks(updatedDecks);

    // 3. 补回官方词库对应的默认词汇
    const currentWordIds = new Set(words.map(w => w.id));
    const wordsToRestore = INITIAL_WORDS.filter(w => {
      const isBelonging = missingDecks.some(d => isWordInDeck(w, d));
      return isBelonging && !currentWordIds.has(w.id);
    });

    if (wordsToRestore.length > 0) {
      const updatedWords = [...words, ...wordsToRestore];
      setWords(updatedWords);
      StorageService.saveWords(updatedWords);
    }

    // 4. 若当前没有选中的活跃词库，自动选中第一个恢复的词库
    if (!settings.activeDeckId || !updatedDecks.some(d => d.id === settings.activeDeckId)) {
      updateSettings({ activeDeckId: updatedDecks[0].id });
    }

    confetti({ particleCount: 35, spread: 60 });
  };

  // 重新均分词库的 List (如改为每组 15/20/25/30 词)
  const handleRepartitionDeck = (deckId: string, wordsPerList: number) => {
    const updatedWords = repartitionDeckWords(words, deckId, wordsPerList);
    setWords(updatedWords);
    StorageService.saveWords(updatedWords);

    const updatedDecks = decks.map(d => {
      if (d.id === deckId) {
        return { ...d, wordsPerList };
      }
      return d;
    });
    setDecks(updatedDecks);
    StorageService.saveDecks(updatedDecks);
  };

  // 修改词条信息
  const handleUpdateWord = (updatedItem: WordItem) => {
    const updatedWords = words.map(w => w.id === updatedItem.id ? updatedItem : w);
    setWords(updatedWords);
    StorageService.saveWords(updatedWords);
  };

  // 批量修改词条信息
  const handleBatchUpdateWords = (updatedItems: WordItem[]) => {
    const updateMap = new Map(updatedItems.map(item => [item.id, item]));
    const updatedWords = words.map(w => updateMap.get(w.id) || w);
    setWords(updatedWords);
    StorageService.saveWords(updatedWords);
  };

  // 删除单个词条
  const handleDeleteWord = (wordId: string) => {
    const targetWord = words.find(w => w.id === wordId);
    const updatedWords = words.filter(w => w.id !== wordId);
    setWords(updatedWords);
    StorageService.saveWords(updatedWords);

    if (targetWord) {
      const targetDeckId = targetWord.deckId;
      const updatedDecks = decks.map(d => {
        if (d.id === targetDeckId && d.totalWords > 0) {
          return { ...d, totalWords: d.totalWords - 1 };
        }
        return d;
      });
      setDecks(updatedDecks);
      StorageService.saveDecks(updatedDecks);
    }
  };

  // 批量删除词条
  const handleBatchDeleteWords = (wordIds: string[]) => {
    const deleteSet = new Set(wordIds);
    const updatedWords = words.filter(w => !deleteSet.has(w.id));
    setWords(updatedWords);
    StorageService.saveWords(updatedWords);
  };

  // 清空全部数据
  const handleClearAllData = () => {
    StorageService.clearAllData();
    setWords(StorageService.loadWords());
    setDecks(StorageService.loadDecks());
    setProgressMap({});
    setSettings(StorageService.loadSettings());
    setFlashcardIndex(0);
    setClozeIndex(0);
    setSpellingIndex(0);
    setSpeedIndex(0);
    setIsCramActive(false);
    setCramQueue([]);
    setUndoHistory([]);
  };

  // 当前分卷单元与下一单元推导
  const currentListNum = typeof settings.activeListIndex === 'number' ? settings.activeListIndex : undefined;
  const currentListPos = currentListNum !== undefined ? deckListSummaries.findIndex(s => s.listIndex === currentListNum) : -1;
  const nextListSummary = currentListPos >= 0 && currentListPos < deckListSummaries.length - 1 ? deckListSummaries[currentListPos + 1] : undefined;

  return (
    <div className="min-h-screen neu-surface flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* 顶部硬件控制台导航栏 */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cognitiveState={cognitiveState}
        settings={settings}
        updateSettings={updateSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        dueCount={dueWordPairs.length}
        newCount={newWordPairs.length}
      />

      {/* 主体交互视口 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col items-center justify-center">
        
        {/* 学习模式 List 单元分卷硬件滑槽 */}
        {['flashcard', 'listen', 'cloze', 'spelling', 'speed'].includes(activeTab) && deckListSummaries.length > 1 && (
          <div className="w-full max-w-2xl mx-auto mb-5 neu-inset rounded-2xl p-2 flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-neu-muted whitespace-nowrap shrink-0">
              <Layers className="w-3.5 h-3.5 text-neu-sage" />
              <span className="tracking-wider uppercase text-[11px]">UNIT</span>
            </div>

            {deckListSummaries.length > 4 && (
              <button
                type="button"
                onClick={() => {
                  unitScrollRef.current?.scrollBy({ left: -220, behavior: 'smooth' });
                }}
                className="w-7 h-7 rounded-xl neu-btn-sm flex items-center justify-center text-neu-sub hover:text-neu-main shrink-0"
                title="向左滑动单元轨道"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}

            <div
              ref={unitScrollRef}
              onWheel={(e) => {
                if (e.deltaY !== 0 && unitScrollRef.current) {
                  unitScrollRef.current.scrollLeft += e.deltaY;
                }
              }}
              className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 px-1"
            >
              <button
                data-unit-active={!settings.activeListIndex || settings.activeListIndex === 'all' ? 'true' : undefined}
                onClick={() => updateSettings({ activeListIndex: 'all' })}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  !settings.activeListIndex || settings.activeListIndex === 'all'
                    ? 'neu-raised text-neu-main'
                    : 'text-neu-sub hover:text-neu-main'
                }`}
              >
                <span
                  className={`neu-led ${
                    !settings.activeListIndex || settings.activeListIndex === 'all'
                      ? 'neu-led-sage'
                      : 'neu-led-off'
                  }`}
                />
                <span>全部单元</span>
                <span className="text-[10px] text-neu-muted px-1.5 py-0.2 neu-inset-sm rounded-md font-mono">
                  {activeDeckWords.length}
                </span>
              </button>

              {deckListSummaries.map((summary) => {
                const isSelected = Number(settings.activeListIndex) === summary.listIndex;
                const completionRate = summary.totalWords > 0 
                  ? Math.round((summary.masteredWords / summary.totalWords) * 100) 
                  : 0;
                
                return (
                  <button
                    key={summary.listIndex}
                    data-unit-active={isSelected ? 'true' : undefined}
                    onClick={() => updateSettings({ activeListIndex: summary.listIndex })}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'neu-raised text-neu-main'
                        : 'text-neu-sub hover:text-neu-main'
                    }`}
                  >
                    <span
                      className={`neu-led ${
                        isSelected
                          ? 'neu-led-sage'
                          : completionRate === 100
                          ? 'neu-led-steel'
                          : 'neu-led-off'
                      }`}
                    />
                    <span>{summary.name}</span>
                    <span className="text-[10px] text-neu-muted px-1.5 py-0.2 neu-inset-sm rounded-md font-mono">
                      {summary.totalWords}
                    </span>
                    {completionRate > 0 && (
                      <span className="text-[10px] font-mono text-neu-sage">
                        {completionRate}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {deckListSummaries.length > 4 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    unitScrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
                  }}
                  className="w-7 h-7 rounded-xl neu-btn-sm flex items-center justify-center text-neu-sub hover:text-neu-main shrink-0"
                  title="向右滑动单元轨道"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <select
                  value={settings.activeListIndex === undefined || settings.activeListIndex === 'all' ? 'all' : String(settings.activeListIndex)}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateSettings({ activeListIndex: val === 'all' ? 'all' : Number(val) });
                  }}
                  className="px-2.5 py-1.5 rounded-xl neu-btn-sm text-[11px] font-mono font-bold text-neu-main bg-transparent outline-none cursor-pointer shrink-0"
                  title="快速跳转至指定分卷 List"
                >
                  <option value="all" className="bg-[var(--neu-bg)] text-neu-main">
                    全部 ({deckListSummaries.length}组)
                  </option>
                  {deckListSummaries.map((s) => (
                    <option key={s.listIndex} value={String(s.listIndex)} className="bg-[var(--neu-bg)] text-neu-main">
                      {s.name} ({s.totalWords}词)
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        {/* 1. 闪卡主动回忆模式 */}
        {activeTab === 'flashcard' && (
          currentFlashcard ? (
            <div className="w-full">
              {isCramActive && (
                <div className="w-full max-w-2xl mx-auto mb-4 px-4 py-2.5 neu-inset rounded-2xl flex items-center justify-between text-xs text-neu-main animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="neu-led neu-led-steel" />
                    <Sparkles className="w-3.5 h-3.5 text-neu-steel" />
                    <span className="font-semibold">巩固强化轮 · 第 {safeFlashcardIndex + 1} / {flashcardQueue.length} 词</span>
                  </div>
                  <button 
                    onClick={() => { setIsCramActive(false); setCramQueue([]); }}
                    className="text-xs font-semibold px-3 py-1 rounded-xl neu-btn-sm text-neu-sub hover:text-neu-main"
                  >
                    结束强化
                  </button>
                </div>
              )}
              <FlashcardRecall
                card={currentFlashcard}
                allWords={words}
                settings={settings}
                onRate={(rating, latency) => handleRateCard(currentFlashcard, rating, latency, 'flashcard')}
                onToggleStar={handleToggleStar}
                onUpdateWord={handleUpdateWord}
                canUndo={undoHistory.length > 0}
                lastRatedWordText={undoHistory.length > 0 ? undoHistory[undoHistory.length - 1].wordText : undefined}
                onUndo={handleUndoLastRating}
                remainingDue={dueWordPairs.length}
                remainingNew={newWordPairs.length}
              />
            </div>
          ) : (
            <EmptyQueueCelebration 
              onLearnMore={handleLearnMore}
              onSwitchMode={(tab) => {
                setActiveTab(tab);
                setClozeIndex(0);
                setSpellingIndex(0);
                setSpeedIndex(0);
              }}
              hasMoreNewWords={newWordPairs.length > 0}
              availablePracticeCount={practiceCards.length}
              currentListIndex={settings.activeListIndex}
              hasNextList={Boolean(nextListSummary)}
              nextListIndex={nextListSummary?.listIndex}
              onGoToNextList={() => {
                if (nextListSummary) {
                  updateSettings({ activeListIndex: nextListSummary.listIndex });
                }
              }}
              onGoToAllLists={() => updateSettings({ activeListIndex: 'all' })}
            />
          )
        )}

        {/* 1B. 单词速听模式（先英文读音 -> 后中文读第一个意思） */}
        {activeTab === 'listen' && (
          walkmanCards.length > 0 ? (
            <AudioWalkman
              cards={walkmanCards}
              settings={settings}
              onToggleStar={handleToggleStar}
              activeDeckName={activeDeck?.name}
              activeListIndex={settings.activeListIndex}
            />
          ) : (
            <EmptyDeckNotice onGoToDecks={() => setActiveTab('decks')} />
          )
        )}

        {/* 2. 语境挖空模式 */}
        {activeTab === 'cloze' && (
          currentClozeCard ? (
            <ContextCloze
              card={currentClozeCard}
              settings={settings}
              onRate={(rating, latency) => handleRateCard(currentClozeCard, rating, latency, 'cloze')}
              onNext={() => setClozeIndex(idx => (idx + 1) % Math.max(1, clozeQueue.length))}
            />
          ) : (
            <EmptyDeckNotice onGoToDecks={() => setActiveTab('decks')} />
          )
        )}

        {/* 3. 听写拼写测验模式 */}
        {activeTab === 'spelling' && (
          currentSpellingCard ? (
            <SpellingQuiz
              card={currentSpellingCard}
              settings={settings}
              onRate={(rating, latency) => handleRateCard(currentSpellingCard, rating, latency, 'spelling')}
              onNext={() => setSpellingIndex(idx => (idx + 1) % Math.max(1, spellingQueue.length))}
            />
          ) : (
            <EmptyDeckNotice onGoToDecks={() => setActiveTab('decks')} />
          )
        )}

        {/* 4. 极限速刷模式 */}
        {activeTab === 'speed' && (
          currentSpeedCard ? (
            <SpeedReview
              card={currentSpeedCard}
              allWords={words}
              settings={settings}
              onRate={(rating, latency) => handleRateCard(currentSpeedCard, rating, latency, 'speed')}
              onNext={() => setSpeedIndex(idx => (idx + 1) % Math.max(1, speedQueue.length))}
            />
          ) : (
            <EmptyDeckNotice onGoToDecks={() => setActiveTab('decks')} />
          )
        )}

        {/* 5. 记忆科学画像与统计 */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            words={words}
            progressMap={progressMap}
            cognitiveState={cognitiveState}
            deckListSummaries={deckListSummaries}
            activeDeckName={activeDeck?.name}
            activeListIndex={settings.activeListIndex}
            onSelectListToStudy={(listIdx) => {
              updateSettings({ activeListIndex: listIdx });
              setActiveTab('flashcard');
            }}
          />
        )}

        {/* 6. 词库与词表管理 */}
        {activeTab === 'decks' && (
          <WordListManager
            words={words}
            decks={decks}
            progressMap={progressMap}
            activeDeckId={settings.activeDeckId}
            activeListIndex={settings.activeListIndex}
            onSelectDeck={(deckId) => updateSettings({ activeDeckId: deckId })}
            onSelectActiveList={(listIdx) => updateSettings({ activeListIndex: listIdx })}
            onRepartitionDeck={handleRepartitionDeck}
            onCreateDeck={handleCreateDeck}
            onUpdateDeck={handleUpdateDeck}
            onDeleteDeck={handleDeleteDeck}
            onAddWordOrPhrase={handleAddWordOrPhrase}
            onUpdateWord={handleUpdateWord}
            onBatchUpdateWords={handleBatchUpdateWords}
            onDeleteWord={handleDeleteWord}
            onBatchDeleteWords={handleBatchDeleteWords}
            onToggleStar={handleToggleStar}
            onImportWords={handleImportWords}
            onRestoreBackup={handleRestoreBackup}
            onResetWordProgress={handleResetWordProgress}
            onRestoreOfficialDecks={handleRestoreOfficialDecks}
            accent={settings.accent}
          />
        )}
      </main>

      {/* 偏好设置 Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        updateSettings={updateSettings}
        onClearAllData={handleClearAllData}
      />
    </div>
  );
}

// 今日复习完成通关纪念面板
function EmptyQueueCelebration({ 
  onLearnMore, 
  onSwitchMode,
  hasMoreNewWords,
  availablePracticeCount,
  currentListIndex,
  hasNextList,
  nextListIndex,
  onGoToNextList,
  onGoToAllLists,
}: { 
  onLearnMore: () => void; 
  onSwitchMode: (tab: TabType) => void;
  hasMoreNewWords: boolean;
  availablePracticeCount: number;
  currentListIndex?: number | 'all';
  hasNextList?: boolean;
  nextListIndex?: number;
  onGoToNextList?: () => void;
  onGoToAllLists?: () => void;
}) {
  const isSpecificList = typeof currentListIndex === 'number';

  return (
    <div className="w-full max-w-lg mx-auto neu-panel rounded-3xl p-8 text-center animate-scale-up">
      <div className="w-16 h-16 rounded-2xl neu-inset text-neu-sage mx-auto flex items-center justify-center mb-5">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <h2 className="text-xl font-bold text-neu-main mb-2 tracking-tight">
        {isSpecificList 
          ? `List ${currentListIndex} · 今日记忆配额已达成` 
          : '今日记忆配额已达成'}
      </h2>

      <p className="text-xs text-neu-sub mb-7 leading-relaxed px-2">
        {isSpecificList
          ? `根据 FSRS 记忆曲线，您在【List ${currentListIndex}】内的到期词汇已完成巩固。可切换至下一分卷或开启语境填空。`
          : '根据 FSRS 记忆曲线，当前词库内到期单词已完成有效强化。适度留白有助于大脑进行突触整合。'}
      </p>

      <div className="flex flex-col gap-3">
        {isSpecificList && hasNextList && nextListIndex && onGoToNextList && (
          <button
            onClick={onGoToNextList}
            className="w-full py-3.5 rounded-2xl neu-btn font-bold text-sm text-neu-sage flex items-center justify-center gap-2"
          >
            <span className="neu-led neu-led-sage" />
            <ArrowRight className="w-4 h-4" />
            <span>继续学习【List {nextListIndex}】</span>
          </button>
        )}

        <button
          onClick={onLearnMore}
          className="w-full py-3.5 rounded-2xl neu-btn font-semibold text-sm text-neu-main flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-4 h-4 text-neu-sage" />
          <span>
            {hasMoreNewWords 
              ? '学有余力 · 再加 10 个新词' 
              : '学有余力 · 开启 10 词强化巩固轮'}
          </span>
        </button>

        {isSpecificList && onGoToAllLists && (
          <button
            onClick={onGoToAllLists}
            className="w-full py-3 rounded-2xl neu-btn-sm text-neu-sub hover:text-neu-main font-semibold text-xs flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4 text-neu-muted" />
            <span>切换为整书复习 (全部单元)</span>
          </button>
        )}

        <button
          onClick={() => onSwitchMode('cloze')}
          className="w-full py-3.5 rounded-2xl neu-btn font-semibold text-sm text-neu-steel flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-neu-steel" />
          <span>
            进入语境填空深度巩固 {availablePracticeCount > 0 ? `(${availablePracticeCount} 词)` : ''}
          </span>
        </button>

        <button
          onClick={() => onSwitchMode('analytics')}
          className="w-full py-2.5 mt-1 rounded-xl text-neu-muted hover:text-neu-main text-xs font-medium transition-colors"
        >
          查看记忆留存画像与稳定性漏斗
        </button>
      </div>
    </div>
  );
}

// 词库无词提醒面板
function EmptyDeckNotice({ onGoToDecks }: { onGoToDecks: () => void }) {
  return (
    <div className="w-full max-w-md mx-auto neu-panel rounded-3xl p-8 text-center animate-scale-up">
      <div className="w-14 h-14 rounded-2xl neu-inset text-neu-amber mx-auto flex items-center justify-center mb-4">
        <BookOpen className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-neu-main mb-2">
        当前词库暂无可练习词汇
      </h3>
      <p className="text-xs text-neu-sub mb-6">
        请先在词库管理中添加单词、短语，或导入大纲词库。
      </p>
      <button
        onClick={onGoToDecks}
        className="w-full py-3.5 rounded-2xl neu-btn font-semibold text-xs text-neu-sage flex items-center justify-center gap-2"
      >
        <span>前往词库管理</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default App;
