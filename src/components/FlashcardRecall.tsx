import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  Star, 
  Clock, 
  Sparkles, 
  Target,
  Lightbulb,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Check,
  Loader2
} from 'lucide-react';
import { WordItem, WordProgress, Rating, UserSettings } from '../types';
import { SpeechService } from '../utils/speech';
import { TactileSoundService } from '../utils/soundEffects';
import { defaultFsrs } from '../algorithms/fsrs';
import { generateSmartDistractors } from '../utils/distractors';
import { parseMeanings, cleanEnglishDefinition, cleanDuplicatePos } from '../utils/formatTranslation';
import { lookupWordSmart } from '../utils/smartLookup';
import confetti from 'canvas-confetti';

interface FlashcardRecallProps {
  card: { word: WordItem; progress: WordProgress };
  allWords: WordItem[];
  settings: UserSettings;
  onRate: (rating: Rating, latencyMs: number) => void;
  onToggleStar: (wordId: string) => void;
  remainingDue: number;
  remainingNew: number;
  canUndo?: boolean;
  lastRatedWordText?: string;
  onUndo?: () => void;
  onUpdateWord?: (updatedWord: WordItem) => void;
}

export const FlashcardRecall: React.FC<FlashcardRecallProps> = ({
  card,
  allWords,
  settings,
  onRate,
  onToggleStar,
  remainingDue,
  remainingNew,
  canUndo = false,
  lastRatedWordText,
  onUndo,
  onUpdateWord,
}) => {
  const { word, progress } = card;
  const [isRevealed, setIsRevealed] = useState(false);
  const [useQuizMode, setUseQuizMode] = useState<boolean>(() => {
    return localStorage.getItem('vocab_use_quiz_mode') === 'true';
  });
  const [quizOptions, setQuizOptions] = useState<WordItem[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [suggestedRating, setSuggestedRating] = useState<Rating | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [showAllMeanings, setShowAllMeanings] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  // 原地快速编辑弹窗状态
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [editWordText, setEditWordText] = useState(word.word);
  const [editPhonetic, setEditPhonetic] = useState(word.phonetic_us || '');
  const [editPos, setEditPos] = useState(word.pos || '');
  const [editTranslation, setEditTranslation] = useState(word.translation || '');
  const [editDefinitionEn, setEditDefinitionEn] = useState(word.definition_en || '');
  const [editExampleEn, setEditExampleEn] = useState(word.example_en || '');
  const [editExampleZh, setEditExampleZh] = useState(word.example_zh || '');
  const [editRootsAffixes, setEditRootsAffixes] = useState(word.roots_affixes || '');
  const [editMnemonic, setEditMnemonic] = useState(word.mnemonic || '');
  const [editListIndex, setEditListIndex] = useState<number>(word.listIndex || 1);
  const [isEditEnriching, setIsEditEnriching] = useState(false);

  const openQuickEdit = () => {
    setEditWordText(word.word);
    setEditPhonetic(word.phonetic_us || '');
    setEditPos(word.pos || '');
    setEditTranslation(word.translation || '');
    setEditDefinitionEn(word.definition_en || '');
    setEditExampleEn(word.example_en || '');
    setEditExampleZh(word.example_zh || '');
    setEditRootsAffixes(word.roots_affixes || '');
    setEditMnemonic(word.mnemonic || '');
    setEditListIndex(word.listIndex || 1);
    setIsQuickEditOpen(true);
  };

  const handleQuickEditSmartEnrich = async () => {
    if (!editWordText.trim() || isEditEnriching) return;
    setIsEditEnriching(true);
    try {
      const res = await lookupWordSmart(editWordText.trim());
      if (res.phonetic_us) setEditPhonetic(res.phonetic_us);
      if (res.pos) setEditPos(res.pos);
      if (res.translation) setEditTranslation(res.translation);
      if (res.definition_en) setEditDefinitionEn(res.definition_en);
      if (res.example_en) setEditExampleEn(res.example_en);
      if (res.example_zh) setEditExampleZh(res.example_zh);
      if (res.roots_affixes) setEditRootsAffixes(res.roots_affixes);
      if (res.mnemonic) setEditMnemonic(res.mnemonic);
    } finally {
      setIsEditEnriching(false);
    }
  };

  const handleSaveQuickEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateWord || !editWordText.trim() || !editTranslation.trim()) return;
    onUpdateWord({
      ...word,
      word: editWordText.trim(),
      phonetic_us: editPhonetic.trim(),
      pos: editPos.trim() || undefined,
      translation: cleanDuplicatePos(editTranslation.trim()),
      definition_en: editDefinitionEn.trim(),
      example_en: editExampleEn.trim(),
      example_zh: editExampleZh.trim(),
      roots_affixes: editRootsAffixes.trim() || undefined,
      mnemonic: editMnemonic.trim() || undefined,
      listIndex: Math.max(1, editListIndex || 1),
    });
    setIsQuickEditOpen(false);
  };

  const toggleQuizMode = () => {
    const nextVal = !useQuizMode;
    setUseQuizMode(nextVal);
    localStorage.setItem('vocab_use_quiz_mode', String(nextVal));
  };

  // 初始化每张卡片（隐式记录回忆耗时，不在界面显示读秒计时器以免分散注意力）
  useEffect(() => {
    setIsRevealed(false);
    setShowAllMeanings(false);
    setSelectedOptionId(null);
    setSuggestedRating(null);
    setElapsedMs(0);
    setIsQuickEditOpen(false);

    // 隐式计时起点：读完发音后再启动回忆耗时统计
    const startTiming = () => {
      setIsAudioPlaying(false);
      const timerStart = Date.now();
      setStartTime(timerStart);
      timerRef.current = timerStart;
    };

    // 自动发音处理：如果开启了自动发音，等待音频播放完毕后记录计时起点
    const initialNow = Date.now();
    setStartTime(initialNow);
    timerRef.current = initialNow;

    if (settings.autoPlayAudio) {
      setIsAudioPlaying(true);
      SpeechService.speak(word.word, settings.accent, 0.95, () => {
        startTiming();
      });
    } else {
      setIsAudioPlaying(false);
      startTiming();
    }

    // 准备高辨识度无语义重叠智能干扰项
    const distractors = generateSmartDistractors(word, allWords, 3);
    const options = [word, ...distractors].sort(() => Math.random() - 0.5);
    setQuizOptions(options);

    return () => {
      SpeechService.stop();
    };
  }, [word.id, settings.autoPlayAudio, settings.accent]);

  // 翻卡或作答：隐式结算提取耗时并停止发音
  const handleReveal = () => {
    SpeechService.stop();
    const baseStart = timerRef.current || startTime;
    const latency = isAudioPlaying ? 0 : Math.max(0, Date.now() - baseStart);
    setIsAudioPlaying(false);
    setElapsedMs(latency);
    setIsRevealed(true);
  };

  const handleSelectOption = (option: WordItem) => {
    if (selectedOptionId) return;
    SpeechService.stop();
    
    // 若在读完前已抢答，提取耗时直接为 0ms；否则隐式计算真实回忆耗时
    const baseStart = timerRef.current || startTime;
    const latency = isAudioPlaying ? 0 : Math.max(0, Date.now() - baseStart);
    setIsAudioPlaying(false);
    setElapsedMs(latency);
    setSelectedOptionId(option.id);
    setIsRevealed(true);

    const isCorrect = option.id === word.id;
    if (isCorrect) {
      TactileSoundService.playSuccess();
      if (latency < 2000) {
        setSuggestedRating(Rating.Easy);
      } else if (latency < 4500) {
        setSuggestedRating(Rating.Good);
      } else {
        setSuggestedRating(Rating.Hard);
      }
      try {
        confetti({
          particleCount: 30,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch (e) {
        // ignore
      }
    } else {
      TactileSoundService.playError();
      setSuggestedRating(Rating.Again);
    }
  };

  const handleGrade = (rating: Rating) => {
    SpeechService.stop();
    if (rating === Rating.Again) {
      TactileSoundService.playError();
    } else {
      TactileSoundService.playSuccess();
    }
    const baseStart = timerRef.current || startTime;
    const latency = elapsedMs > 0 ? elapsedMs : (isAudioPlaying ? 0 : Math.max(0, Date.now() - baseStart));
    onRate(rating, latency);
  };

  // 键盘快捷键支持
  useEffect(() => {
    if (!settings.keyboardShortcutsEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isQuickEditOpen) return;
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
        return;
      }

      // Ctrl+Z 或 Cmd+Z 撤回上一次评分
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (canUndo && onUndo) {
          e.preventDefault();
          onUndo();
        }
        return;
      }

      // E 键原地打开编辑弹窗
      if (e.key === 'e' || e.key === 'E') {
        if (onUpdateWord) {
          e.preventDefault();
          openQuickEdit();
        }
        return;
      }

      // 辨析模式下未作答前：A/B/C/D 或 1/2/3/4 选择对应项
      if (useQuizMode && !selectedOptionId) {
        const key = e.key.toLowerCase();
        if (key === 'a' || key === '1') {
          e.preventDefault();
          if (quizOptions[0]) handleSelectOption(quizOptions[0]);
          return;
        }
        if (key === 'b' || key === '2') {
          e.preventDefault();
          if (quizOptions[1]) handleSelectOption(quizOptions[1]);
          return;
        }
        if (key === 'c' || key === '3') {
          e.preventDefault();
          if (quizOptions[2]) handleSelectOption(quizOptions[2]);
          return;
        }
        if (key === 'd' || key === '4') {
          e.preventDefault();
          if (quizOptions[3]) handleSelectOption(quizOptions[3]);
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isRevealed) {
          handleReveal();
        } else {
          // 已翻开时，按空格使用推荐评分或默认 Good
          handleGrade(suggestedRating ?? Rating.Good);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        SpeechService.speak(word.word, settings.accent);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        onToggleStar(word.id);
      } else if (isRevealed) {
        if (e.key === '1') handleGrade(Rating.Again);
        if (e.key === '2') handleGrade(Rating.Hard);
        if (e.key === '3') handleGrade(Rating.Good);
        if (e.key === '4') handleGrade(Rating.Easy);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, elapsedMs, word, settings, useQuizMode, selectedOptionId, quizOptions, suggestedRating, canUndo, onUndo, isQuickEditOpen]);

  // 计算 FSRS 预估下次间隔
  const getPredictedInterval = (rating: Rating): string => {
    const sim = defaultFsrs.reviewCard(progress, rating, elapsedMs, settings, 'flashcard');
    if (rating === Rating.Again) return '10分钟后';
    const days = sim.log.scheduledDays;
    if (days < 1) return '< 1天';
    if (days === 1) return '1天后';
    if (days < 30) return `${days}天后`;
    if (days < 365) return `${(days / 30).toFixed(1)}个月后`;
    return `${(days / 365).toFixed(1)}年后`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5 animate-fade-in">
      {/* 顶部仪表状态槽（反应耗时已改为后台隐式记录，避免读秒计时器分散注意力） */}
      <div className="flex items-center justify-between px-1 text-xs text-neu-sub flex-wrap gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl neu-inset-sm">
            <span className="neu-led neu-led-steel"></span>
            <span className="text-neu-muted">新词</span>
            <strong className="font-mono text-neu-main">{remainingNew}</strong>
          </span>
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl neu-inset-sm">
            <span className="neu-led neu-led-amber"></span>
            <span className="text-neu-muted">待复习</span>
            <strong className="font-mono text-neu-main">{remainingDue}</strong>
          </span>

          {canUndo && onUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="px-3 py-1.5 rounded-xl neu-btn-sm text-neu-sub hover:text-neu-main font-semibold flex items-center gap-1.5 animate-fade-in"
              title="撤回上一张卡片的评分 (快捷键 Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neu-amber" />
              <span>撤回{lastRatedWordText ? ` (${lastRatedWordText})` : ''}</span>
            </button>
          )}
        </div>

        {/* 声学朗读状态指示（仅在自动发音播放期间静默提示） */}
        {isAudioPlaying && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-inset-sm font-mono text-neu-sage text-[11px]">
            <span className="neu-led neu-led-sage animate-pulse" />
            <Volume2 className="w-3.5 h-3.5" />
            <span>声学朗读中</span>
          </div>
        )}
      </div>

      {/* 主新拟态声学词卡面板 */}
      <div className="relative neu-panel rounded-3xl p-6 sm:p-9 transition-all flex flex-col min-h-[430px]">
        
        {/* 面板顶部铭牌与轻触开关 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {(word.isPhrase || word.word.includes(' ')) && (
              <span className="px-2.5 py-1 text-[11px] font-semibold tracking-wide neu-inset-sm text-neu-steel rounded-lg">
                PHRASE · 短语
              </span>
            )}
            {word.listIndex && (
              <span className="px-2.5 py-1 text-[11px] font-mono font-semibold neu-inset-sm text-neu-sage rounded-lg">
                List {word.listIndex}
              </span>
            )}
            {word.tags.map(tag => (
              <span key={tag} className="px-2.5 py-1 text-[11px] font-medium tracking-wide neu-inset-sm text-neu-sub rounded-lg">
                {tag}
              </span>
            ))}
            {progress.reps > 0 && (
              <span className="px-2.5 py-1 text-[11px] font-mono neu-inset-sm text-neu-sage rounded-lg">
                S:{progress.stability}d · D:{progress.difficulty}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleQuizMode}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                useQuizMode 
                  ? 'neu-btn-sm neu-btn-sm-active text-neu-sage' 
                  : 'neu-btn-sm text-neu-sub hover:text-neu-main'
              }`}
              title="切换形近词/释义辨析选择模式"
            >
              <span className={`neu-led ${useQuizMode ? 'neu-led-sage' : 'neu-led-off'}`} />
              <Target className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">辨析模式</span>
            </button>

            {onUpdateWord && (
              <button
                type="button"
                onClick={openQuickEdit}
                className="w-9 h-9 rounded-xl neu-btn-sm text-neu-muted hover:text-neu-sage flex items-center justify-center transition-all"
                title="原地快速编辑词条/助记/分卷 (快捷键 E)"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => onToggleStar(word.id)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                progress.isStarred
                  ? 'neu-btn-sm neu-btn-sm-active text-neu-amber'
                  : 'neu-btn-sm text-neu-muted hover:text-neu-main'
              }`}
              title="收藏到重点词本 (快捷键 S)"
            >
              <Star className={`w-4 h-4 ${progress.isStarred ? 'fill-current text-neu-amber' : ''}`} />
            </button>
          </div>
        </div>

        {/* 单词主体展示区 (主动回忆正面) */}
        <div className="text-center my-auto py-5">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-neu-main">
              {word.word}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => SpeechService.speak(word.word, settings.accent)}
                className="w-11 h-11 rounded-full neu-btn flex items-center justify-center text-neu-sage shrink-0"
                title="播放英文发音 (快捷键 R)"
              >
                <Volume2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  SpeechService.speakBilingual(word.word, word.translation, {
                    accent: settings.accent,
                  })
                }
                className="px-3 h-11 rounded-2xl neu-btn-sm flex items-center justify-center gap-1 text-[11px] font-mono font-bold text-neu-steel hover:text-neu-sage shrink-0"
                title="单词速听：先播放英文读音，再用中文读一遍第一个意思"
              >
                <span>EN+中</span>
              </button>
            </div>
          </div>

          {word.phonetic_us && (
            <div className="mt-3">
              <span className="inline-block px-3.5 py-1 rounded-xl neu-inset-sm font-mono text-neu-sub text-sm">
                {word.phonetic_us}
              </span>
            </div>
          )}

          {/* 形近词/释义智能辨析实体矩阵键 */}
          {useQuizMode && (
            <div className="mt-8 max-w-xl mx-auto w-full text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quizOptions.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isCorrect = opt.id === word.id;
                  const isSelected = selectedOptionId === opt.id;
                  
                  let btnStyle = "neu-btn text-neu-main";
                  let badgeStyle = "neu-inset-sm text-neu-sub";
                  let ledClass = "neu-led-off";

                  if (selectedOptionId) {
                    if (isCorrect) {
                      btnStyle = "neu-inset text-neu-sage font-semibold";
                      badgeStyle = "neu-raised text-neu-sage";
                      ledClass = "neu-led-sage";
                    } else if (isSelected) {
                      btnStyle = "neu-inset text-neu-coral line-through opacity-85";
                      badgeStyle = "neu-raised text-neu-coral";
                      ledClass = "neu-led-coral";
                    } else {
                      btnStyle = "neu-raised text-neu-muted opacity-45";
                      badgeStyle = "neu-inset-sm text-neu-muted";
                    }
                  }

                  return (
                    <button
                      key={opt.id}
                      disabled={!!selectedOptionId}
                      onClick={() => handleSelectOption(opt)}
                      className={`p-3.5 text-left rounded-2xl transition-all flex items-center justify-between group ${btnStyle}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-mono font-bold shrink-0 ${badgeStyle}`}>
                          {letter}
                        </span>
                        <span className="text-sm line-clamp-2">
                          {opt.translation}
                        </span>
                      </div>
                      <span className={`neu-led ml-2 ${ledClass}`} />
                    </button>
                  );
                })}
              </div>

              {/* 答题反馈状态槽 */}
              {selectedOptionId && (
                <div className="mt-3.5 px-4 py-2.5 rounded-xl neu-inset-sm text-xs font-medium flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-2">
                    {selectedOptionId === word.id ? (
                      <>
                        <span className="neu-led neu-led-sage" />
                        <span className="text-neu-sage font-semibold">辨析正确 · 耗时 {latencySeconds}s</span>
                      </>
                    ) : (
                      <>
                        <span className="neu-led neu-led-coral" />
                        <span className="text-neu-coral font-semibold">辨析失误 · 已标记为重学</span>
                      </>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-neu-muted">
                    [Space] 确认继续
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 背面释义与语境显示屏区 */}
        {isRevealed ? (
          <div className="mt-5 pt-5 animate-fade-in flex flex-col gap-4 text-left">
            <div className="neu-groove-h mb-1" />
            
            {/* 中文核心考意与英文释义凹槽 */}
            <div className="neu-inset p-4 sm:p-5 rounded-2xl">
              {(() => {
                const parsed = parseMeanings(word.translation, word.pos);
                const cleanDef = cleanEnglishDefinition(word.definition_en, word.word, word.pos);
                let displayPos = (word.pos || parsed.pos || '').trim();
                let displayCore = cleanDuplicatePos(parsed.coreText);
                const leadingPosMatch = displayCore.match(/^([a-z]{1,6}\.)\s*/i);
                if (leadingPosMatch) {
                  displayPos = leadingPosMatch[1].toLowerCase();
                  displayCore = displayCore.slice(leadingPosMatch[0].length).trim();
                }

                return (
                  <div className="flex flex-col gap-2.5">
                    <div className="text-base sm:text-lg font-bold text-neu-main flex items-baseline flex-wrap gap-2.5">
                      {displayPos && (
                        <span className="text-neu-sage text-sm font-mono font-bold px-2 py-0.5 rounded-lg neu-raised">
                          {displayPos}
                        </span>
                      )}
                      <span>{displayCore}</span>
                      {parsed.hasExtended && (
                        <button
                          type="button"
                          onClick={() => setShowAllMeanings(!showAllMeanings)}
                          className="text-xs px-3 py-1 rounded-xl neu-btn-sm text-neu-steel font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>{showAllMeanings ? '收起完整释义' : `+${parsed.extendedItems.length} 延伸释义`}</span>
                          {showAllMeanings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>

                    {showAllMeanings && parsed.hasExtended && (
                      <div className="p-3.5 rounded-xl neu-raised text-xs text-neu-sub animate-fade-in space-y-1">
                        <div className="text-[11px] font-semibold text-neu-muted">完整 / 延伸考意：</div>
                        <div className="leading-relaxed text-neu-main">{parsed.extendedText}</div>
                      </div>
                    )}

                    {cleanDef && (
                      <p className="text-xs text-neu-sub italic font-mono pt-0.5">
                        {cleanDef}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 词根词缀与科学助记模块 */}
            {(word.roots_affixes || word.mnemonic) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {word.roots_affixes && (
                  <div className="p-4 rounded-2xl neu-raised text-xs">
                    <div className="flex items-center gap-2 font-semibold text-neu-steel mb-1.5">
                      <span className="neu-led neu-led-steel" />
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>词根词缀剖析</span>
                    </div>
                    <p className="text-neu-sub leading-relaxed">{word.roots_affixes}</p>
                  </div>
                )}
                {word.mnemonic && (
                  <div className="p-4 rounded-2xl neu-raised text-xs">
                    <div className="flex items-center gap-2 font-semibold text-neu-amber mb-1.5">
                      <span className="neu-led neu-led-amber" />
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>认知联想助记</span>
                    </div>
                    <p className="text-neu-sub leading-relaxed">{word.mnemonic}</p>
                  </div>
                )}
              </div>
            )}

            {/* 真实情境例句凹槽 */}
            <div className="p-4 rounded-2xl neu-inset">
              <div className="flex items-center justify-between mb-1.5">
                <span className="neu-label">CONTEXT · 语境共现例句</span>
                <button
                  onClick={() => SpeechService.speak(word.example_en, settings.accent, 0.9)}
                  className="w-7 h-7 rounded-lg neu-btn-sm flex items-center justify-center text-neu-sub hover:text-neu-sage"
                  title="朗读完整例句"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm font-medium text-neu-main leading-relaxed">
                {word.example_en}
              </p>
              <p className="text-xs text-neu-sub mt-1">
                {word.example_zh}
              </p>
            </div>

            {/* 同义词 */}
            {word.synonyms && word.synonyms.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-neu-sub px-1">
                <span className="neu-label">SYNONYMS:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {word.synonyms.map(syn => (
                    <span key={syn} className="px-2.5 py-0.5 rounded-lg neu-inset-sm font-mono text-neu-main">
                      {syn}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          !useQuizMode && (
            <div className="mt-8 flex flex-col items-center justify-center gap-3">
              <button
                onClick={handleReveal}
                className="w-full sm:w-auto px-9 py-4 rounded-2xl neu-btn font-bold text-sm text-neu-main flex items-center justify-center gap-3"
              >
                <span className="neu-led neu-led-sage" />
                <span>轻触翻开 · 检验主动回忆</span>
                <span className="px-2 py-0.5 text-[11px] neu-inset-sm text-neu-muted rounded-md font-mono hidden sm:inline">
                  Space
                </span>
              </button>
              <p className="text-[11px] text-neu-muted">
                先在脑海中检索词义与发音，再按下按键核对
              </p>
            </div>
          )
        )}
      </div>

      {/* 底部 FSRS 四阶实体机械琴键 (主动回忆反馈控制器) */}
      {isRevealed && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 animate-scale-up">
          {/* 1. Again */}
          <button
            onClick={() => handleGrade(Rating.Again)}
            className="p-4 rounded-2xl neu-btn flex flex-col items-center justify-center gap-1.5 relative group"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-neu-main">
              <span className="neu-led neu-led-coral" />
              <span>忘记</span>
              <span className="px-1.5 py-0.2 text-[10px] neu-inset-sm text-neu-muted rounded font-mono">1</span>
              {suggestedRating === Rating.Again && (
                <span className="text-[10px] neu-inset-sm text-neu-coral px-1.5 py-0.2 rounded font-semibold">推荐</span>
              )}
            </div>
            <span className="text-[11px] text-neu-coral font-mono">
              {getPredictedInterval(Rating.Again)}
            </span>
          </button>

          {/* 2. Hard */}
          <button
            onClick={() => handleGrade(Rating.Hard)}
            className="p-4 rounded-2xl neu-btn flex flex-col items-center justify-center gap-1.5 relative group"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-neu-main">
              <span className="neu-led neu-led-amber" />
              <span>困难</span>
              <span className="px-1.5 py-0.2 text-[10px] neu-inset-sm text-neu-muted rounded font-mono">2</span>
              {suggestedRating === Rating.Hard && (
                <span className="text-[10px] neu-inset-sm text-neu-amber px-1.5 py-0.2 rounded font-semibold">推荐</span>
              )}
            </div>
            <span className="text-[11px] text-neu-amber font-mono">
              {getPredictedInterval(Rating.Hard)}
            </span>
          </button>

          {/* 3. Good */}
          <button
            onClick={() => handleGrade(Rating.Good)}
            className="p-4 rounded-2xl neu-btn flex flex-col items-center justify-center gap-1.5 relative group"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-neu-main">
              <span className="neu-led neu-led-sage" />
              <span>掌握</span>
              <span className="px-1.5 py-0.2 text-[10px] neu-inset-sm text-neu-muted rounded font-mono">3</span>
              {suggestedRating === Rating.Good && (
                <span className="text-[10px] neu-inset-sm text-neu-sage px-1.5 py-0.2 rounded font-semibold">推荐</span>
              )}
            </div>
            <span className="text-[11px] text-neu-sage font-mono">
              {getPredictedInterval(Rating.Good)}
            </span>
          </button>

          {/* 4. Easy */}
          <button
            onClick={() => handleGrade(Rating.Easy)}
            className="p-4 rounded-2xl neu-btn flex flex-col items-center justify-center gap-1.5 relative group"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-neu-main">
              <span className="neu-led neu-led-steel" />
              <span>秒杀</span>
              <span className="px-1.5 py-0.2 text-[10px] neu-inset-sm text-neu-muted rounded font-mono">4</span>
              {suggestedRating === Rating.Easy && (
                <span className="text-[10px] neu-inset-sm text-neu-steel px-1.5 py-0.2 rounded font-semibold">推荐</span>
              )}
            </div>
            <span className="text-[11px] text-neu-steel font-mono">
              {getPredictedInterval(Rating.Easy)}
            </span>
          </button>
        </div>
      )}

      {/* 原地快速编辑词条 Modal */}
      {isQuickEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-panel rounded-3xl max-w-lg w-full animate-scale-up max-h-[90vh] flex flex-col overflow-hidden text-left">
            <div className="px-6 sm:px-7 pt-6 sm:pt-7 pb-3 shrink-0">
              <div className="flex items-start justify-between gap-3 pb-3">
                <div>
                  <h3 className="text-base font-bold text-neu-main flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg neu-inset-sm flex items-center justify-center text-neu-sage shrink-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </div>
                    <span>现场微调词条：{word.word}</span>
                  </h3>
                  <p className="text-[11px] text-neu-muted mt-1">
                    背词过程中随时补充专属口诀、修订释义或调整分卷 List，保存后即时生效
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickEditOpen(false)}
                  className="w-8 h-8 rounded-xl neu-btn-sm flex items-center justify-center shrink-0 text-neu-muted hover:text-neu-main"
                  title="关闭窗口"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="neu-groove-h" />
            </div>

            <form onSubmit={handleSaveQuickEdit} className="px-6 sm:px-7 pb-6 sm:pb-7 pt-3 space-y-3 text-xs overflow-y-auto flex-1">
              <div>
                <label className="font-semibold text-neu-sub mb-1 block">英文单词 / 短语 *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={editWordText}
                    onChange={e => setEditWordText(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl neu-input font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleQuickEditSmartEnrich}
                    disabled={!editWordText.trim() || isEditEnriching}
                    className="px-3 py-2 rounded-xl neu-btn text-neu-main font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-40"
                  >
                    {isEditEnriching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-neu-amber" />
                        <span>同步中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-neu-amber" />
                        <span>智能补全</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">美式音标</label>
                  <input
                    type="text"
                    value={editPhonetic}
                    onChange={e => setEditPhonetic(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl neu-input font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">词性</label>
                  <input
                    type="text"
                    value={editPos}
                    onChange={e => setEditPos(e.target.value)}
                    placeholder="n. / v. / adj."
                    className="w-full px-3 py-2 rounded-xl neu-input font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">所属 List 单元</label>
                  <input
                    type="number"
                    min={1}
                    value={editListIndex}
                    onChange={e => setEditListIndex(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 rounded-xl neu-input font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-neu-sub mb-1 block">中文释义 *</label>
                <input
                  type="text"
                  required
                  value={editTranslation}
                  onChange={e => setEditTranslation(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl neu-input"
                />
              </div>

              <div>
                <label className="font-semibold text-neu-sub mb-1 block">专属记忆口诀 / 助记笔记</label>
                <input
                  type="text"
                  value={editMnemonic}
                  onChange={e => setEditMnemonic(e.target.value)}
                  placeholder="输入你的谐音、联想或真题语境笔记..."
                  className="w-full px-3.5 py-2 rounded-xl neu-input"
                />
              </div>

              <div>
                <label className="font-semibold text-neu-sub mb-1 block">词根词缀剖析</label>
                <input
                  type="text"
                  value={editRootsAffixes}
                  onChange={e => setEditRootsAffixes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl neu-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">英文例句</label>
                  <input
                    type="text"
                    value={editExampleEn}
                    onChange={e => setEditExampleEn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl neu-input font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">例句翻译</label>
                  <input
                    type="text"
                    value={editExampleZh}
                    onChange={e => setEditExampleZh(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl neu-input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickEditOpen(false)}
                  className="px-4 py-2 rounded-xl neu-btn-sm text-neu-sub font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl neu-btn text-neu-main font-bold flex items-center gap-2"
                >
                  <span className="neu-led neu-led-sage" />
                  <Check className="w-4 h-4 text-neu-sage" />
                  <span>保存修改</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
