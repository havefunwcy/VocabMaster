import React, { useState, useEffect, useRef } from 'react';
import { WordItem, WordProgress, Rating, UserSettings } from '../types';
import { SpeechService } from '../utils/speech';
import { cleanDuplicatePos } from '../utils/formatTranslation';
import { Volume2, Sparkles, Check, X, ArrowRight, Lightbulb, SkipForward } from 'lucide-react';

interface ContextClozeProps {
  card: { word: WordItem; progress: WordProgress };
  settings: UserSettings;
  onRate: (rating: Rating, latencyMs: number) => void;
  onNext: () => void;
}

export const ContextCloze: React.FC<ContextClozeProps> = ({
  card,
  settings,
  onRate,
  onNext,
}) => {
  const { word } = card;
  const [inputVal, setInputVal] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingRateRef = useRef<{ rating: Rating; latency: number } | null>(null);

  useEffect(() => {
    setInputVal('');
    setIsSubmitted(false);
    setIsCorrect(false);
    setShowHint(false);
    setStartTime(Date.now());
    pendingRateRef.current = null;

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => {
      clearTimeout(focusTimer);
      SpeechService.stop();
    };
  }, [word.id]);

  // 将例句中的目标词/短语用挖空凹槽占位符替换 (不区分大小写)
  const renderSentenceWithBlank = () => {
    const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b|\\b${escaped}s\\b|\\b${escaped}ed\\b|\\b${escaped}ing\\b`, 'gi');
    let parts = word.example_en.split(regex);
    let matches = word.example_en.match(regex);

    if (!matches) {
      const idx = word.example_en.toLowerCase().indexOf(word.word.toLowerCase());
      if (idx !== -1) {
        parts = [
          word.example_en.slice(0, idx),
          word.example_en.slice(idx + word.word.length)
        ];
        matches = [word.example_en.slice(idx, idx + word.word.length)];
      } else {
        return <span>{word.example_en}</span>;
      }
    }

    const getHintPlaceholder = () => {
      if (!showHint) return `  ${'_'.repeat(Math.min(word.word.length, 10))}  `;
      if (word.word.includes(' ')) {
        return word.word.split(' ').map(w => `${w[0]}${'_'.repeat(Math.max(1, w.length - 1))}`).join(' ');
      }
      return `${word.word.slice(0, 2)}${'_'.repeat(Math.max(1, word.word.length - 2))}`;
    };

    return (
      <span>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {part}
            {i < parts.length - 1 && (
              <span
                className={`inline-block px-3.5 py-1 mx-1.5 rounded-xl font-bold font-mono text-base neu-inset-sm transition-all ${
                  !isSubmitted
                    ? 'text-neu-steel'
                    : isCorrect
                    ? 'text-neu-sage'
                    : 'text-neu-coral line-through'
                }`}
              >
                {isSubmitted ? word.word : getHintPlaceholder()}
              </span>
            )}
          </React.Fragment>
        ))}
      </span>
    );
  };

  const handleProceedNext = () => {
    SpeechService.stop();
    if (pendingRateRef.current) {
      const { rating, latency } = pendingRateRef.current;
      pendingRateRef.current = null;
      onRate(rating, latency);
    }
    onNext();
  };

  const handleSkip = () => {
    if (isSubmitted) {
      handleProceedNext();
      return;
    }
    SpeechService.stop();
    const latency = Date.now() - startTime;
    setIsCorrect(false);
    setIsSubmitted(true);
    pendingRateRef.current = { rating: Rating.Again, latency };

    if (settings.autoPlayAudio) {
      SpeechService.speak(word.word, settings.accent);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitted || !inputVal.trim()) return;

    const latency = Date.now() - startTime;
    const correct = inputVal.trim().toLowerCase() === word.word.toLowerCase();
    setIsCorrect(correct);
    setIsSubmitted(true);

    if (settings.autoPlayAudio) {
      SpeechService.speak(word.word, settings.accent);
    }

    if (correct) {
      const rating = showHint ? Rating.Hard : (latency < 3500 ? Rating.Easy : Rating.Good);
      pendingRateRef.current = { rating, latency };
    } else {
      pendingRateRef.current = { rating: Rating.Again, latency };
    }
  };

  // 全局与输入框空格跳过/继续支持
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (isSubmitted) {
          e.preventDefault();
          handleProceedNext();
          return;
        }
        const activeTag = (document.activeElement as HTMLElement)?.tagName.toLowerCase();
        if (activeTag !== 'input' || !inputVal.trim()) {
          e.preventDefault();
          handleSkip();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSubmitted, inputVal, word.id, startTime]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === 'Space' && !inputVal.trim()) {
      e.preventDefault();
      handleSkip();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5 animate-fade-in">
      <div className="neu-panel rounded-3xl p-6 sm:p-9 flex flex-col min-h-[390px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl neu-inset-sm text-neu-steel font-semibold text-xs flex items-center gap-2">
              <span className="neu-led neu-led-steel" />
              <Sparkles className="w-3.5 h-3.5" />
              <span>语境填空 · CONTEXT CLOZE</span>
            </span>
            {(word.isPhrase || word.word.includes(' ')) && (
              <span className="px-2.5 py-1 rounded-xl neu-inset-sm text-neu-sub font-semibold text-xs">
                短语搭配
              </span>
            )}
          </div>

          <button
            onClick={() => setShowHint(true)}
            disabled={showHint || isSubmitted}
            className="px-3 py-1.5 rounded-xl neu-btn-sm text-xs font-semibold text-neu-amber flex items-center gap-1.5 disabled:opacity-45"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>首字母提示</span>
          </button>
        </div>

        {/* 语境例句挖空显示区 */}
        <div className="my-auto py-5">
          <div className="text-xl sm:text-2xl leading-relaxed text-neu-main font-medium text-center">
            {renderSentenceWithBlank()}
          </div>

          <p className="text-sm text-neu-sub text-center mt-4">
            {word.example_zh}
          </p>
        </div>

        {/* 词义凹槽提示 */}
        <div className="mt-4 p-4 neu-inset rounded-2xl flex items-center justify-between gap-3">
          <div className="text-xs text-neu-main flex items-baseline gap-2">
            {word.pos && (
              <span className="font-mono font-bold text-neu-sage px-2 py-0.5 rounded-lg neu-raised">
                {word.pos}
              </span>
            )}
            <span className="font-medium">{cleanDuplicatePos(word.translation)}</span>
          </div>
          <span className="text-[11px] font-mono text-neu-muted shrink-0">
            {word.word.includes(' ') ? `${word.word.split(' ').length} 词短语` : `${word.word.length} LETTERS`}
          </span>
        </div>

        {/* 凹槽输入框与实体按键表单 */}
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-3">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={isSubmitted}
            placeholder={word.word.includes(' ') ? "输入目标短语 (词间空格)..." : "输入语境缺失词并回车..."}
            className="flex-1 px-4 py-3.5 rounded-2xl neu-input font-mono text-base"
          />

          {!isSubmitted ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-3.5 rounded-2xl neu-btn text-neu-sub hover:text-neu-main font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0"
                title="跳过本词 (快捷键 Space)"
              >
                <SkipForward className="w-4 h-4 text-neu-muted" />
                <span>跳过 [Space]</span>
              </button>

              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="px-6 py-3.5 rounded-2xl neu-btn disabled:opacity-45 text-neu-main font-bold text-sm flex items-center justify-center gap-2 shrink-0"
              >
                <span className="neu-led neu-led-sage" />
                <span>核对答案</span>
                <ArrowRight className="w-4 h-4 text-neu-sage" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleProceedNext}
              className="px-6 py-3.5 rounded-2xl neu-btn text-neu-main font-bold text-sm flex items-center justify-center gap-2 shrink-0"
            >
              <span className="neu-led neu-led-sage" />
              <span>下一题 [Space]</span>
              <ArrowRight className="w-4 h-4 text-neu-sage" />
            </button>
          )}
        </form>

        {/* 提交后结果反馈凹槽 */}
        {isSubmitted && (
          <div className="mt-4 p-4 rounded-2xl neu-inset flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl neu-raised flex items-center justify-center ${isCorrect ? 'text-neu-sage' : 'text-neu-coral'}`}>
                {isCorrect ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </div>
              <div>
                <div className={`font-bold text-sm ${isCorrect ? 'text-neu-sage' : 'text-neu-coral'}`}>
                  {isCorrect ? '语境还原正确 · 神经提取强化 +1' : `未命中 · 正确拼写: ${word.word}`}
                </div>
                <div className="text-xs text-neu-sub font-mono mt-0.5">
                  {word.phonetic_us} {word.definition_en ? `· ${word.definition_en}` : ''}
                </div>
              </div>
            </div>

            <button
              onClick={() => SpeechService.speak(word.word, settings.accent)}
              className="w-9 h-9 rounded-xl neu-btn-sm flex items-center justify-center text-neu-sage shrink-0"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
