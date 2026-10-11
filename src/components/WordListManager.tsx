import React, { useState, useRef, useEffect } from 'react';
import { WordItem, WordProgress, DeckMetadata, State } from '../types';
import { SpeechService } from '../utils/speech';
import { 
  Search, 
  Star, 
  Volume2, 
  Filter, 
  Upload, 
  Download, 
  Plus, 
  BookOpen, 
  Trash2, 
  CheckCircle,
  FileText,
  Sparkles,
  Workflow,
  FolderPlus,
  Quote,
  Layers,
  X,
  FileUp,
  Check,
  Info,
  RotateCcw,
  Loader2,
  Settings2,
  Pencil,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square
} from 'lucide-react';
import { DECKS } from '../data/wordbanks';
import { lookupWordSmart, getStoredAiConfig, saveStoredAiConfig, AiConfig, searchBookCandidates, BookCandidateOption } from '../utils/smartLookup';
import { parseMeanings, cleanDuplicatePos, cleanEnglishDefinition } from '../utils/formatTranslation';
import { getWordListIndex, getDeckListSummaries, DEFAULT_WORDS_PER_LIST } from '../utils/listManager';
import { isWordInDeck } from '../utils/storage';

interface WordListManagerProps {
  words: WordItem[];
  decks: DeckMetadata[];
  progressMap: Record<string, WordProgress>;
  activeDeckId: string;
  activeListIndex?: number | 'all';
  onSelectDeck: (deckId: string) => void;
  onSelectActiveList?: (listIndex: number | 'all') => void;
  onRepartitionDeck?: (deckId: string, wordsPerList: number) => void;
  onCreateDeck: (newDeck: Omit<DeckMetadata, 'totalWords'>) => void;
  onUpdateDeck?: (updatedDeck: DeckMetadata, repartitionNow?: boolean) => void;
  onDeleteDeck: (deckId: string) => void;
  onAddWordOrPhrase: (item: WordItem) => void;
  onUpdateWord?: (item: WordItem) => void;
  onBatchUpdateWords?: (items: WordItem[]) => void;
  onDeleteWord?: (wordId: string) => void;
  onBatchDeleteWords?: (wordIds: string[]) => void;
  onToggleStar: (wordId: string) => void;
  onImportWords: (newWords: WordItem[], targetDeckId?: string) => void;
  onRestoreBackup: (data: { words?: WordItem[]; decks?: DeckMetadata[]; progressMap?: Record<string, WordProgress> }) => void;
  onResetWordProgress: (wordId: string) => void;
  onRestoreOfficialDecks?: () => void;
  accent: 'us' | 'uk';
}

export const WordListManager: React.FC<WordListManagerProps> = ({
  words,
  decks,
  progressMap,
  activeDeckId,
  activeListIndex,
  onSelectDeck,
  onSelectActiveList,
  onRepartitionDeck,
  onCreateDeck,
  onUpdateDeck,
  onDeleteDeck,
  onAddWordOrPhrase,
  onUpdateWord,
  onBatchUpdateWords,
  onDeleteWord,
  onBatchDeleteWords,
  onToggleStar,
  onImportWords,
  onRestoreBackup,
  onResetWordProgress,
  onRestoreOfficialDecks,
  accent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'phrases' | 'starred' | 'mastered' | 'learning' | 'new'>('all');
  const [scopeMode, setScopeMode] = useState<'current' | 'all'>('current');
  const [selectedListIndex, setSelectedListIndex] = useState<number | 'all'>(activeListIndex || 'all');
  const [isRepartitionModalOpen, setIsRepartitionModalOpen] = useState(false);
  const [customWordsPerList, setCustomWordsPerList] = useState<number>(20);
  const [newListIndex, setNewListIndex] = useState<number | ''>('');
  const [editListIndex, setEditListIndex] = useState<number | ''>('');
  const [isNewListCustom, setIsNewListCustom] = useState(false);
  const [isEditListCustom, setIsEditListCustom] = useState(false);
  const listUnitsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = listUnitsScrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector('[data-list-unit-active="true"]') as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedListIndex, activeDeckId, scopeMode]);

  // 分页步进器状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // 批量多选与批处理状态
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [batchTargetList, setBatchTargetList] = useState<number>(1);
  const [batchTargetDeckId, setBatchTargetDeckId] = useState<string>(activeDeckId || 'deck-cet4');
  const [isBatchEnriching, setIsBatchEnriching] = useState<boolean>(false);
  const [batchEnrichProgress, setBatchEnrichProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Modals
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [isCreateDeckModalOpen, setIsCreateDeckModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Success Feedback Banner
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // 释义折叠/展开状态集合 (默认仅展示常见高频考意，点击可展开完整释义)
  const [expandedWordIds, setExpandedWordIds] = useState<Set<string>>(new Set());
  const toggleWordExpansion = (wordId: string) => {
    setExpandedWordIds(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  // Add Word / Phrase Form State
  const [newWord, setNewWord] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [newPos, setNewPos] = useState('');
  const [newPhonetic, setNewPhonetic] = useState('');
  const [newDefinitionEn, setNewDefinitionEn] = useState('');
  const [newRootsAffixes, setNewRootsAffixes] = useState('');
  const [newExampleEn, setNewExampleEn] = useState('');
  const [newExampleZh, setNewExampleZh] = useState('');
  const [newMnemonic, setNewMnemonic] = useState('');
  const [newTags, setNewTags] = useState('高频');
  const [newDeckId, setNewDeckId] = useState(activeDeckId || 'deck-cet4');
  const [isPhraseMode, setIsPhraseMode] = useState(false);

  // Edit Word State
  const [editingWord, setEditingWord] = useState<WordItem | null>(null);
  const [editWordText, setEditWordText] = useState('');
  const [editTranslation, setEditTranslation] = useState('');
  const [editPos, setEditPos] = useState('');
  const [editPhonetic, setEditPhonetic] = useState('');
  const [editDefinitionEn, setEditDefinitionEn] = useState('');
  const [editRootsAffixes, setEditRootsAffixes] = useState('');
  const [editExampleEn, setEditExampleEn] = useState('');
  const [editExampleZh, setEditExampleZh] = useState('');
  const [editMnemonic, setEditMnemonic] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editDeckId, setEditDeckId] = useState('');
  const [editIsPhrase, setEditIsPhrase] = useState(false);
  const [isEditEnriching, setIsEditEnriching] = useState(false);
  const [editSmartMessage, setEditSmartMessage] = useState<string | null>(null);

  // 智能完善状态
  const [isEnriching, setIsEnriching] = useState(false);
  const [smartSource, setSmartSource] = useState<'builtin' | 'ai' | 'dictionary' | 'inferred' | null>(null);
  const [smartMessage, setSmartMessage] = useState<string | null>(null);

  // 可选 AI 大模型配置
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => getStoredAiConfig());
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);

  // Create Deck Form State
  const [deckName, setDeckName] = useState('');
  const [deckDesc, setDeckDesc] = useState('');
  const [deckCategory, setDeckCategory] = useState<DeckMetadata['category']>('phrases');
  const [deckColor, setDeckColor] = useState('from-emerald-500 to-teal-500');
  const [deckIcon, setDeckIcon] = useState('BookOpen');
  const [deckTargetLevel, setDeckTargetLevel] = useState('');
  const [deckWordsPerList, setDeckWordsPerList] = useState<number>(DEFAULT_WORDS_PER_LIST);

  // Edit Deck Basic Info Modal State
  const [editingDeck, setEditingDeck] = useState<DeckMetadata | null>(null);
  const [editDeckName, setEditDeckName] = useState('');
  const [editDeckDesc, setEditDeckDesc] = useState('');
  const [editDeckCategory, setEditDeckCategory] = useState<DeckMetadata['category']>('custom');
  const [editDeckIcon, setEditDeckIcon] = useState('BookOpen');
  const [editDeckColor, setEditDeckColor] = useState('from-emerald-500 to-teal-500');
  const [editDeckTargetLevel, setEditDeckTargetLevel] = useState('');
  const [editDeckWordsPerList, setEditDeckWordsPerList] = useState<number>(DEFAULT_WORDS_PER_LIST);
  const [editDeckRepartitionNow, setEditDeckRepartitionNow] = useState(false);
  const [editDeckIsPinned, setEditDeckIsPinned] = useState(false);

  // Import State
  const [importText, setImportText] = useState('');
  const [importTag, setImportTag] = useState('');
  const [importTargetDeckId, setImportTargetDeckId] = useState(activeDeckId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDeck = decks.find(d => d.id === activeDeckId) || decks[0] || {
    id: '',
    name: '默认词库',
    description: '暂无词库，请新建或恢复官方词库',
    category: 'custom' as const,
    totalWords: 0
  };

  const activeDeckWords = React.useMemo(() => {
    return words.filter(w => isWordInDeck(w, activeDeck));
  }, [words, activeDeck]);

  const deckListSummaries = React.useMemo(() => {
    return getDeckListSummaries(
      activeDeckWords,
      activeDeck?.wordsPerList || DEFAULT_WORDS_PER_LIST,
      progressMap,
      Date.now()
    );
  }, [activeDeckWords, activeDeck, progressMap]);

  // 当前词库可用的 List 序号集合 (如 1, 2, 3...)
  const availableListIndices = React.useMemo(() => {
    const indices = new Set<number>();
    deckListSummaries.forEach(s => indices.add(s.listIndex));
    activeDeckWords.forEach(w => {
      if (w.listIndex && w.listIndex > 0) indices.add(w.listIndex);
    });
    if (indices.size === 0) indices.add(1);
    return Array.from(indices).sort((a, b) => a - b);
  }, [deckListSummaries, activeDeckWords]);

  const nextNewListIndex = React.useMemo(() => {
    return (Math.max(...availableListIndices, 0)) + 1;
  }, [availableListIndices]);

  // 直接在词库表格中快捷切换单词的 List
  const handleDirectChangeWordList = (word: WordItem, targetListIndex: number) => {
    if (isNaN(targetListIndex) || targetListIndex <= 0) return;
    const updated: WordItem = {
      ...word,
      listIndex: targetListIndex,
    };
    if (onUpdateWord) {
      onUpdateWord(updated);
    }
    setBannerMessage(`✅ 已将单词【${word.word}】移动至 List ${targetListIndex}`);
    setTimeout(() => setBannerMessage(null), 3000);
  };

  React.useEffect(() => {
    if (activeListIndex !== undefined) {
      setSelectedListIndex(activeListIndex);
    }
  }, [activeListIndex]);

  React.useEffect(() => {
    setSelectedListIndex('all');
    setCustomWordsPerList(activeDeck?.wordsPerList || DEFAULT_WORDS_PER_LIST);
  }, [activeDeckId, activeDeck?.wordsPerList]);

  const handleSelectListTab = (listIdx: number | 'all') => {
    setSelectedListIndex(listIdx);
    if (onSelectActiveList) {
      onSelectActiveList(listIdx);
    }
  };

  const hasMissingOfficialDecks = DECKS.some(d => !decks.some(current => current.id === d.id));

  // 当在添加表单中输入空格时，自动检测为短语
  const handleWordInputChange = (val: string) => {
    setNewWord(val);
    const containsSpace = val.trim().includes(' ');
    if (containsSpace && !isPhraseMode) {
      setIsPhraseMode(true);
      if (!newPos) setNewPos('v. phr.');
      if (!newTags.includes('短语')) {
        setNewTags(prev => prev ? `短语, ${prev}` : '短语');
      }
    }
  };

  // 实时检索内置《高中词根+联想（乱序版）》及精选词库匹配候选项
  const addBookCandidates = React.useMemo(() => {
    return searchBookCandidates(newWord, 6);
  }, [newWord]);

  const editBookCandidates = React.useMemo(() => {
    return searchBookCandidates(editWordText, 5);
  }, [editWordText]);

  const handleApplyCandidate = (cand: BookCandidateOption) => {
    setNewWord(cand.word);
    setIsPhraseMode(Boolean(cand.isPhrase || cand.word.includes(' ')));
    setNewPhonetic(cand.phonetic_us || '');
    setNewPos(cand.pos || '');
    setNewTranslation(cand.translation || '');
    setNewDefinitionEn(cand.definition_en || '');
    setNewExampleEn(cand.example_en || '');
    setNewExampleZh(cand.example_zh || '');
    setNewRootsAffixes(cand.roots_affixes || '');
    setNewMnemonic(cand.mnemonic || '');
    setSmartSource('builtin');
    setSmartMessage(`✨ 已套用【${cand.sourceLabel}】中的「${cand.word}」词条（音标/考意/词根/例句）！`);
  };

  const handleApplyEditCandidate = (cand: BookCandidateOption) => {
    setEditWordText(cand.word);
    setEditIsPhrase(Boolean(cand.isPhrase || cand.word.includes(' ')));
    setEditPhonetic(cand.phonetic_us || '');
    setEditPos(cand.pos || '');
    setEditTranslation(cand.translation || '');
    setEditDefinitionEn(cand.definition_en || '');
    setEditExampleEn(cand.example_en || '');
    setEditExampleZh(cand.example_zh || '');
    setEditRootsAffixes(cand.roots_affixes || '');
    setEditMnemonic(cand.mnemonic || '');
    setEditSmartMessage(`✨ 已套用【${cand.sourceLabel}】中的「${cand.word}」词条数据！`);
  };

  // 智能完善词语信息核心处理函数
  const handleSmartEnrich = async () => {
    const query = newWord.trim();
    if (!query) return;

    setIsEnriching(true);
    setSmartMessage(null);

    try {
      const result = await lookupWordSmart(query, words);
      setNewWord(result.word);
      setIsPhraseMode(result.isPhrase);
      if (result.translation) {
        setNewTranslation(result.translation);
      }
      setNewPos(result.pos);
      setNewPhonetic(result.phonetic_us);
      setNewDefinitionEn(result.definition_en || '');
      setNewExampleEn(result.example_en || '');
      setNewExampleZh(result.example_zh || '');
      setNewMnemonic(result.mnemonic || '');
      setNewRootsAffixes(result.roots_affixes || '');
      if (result.tags && result.tags.length > 0) {
        setNewTags(result.tags.join(', '));
      }
      setSmartSource(result.source);

      const sourceNameMap = {
        builtin: '内置词书（含俞敏洪高中乱序词库）',
        dictionary: '学术高频语料库',
        ai: 'AI大模型深度解析',
        inferred: '语言学智能引擎'
      };
      setSmartMessage(`✨ 已基于【${sourceNameMap[result.source]}】成功补全词条信息！下方所有字段均可自由修改。`);
    } catch (e: any) {
      console.error('Smart lookup failed', e);
      setSmartMessage('⚠️ 智能解析失败，您仍可手动完整填写下方字段。');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleResetAddForm = () => {
    setNewWord('');
    setNewTranslation('');
    setNewPos('');
    setNewPhonetic('');
    setNewDefinitionEn('');
    setNewRootsAffixes('');
    setNewExampleEn('');
    setNewExampleZh('');
    setNewMnemonic('');
    setNewTags('高频');
    const defaultList = selectedListIndex !== 'all' 
      ? selectedListIndex 
      : (activeListIndex && activeListIndex !== 'all' ? Number(activeListIndex) : 1);
    setNewListIndex(defaultList);
    setIsNewListCustom(false);
    setIsPhraseMode(false);
    setSmartSource(null);
    setSmartMessage(null);
  };

  // 打开编辑词条 Modal
  const handleOpenEditModal = (item: WordItem) => {
    setEditingWord(item);
    setEditWordText(item.word);
    setEditTranslation(item.translation);
    setEditPos(item.pos || (item.isPhrase ? 'phr.' : 'n.'));
    setEditPhonetic(item.phonetic_us || '');
    setEditDefinitionEn(item.definition_en || '');
    setEditRootsAffixes(item.roots_affixes || '');
    setEditExampleEn(item.example_en || '');
    setEditExampleZh(item.example_zh || '');
    setEditMnemonic(item.mnemonic || '');
    setEditTags((item.tags || []).join(', '));
    setEditDeckId(item.deckId || activeDeckId);
    const currentListIdx = item.listIndex || getWordListIndex(item, activeDeckWords, activeDeck?.wordsPerList || DEFAULT_WORDS_PER_LIST);
    setEditListIndex(currentListIdx);
    setIsEditListCustom(false);
    setEditIsPhrase(Boolean(item.isPhrase || item.tags?.includes('短语') || item.word.trim().includes(' ')));
    setEditSmartMessage(null);
  };

  // 编辑弹窗中的智能重新完善
  const handleEditSmartEnrich = async () => {
    const query = editWordText.trim();
    if (!query) return;

    setIsEditEnriching(true);
    setEditSmartMessage(null);

    try {
      const otherWords = words.filter(w => w.id !== editingWord?.id);
      const result = await lookupWordSmart(query, otherWords);
      setEditWordText(result.word);
      setEditIsPhrase(result.isPhrase);
      if (result.translation) setEditTranslation(result.translation);
      if (result.pos) setEditPos(result.pos);
      if (result.phonetic_us) setEditPhonetic(result.phonetic_us);
      if (result.definition_en) setEditDefinitionEn(result.definition_en);
      if (result.example_en) setEditExampleEn(result.example_en);
      if (result.example_zh) setEditExampleZh(result.example_zh);
      if (result.mnemonic) setEditMnemonic(result.mnemonic);
      if (result.roots_affixes) setEditRootsAffixes(result.roots_affixes);
      if (result.tags && result.tags.length > 0) {
        setEditTags(result.tags.join(', '));
      }
      setEditSmartMessage('✨ 已重新拉取权威词典解析，请核对并点击【保存修改】');
    } catch (e: any) {
      console.error('Edit smart enrich failed', e);
      setEditSmartMessage('⚠️ 智能解析失败，可直接手动修改各字段。');
    } finally {
      setIsEditEnriching(false);
    }
  };

  // 保存修改词条
  const handleSaveEditSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingWord || !editWordText.trim() || !editTranslation.trim()) return;

    const trimmedWord = editWordText.trim();
    const isPhrase = editIsPhrase || trimmedWord.includes(' ');
    const tagArray = editTags
      .split(/[,，\s]+/)
      .map(t => t.trim())
      .filter(Boolean);

    if (isPhrase && !tagArray.includes('短语')) {
      tagArray.unshift('短语');
    }

    const cleanedTrans = cleanDuplicatePos(editTranslation.trim());
    const cleanedPos = cleanDuplicatePos(editPos.trim()) || (isPhrase ? 'phr.' : 'n.');
    const cleanedDefEn = cleanEnglishDefinition(editDefinitionEn.trim(), trimmedWord, cleanedPos);

    const updatedItem: WordItem = {
      ...editingWord,
      word: trimmedWord,
      isPhrase,
      translation: cleanedTrans,
      pos: cleanedPos,
      listIndex: Number(editListIndex) > 0 ? Number(editListIndex) : (editingWord.listIndex || 1),
      phonetic_us: editPhonetic.trim() || `/${trimmedWord}/`,
      definition_en: cleanedDefEn,
      roots_affixes: editRootsAffixes.trim() || undefined,
      example_en: editExampleEn.trim() || `Here is an example for "${trimmedWord}".`,
      example_zh: editExampleZh.trim() || `这是包含 "${trimmedWord}" 的例句。`,
      mnemonic: editMnemonic.trim() || undefined,
      tags: tagArray.length > 0 ? tagArray : (isPhrase ? ['短语'] : ['核心词汇']),
      deckId: editDeckId || editingWord.deckId,
    };

    if (onUpdateWord) {
      onUpdateWord(updatedItem);
    }
    setEditingWord(null);
    setBannerMessage(`✅ 已成功保存对词条【${updatedItem.word}】的修改！`);
    setTimeout(() => setBannerMessage(null), 3500);
  };

  // 删除单个词条
  const handleDeleteWordDirect = (wordId: string, wordText: string) => {
    if (window.confirm(`确定要从词库中删除词条【${wordText}】吗？删除后该词的复习进度也将一并移除。`)) {
      if (onDeleteWord) {
        onDeleteWord(wordId);
      }
      if (editingWord?.id === wordId) {
        setEditingWord(null);
      }
      setBannerMessage(`🗑️ 已删除词条【${wordText}】`);
      setTimeout(() => setBannerMessage(null), 3000);
    }
  };

  const handleAddSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newWord.trim() || !newTranslation.trim()) return;

    const trimmedWord = newWord.trim();
    const isPhrase = isPhraseMode || trimmedWord.includes(' ');
    const tagArray = newTags
      .split(/[,，\s]+/)
      .map(t => t.trim())
      .filter(Boolean);

    if (isPhrase && !tagArray.includes('短语')) {
      tagArray.unshift('短语');
    }

    const cleanedTrans = cleanDuplicatePos(newTranslation.trim());
    const cleanedPos = cleanDuplicatePos(newPos.trim()) || (isPhrase ? 'phr.' : 'n.');
    const cleanedDefEn = cleanEnglishDefinition(newDefinitionEn.trim(), trimmedWord, cleanedPos);

    const item: WordItem = {
      id: `item-${Date.now()}`,
      word: trimmedWord,
      isPhrase,
      deckId: newDeckId,
      listIndex: Number(newListIndex) > 0 ? Number(newListIndex) : 1,
      phonetic_us: newPhonetic.trim() || `/${trimmedWord}/`,
      translation: cleanedTrans,
      pos: cleanedPos,
      definition_en: cleanedDefEn,
      roots_affixes: newRootsAffixes.trim(),
      example_en: newExampleEn.trim() || `We should carefully review ${trimmedWord} in authentic contexts.`,
      example_zh: newExampleZh.trim() || `我们应当在真实语境中仔细复习 ${trimmedWord}。`,
      mnemonic: newMnemonic.trim(),
      tags: tagArray.length > 0 ? tagArray : ['自定义'],
    };

    onAddWordOrPhrase(item);

    setBannerMessage(`✅ 成功添加【${item.word}】！已加入记忆复习队列。`);
    setTimeout(() => setBannerMessage(null), 4000);

    handleResetAddForm();
    setIsAddWordModalOpen(false);
  };

  const handleCreateDeckSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!deckName.trim()) return;

    const newDeck: Omit<DeckMetadata, 'totalWords'> = {
      id: `deck-custom-${Date.now()}`,
      name: deckName.trim(),
      description: deckDesc.trim() || '用户自定义专属记忆词库',
      category: deckCategory,
      icon: deckIcon || (deckCategory === 'phrases' ? 'Workflow' : 'BookOpen'),
      color: deckColor,
      wordsPerList: deckWordsPerList || DEFAULT_WORDS_PER_LIST,
      targetLevel: deckTargetLevel.trim() || undefined,
      isCustom: true,
    };

    onCreateDeck(newDeck);
    setBannerMessage(`🎉 词库【${newDeck.name}】创建成功！`);
    setTimeout(() => setBannerMessage(null), 4000);
    setDeckName('');
    setDeckDesc('');
    setDeckTargetLevel('');
    setIsCreateDeckModalOpen(false);
  };

  // 打开编辑词书基本信息弹窗
  const handleOpenEditDeckModal = (deck: DeckMetadata) => {
    setEditingDeck(deck);
    setEditDeckName(deck.name);
    setEditDeckDesc(deck.description || '');
    setEditDeckCategory(deck.category || 'custom');
    setEditDeckIcon(deck.icon || (deck.category === 'phrases' ? 'Workflow' : 'BookOpen'));
    setEditDeckColor(deck.color || 'from-emerald-500 to-teal-500');
    setEditDeckTargetLevel(deck.targetLevel || '');
    setEditDeckWordsPerList(deck.wordsPerList || DEFAULT_WORDS_PER_LIST);
    setEditDeckRepartitionNow(false);
    setEditDeckIsPinned(Boolean(deck.isPinned));
  };

  // 保存编辑后的词书基本信息
  const handleUpdateDeckSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingDeck || !editDeckName.trim() || !onUpdateDeck) return;

    const safeWordsPerList = Math.max(5, Math.min(200, Number(editDeckWordsPerList) || DEFAULT_WORDS_PER_LIST));
    const updatedDeck: DeckMetadata = {
      ...editingDeck,
      name: editDeckName.trim(),
      description: editDeckDesc.trim() || '暂无词书说明',
      category: editDeckCategory,
      icon: editDeckIcon,
      color: editDeckColor,
      targetLevel: editDeckTargetLevel.trim() || undefined,
      wordsPerList: safeWordsPerList,
      isPinned: editDeckIsPinned,
    };

    onUpdateDeck(updatedDeck, editDeckRepartitionNow);
    setBannerMessage(
      `✅ 词书【${updatedDeck.name}】基本信息已更新${editDeckRepartitionNow ? `（并已按 ${safeWordsPerList} 词/List 重新均分单元）` : ''}！`
    );
    setTimeout(() => setBannerMessage(null), 4000);
    setEditingDeck(null);
  };

  // 一键将官方内置词书还原为出厂默认元信息
  const handleRestoreDefaultDeckMeta = () => {
    if (!editingDeck) return;
    const officialDefault = DECKS.find(d => d.id === editingDeck.id);
    if (!officialDefault) return;
    setEditDeckName(officialDefault.name);
    setEditDeckDesc(officialDefault.description);
    setEditDeckCategory(officialDefault.category);
    setEditDeckIcon(officialDefault.icon || 'BookOpen');
    setEditDeckColor(officialDefault.color);
    setEditDeckTargetLevel(officialDefault.targetLevel || '');
    setEditDeckWordsPerList(officialDefault.wordsPerList || DEFAULT_WORDS_PER_LIST);
    setEditDeckIsPinned(false);
  };

  // 根据词书 color 字段映射新拟态柔和强调色与指示灯
  const getDeckTone = (color?: string) => {
    const c = (color || '').toLowerCase();
    if (c.includes('amber') || c.includes('orange')) {
      return { textClass: 'text-neu-amber', ledClass: 'neu-led-amber', label: '暖珀陶橙' };
    }
    if (c.includes('rose') || c.includes('pink') || c.includes('coral') || c.includes('red')) {
      return { textClass: 'text-neu-coral', ledClass: 'neu-led-coral', label: '柔雾珊瑚' };
    }
    if (c.includes('blue') || c.includes('cyan') || c.includes('violet') || c.includes('purple') || c.includes('indigo') || c.includes('steel')) {
      return { textClass: 'text-neu-steel', ledClass: 'neu-led-steel', label: '冷钢灰蓝' };
    }
    return { textClass: 'text-neu-sage', ledClass: 'neu-led-sage', label: '鼠尾草绿' };
  };

  // 根据词书 icon 字段渲染实体图标
  const renderDeckIcon = (deck: DeckMetadata, className = 'w-3.5 h-3.5') => {
    const iconName = deck.icon || (deck.category === 'phrases' ? 'Workflow' : 'Layers');
    switch (iconName) {
      case 'Workflow':
        return <Workflow className={className} />;
      case 'Sparkles':
        return <Sparkles className={className} />;
      case 'Star':
        return <Star className={className} />;
      case 'FileText':
        return <FileText className={className} />;
      case 'BookOpen':
        return <BookOpen className={className} />;
      default:
        return <Layers className={className} />;
    }
  };

  // 本地文件选择读取 (.txt / .csv / .json)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
        // 自动提取文件名作为默认标签
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        if (!importTag) {
          setImportTag(baseName);
        }
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // 处理批量导入 (支持多种格式：备份还原 JSON、词汇对象数组、中英文分隔文本、CSV)
  const handleImportSubmit = () => {
    if (!importText.trim()) return;

    const targetDeck = decks.find(d => d.id === importTargetDeckId) || activeDeck;
    const defaultTag = importTag.trim() || targetDeck.name;

    try {
      const trimmed = importText.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);

        // 1. 全量备份还原格式检测: { version: '1.x', words: [...], decks: [...] }
        if (parsed.words && Array.isArray(parsed.words)) {
          onRestoreBackup(parsed);
          setBannerMessage(`🎉 成功完整恢复备份！已恢复 ${parsed.words.length} 个词条。`);
          setTimeout(() => setBannerMessage(null), 4000);
          setIsImportModalOpen(false);
          setImportText('');
          return;
        }

        // 2. 单词列表对象检测: { data: [...] } 或直接数组
        const rawList = Array.isArray(parsed) ? parsed : (parsed.data || parsed.list || parsed.vocabulary || []);
        if (Array.isArray(rawList) && rawList.length > 0) {
          const formatted: WordItem[] = rawList.map((item: any, idx: number) => {
            const w = typeof item === 'string' ? item.trim() : (item.word || 'unknown').trim();
            const isPhr = Boolean(item.isPhrase || w.includes(' '));
            const trans = typeof item === 'string' ? '待完善释义' : (item.translation || item.trans || '待完善释义');

            return {
              id: item.id || `custom-${Date.now()}-${idx}`,
              word: w,
              isPhrase: isPhr,
              deckId: targetDeck.id,
              phonetic_us: item.phonetic_us || `/${w}/`,
              translation: trans,
              pos: item.pos || (isPhr ? 'phr.' : ''),
              definition_en: item.definition_en || trans,
              example_en: item.example_en || `I am actively reviewing ${w} with VocabMaster.`,
              example_zh: item.example_zh || `我正在用 VocabMaster 高效学习 ${w}。`,
              mnemonic: item.mnemonic || '',
              tags: item.tags && Array.isArray(item.tags) 
                ? Array.from(new Set([...item.tags, defaultTag, isPhr ? '短语' : '']))
                : [defaultTag, isPhr ? '短语' : ''].filter(Boolean),
            };
          });

          onImportWords(formatted, targetDeck.id);
          setBannerMessage(`✅ 成功导入 ${formatted.length} 个词条到【${targetDeck.name}】！`);
          setTimeout(() => setBannerMessage(null), 4000);
          setIsImportModalOpen(false);
          setImportText('');
          return;
        }
      }
    } catch (e) {
      // JSON 解析失败则平滑降级为按行正则解析
    }

    // 3. 增强型文本按行解析 (支持逗号、中文逗号、分号、制表符、冒号、空格中英文混排)
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    const imported: WordItem[] = [];

    lines.forEach((line, idx) => {
      let cleanLine = line.trim();
      if (!cleanLine) return;

      // 去除两端包裹的引号 (CSV 导出常见)
      if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
        cleanLine = cleanLine.slice(1, -1);
      }

      let word = '';
      let trans = '';

      // 优先匹配标准分隔符: \t, 英文逗号, 中文逗号, 分号, 冒号
      const sepMatch = cleanLine.match(/[\t,，;；:：]/);
      if (sepMatch && sepMatch.index !== undefined) {
        word = cleanLine.slice(0, sepMatch.index).trim();
        trans = cleanLine.slice(sepMatch.index + 1).trim();
      } else if (/[\u4e00-\u9fa5]/.test(cleanLine)) {
        // 无符号但在空格后出现中文: 例如 "take into account 考虑到"
        const firstChinese = cleanLine.search(/[\u4e00-\u9fa5]/);
        word = cleanLine.slice(0, firstChinese).trim();
        trans = cleanLine.slice(firstChinese).trim();
      } else {
        // 纯英文单行 (无翻译)
        word = cleanLine;
        trans = '待完善释义';
      }

      // 清理引号
      word = word.replace(/^["']|["']$/g, '').trim();
      trans = trans.replace(/^["']|["']$/g, '').trim();

      if (word) {
        const isPhr = word.includes(' ');
        imported.push({
          id: `custom-${Date.now()}-${idx}`,
          word,
          isPhrase: isPhr,
          deckId: targetDeck.id,
          phonetic_us: `/${word}/`,
          translation: trans || '待完善释义',
          pos: isPhr ? 'phr.' : '',
          definition_en: trans,
          example_en: `I am actively reviewing ${word} with VocabMaster.`,
          example_zh: `我正在用 VocabMaster 高效复习 ${word}。`,
          tags: [defaultTag, isPhr ? '短语' : ''].filter(Boolean),
        });
      }
    });

    if (imported.length > 0) {
      onImportWords(imported, targetDeck.id);
      setBannerMessage(`✅ 成功导入 ${imported.length} 个词条至【${targetDeck.name}】！`);
      setTimeout(() => setBannerMessage(null), 4000);
      setIsImportModalOpen(false);
      setImportText('');
    } else {
      alert('未能识别到有效的词条内容，请检查格式后重试。');
    }
  };

  // 导出全部词库与进度数据 (JSON)
  const handleExportData = () => {
    const exportData = {
      version: '1.2',
      exportDate: new Date().toISOString(),
      decks,
      words,
      progressMap,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocab-master-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 计算指定词库内的实际词数
  const getDeckWordCount = (deck: DeckMetadata) => {
    return words.filter(w => isWordInDeck(w, deck)).length;
  };

  // 词表筛选
  const filteredWords = words.filter(w => {
    // 1. 词库范围过滤
    if (scopeMode === 'current') {
      if (!isWordInDeck(w, activeDeck)) return false;

      // List 分卷过滤
      if (selectedListIndex !== 'all') {
        const listIdx = getWordListIndex(w, activeDeckWords, activeDeck.wordsPerList || DEFAULT_WORDS_PER_LIST);
        if (listIdx !== selectedListIndex) return false;
      }
    }

    // 2. 搜索关键词过滤
    const matchesSearch = 
      w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.translation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // 3. 状态与标签过滤
    const p = progressMap[w.id];
    if (selectedFilter === 'phrases') return w.isPhrase || w.tags.includes('短语') || w.word.trim().includes(' ');
    if (selectedFilter === 'starred') return p?.isStarred;
    if (selectedFilter === 'mastered') return p?.isMastered || (p?.stability >= 90);
    if (selectedFilter === 'learning') return p && p.state !== State.New && p.reps > 0 && !p.isMastered;
    if (selectedFilter === 'new') return !p || p.state === State.New || p.reps === 0;

    return true;
  });

  // 硬件分页器计算
  const totalPages = Math.max(1, Math.ceil(filteredWords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedWords = filteredWords.slice((safePage - 1) * pageSize, safePage * pageSize);

  // 批量选择与操作函数
  const toggleSelectWord = (wordId: string) => {
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  const isCurrentPageAllSelected = paginatedWords.length > 0 && paginatedWords.every(w => selectedWordIds.has(w.id));

  const toggleSelectPage = () => {
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      if (isCurrentPageAllSelected) {
        paginatedWords.forEach(w => next.delete(w.id));
      } else {
        paginatedWords.forEach(w => next.add(w.id));
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedWordIds(new Set(filteredWords.map(w => w.id)));
  };

  const clearSelection = () => {
    setSelectedWordIds(new Set());
  };

  const handleBatchAssignList = (targetListIdx: number) => {
    if (selectedWordIds.size === 0) return;
    const selectedItems = words.filter(w => selectedWordIds.has(w.id)).map(w => ({
      ...w,
      listIndex: targetListIdx
    }));
    if (onBatchUpdateWords) {
      onBatchUpdateWords(selectedItems);
    } else if (onUpdateWord) {
      selectedItems.forEach(item => onUpdateWord(item));
    }
    showBanner(`已将选中的 ${selectedItems.length} 个词条批量分配至 List ${targetListIdx}！`);
    clearSelection();
  };

  const handleBatchMoveDeck = (targetDeckId: string) => {
    if (selectedWordIds.size === 0 || !targetDeckId) return;
    const targetDeck = decks.find(d => d.id === targetDeckId);
    if (!targetDeck) return;
    const selectedItems = words.filter(w => selectedWordIds.has(w.id)).map(w => ({
      ...w,
      deckId: targetDeckId,
      tags: Array.from(new Set([...w.tags, targetDeck.name]))
    }));
    if (onBatchUpdateWords) {
      onBatchUpdateWords(selectedItems);
    } else if (onUpdateWord) {
      selectedItems.forEach(item => onUpdateWord(item));
    }
    showBanner(`已将选中的 ${selectedItems.length} 个词条迁移至词库【${targetDeck.name}】！`);
    clearSelection();
  };

  const handleBatchSmartEnrich = async () => {
    if (selectedWordIds.size === 0 || isBatchEnriching) return;
    const targets = words.filter(w => selectedWordIds.has(w.id));
    setIsBatchEnriching(true);
    setBatchEnrichProgress({ current: 0, total: targets.length });
    const updatedList: WordItem[] = [];

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      setBatchEnrichProgress({ current: i + 1, total: targets.length });
      try {
        const res = await lookupWordSmart(item.word, aiConfig);
        if (res) {
          updatedList.push({
            ...item,
            translation: res.translation || item.translation,
            pos: res.pos || item.pos,
            phonetic_us: res.phonetic_us || item.phonetic_us,
            phonetic_uk: res.phonetic_uk || item.phonetic_uk,
            definition_en: res.definition_en || item.definition_en,
            roots_affixes: res.roots_affixes || item.roots_affixes,
            mnemonic: res.mnemonic || item.mnemonic,
            examples: res.examples && res.examples.length > 0 ? res.examples : item.examples
          });
        }
      } catch {
        // 单个词条失败跳过继续处理其余词条
      }
    }

    if (updatedList.length > 0) {
      if (onBatchUpdateWords) {
        onBatchUpdateWords(updatedList);
      } else if (onUpdateWord) {
        updatedList.forEach(u => onUpdateWord(u));
      }
      showBanner(`已完成 ${updatedList.length} / ${targets.length} 个词条的智能补全（音标/考意/助记/例句）！`);
    } else {
      showBanner('批量补全未获取到新数据，请检查网络或 AI 配置');
    }
    setIsBatchEnriching(false);
    clearSelection();
  };

  const handleBatchDelete = () => {
    if (selectedWordIds.size === 0) return;
    if (!window.confirm(`确定要从词库中批量删除选中的 ${selectedWordIds.size} 个词条吗？此操作不可撤销。`)) return;
    const ids = Array.from(selectedWordIds);
    if (onBatchDeleteWords) {
      onBatchDeleteWords(ids);
    } else if (onDeleteWord) {
      ids.forEach(id => onDeleteWord(id));
    }
    showBanner(`已批量删除 ${ids.length} 个词条`);
    clearSelection();
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in pb-12">
      {/* 顶部全局状态提示槽 */}
      {bannerMessage && (
        <div className="p-4 rounded-2xl neu-inset text-neu-sage font-semibold text-xs sm:text-sm flex items-center justify-between animate-scale-up">
          <div className="flex items-center gap-2.5">
            <span className="neu-led neu-led-sage" />
            <Check className="w-4 h-4" />
            <span>{bannerMessage}</span>
          </div>
          <button onClick={() => setBannerMessage(null)} className="w-7 h-7 rounded-lg neu-btn-sm flex items-center justify-center text-neu-sub">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 词库模块插槽与顶栏控制 */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl neu-raised flex items-center justify-center text-neu-sage">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neu-main flex items-center gap-2">
                <span>大纲与专属词库模块</span>
                <span className="text-[11px] text-neu-muted font-mono px-2 py-0.5 rounded-lg neu-inset-sm">
                  {decks.length} DECKS
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 添加短语/单词 实体键 */}
            <button
              onClick={() => {
                setNewDeckId(activeDeckId);
                const defaultList = selectedListIndex !== 'all' 
                  ? selectedListIndex 
                  : (activeListIndex && activeListIndex !== 'all' ? Number(activeListIndex) : 1);
                setNewListIndex(defaultList);
                setIsNewListCustom(false);
                setIsAddWordModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl neu-btn text-neu-main font-bold text-xs flex items-center gap-2"
            >
              <span className="neu-led neu-led-sage" />
              <Plus className="w-3.5 h-3.5 text-neu-sage" />
              <span>添加短语 / 词条</span>
            </button>

            {/* 新建自定义词库 */}
            <button
              onClick={() => setIsCreateDeckModalOpen(true)}
              className="px-3.5 py-2 rounded-xl neu-btn-sm text-neu-main font-semibold text-xs flex items-center gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5 text-neu-steel" />
              <span>新建词库</span>
            </button>

            {/* 编辑当前选中词书基本信息 */}
            {onUpdateDeck && activeDeck?.id && (
              <button
                onClick={() => handleOpenEditDeckModal(activeDeck)}
                className="px-3.5 py-2 rounded-xl neu-btn-sm text-neu-main font-semibold text-xs flex items-center gap-1.5"
                title={`编辑当前词书【${activeDeck.name}】的基本信息与分卷规格`}
              >
                <Pencil className="w-3.5 h-3.5 text-neu-sage" />
                <span>编辑词书</span>
              </button>
            )}

            {/* 恢复官方词库 */}
            {hasMissingOfficialDecks && onRestoreOfficialDecks && (
              <button
                onClick={onRestoreOfficialDecks}
                className="px-3.5 py-2 rounded-xl neu-btn-sm text-neu-amber font-semibold text-xs flex items-center gap-1.5"
                title="已删除部分内置词库，点击可一键恢复所有官方词库及单词"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>恢复官方词库</span>
              </button>
            )}

            {/* 批量导入 */}
            <button
              onClick={() => {
                setImportTargetDeckId(activeDeckId);
                setIsImportModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl neu-btn-sm text-neu-sub hover:text-neu-main font-semibold text-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>批量导入</span>
            </button>

            {/* 备份导出 */}
            <button
              onClick={handleExportData}
              className="px-3.5 py-2 rounded-xl neu-btn-sm text-neu-sub hover:text-neu-main font-semibold text-xs flex items-center gap-1.5"
              title="导出当前全部词库与复习进度 JSON 文件"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出备份</span>
            </button>
          </div>
        </div>

        {/* 词库模块卡片矩阵 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {decks.length === 0 ? (
            <div className="col-span-full py-10 text-center neu-inset rounded-3xl p-6">
              <p className="text-sm font-bold text-neu-main mb-1.5">
                暂无词库模块
              </p>
              <p className="text-xs text-neu-sub mb-5">
                当前词库槽位为空，您可以一键恢复官方大纲词库或新建自定义词库。
              </p>
              <div className="flex items-center justify-center gap-3">
                {onRestoreOfficialDecks && (
                  <button
                    onClick={onRestoreOfficialDecks}
                    className="px-4 py-2.5 rounded-xl neu-btn text-neu-sage font-bold text-xs flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>恢复官方词库</span>
                  </button>
                )}
                <button
                  onClick={() => setIsCreateDeckModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl neu-btn text-neu-main font-bold text-xs flex items-center gap-1.5"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-neu-steel" />
                  <span>新建词库</span>
                </button>
              </div>
            </div>
          ) : (
            decks.map(deck => {
              const count = getDeckWordCount(deck);
              const isSelected = activeDeckId === deck.id;
              const tone = getDeckTone(deck.color);

              return (
                <div
                  key={deck.id}
                  onClick={() => {
                    onSelectDeck(deck.id);
                    setScopeMode('current');
                  }}
                  className={`p-4 rounded-2xl text-left flex flex-col justify-between transition-all cursor-pointer relative group min-h-[135px] ${
                    isSelected
                      ? 'neu-inset'
                      : 'neu-card hover:-translate-y-0.5'
                  }`}
                >
                  {/* 词书编辑与删除微动键组 */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10">
                    {onUpdateDeck && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditDeckModal(deck);
                        }}
                        className="w-6 h-6 rounded-lg neu-btn-sm flex items-center justify-center text-neu-muted hover:text-neu-sage"
                        title={`编辑词书【${deck.name}】基本信息`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const isOfficial = !deck.isCustom;
                        const confirmMsg = isOfficial
                          ? `确定要删除官方词库【${deck.name}】吗？\n该词库及其所含词汇将被移除（可随时点击右上角“恢复官方词库”重新找回）。`
                          : `确定要删除自定义词库【${deck.name}】吗？\n该词库及其所含词汇将被彻底移除。`;
                        if (window.confirm(confirmMsg)) {
                          onDeleteDeck(deck.id);
                        }
                      }}
                      className="w-6 h-6 rounded-lg neu-btn-sm flex items-center justify-center text-neu-muted hover:text-neu-coral"
                      title={deck.isCustom ? `删除自定义词库【${deck.name}】` : `删除官方词库【${deck.name}】`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1.5 pr-12">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? `neu-raised ${tone.textClass}` : 'neu-inset-sm text-neu-sub'
                        }`}
                      >
                        {renderDeckIcon(deck)}
                      </span>
                      <span 
                        className="font-bold text-xs text-neu-main line-clamp-1"
                        title={deck.name}
                      >
                        {deck.name}
                      </span>
                    </div>

                    {(deck.isPinned || deck.targetLevel) && (
                      <div className="flex items-center gap-1 flex-wrap mb-1.5">
                        {deck.isPinned && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold neu-inset-sm text-neu-amber">
                            ★ 置顶
                          </span>
                        )}
                        {deck.targetLevel && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono neu-inset-sm text-neu-muted line-clamp-1">
                            {deck.targetLevel}
                          </span>
                        )}
                      </div>
                    )}

                    <p 
                      title={deck.description}
                      className={`text-[11px] line-clamp-2 leading-relaxed mb-2 ${
                        isSelected
                          ? 'text-neu-main font-medium'
                          : 'text-neu-sub'
                      }`}
                    >
                      {deck.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono mt-auto pt-1">
                    <span className={isSelected ? `font-bold ${tone.textClass}` : 'text-neu-muted'}>
                      {count} 词
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`neu-led ${isSelected ? tone.ledClass : 'neu-led-off'}`} />
                      {isSelected && (
                        <span className={`text-[10px] font-sans font-bold ${tone.textClass}`}>
                          当前
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 词表搜索、分卷导轨与管理主面板 */}
      <div className="neu-panel rounded-3xl p-6 sm:p-8">
        
        {/* 顶部词库范围切换导轨 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <span className="neu-label">SCOPE:</span>
            <div className="flex items-center gap-1.5 neu-inset p-1.5 rounded-2xl">
              <button
                onClick={() => setScopeMode('current')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  scopeMode === 'current'
                    ? 'neu-raised text-neu-main'
                    : 'text-neu-sub hover:text-neu-main'
                }`}
              >
                <span className={`neu-led ${scopeMode === 'current' ? 'neu-led-sage' : 'neu-led-off'}`} />
                <span>当前【{activeDeck.name}】({getDeckWordCount(activeDeck)})</span>
              </button>
              <button
                onClick={() => setScopeMode('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  scopeMode === 'all'
                    ? 'neu-raised text-neu-main'
                    : 'text-neu-sub hover:text-neu-main'
                }`}
              >
                <span className={`neu-led ${scopeMode === 'all' ? 'neu-led-sage' : 'neu-led-off'}`} />
                <span>全部词库 ({words.length})</span>
              </button>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl neu-inset-sm text-xs text-neu-sub font-mono">
            RECORDS: <strong className="text-neu-main">{filteredWords.length}</strong>
          </div>
        </div>

        {/* List 分卷单元导轨 (仅在当前词库模式下展示) */}
        {scopeMode === 'current' && deckListSummaries.length > 0 && (
          <div className="mb-6 p-2.5 rounded-2xl neu-inset flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
            <span className="neu-label px-2 flex items-center gap-1.5 shrink-0">
              <Layers className="w-3.5 h-3.5 text-neu-sage" />
              <span>LIST UNITS:</span>
            </span>

            {deckListSummaries.length > 5 && (
              <button
                type="button"
                onClick={() => {
                  listUnitsScrollRef.current?.scrollBy({ left: -240, behavior: 'smooth' });
                }}
                className="w-7 h-7 rounded-xl neu-btn-sm flex items-center justify-center text-neu-sub hover:text-neu-main shrink-0"
                title="向左滑动单元轨道"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}

            <div
              ref={listUnitsScrollRef}
              onWheel={(e) => {
                if (e.deltaY !== 0 && listUnitsScrollRef.current) {
                  listUnitsScrollRef.current.scrollLeft += e.deltaY;
                }
              }}
              className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 px-1"
            >
              <button
                data-list-unit-active={selectedListIndex === 'all' ? 'true' : undefined}
                onClick={() => handleSelectListTab('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedListIndex === 'all'
                    ? 'neu-raised text-neu-main'
                    : 'text-neu-sub hover:text-neu-main'
                }`}
              >
                <span className={`neu-led ${selectedListIndex === 'all' ? 'neu-led-sage' : 'neu-led-off'}`} />
                <span>全部单元</span>
                <span className="px-1.5 py-0.2 rounded-md text-[10px] neu-inset-sm text-neu-muted font-mono">
                  {activeDeckWords.length}
                </span>
              </button>

              {deckListSummaries.map(summary => {
                const isSelected = selectedListIndex === summary.listIndex;
                const masteredPct = summary.totalWords > 0 
                  ? Math.round((summary.masteredWords / summary.totalWords) * 100) 
                  : 0;
                return (
                  <button
                    key={summary.listIndex}
                    data-list-unit-active={isSelected ? 'true' : undefined}
                    onClick={() => handleSelectListTab(summary.listIndex)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'neu-raised text-neu-main'
                        : 'text-neu-sub hover:text-neu-main'
                    }`}
                  >
                    <span className={`neu-led ${isSelected ? 'neu-led-sage' : 'neu-led-off'}`} />
                    <span>{summary.name}</span>
                    <span className="px-1.5 py-0.2 rounded-md text-[10px] neu-inset-sm text-neu-muted font-mono">
                      {summary.totalWords}
                    </span>
                    {masteredPct > 0 && (
                      <span className="text-[10px] font-mono text-neu-sage">
                        {masteredPct}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {deckListSummaries.length > 5 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      listUnitsScrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' });
                    }}
                    className="w-7 h-7 rounded-xl neu-btn-sm flex items-center justify-center text-neu-sub hover:text-neu-main shrink-0"
                    title="向右滑动单元轨道"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <select
                    value={selectedListIndex === 'all' ? 'all' : String(selectedListIndex)}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleSelectListTab(val === 'all' ? 'all' : Number(val));
                    }}
                    className="px-2.5 py-1.5 rounded-xl neu-btn-sm text-[11px] font-mono font-bold text-neu-main bg-transparent outline-none cursor-pointer shrink-0"
                    title="快速跳转至指定分卷 List"
                  >
                    <option value="all" className="bg-[var(--neu-bg)] text-neu-main">
                      全部 ({deckListSummaries.length}组)
                    </option>
                    {deckListSummaries.map(s => (
                      <option key={s.listIndex} value={String(s.listIndex)} className="bg-[var(--neu-bg)] text-neu-main">
                        {s.name} ({s.totalWords}词)
                      </option>
                    ))}
                  </select>
                </>
              )}

              {/* List 分卷规格设置按钮 */}
              {onRepartitionDeck && (
                <button
                  onClick={() => {
                    setCustomWordsPerList(activeDeck.wordsPerList || DEFAULT_WORDS_PER_LIST);
                    setIsRepartitionModalOpen(true);
                  }}
                  className="text-[11px] font-semibold text-neu-sub hover:text-neu-main flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-btn-sm shrink-0"
                  title="自定义每组词数并重新均分 List"
                >
                  <Settings2 className="w-3.5 h-3.5 text-neu-sage" />
                  <span>分卷规格 ({activeDeck.wordsPerList || DEFAULT_WORDS_PER_LIST}词/List)</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          {/* 凹槽搜索框 */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-neu-muted absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索单词、短语、释义或标签..."
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl neu-input text-sm"
            />
          </div>

          {/* 状态筛选实体按键槽 */}
          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto neu-inset p-1.5 rounded-2xl">
            {(['all', 'phrases', 'learning', 'starred', 'mastered', 'new'] as const).map(filterKey => {
              const labelMap = {
                all: '全部',
                phrases: '短语搭配',
                learning: '复习中',
                starred: '重点本',
                mastered: '已掌握',
                new: '未学习',
              };
              const isFilterActive = selectedFilter === filterKey;
              return (
                <button
                  key={filterKey}
                  onClick={() => setSelectedFilter(filterKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isFilterActive
                      ? 'neu-raised text-neu-main'
                      : 'text-neu-sub hover:text-neu-main'
                  }`}
                >
                  {isFilterActive && <span className="neu-led neu-led-sage" />}
                  <span>{labelMap[filterKey]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="neu-groove-h mb-4" />

        {/* 批量管理操作台 (当勾选词条时浮现) */}
        {selectedWordIds.size > 0 && (
          <div className="mb-4 p-3.5 rounded-2xl neu-inset flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 animate-scale-up">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl neu-raised text-xs font-bold text-neu-amber">
                <span className="neu-led neu-led-amber" />
                <span>已勾选 {selectedWordIds.size} 项</span>
              </div>
              {selectedWordIds.size < filteredWords.length && (
                <button
                  onClick={selectAllFiltered}
                  className="px-3 py-1.5 rounded-xl neu-btn-sm text-xs font-semibold text-neu-steel hover:text-neu-main"
                >
                  全选当前筛选的全部 {filteredWords.length} 项
                </button>
              )}
              <button
                onClick={clearSelection}
                className="px-2.5 py-1.5 rounded-xl neu-btn-sm text-xs text-neu-sub hover:text-neu-main"
              >
                取消勾选
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
              {/* 批量改分卷 List */}
              <div className="inline-flex items-center relative">
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (val === 'new') {
                      handleBatchAssignList(nextNewListIndex);
                    } else if (val === 'custom') {
                      const inputVal = window.prompt('请输入批量分配的目标 List 分卷序号 (正整数):');
                      if (inputVal) {
                        const num = parseInt(inputVal, 10);
                        if (!isNaN(num) && num > 0) handleBatchAssignList(num);
                      }
                    } else {
                      handleBatchAssignList(Number(val));
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold neu-btn-sm text-neu-amber pr-7 appearance-none cursor-pointer outline-none"
                >
                  <option value="">批量归入 List...</option>
                  {availableListIndices.map(idx => (
                    <option key={idx} value={idx}>归入 List {idx}</option>
                  ))}
                  <option value="new">+ 新建 List {nextNewListIndex}</option>
                  <option value="custom">自定义 List 序号...</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-neu-amber absolute right-2 pointer-events-none" />
              </div>

              {/* 批量迁移词库 */}
              <div className="inline-flex items-center relative">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) handleBatchMoveDeck(e.target.value);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold neu-btn-sm text-neu-steel pr-7 appearance-none cursor-pointer outline-none"
                >
                  <option value="">批量迁移至词库...</option>
                  {decks.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-neu-steel absolute right-2 pointer-events-none" />
              </div>

              {/* 批量智能补全 */}
              <button
                onClick={handleBatchSmartEnrich}
                disabled={isBatchEnriching}
                className="px-3 py-1.5 rounded-xl text-xs font-bold neu-btn-sm text-neu-sage flex items-center gap-1.5 disabled:opacity-50"
                title="对勾选项批量联网/AI补全音标、考意、词根与例句"
              >
                {isBatchEnriching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>补全中 ({batchEnrichProgress.current}/{batchEnrichProgress.total})</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>批量智能补全</span>
                  </>
                )}
              </button>

              {/* 批量删除 */}
              {(onBatchDeleteWords || onDeleteWord) && (
                <button
                  onClick={handleBatchDelete}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold neu-btn-sm text-neu-coral flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>批量删除</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 词汇清单表格 */}
        <div className="overflow-x-auto pb-1">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold text-neu-muted uppercase tracking-wider">
                <th className="pb-3.5 pl-2 w-9">
                  <button
                    onClick={toggleSelectPage}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isCurrentPageAllSelected
                        ? 'neu-btn-sm neu-btn-sm-active text-neu-sage'
                        : 'neu-btn-sm text-neu-muted hover:text-neu-main'
                    }`}
                    title={isCurrentPageAllSelected ? '取消全选本页' : '全选本页词条'}
                  >
                    {isCurrentPageAllSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  </button>
                </th>
                <th className="pb-3.5">重点</th>
                <th className="pb-3.5">词条 / 分卷与音标</th>
                <th className="pb-3.5">核心考意与释义</th>
                <th className="pb-3.5">所属模块 / 标签</th>
                <th className="pb-3.5">FSRS 记忆状态</th>
                <th className="pb-3.5 pr-2 text-right">控制</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300/30 dark:divide-slate-700/30">
              {paginatedWords.map(w => {
                const p = progressMap[w.id];
                const isMastered = p?.isMastered || (p && p.stability >= 90);
                const isStarred = p?.isStarred;
                const isPhrase = w.isPhrase || w.tags.includes('短语') || w.word.trim().includes(' ');
                const belongingDeck = decks.find(d => d.id === w.deckId);
                const isSelected = selectedWordIds.has(w.id);

                return (
                  <tr
                    key={w.id}
                    className={`transition-colors group ${
                      isSelected
                        ? 'bg-emerald-500/[0.05] dark:bg-emerald-400/[0.06]'
                        : 'hover:bg-black/[0.015] dark:hover:bg-white/[0.015]'
                    }`}
                  >
                    <td className="py-3.5 pl-2">
                      <button
                        onClick={() => toggleSelectWord(w.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          isSelected
                            ? 'neu-btn-sm neu-btn-sm-active text-neu-sage'
                            : 'neu-btn-sm text-neu-muted hover:text-neu-main'
                        }`}
                        title="勾选词条以进行批量操作"
                      >
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                    </td>

                    <td className="py-3.5">
                      <button
                        onClick={() => onToggleStar(w.id)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                          isStarred
                            ? 'neu-btn-sm neu-btn-sm-active text-neu-amber'
                            : 'neu-btn-sm text-neu-muted hover:text-neu-amber'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-current text-neu-amber' : ''}`} />
                      </button>
                    </td>

                    <td className="py-3.5 font-bold text-neu-main">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{w.word}</span>
                        {/* 快捷直接修改分卷单元轻触下拉器 */}
                        <div className="inline-flex items-center relative" title="点击直接切换此单词所属的 List 单元">
                          <select
                            value={getWordListIndex(w, activeDeckWords, activeDeck?.wordsPerList || DEFAULT_WORDS_PER_LIST)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'new') {
                                handleDirectChangeWordList(w, nextNewListIndex);
                              } else if (val === 'custom') {
                                const inputVal = window.prompt(`请输入单词【${w.word}】的目标分卷序号 (如 1, 2, 3...):`);
                                if (inputVal) {
                                  const num = parseInt(inputVal, 10);
                                  if (!isNaN(num) && num > 0) {
                                    handleDirectChangeWordList(w, num);
                                  }
                                }
                              } else {
                                handleDirectChangeWordList(w, Number(val));
                              }
                            }}
                            className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-mono neu-btn-sm text-neu-amber cursor-pointer outline-none pr-4.5 appearance-none"
                          >
                            {availableListIndices.map(idx => (
                              <option key={idx} value={idx}>List {idx}</option>
                            ))}
                            <option value="new">+ 新建 List {nextNewListIndex}</option>
                            <option value="custom">自定义序号...</option>
                          </select>
                          <ChevronDown className="w-2.5 h-2.5 text-neu-amber absolute right-1 pointer-events-none opacity-80" />
                        </div>
                        {isPhrase && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] neu-inset-sm text-neu-steel font-semibold">
                            短语
                          </span>
                        )}
                        <button
                          onClick={() => SpeechService.speak(w.word, accent)}
                          className="w-7 h-7 rounded-lg neu-btn-sm flex items-center justify-center text-neu-sub hover:text-neu-sage opacity-0 group-hover:opacity-100 transition-opacity"
                          title="播放发音"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs font-normal text-neu-muted font-mono">{w.phonetic_us}</span>
                    </td>

                    <td className="py-3.5 max-w-sm">
                      {(() => {
                        const isExpanded = expandedWordIds.has(w.id);
                        const parsed = parseMeanings(w.translation, w.pos);
                        const cleanDef = cleanEnglishDefinition(w.definition_en, w.word, w.pos);

                        let displayPos = (w.pos || parsed.pos || '').trim();
                        let displayCore = cleanDuplicatePos(parsed.coreText);
                        const leadingPosMatch = displayCore.match(/^([a-z]{1,6}\.)\s*/i);
                        if (leadingPosMatch) {
                          displayPos = leadingPosMatch[1].toLowerCase();
                          displayCore = displayCore.slice(leadingPosMatch[0].length).trim();
                        }

                        return (
                          <div className="flex flex-col gap-1">
                            {!isExpanded ? (
                              <div className="text-neu-main font-medium text-xs leading-relaxed flex items-center flex-wrap gap-1.5">
                                {displayPos && (
                                  <span className="text-neu-sage font-mono font-bold px-1.5 py-0.2 rounded neu-inset-sm">
                                    {displayPos}
                                  </span>
                                )}
                                <span>{displayCore}</span>
                                {parsed.hasExtended && (
                                  <button
                                    onClick={() => toggleWordExpansion(w.id)}
                                    className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold neu-btn-sm text-neu-steel cursor-pointer"
                                    title="点击展开完整考意"
                                  >
                                    <span>+{parsed.extendedItems.length}更多</span>
                                    <ChevronDown className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="p-3 rounded-2xl neu-inset space-y-1.5 animate-fade-in text-xs">
                                <div className="flex items-center justify-between pb-1">
                                  <span className="text-[11px] font-bold text-neu-sage flex items-center gap-1.5">
                                    <span className="neu-led neu-led-sage" />
                                    <span>考点全览 ({parsed.totalCount}项)</span>
                                  </span>
                                  <button
                                    onClick={() => toggleWordExpansion(w.id)}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg neu-btn-sm text-neu-sub flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <span>收起</span>
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                </div>

                                <div>
                                  <span className="text-[10px] font-semibold text-neu-sage neu-raised px-1.5 py-0.2 rounded mr-1.5">
                                    常见考意
                                  </span>
                                  {displayPos && <span className="font-mono font-bold text-neu-sage mr-1">{displayPos}</span>}
                                  <span className="font-medium text-neu-main">{displayCore}</span>
                                </div>

                                {parsed.hasExtended && (
                                  <div className="text-[11px] text-neu-sub pt-0.5">
                                    <span className="text-[10px] font-semibold text-neu-muted neu-raised px-1.5 py-0.2 rounded mr-1.5">
                                      延伸释义
                                    </span>
                                    <span>{parsed.extendedText}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {cleanDef && (
                              <div className="text-[11px] text-neu-muted line-clamp-1 italic font-mono">
                                {cleanDef}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {belongingDeck && (
                          <span className="px-2.5 py-0.5 text-[10px] font-semibold neu-inset-sm text-neu-steel rounded-lg">
                            {belongingDeck.name}
                          </span>
                        )}
                        {w.tags.map(t => (
                          <span key={t} className="px-2 py-0.5 text-[10px] font-medium neu-inset-sm text-neu-sub rounded-lg">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5">
                      {p && p.reps > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs font-mono font-bold flex items-center gap-1.5 ${isMastered ? 'text-neu-sage' : p.stability < 3 ? 'text-neu-coral' : 'text-neu-steel'}`}>
                            <span className={`neu-led ${isMastered ? 'neu-led-sage' : p.stability < 3 ? 'neu-led-coral' : 'neu-led-steel'}`} />
                            <span>S: {p.stability}d</span>
                          </span>
                          <span className="text-[10px] text-neu-muted font-mono">
                            {p.reps}次 · D:{p.difficulty}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-neu-muted flex items-center gap-1.5">
                          <span className="neu-led neu-led-off" />
                          <span>未激活</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 pr-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(w)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold neu-btn-sm text-neu-main hover:text-neu-sage flex items-center gap-1"
                          title="编辑此词条"
                        >
                          <Pencil className="w-3 h-3 text-neu-sage" />
                          <span>编辑</span>
                        </button>

                        {p && p.reps > 0 && (
                          <button
                            onClick={() => onResetWordProgress(w.id)}
                            className="px-2.5 py-1.5 rounded-xl text-xs neu-btn-sm text-neu-sub hover:text-neu-amber"
                            title="重置记忆进度为新词"
                          >
                            重置
                          </button>
                        )}

                        {onDeleteWord && (
                          <button
                            onClick={() => handleDeleteWordDirect(w.id, w.word)}
                            className="w-8 h-8 rounded-xl neu-btn-sm flex items-center justify-center text-neu-muted hover:text-neu-coral opacity-0 group-hover:opacity-100 transition-opacity"
                            title="从词库中删除此词条"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredWords.length === 0 && (
            <div className="text-center py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl neu-inset flex items-center justify-center text-neu-muted">
                <Info className="w-6 h-6" />
              </div>
              <p className="text-neu-sub text-sm font-medium">
                {scopeMode === 'current' 
                  ? `当前词库【${activeDeck.name}】中暂无符合条件的词条`
                  : '没有找到匹配的词汇或短语条目'}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => {
                    setNewDeckId(activeDeck.id);
                    setIsAddWordModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl neu-btn text-neu-sage text-xs font-bold"
                >
                  添加词条 / 短语
                </button>
                {scopeMode === 'current' && (
                  <button
                    onClick={() => setScopeMode('all')}
                    className="px-4 py-2 rounded-xl neu-btn-sm text-neu-sub text-xs font-semibold"
                  >
                    查看全部词库
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部新拟态硬件步进分页器 */}
        {filteredWords.length > 0 && (
          <div className="mt-5 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-neu-sub font-mono">
              <span>
                显示 {(safePage - 1) * pageSize + 1} - {Math.min(safePage * pageSize, filteredWords.length)} / 共 {filteredWords.length} 词条
              </span>
              <div className="flex items-center gap-1 ml-2 p-1 rounded-xl neu-inset-sm">
                {[25, 50, 100].map(sz => (
                  <button
                    key={sz}
                    onClick={() => {
                      setPageSize(sz);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                      pageSize === sz ? 'neu-raised text-neu-sage' : 'text-neu-muted hover:text-neu-main'
                    }`}
                  >
                    {sz}/页
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safePage <= 1}
                className="px-2.5 py-1.5 rounded-xl neu-btn-sm text-xs font-semibold text-neu-sub disabled:opacity-40"
              >
                首页
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-xl neu-btn-sm text-neu-main disabled:opacity-40"
                title="上一页"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3.5 py-1.5 rounded-xl neu-inset-sm text-xs font-mono font-bold text-neu-main">
                PAGE {safePage} / {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-xl neu-btn-sm text-neu-main disabled:opacity-40"
                title="下一页"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage >= totalPages}
                className="px-2.5 py-1.5 rounded-xl neu-btn-sm text-xs font-semibold text-neu-sub disabled:opacity-40"
              >
                末页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 1. 添加短语 / 单词 Modal */}
      {isAddWordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-panel rounded-3xl max-w-lg w-full animate-scale-up max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 sm:px-7 pt-6 sm:pt-7 pb-3 shrink-0">
              <div className="flex items-start justify-between gap-3 pb-3">
                <div>
                  <h3 className="text-base font-bold text-neu-main flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg neu-inset-sm flex items-center justify-center text-neu-sage shrink-0">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span>添加新单词 / 短语搭配</span>
                  </h3>
                  <p className="text-[11px] text-neu-muted mt-1">
                    支持自定义手动填写，亦可输入单词后点击【智能完善】一键补全信息
                  </p>
                </div>
                <button
                  onClick={() => {
                    handleResetAddForm();
                    setIsAddWordModalOpen(false);
                  }}
                  className="w-8 h-8 rounded-xl neu-btn-sm flex items-center justify-center shrink-0 text-neu-muted hover:text-neu-main"
                  title="关闭窗口"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="neu-groove-h" />
            </div>

            <form onSubmit={handleAddSubmit} className="px-6 sm:px-7 pb-6 sm:pb-7 pt-3 space-y-3.5 text-xs overflow-y-auto flex-1">
              {/* 英文内容与智能完善操作区 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-neu-sub">英文短语 / 单词 *</label>
                  <button
                    type="button"
                    onClick={() => setIsPhraseMode(!isPhraseMode)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                      isPhraseMode
                        ? 'neu-btn-sm-active text-neu-steel'
                        : 'neu-btn-sm text-neu-sub'
                    }`}
                  >
                    <span className={`neu-led ${isPhraseMode ? 'neu-led-steel' : 'neu-led-off'}`} />
                    <span>固定短语/词组</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={newWord}
                      onChange={e => handleWordInputChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !newTranslation.trim()) {
                          e.preventDefault();
                          handleSmartEnrich();
                        }
                      }}
                      placeholder="例如: resilient 或 take into account"
                      className="w-full px-3.5 py-2.5 rounded-xl neu-input text-sm font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSmartEnrich}
                    disabled={!newWord.trim() || isEnriching}
                    className="px-3.5 py-2.5 rounded-xl neu-btn text-neu-main font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none shrink-0"
                    title="点击一键智能解析并补全音标、释义、例句与助记（也可随时手动修改）"
                  >
                    {isEnriching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-neu-amber" />
                        <span>完善中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-neu-amber" />
                        <span>智能完善</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 词书实时匹配候选项（《俞敏洪高中词根+联想（乱序版）》及精选词库） */}
                {addBookCandidates.length > 0 && (
                  <div className="mt-2.5 p-2.5 rounded-2xl neu-inset space-y-1.5 animate-fade-in">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-neu-sub uppercase tracking-wider flex items-center gap-1.5">
                        <span className="neu-led neu-led-sage" />
                        <span>内置词书匹配候选项（点击即可一键套用词根/助记/例句）</span>
                      </span>
                      <span className="text-[10px] text-neu-muted font-mono">{addBookCandidates.length} 项匹配</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {addBookCandidates.map(cand => (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => handleApplyCandidate(cand)}
                          className="w-full p-2 rounded-xl neu-btn-sm text-left flex flex-col gap-0.5 hover:text-neu-sage transition-all"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-xs text-neu-main">{cand.word}</span>
                              {cand.phonetic_us && (
                                <span className="text-[10px] font-mono text-neu-muted">{cand.phonetic_us}</span>
                              )}
                              <span className="px-2 py-0.2 rounded-md text-[10px] font-bold neu-inset-sm text-neu-sage">
                                {cand.sourceLabel}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-neu-amber">点击套用 →</span>
                          </div>
                          <div className="text-[11px] text-neu-sub line-clamp-1">
                            {cand.translation}
                          </div>
                          {(cand.roots_affixes || cand.mnemonic) && (
                            <div className="text-[10px] text-neu-muted line-clamp-1">
                              {cand.roots_affixes ? `【词根】${cand.roots_affixes} ` : ''}
                              {cand.mnemonic ? `【助记】${cand.mnemonic}` : ''}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 智能完善反馈横幅 */}
              {smartMessage && (
                <div className="p-2.5 rounded-xl neu-inset-sm text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`neu-led ${smartSource ? 'neu-led-sage' : 'neu-led-amber'}`} />
                    <span className={smartSource ? 'text-neu-sage font-semibold' : 'text-neu-amber font-semibold'}>
                      {smartMessage}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmartMessage(null)}
                    className="text-neu-muted hover:text-neu-main text-xs ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 音标与词性 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">美式音标 (可自定义)</label>
                  <input
                    type="text"
                    value={newPhonetic}
                    onChange={e => setNewPhonetic(e.target.value)}
                    placeholder="例如: /rɪˈzɪliənt/"
                    className="w-full px-3.5 py-2 rounded-xl neu-input font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">词性 / 分类 (可自定义)</label>
                  <input
                    type="text"
                    value={newPos}
                    onChange={e => setNewPos(e.target.value)}
                    placeholder={isPhraseMode ? "v. phr." : "adj. / v. / n."}
                    className="w-full px-3.5 py-2 rounded-xl neu-input font-mono"
                  />
                </div>
              </div>

              {/* 中文释义与英文释义 */}
              <div>
                <label className="font-semibold text-neu-sub mb-1 block">中文释义 *</label>
                <input
                  type="text"
                  required
                  value={newTranslation}
                  onChange={e => setNewTranslation(e.target.value)}
                  placeholder="例如: 有韧性的，能迅速恢复的"
                  className="w-full px-3.5 py-2 rounded-xl neu-input"
                />
              </div>

              <div>
                <label className="font-semibold text-neu-sub mb-1 block">地道英文释义 (可选)</label>
                <input
                  type="text"
                  value={newDefinitionEn}
                  onChange={e => setNewDefinitionEn(e.target.value)}
                  placeholder="able to withstand or recover quickly from difficult conditions"
                  className="w-full px-3.5 py-2 rounded-xl neu-input"
                />
              </div>

              {/* 真实情境例句与中文翻译 */}
              <div>
                <label className="font-semibold text-neu-sub mb-1 block">
                  真实例句 (用于语境挖空填空)
                </label>
                <textarea
                  rows={2}
                  value={newExampleEn}
                  onChange={e => setNewExampleEn(e.target.value)}
                  placeholder="The algorithm takes into account the user response latency."
                  className="w-full p-2.5 rounded-xl neu-input font-mono resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-neu-sub mb-1 block">例句中文翻译</label>
                <input
                  type="text"
                  value={newExampleZh}
                  onChange={e => setNewExampleZh(e.target.value)}
                  placeholder="该算法会充分考虑到用户的反应耗时。"
                  className="w-full px-3.5 py-2 rounded-xl neu-input"
                />
              </div>

              {/* 词根构词与记忆助记 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">词根词缀构词 (可选)</label>
                  <input
                    type="text"
                    value={newRootsAffixes}
                    onChange={e => setNewRootsAffixes(e.target.value)}
                    placeholder="re- (重新) + sil (跳跃) + -ient"
                    className="w-full px-3.5 py-2 rounded-xl neu-input"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">搭配说明 / 记忆口诀 (可选)</label>
                  <input
                    type="text"
                    value={newMnemonic}
                    onChange={e => setNewMnemonic(e.target.value)}
                    placeholder="跌倒再跳起，展现出极强的韧性"
                    className="w-full px-3.5 py-2 rounded-xl neu-input"
                  />
                </div>
              </div>

              {/* 归属词库、List 序号与标签 */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">归属目标词库</label>
                  <select
                    value={newDeckId}
                    onChange={e => setNewDeckId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl neu-input font-semibold"
                  >
                    {decks.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 flex items-center justify-between">
                    <span>分卷单元 (List)</span>
                  </label>
                  <div className="flex gap-1.5 items-center">
                    <select
                      value={isNewListCustom ? 'custom' : (newListIndex || 1)}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setIsNewListCustom(true);
                        } else if (val === 'new') {
                          setIsNewListCustom(false);
                          setNewListIndex(nextNewListIndex);
                        } else {
                          setIsNewListCustom(false);
                          setNewListIndex(Number(val));
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl neu-input font-semibold text-xs"
                    >
                      {availableListIndices.map(idx => {
                        const summary = deckListSummaries.find(s => s.listIndex === idx);
                        const count = summary ? summary.totalWords : 0;
                        return (
                          <option key={idx} value={idx}>
                            List {idx} {count > 0 ? `(${count}词)` : ''}
                          </option>
                        );
                      })}
                      <option value="new">+ 新建 List {nextNewListIndex}</option>
                      <option value="custom">自定义序号...</option>
                    </select>
                    {isNewListCustom && (
                      <input
                        type="number"
                        min={1}
                        value={newListIndex}
                        onChange={e => setNewListIndex(e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : '')}
                        placeholder="序号"
                        className="w-16 px-2 py-2 rounded-xl neu-input font-mono text-xs text-center"
                        title="输入自定义 List 编号"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">分类标签 (逗号分隔)</label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    placeholder="短语, 考研, 写作"
                    className="w-full px-3.5 py-2 rounded-xl neu-input"
                  />
                </div>
              </div>

              {/* 可选自定义 AI 模型配置折叠区 */}
              <div className="pt-2">
                <div className="neu-groove-h mb-2.5" />
                <button
                  type="button"
                  onClick={() => setIsAiSettingsOpen(!isAiSettingsOpen)}
                  className="text-neu-muted hover:text-neu-main text-[11px] flex items-center gap-1.5 transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>{isAiSettingsOpen ? '收起自定义 AI 模型设置' : '高级设置：配置专属 AI 大模型接口 (可选，留空使用内置引擎)'}</span>
                </button>
                {isAiSettingsOpen && (
                  <div className="mt-2.5 p-3.5 rounded-2xl neu-inset space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-neu-main block">启用自定义大模型 API</span>
                        <span className="text-[10px] text-neu-muted">支持 DeepSeek、OpenAI、Moonshot 等兼容接口</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...aiConfig, enabled: !aiConfig.enabled };
                          setAiConfig(updated);
                          saveStoredAiConfig(updated);
                        }}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                          aiConfig.enabled ? 'neu-btn-sm-active text-neu-sage' : 'neu-btn-sm text-neu-muted'
                        }`}
                      >
                        <span className={`neu-led ${aiConfig.enabled ? 'neu-led-sage' : 'neu-led-off'}`} />
                        <span>{aiConfig.enabled ? '已开启' : '已关闭'}</span>
                      </button>
                    </div>
                    <div>
                      <label className="text-[10px] text-neu-muted block mb-1">API Key</label>
                      <input
                        type="password"
                        value={aiConfig.apiKey || ''}
                        onChange={e => {
                          const updated = { ...aiConfig, apiKey: e.target.value };
                          setAiConfig(updated);
                          saveStoredAiConfig(updated);
                        }}
                        placeholder="sk-..."
                        className="w-full px-2.5 py-1.5 rounded-lg neu-input font-mono text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-neu-muted block mb-1">API Base URL</label>
                        <input
                          type="text"
                          value={aiConfig.baseUrl || ''}
                          onChange={e => {
                            const updated = { ...aiConfig, baseUrl: e.target.value };
                            setAiConfig(updated);
                            saveStoredAiConfig(updated);
                          }}
                          placeholder="https://api.deepseek.com/v1"
                          className="w-full px-2.5 py-1.5 rounded-lg neu-input font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neu-muted block mb-1">模型名称 (Model)</label>
                        <input
                          type="text"
                          value={aiConfig.model || ''}
                          onChange={e => {
                            const updated = { ...aiConfig, model: e.target.value };
                            setAiConfig(updated);
                            saveStoredAiConfig(updated);
                          }}
                          placeholder="deepseek-chat"
                          className="w-full px-2.5 py-1.5 rounded-lg neu-input font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 底部操作区 */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetAddForm}
                  className="px-3 py-2 rounded-xl neu-btn-sm text-neu-muted hover:text-neu-main text-xs font-semibold"
                >
                  清空表单
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetAddForm();
                      setIsAddWordModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl neu-btn-sm text-neu-sub font-semibold"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!newWord.trim() || !newTranslation.trim()}
                    className="px-5 py-2 rounded-xl neu-btn text-neu-main font-bold disabled:opacity-40 flex items-center gap-2"
                  >
                    <span className="neu-led neu-led-sage" />
                    <Check className="w-4 h-4 text-neu-sage" />
                    <span>保存并加入复习</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 编辑词条 / 短语信息 Modal */}
      {editingWord && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-panel rounded-3xl max-w-lg w-full animate-scale-up max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 sm:px-7 pt-6 sm:pt-7 pb-3 shrink-0">
              <div className="flex items-start justify-between gap-3 pb-3">
                <div>
                  <h3 className="text-base font-bold text-neu-main flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg neu-inset-sm flex items-center justify-center text-neu-sage shrink-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </div>
                    <span>编辑词条信息：{editingWord.word}</span>
                  </h3>
                  <p className="text-[11px] text-neu-muted mt-1">
                    所有字段均可自由修改，亦可点击【智能重新完善】快速同步权威释义
                  </p>
                </div>
                <button
                  onClick={() => setEditingWord(null)}
                  className="w-8 h-8 rounded-xl neu-btn-sm flex items-center justify-center shrink-0 text-neu-muted hover:text-neu-main"
                  title="关闭窗口"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="neu-groove-h" />
            </div>

            <form onSubmit={handleSaveEditSubmit} className="px-6 sm:px-7 pb-6 sm:pb-7 pt-3 space-y-3.5 text-xs overflow-y-auto flex-1">
              {/* 词条名称与智能完善按钮 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-neu-sub">英文词条 / 短语 *</label>
                  <button
                    type="button"
                    onClick={() => setEditIsPhrase(!editIsPhrase)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                      editIsPhrase
                        ? 'neu-btn-sm-active text-neu-steel'
                        : 'neu-btn-sm text-neu-sub'
                    }`}
                  >
                    <span className={`neu-led ${editIsPhrase ? 'neu-led-steel' : 'neu-led-off'}`} />
                    <span>固定短语/词组</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={editWordText}
                      onChange={e => setEditWordText(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl neu-input text-sm font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleEditSmartEnrich}
                    disabled={!editWordText.trim() || isEditEnriching}
                    className="px-3.5 py-2.5 rounded-xl neu-btn text-neu-main font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none shrink-0"
                    title="点击重新从权威词典/AI获取最新音标、中文释义和权威例句"
                  >
                    {isEditEnriching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-neu-amber" />
                        <span>完善中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-neu-amber" />
                        <span>智能重新完善</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 编辑模式：词书匹配候选项 */}
                {editBookCandidates.length > 0 && (
                  <div className="mt-2.5 p-2.5 rounded-2xl neu-inset space-y-1.5 animate-fade-in">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-neu-sub uppercase tracking-wider flex items-center gap-1.5">
                        <span className="neu-led neu-led-sage" />
                        <span>内置词书匹配候选项（点击可切换套用《高中词根+联想》等版本）</span>
                      </span>
                      <span className="text-[10px] text-neu-muted font-mono">{editBookCandidates.length} 项匹配</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                      {editBookCandidates.map(cand => (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => handleApplyEditCandidate(cand)}
                          className="w-full p-2 rounded-xl neu-btn-sm text-left flex flex-col gap-0.5 hover:text-neu-sage transition-all"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-xs text-neu-main">{cand.word}</span>
                              {cand.phonetic_us && (
                                <span className="text-[10px] font-mono text-neu-muted">{cand.phonetic_us}</span>
                              )}
                              <span className="px-2 py-0.2 rounded-md text-[10px] font-bold neu-inset-sm text-neu-sage">
                                {cand.sourceLabel}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-neu-amber">点击套用 →</span>
                          </div>
                          <div className="text-[11px] text-neu-sub line-clamp-1">
                            {cand.translation}
                          </div>
                          {(cand.roots_affixes || cand.mnemonic) && (
                            <div className="text-[10px] text-neu-muted line-clamp-1">
                              {cand.roots_affixes ? `【词根】${cand.roots_affixes} ` : ''}
                              {cand.mnemonic ? `【助记】${cand.mnemonic}` : ''}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 智能完善反馈 */}
              {editSmartMessage && (
                <div className="p-2.5 rounded-xl neu-inset-sm text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="neu-led neu-led-sage" />
                    <span className="text-neu-sage font-semibold">{editSmartMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditSmartMessage(null)}
                    className="text-neu-muted hover:text-neu-main text-xs ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 音标与词性 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">美式音标</label>
                  <input
                    type="text"
                    value={editPhonetic}
                    onChange={e => setEditPhonetic(e.target.value)}
                    placeholder="例如: /kɔːz/"
                    className="w-full px-3.5 py-2 rounded-xl neu-input font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">词性 / 分类</label>
                  <input
                    type="text"
                    value={editPos}
                    onChange={e => setEditPos(e.target.value)}
                    placeholder="例如: n./v."
                    className="w-full px-3.5 py-2 rounded-xl neu-input font-mono"
                  />
                </div>
              </div>

              {/* 中文释义与英文释义 */}
              <div>
                <label className="font-semibold text-neu-sub mb-1 block">中文释义 *</label>
                <input
                  type="text"
                  required
                  value={editTranslation}
                  onChange={e => setEditTranslation(e.target.value)}
                  placeholder="例如: n. 原因，起因；v. 引起，使发生"
                  className="w-full px-3.5 py-2 rounded-xl neu-input"
                />
              </div>

              <div>
                <label className="font-semibold text-neu-sub mb-1 block">地道英文释义 (可选)</label>
                <input
                  type="text"
                  value={editDefinitionEn}
                  onChange={e => setEditDefinitionEn(e.target.value)}
                  placeholder="make something happen; a person or thing that gives rise to an action"
                  className="w-full px-3.5 py-2 rounded-xl neu-input"
                />
              </div>

              {/* 例句与翻译 */}
              <div>
                <label className="font-semibold text-neu-sub mb-1 block">
                  真实例句 (用于语境挖空填空)
                </label>
                <textarea
                  rows={2}
                  value={editExampleEn}
                  onChange={e => setEditExampleEn(e.target.value)}
                  className="w-full p-2.5 rounded-xl neu-input font-mono resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-neu-sub mb-1 block">例句中文翻译</label>
                <input
                  type="text"
                  value={editExampleZh}
                  onChange={e => setEditExampleZh(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl neu-input"
                />
              </div>

              {/* 词根词缀与记忆助记 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">词根词缀构词 (可选)</label>
                  <input
                    type="text"
                    value={editRootsAffixes}
                    onChange={e => setEditRootsAffixes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl neu-input"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">科学记忆助记 / 口诀 (可选)</label>
                  <input
                    type="text"
                    value={editMnemonic}
                    onChange={e => setEditMnemonic(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl neu-input"
                  />
                </div>
              </div>

              {/* 归属词库、List 序号与标签 */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">归属词库</label>
                  <select
                    value={editDeckId}
                    onChange={e => setEditDeckId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl neu-input font-semibold"
                  >
                    {decks.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 flex items-center justify-between">
                    <span>分卷单元 (List)</span>
                  </label>
                  <div className="flex gap-1.5 items-center">
                    <select
                      value={isEditListCustom ? 'custom' : (editListIndex || 1)}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setIsEditListCustom(true);
                        } else if (val === 'new') {
                          setIsEditListCustom(false);
                          setEditListIndex(nextNewListIndex);
                        } else {
                          setIsEditListCustom(false);
                          setEditListIndex(Number(val));
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl neu-input font-semibold text-xs"
                    >
                      {availableListIndices.map(idx => {
                        const summary = deckListSummaries.find(s => s.listIndex === idx);
                        const count = summary ? summary.totalWords : 0;
                        return (
                          <option key={idx} value={idx}>
                            List {idx} {count > 0 ? `(${count}词)` : ''}
                          </option>
                        );
                      })}
                      <option value="new">+ 新建 List {nextNewListIndex}</option>
                      <option value="custom">自定义序号...</option>
                    </select>
                    {isEditListCustom && (
                      <input
                        type="number"
                        min={1}
                        value={editListIndex}
                        onChange={e => setEditListIndex(e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : '')}
                        placeholder="序号"
                        className="w-16 px-2 py-2 rounded-xl neu-input font-mono text-xs text-center"
                        title="输入自定义 List 编号"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">分类标签 (逗号分隔)</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={e => setEditTags(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl neu-input"
                  />
                </div>
              </div>

              {/* 底部操作区 */}
              <div className="flex items-center justify-between pt-2">
                {onDeleteWord ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteWordDirect(editingWord.id, editingWord.word)}
                    className="px-3 py-2 rounded-xl neu-btn-sm text-neu-coral text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除此词</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingWord(null)}
                    className="px-4 py-2 rounded-xl neu-btn-sm text-neu-sub font-semibold"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!editWordText.trim() || !editTranslation.trim()}
                    className="px-5 py-2 rounded-xl neu-btn text-neu-main font-bold disabled:opacity-40 flex items-center gap-2"
                  >
                    <span className="neu-led neu-led-sage" />
                    <Check className="w-4 h-4 text-neu-sage" />
                    <span>保存修改</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 新建词库 Modal */}
      {isCreateDeckModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-panel rounded-3xl max-w-md w-full p-6 animate-scale-up">
            <div className="flex items-center justify-between pb-3 mb-3">
              <h3 className="text-base font-bold text-neu-main flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg neu-inset-sm flex items-center justify-center text-neu-steel shrink-0">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <span>新建专属词库 / 短语库</span>
              </h3>
              <button
                onClick={() => setIsCreateDeckModalOpen(false)}
                className="w-8 h-8 rounded-xl neu-btn-sm flex items-center justify-center shrink-0 text-neu-muted hover:text-neu-main"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="neu-groove-h mb-4" />

            <form onSubmit={handleCreateDeckSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neu-sub mb-1 block">词库名称 *</label>
                <input
                  type="text"
                  required
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  placeholder="例如: 高三一轮错题词本、考研学术写作短语库"
                  className="w-full px-3.5 py-2.5 rounded-xl neu-input text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-neu-sub mb-1 block">词库定位与描述</label>
                <textarea
                  rows={2}
                  value={deckDesc}
                  onChange={e => setDeckDesc(e.target.value)}
                  placeholder="精选学术议论文中的承上启下连接短语与高频搭配"
                  className="w-full p-2.5 rounded-xl neu-input resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">词库类别</label>
                  <select
                    value={deckCategory}
                    onChange={e => setDeckCategory(e.target.value as DeckMetadata['category'])}
                    className="w-full px-3 py-2 rounded-xl neu-input font-semibold"
                  >
                    <option value="gaozhong">高中 / 高考英语</option>
                    <option value="cet4">CET-4 大学四级</option>
                    <option value="cet6">CET-6 大学六级</option>
                    <option value="kaoyan">考研英语冲刺</option>
                    <option value="ielts">雅思 / 托福留学</option>
                    <option value="gre">GRE 学术进阶</option>
                    <option value="phrases">短语与固定搭配</option>
                    <option value="custom">自定义词库</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">指示灯色系</label>
                  <select
                    value={deckColor}
                    onChange={e => setDeckColor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl neu-input"
                  >
                    <option value="from-emerald-500 to-teal-500">鼠尾草绿 (学术风)</option>
                    <option value="from-blue-500 to-cyan-500">冷钢灰蓝 (清爽风)</option>
                    <option value="from-amber-500 to-orange-500">暖珀陶橙 (冲刺风)</option>
                    <option value="from-rose-500 to-pink-500">柔雾珊瑚 (突破风)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">学段/目标铭牌 (可选)</label>
                  <input
                    type="text"
                    value={deckTargetLevel}
                    onChange={e => setDeckTargetLevel(e.target.value)}
                    placeholder="如: 高考 135+ / 必背"
                    className="w-full px-3 py-2 rounded-xl neu-input"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">每组 List 词数</label>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={deckWordsPerList}
                    onChange={e => setDeckWordsPerList(Math.max(5, Math.min(200, Number(e.target.value) || 20)))}
                    className="w-full px-3 py-2 rounded-xl neu-input font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateDeckModalOpen(false)}
                  className="px-4 py-2 rounded-xl neu-btn-sm text-neu-sub font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!deckName.trim()}
                  className="px-5 py-2 rounded-xl neu-btn text-neu-main font-bold disabled:opacity-40 flex items-center gap-2"
                >
                  <span className="neu-led neu-led-sage" />
                  <span>立即创建词库</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2B. 编辑词书基本信息 Modal */}
      {editingDeck && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-panel rounded-3xl max-w-lg w-full animate-scale-up max-h-[90vh] flex flex-col overflow-hidden">
            {/* 固定顶部标题槽 */}
            <div className="px-6 sm:px-7 pt-6 sm:pt-7 pb-3 shrink-0">
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-base font-bold text-neu-main flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg neu-inset-sm flex items-center justify-center text-neu-sage shrink-0">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <span>编辑词书基本信息 · DECK METADATA</span>
                </h3>
                <button
                  onClick={() => setEditingDeck(null)}
                  className="w-8 h-8 rounded-xl neu-btn-sm flex items-center justify-center shrink-0 text-neu-muted hover:text-neu-main"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="neu-groove-h" />
            </div>

            {/* 独立滚动表单区 */}
            <form onSubmit={handleUpdateDeckSubmit} className="px-6 sm:px-7 pb-6 sm:pb-7 pt-3 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* 1. 词书名称与置顶开关 */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label className="font-semibold text-neu-sub mb-1 block">
                    词书名称 *
                  </label>
                  <input
                    type="text"
                    required
                    value={editDeckName}
                    onChange={e => setEditDeckName(e.target.value)}
                    placeholder="输入词书名称，如：高中词根+联想·核心冲刺卷"
                    className="w-full px-3.5 py-2.5 rounded-xl neu-input text-sm font-bold text-neu-main"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setEditDeckIsPinned(!editDeckIsPinned)}
                  className={`px-3.5 py-2.5 rounded-xl font-semibold flex items-center gap-1.5 shrink-0 transition-all ${
                    editDeckIsPinned
                      ? 'neu-btn-sm neu-btn-sm-active text-neu-amber'
                      : 'neu-btn-sm text-neu-sub hover:text-neu-main'
                  }`}
                  title="置顶后该词书将排在词库模块矩阵最前排"
                >
                  <span className={`neu-led ${editDeckIsPinned ? 'neu-led-amber' : 'neu-led-off'}`} />
                  <span>{editDeckIsPinned ? '★ 已置顶词书' : '置顶词书'}</span>
                </button>
              </div>

              {/* 2. 词书定位简介与备注 */}
              <div>
                <label className="font-semibold text-neu-sub mb-1 block">
                  词书定位、来源说明或学习计划备注
                </label>
                <textarea
                  rows={2}
                  value={editDeckDesc}
                  onChange={e => setEditDeckDesc(e.target.value)}
                  placeholder="编写词书简介、背诵周期目标或章节说明..."
                  className="w-full p-2.5 rounded-xl neu-input resize-none leading-relaxed"
                />
              </div>

              {/* 3. 学科分类与目标学段铭牌 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">
                    所属学科 / 考试分类
                  </label>
                  <select
                    value={editDeckCategory}
                    onChange={e => setEditDeckCategory(e.target.value as DeckMetadata['category'])}
                    className="w-full px-3 py-2 rounded-xl neu-input font-semibold"
                  >
                    <option value="gaozhong">高中 / 高考英语</option>
                    <option value="cet4">CET-4 大学四级</option>
                    <option value="cet6">CET-6 大学六级</option>
                    <option value="kaoyan">考研英语冲刺</option>
                    <option value="ielts">雅思 / 托福留学</option>
                    <option value="gre">GRE 学术进阶</option>
                    <option value="phrases">短语与固定搭配</option>
                    <option value="custom">自定义专属词库</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">
                    目标学段 / 难度铭牌 (可选)
                  </label>
                  <input
                    type="text"
                    value={editDeckTargetLevel}
                    onChange={e => setEditDeckTargetLevel(e.target.value)}
                    placeholder="例如: 高考 3500 / 乱序版 / 一轮必背"
                    className="w-full px-3 py-2 rounded-xl neu-input"
                  />
                </div>
              </div>

              {/* 4. 硬件面板图标选择 */}
              <div>
                <label className="font-semibold text-neu-sub mb-1.5 block">
                  面板铭牌图标 (Icon)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-2 rounded-2xl neu-inset">
                  {[
                    { key: 'BookOpen', label: '词书', icon: <BookOpen className="w-3.5 h-3.5" /> },
                    { key: 'Layers', label: '分卷', icon: <Layers className="w-3.5 h-3.5" /> },
                    { key: 'Workflow', label: '搭配', icon: <Workflow className="w-3.5 h-3.5" /> },
                    { key: 'Sparkles', label: '精选', icon: <Sparkles className="w-3.5 h-3.5" /> },
                    { key: 'Star', label: '重点', icon: <Star className="w-3.5 h-3.5" /> },
                    { key: 'FileText', label: '大纲', icon: <FileText className="w-3.5 h-3.5" /> },
                  ].map(opt => {
                    const active = editDeckIcon === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setEditDeckIcon(opt.key)}
                        className={`py-2 px-2 rounded-xl flex flex-col items-center gap-1 font-semibold transition-all ${
                          active ? 'neu-raised text-neu-sage' : 'text-neu-sub hover:text-neu-main'
                        }`}
                      >
                        {opt.icon}
                        <span className="text-[10px]">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. 硬件指示灯色系选择 */}
              <div>
                <label className="font-semibold text-neu-sub mb-1.5 block">
                  指示灯与强调色系 (LED Accent)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-2xl neu-inset">
                  {[
                    { value: 'from-emerald-500 to-teal-500', label: '鼠尾草绿', led: 'neu-led-sage', text: 'text-neu-sage' },
                    { value: 'from-blue-500 to-cyan-500', label: '冷钢灰蓝', led: 'neu-led-steel', text: 'text-neu-steel' },
                    { value: 'from-amber-500 to-orange-500', label: '暖珀陶橙', led: 'neu-led-amber', text: 'text-neu-amber' },
                    { value: 'from-rose-500 to-pink-500', label: '柔雾珊瑚', led: 'neu-led-coral', text: 'text-neu-coral' },
                  ].map(opt => {
                    const currentTone = getDeckTone(editDeckColor);
                    const optTone = getDeckTone(opt.value);
                    const active = currentTone.label === optTone.label;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditDeckColor(opt.value)}
                        className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all ${
                          active ? `neu-raised ${opt.text}` : 'text-neu-sub hover:text-neu-main'
                        }`}
                      >
                        <span className={`neu-led ${opt.led}`} />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. 分卷规格 (每组 List 词数) 与自动重分卷选项 */}
              <div className="p-3.5 rounded-2xl neu-inset space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="font-bold text-neu-main block">默认每组分卷容量 (Words Per List)</span>
                    <span className="text-[11px] text-neu-muted">
                      当前词书共 {getDeckWordCount(editingDeck)} 词，按 {editDeckWordsPerList} 词/组约分为 {Math.max(1, Math.ceil(getDeckWordCount(editingDeck) / Math.max(1, editDeckWordsPerList)))} 个 List
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[15, 20, 30, 40, 50].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEditDeckWordsPerList(preset)}
                        className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all ${
                          editDeckWordsPerList === preset
                            ? 'neu-raised text-neu-sage'
                            : 'neu-btn-sm text-neu-sub hover:text-neu-main'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={editDeckWordsPerList}
                      onChange={e => setEditDeckWordsPerList(Math.max(5, Math.min(200, Number(e.target.value) || 20)))}
                      className="w-16 px-2 py-1 rounded-lg neu-input font-mono text-center text-xs"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none text-neu-sub hover:text-neu-main">
                  <input
                    type="checkbox"
                    checked={editDeckRepartitionNow}
                    onChange={e => setEditDeckRepartitionNow(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span>保存时立即按 {editDeckWordsPerList} 词/组重新均分该词书内所有词汇的 List 序号</span>
                </label>
              </div>

              {/* 底部操作区 */}
              <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
                {DECKS.some(d => d.id === editingDeck.id) ? (
                  <button
                    type="button"
                    onClick={handleRestoreDefaultDeckMeta}
                    className="px-3 py-2 rounded-xl neu-btn-sm text-neu-amber font-semibold flex items-center gap-1.5"
                    title="还原此官方词书的默认名称、简介、图标与配色"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>还原官方默认信息</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingDeck(null)}
                    className="px-4 py-2 rounded-xl neu-btn-sm text-neu-sub font-semibold"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!editDeckName.trim()}
                    className="px-5 py-2 rounded-xl neu-btn text-neu-main font-bold disabled:opacity-40 flex items-center gap-2"
                  >
                    <span className="neu-led neu-led-sage" />
                    <Check className="w-4 h-4 text-neu-sage" />
                    <span>保存词书信息</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. 增强型批量导入 Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-panel rounded-3xl max-w-xl w-full animate-scale-up max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 sm:px-7 pt-6 sm:pt-7 pb-3 shrink-0">
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-base font-bold text-neu-main flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg neu-inset-sm flex items-center justify-center text-neu-sage shrink-0">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span>导入单词 / 短语 / 备份恢复</span>
                </h3>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="w-8 h-8 rounded-xl neu-btn-sm flex items-center justify-center shrink-0 text-neu-muted hover:text-neu-main"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="neu-groove-h" />
            </div>

            <div className="px-6 sm:px-7 pb-6 sm:pb-7 pt-3 overflow-y-auto flex-1">
              {/* 本地文件选择入口 */}
              <div className="mb-4 p-3.5 rounded-2xl neu-inset flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-xs text-neu-main block">从本地文件读取导入</span>
                  <span className="text-[11px] text-neu-muted">支持 .txt / .csv / 备份 .json 文件一键读取</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl neu-btn-sm text-xs font-semibold text-neu-main flex items-center gap-1.5"
                >
                  <FileUp className="w-4 h-4 text-neu-sage" />
                  <span>选择本地文件</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">导入目标词库</label>
                  <select
                    value={importTargetDeckId}
                    onChange={e => setImportTargetDeckId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl neu-input font-semibold"
                  >
                    {decks.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-neu-sub mb-1 block">分类标签 (可选)</label>
                  <input
                    type="text"
                    value={importTag}
                    onChange={e => setImportTag(e.target.value)}
                    placeholder="例如: 核心短语、真题词汇"
                    className="w-full px-3.5 py-2 rounded-xl neu-input"
                  />
                </div>
              </div>

              <div className="mb-2">
                <label className="text-xs font-semibold text-neu-sub mb-1 block">
                  或直接粘贴文本内容：
                </label>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder="支持以下任意格式：&#10;1. take into account, 考虑到&#10;2. come up with，想出方案 (支持中文逗号/制表符/分号)&#10;3. play a crucial role in 起至关重要的作用&#10;4. 粘贴备份文件 JSON 内容"
                  rows={7}
                  className="w-full p-3.5 rounded-2xl neu-input text-xs font-mono resize-none"
                />
              </div>

              <p className="text-[11px] text-neu-muted mb-4">
                包含空格的条目会自动标记为短语。若粘贴的是备份 JSON，系统会自动完整恢复词库、词条与学习进度。
              </p>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl neu-btn-sm text-neu-sub text-xs font-semibold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleImportSubmit}
                  disabled={!importText.trim()}
                  className="px-5 py-2 rounded-xl neu-btn text-neu-main text-xs font-bold disabled:opacity-40 flex items-center gap-2"
                >
                  <span className="neu-led neu-led-sage" />
                  <span>开始解析并导入</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重新均分词库 List Modal */}
      {isRepartitionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="neu-panel rounded-3xl max-w-md w-full p-6 animate-scale-up">
            <div className="flex items-center justify-between pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl neu-inset-sm flex items-center justify-center text-neu-sage shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-neu-main">分卷设置 · 调整 List 规格</h3>
                  <p className="text-xs text-neu-muted">设置【{activeDeck.name}】每个 List 容纳的单词量</p>
                </div>
              </div>
              <button
                onClick={() => setIsRepartitionModalOpen(false)}
                className="w-8 h-8 rounded-xl neu-btn-sm flex items-center justify-center shrink-0 text-neu-muted hover:text-neu-main"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="neu-groove-h mb-4" />

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neu-sub mb-2 block">
                  快捷选择每 List 单词量
                </label>
                <div className="p-2 rounded-2xl neu-inset grid grid-cols-4 gap-2">
                  {[15, 20, 25, 30].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setCustomWordsPerList(cnt)}
                      className={`py-2 rounded-xl font-mono font-bold transition-all ${
                        customWordsPerList === cnt
                          ? 'neu-raised text-neu-sage'
                          : 'text-neu-sub hover:text-neu-main'
                      }`}
                    >
                      {cnt} 词
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-neu-sub mb-1 block">
                  自定义每组词数
                </label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={customWordsPerList}
                  onChange={e => setCustomWordsPerList(Math.max(1, parseInt(e.target.value) || 20))}
                  className="w-full px-3.5 py-2.5 rounded-xl neu-input font-mono text-sm"
                />
                <span className="text-[11px] text-neu-muted mt-1.5 block">
                  当前词库共 {activeDeckWords.length} 词，调整后将自动划分为约 {Math.ceil(activeDeckWords.length / customWordsPerList)} 个 List。
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRepartitionModalOpen(false)}
                  className="px-4 py-2 rounded-xl neu-btn-sm text-neu-sub font-semibold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onRepartitionDeck) {
                      onRepartitionDeck(activeDeck.id, customWordsPerList);
                      setBannerMessage(`已成功将【${activeDeck.name}】按每组 ${customWordsPerList} 词重新划分 List！`);
                      setTimeout(() => setBannerMessage(null), 3500);
                    }
                    setIsRepartitionModalOpen(false);
                  }}
                  className="px-5 py-2 rounded-xl neu-btn text-neu-main font-bold flex items-center gap-2"
                >
                  <span className="neu-led neu-led-sage" />
                  <span>确认重新划分</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
