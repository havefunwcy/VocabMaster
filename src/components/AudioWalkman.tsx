import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Repeat,
  Repeat1,
  Shuffle,
  Star,
  Headphones,
  Eye,
  EyeOff,
  RotateCcw,
  Layers,
  Quote
} from 'lucide-react';
import { WordItem, WordProgress, UserSettings, State } from '../types';
import { SpeechService, extractFirstChineseMeaning } from '../utils/speech';
import { cleanDuplicatePos } from '../utils/formatTranslation';

interface AudioWalkmanProps {
  cards: { word: WordItem; progress: WordProgress }[];
  settings: UserSettings;
  onToggleStar: (wordId: string) => void;
  activeDeckName?: string;
  activeListIndex?: number | 'all';
}

type WalkmanPhase = 'idle' | 'en' | 'zh' | 'wait';
type LoopMode = 'sequence' | 'one' | 'shuffle';
type FilterMode = 'all' | 'unmastered' | 'starred';

export const AudioWalkman: React.FC<AudioWalkmanProps> = ({
  cards,
  settings,
  onToggleStar,
  activeDeckName,
  activeListIndex,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<WalkmanPhase>('idle');
  const [loopMode, setLoopMode] = useState<LoopMode>('sequence');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [enRepeat, setEnRepeat] = useState<1 | 2>(1);
  const [speedPreset, setSpeedPreset] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [gapMs, setGapMs] = useState<number>(1100);
  const [blindMode, setBlindMode] = useState<boolean>(false);

  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playlistContainerRef = useRef<HTMLDivElement>(null);

  // 根据筛选范围过滤播放列表
  const playlist = useMemo(() => {
    if (filterMode === 'starred') {
      return cards.filter(c => c.progress.isStarred);
    }
    if (filterMode === 'unmastered') {
      return cards.filter(c => !c.progress.isMastered && c.progress.stability < 30);
    }
    return cards;
  }, [cards, filterMode]);

  // 确保索引合法
  const safeIndex = playlist.length > 0 ? Math.min(currentIndex, playlist.length - 1) : 0;
  const currentCard = playlist[safeIndex];

  // 当切换词书或分卷时，重置到第一首并暂停
  useEffect(() => {
    setIsPlaying(false);
    setPhase('idle');
    setCurrentIndex(0);
    SpeechService.stop();
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
  }, [activeDeckName, activeListIndex, filterMode]);

  // 组件卸载时停止所有语音与定时器
  useEffect(() => {
    return () => {
      SpeechService.stop();
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    };
  }, []);

  // 自动将播放列表中的当前词条平滑滚入可视区域
  useEffect(() => {
    const container = playlistContainerRef.current;
    if (!container) return;
    const activeRow = container.querySelector('[data-walkman-active="true"]') as HTMLElement | null;
    if (activeRow) {
      activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [safeIndex]);

  const getRates = useCallback(() => {
    if (speedPreset === 'slow') return { enRate: 0.85, zhRate: 0.95 };
    if (speedPreset === 'fast') return { enRate: 1.15, zhRate: 1.22 };
    return { enRate: 0.98, zhRate: 1.06 };
  }, [speedPreset]);

  const advanceToNext = useCallback(() => {
    if (playlist.length === 0) return;
    setCurrentIndex(prev => {
      if (loopMode === 'one') return prev;
      if (loopMode === 'shuffle' && playlist.length > 1) {
        let next = Math.floor(Math.random() * playlist.length);
        if (next === prev) next = (prev + 1) % playlist.length;
        return next;
      }
      return (prev + 1) % playlist.length;
    });
  }, [playlist.length, loopMode]);

  const handlePrev = useCallback(() => {
    if (playlist.length === 0) return;
    SpeechService.stop();
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    setPhase('idle');
    setCurrentIndex(prev => (prev - 1 + playlist.length) % playlist.length);
  }, [playlist.length]);

  const handleNext = useCallback(() => {
    if (playlist.length === 0) return;
    SpeechService.stop();
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    setPhase('idle');
    setCurrentIndex(prev => (prev + 1) % playlist.length);
  }, [playlist.length]);

  // 单次触发当前单词的「先英文 -> 后中文第一个意思」播报（暂停态也可随时点播）
  const playOnceCurrent = useCallback(async () => {
    if (!currentCard) return;
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    setIsPlaying(false);
    const { enRate, zhRate } = getRates();
    await SpeechService.speakBilingual(currentCard.word.word, currentCard.word.translation, {
      accent: settings.accent,
      enRate,
      zhRate,
      enRepeat,
      pauseBetweenMs: 260,
      onPhaseChange: (p) => setPhase(p),
    });
  }, [currentCard, getRates, settings.accent, enRepeat]);

  // 连续自动速听引擎
  useEffect(() => {
    if (!isPlaying || !currentCard) {
      return;
    }

    let cancelled = false;
    const { enRate, zhRate } = getRates();

    const runStep = async () => {
      const completed = await SpeechService.speakBilingual(
        currentCard.word.word,
        currentCard.word.translation,
        {
          accent: settings.accent,
          enRate,
          zhRate,
          enRepeat,
          pauseBetweenMs: 260,
          onPhaseChange: (p) => {
            if (!cancelled) setPhase(p);
          },
        }
      );

      if (cancelled || !completed) return;

      setPhase('wait');
      gapTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        setPhase('idle');
        if (loopMode === 'one') {
          // 单曲循环：再次触发当前词
          runStep();
        } else {
          advanceToNext();
        }
      }, gapMs);
    };

    runStep();

    return () => {
      cancelled = true;
      if (gapTimerRef.current) {
        clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
    };
  }, [isPlaying, safeIndex, currentCard?.word.id, enRepeat, speedPreset, gapMs, loopMode, settings.accent, getRates, advanceToNext]);

  // 键盘快捷键控制
  useEffect(() => {
    if (!settings.keyboardShortcutsEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => {
          if (prev) {
            SpeechService.stop();
            setPhase('idle');
          }
          return !prev;
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playOnceCurrent();
      } else if ((e.key === 's' || e.key === 'S') && currentCard) {
        e.preventDefault();
        onToggleStar(currentCard.word.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settings.keyboardShortcutsEnabled, handlePrev, handleNext, playOnceCurrent, currentCard, onToggleStar]);

  const togglePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setPhase('idle');
      SpeechService.stop();
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    } else {
      setIsPlaying(true);
    }
  };

  if (playlist.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto neu-panel rounded-3xl p-8 text-center animate-scale-up">
        <div className="w-14 h-14 rounded-2xl neu-inset text-neu-steel mx-auto flex items-center justify-center mb-4">
          <Headphones className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-neu-main mb-2">
          当前筛选范围内暂无可速听的单词
        </h3>
        <p className="text-xs text-neu-sub mb-5">
          请切换回「全部词汇」或选择其他 List 分卷。
        </p>
        {filterMode !== 'all' && (
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className="px-5 py-2.5 rounded-xl neu-btn text-xs font-bold text-neu-sage"
          >
            显示全部词汇 ({cards.length})
          </button>
        )}
      </div>
    );
  }

  const firstMeaning = extractFirstChineseMeaning(currentCard.word.translation);
  const fullCleanedTranslation = cleanDuplicatePos(currentCard.word.translation);
  // 盲听模式下，仅在播放英文时遮盖中文，读到中文或处于等待/空闲时揭晓
  const isMeaningHidden = blindMode && phase === 'en';

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5 animate-fade-in">
      {/* 顶部模式筛选与播放状态栏 */}
      <div className="flex items-center justify-between px-1 text-xs text-neu-sub flex-wrap gap-2">
        <div className="flex items-center gap-1.5 neu-inset p-1 rounded-2xl">
          {[
            { id: 'all' as FilterMode, label: `全部 (${cards.length})` },
            {
              id: 'unmastered' as FilterMode,
              label: `待巩固 (${cards.filter(c => !c.progress.isMastered && c.progress.stability < 30).length})`,
            },
            {
              id: 'starred' as FilterMode,
              label: `星标 (${cards.filter(c => c.progress.isStarred).length})`,
            },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                filterMode === tab.id ? 'neu-raised text-neu-main' : 'text-neu-sub hover:text-neu-main'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 盲听默想开关 */}
        <button
          type="button"
          onClick={() => setBlindMode(!blindMode)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            blindMode ? 'neu-btn-sm neu-btn-sm-active text-neu-sage' : 'neu-btn-sm text-neu-sub hover:text-neu-main'
          }`}
          title="开启后：读英文时先隐藏中文，给你1秒反应时间，读中文时自动揭晓"
        >
          {blindMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{blindMode ? '听音默想中' : '同步显示释义'}</span>
        </button>
      </div>

      {/* 主新拟态随身速听声学主机 */}
      <div className="neu-panel rounded-3xl p-6 sm:p-8 flex flex-col gap-6">
        {/* 顶部曲目序号、双语阶段指示灯与收藏键 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl neu-inset-sm font-mono font-bold text-xs text-neu-main">
              TRACK {String(safeIndex + 1).padStart(2, '0')} / {String(playlist.length).padStart(2, '0')}
            </span>
            {currentCard.word.listIndex && (
              <span className="px-2.5 py-1 rounded-xl neu-inset-sm font-mono text-[11px] text-neu-sage font-semibold">
                List {currentCard.word.listIndex}
              </span>
            )}
          </div>

          {/* 实时双语声道指示灯槽 */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl neu-inset-sm text-[11px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className={`neu-led ${phase === 'en' ? 'neu-led-sage animate-pulse' : 'neu-led-off'}`} />
              <span className={phase === 'en' ? 'text-neu-sage font-bold' : 'text-neu-muted'}>
                1.EN 英文
              </span>
            </span>
            <span className="text-neu-muted">→</span>
            <span className="flex items-center gap-1.5">
              <span className={`neu-led ${phase === 'zh' ? 'neu-led-amber animate-pulse' : 'neu-led-off'}`} />
              <span className={phase === 'zh' ? 'text-neu-amber font-bold' : 'text-neu-muted'}>
                2.CN 首义
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => onToggleStar(currentCard.word.id)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              currentCard.progress.isStarred
                ? 'neu-btn-sm neu-btn-sm-active text-neu-amber'
                : 'neu-btn-sm text-neu-muted hover:text-neu-main'
            }`}
            title="加入/移除重点星标 (快捷键 S)"
          >
            <Star className={`w-4 h-4 ${currentCard.progress.isStarred ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* 中央声学显示屏：点击可直接触发一次英汉连读 */}
        <div
          onClick={playOnceCurrent}
          className="neu-inset rounded-3xl p-6 sm:p-8 text-center cursor-pointer select-none flex flex-col items-center justify-center min-h-[210px] transition-all group"
          title="点击屏幕立即播报一次：英文发音 + 中文第一个意思"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neu-main font-mono">
              {currentCard.word.word}
            </h2>
            <Volume2
              className={`w-5 h-5 transition-transform ${
                phase === 'en' || phase === 'zh'
                  ? 'text-neu-sage scale-110 animate-pulse'
                  : 'text-neu-muted group-hover:text-neu-main'
              }`}
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-mono text-neu-muted mb-5">
            {currentCard.word.phonetic_us && <span>{currentCard.word.phonetic_us}</span>}
            {currentCard.word.pos && (
              <span className="px-2 py-0.5 rounded-md neu-raised text-neu-sage font-bold">
                {currentCard.word.pos}
              </span>
            )}
          </div>

          {/* 核心首义高亮读数区（语音播报的中文内容） */}
          <div
            className={`w-full max-w-md rounded-2xl px-5 py-3.5 transition-all ${
              isMeaningHidden ? 'neu-inset-sm blur-sm select-none opacity-45' : 'neu-raised'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className={`neu-led ${phase === 'zh' ? 'neu-led-amber animate-pulse' : 'neu-led-sage'}`} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-neu-muted">
                中文语音播报首义 · FIRST MEANING
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-neu-main tracking-wide">
              {firstMeaning || '暂无释义'}
            </div>
            {fullCleanedTranslation && fullCleanedTranslation !== firstMeaning && (
              <div className="text-xs text-neu-sub mt-1.5 line-clamp-2">
                完整释义：{fullCleanedTranslation}
              </div>
            )}
          </div>

          {/* 词根或助记微提示 */}
          {(currentCard.word.roots_affixes || currentCard.word.mnemonic) && !isMeaningHidden && (
            <div className="mt-4 text-xs text-neu-sub flex items-center justify-center gap-2 max-w-lg line-clamp-1">
              <Quote className="w-3.5 h-3.5 text-neu-steel shrink-0" />
              <span className="truncate">
                {currentCard.word.roots_affixes || currentCard.word.mnemonic}
              </span>
            </div>
          )}
        </div>

        {/* 硬件级播放操控台 (上一首 / 播放暂停 / 下一首 / 重播) */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 py-1">
          <button
            type="button"
            onClick={() => {
              const modes: LoopMode[] = ['sequence', 'one', 'shuffle'];
              const next = modes[(modes.indexOf(loopMode) + 1) % modes.length];
              setLoopMode(next);
            }}
            className="w-11 h-11 rounded-2xl neu-btn-sm flex items-center justify-center text-neu-sub hover:text-neu-main"
            title={
              loopMode === 'sequence'
                ? '当前：顺序循环（点击切换单词循环）'
                : loopMode === 'one'
                ? '当前：单词循环（点击切换随机速听）'
                : '当前：随机速听（点击切换顺序循环）'
            }
          >
            {loopMode === 'sequence' && <Repeat className="w-4 h-4 text-neu-sage" />}
            {loopMode === 'one' && <Repeat1 className="w-4 h-4 text-neu-amber" />}
            {loopMode === 'shuffle' && <Shuffle className="w-4 h-4 text-neu-steel" />}
          </button>

          <button
            type="button"
            onClick={handlePrev}
            className="w-12 h-12 rounded-2xl neu-btn flex items-center justify-center text-neu-main"
            title="上一个单词 (快捷键 ←)"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={togglePlayPause}
            className={`px-8 h-14 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all ${
              isPlaying ? 'neu-inset text-neu-sage' : 'neu-btn text-neu-main'
            }`}
            title="开始/暂停连续双语速听 (快捷键 Space)"
          >
            <span className={`neu-led ${isPlaying ? 'neu-led-sage animate-pulse' : 'neu-led-off'}`} />
            {isPlaying ? <Pause className="w-5 h-5 text-neu-sage" /> : <Play className="w-5 h-5 text-neu-sage" />}
            <span>{isPlaying ? '暂停速听' : '连续速听'}</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="w-12 h-12 rounded-2xl neu-btn flex items-center justify-center text-neu-main"
            title="下一个单词 (快捷键 →)"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={playOnceCurrent}
            className="w-11 h-11 rounded-2xl neu-btn-sm flex items-center justify-center text-neu-sub hover:text-neu-main"
            title="单次重播当前词 (快捷键 R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* 声学参数调节旋钮栏：英文遍数 / 语速 / 词间间隔 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* 1. 英文朗读遍数 */}
          <div className="p-2.5 rounded-2xl neu-inset flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neu-sub px-1">英文遍数</span>
            <div className="flex items-center gap-1">
              {([1, 2] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEnRepeat(n)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all ${
                    enRepeat === n ? 'neu-raised text-neu-sage' : 'text-neu-muted hover:text-neu-main'
                  }`}
                >
                  EN×{n} + 中×1
                </button>
              ))}
            </div>
          </div>

          {/* 2. 语速档位 */}
          <div className="p-2.5 rounded-2xl neu-inset flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neu-sub px-1">播报语速</span>
            <div className="flex items-center gap-1">
              {[
                { id: 'slow' as const, label: '0.85x' },
                { id: 'normal' as const, label: '1.0x' },
                { id: 'fast' as const, label: '1.2x' },
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSpeedPreset(s.id)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all ${
                    speedPreset === s.id ? 'neu-raised text-neu-steel' : 'text-neu-muted hover:text-neu-main'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. 词间停顿间隔 */}
          <div className="p-2.5 rounded-2xl neu-inset flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neu-sub px-1">词间间隔</span>
            <div className="flex items-center gap-1">
              {[
                { ms: 600, label: '0.6s' },
                { ms: 1100, label: '1.1s' },
                { ms: 2000, label: '2.0s' },
              ].map(g => (
                <button
                  key={g.ms}
                  type="button"
                  onClick={() => setGapMs(g.ms)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all ${
                    gapMs === g.ms ? 'neu-raised text-neu-amber' : 'text-neu-muted hover:text-neu-main'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 底部随身听曲目列表（点击任意词条直接跳播） */}
      <div className="neu-panel rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 text-xs font-bold text-neu-main">
            <Layers className="w-4 h-4 text-neu-sage" />
            <span>速听播放队列（点击任意单词即刻播报「英文 + 第一个中文意思」）</span>
          </div>
          <span className="text-[11px] font-mono text-neu-muted">
            共 {playlist.length} 词
          </span>
        </div>

        <div
          ref={playlistContainerRef}
          className="max-h-60 overflow-y-auto space-y-1.5 pr-1.5"
        >
          {playlist.map((item, idx) => {
            const isCurrent = idx === safeIndex;
            const itemFirstMeaning = extractFirstChineseMeaning(item.word.translation);
            return (
              <div
                key={item.word.id}
                data-walkman-active={isCurrent ? 'true' : undefined}
                onClick={() => {
                  setCurrentIndex(idx);
                  if (!isPlaying) {
                    setIsPlaying(true);
                  }
                }}
                className={`px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all text-xs ${
                  isCurrent ? 'neu-inset text-neu-main font-bold' : 'neu-btn-sm text-neu-sub hover:text-neu-main'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`neu-led ${
                      isCurrent
                        ? isPlaying
                          ? 'neu-led-sage animate-pulse'
                          : 'neu-led-amber'
                        : 'neu-led-off'
                    }`}
                  />
                  <span className="font-mono text-[11px] text-neu-muted w-6 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono font-bold text-neu-main truncate">
                    {item.word.word}
                  </span>
                  {item.word.phonetic_us && (
                    <span className="font-mono text-[11px] text-neu-muted hidden sm:inline truncate">
                      {item.word.phonetic_us}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.word.pos && (
                    <span className="text-[10px] font-mono text-neu-sage">
                      {item.word.pos}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-lg neu-inset-sm text-neu-main font-semibold text-xs">
                    {itemFirstMeaning}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
