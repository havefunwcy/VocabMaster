import React, { useState, useEffect, useRef } from 'react';
import { WordItem, WordProgress, Rating, UserSettings } from '../types';
import { SpeechService } from '../utils/speech';
import { cleanDuplicatePos } from '../utils/formatTranslation';
import { Volume2, PenTool, CheckCircle, XCircle, ArrowRight, SkipForward } from 'lucide-react';

interface SpellingQuizProps {
  card: { word: WordItem; progress: WordProgress };
  settings: UserSettings;
  onRate: (rating: Rating, latencyMs: number) => void;
  onNext: () => void;
}

export const SpellingQuiz: React.FC<SpellingQuizProps> = ({
  card,
  settings,
  onRate,
  onNext,
}) => {
  const { word } = card;
  const [inputVal, setInputVal] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingRateRef = useRef<{ rating: Rating; latency: number } | null>(null);

  useEffect(() => {
    setInputVal('');
    setIsAnswered(false);
    setIsCorrect(false);
    setStartTime(Date.now());
    pendingRateRef.current = null;

    SpeechService.speak(word.word, settings.accent);

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => {
      clearTimeout(focusTimer);
      SpeechService.stop();
    };
  }, [word.id, settings.accent]);

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
    if (isAnswered) {
      handleProceedNext();
      return;
    }
    SpeechService.stop();
    const latency = Date.now() - startTime;
    setIsCorrect(false);
    setIsAnswered(true);
    pendingRateRef.current = { rating: Rating.Again, latency };

    if (settings.autoPlayAudio) {
      SpeechService.speak(word.word, settings.accent);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAnswered || !inputVal.trim()) return;

    const latency = Date.now() - startTime;
    const correct = inputVal.trim().toLowerCase() === word.word.toLowerCase();
    setIsCorrect(correct);
    setIsAnswered(true);

    if (correct) {
      const rating = latency < 3000 ? Rating.Easy : (latency < 6000 ? Rating.Good : Rating.Hard);
      pendingRateRef.current = { rating, latency };
    } else {
      pendingRateRef.current = { rating: Rating.Again, latency };
    }
  };

  // 全局与输入框空格跳过/继续支持
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (isAnswered) {
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
  }, [isAnswered, inputVal, word.id, startTime]);

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
            <span className="px-3 py-1.5 rounded-xl neu-inset-sm text-neu-amber font-semibold text-xs flex items-center gap-2">
              <span className="neu-led neu-led-amber" />
              <PenTool className="w-3.5 h-3.5" />
              <span>{(word.isPhrase || word.word.includes(' ')) ? '短语听写 · PHRASE DICTATION' : '听音拼写 · DICTATION'}</span>
            </span>
            {(word.isPhrase || word.word.includes(' ')) && (
              <span className="px-2.5 py-1 rounded-xl neu-inset-sm text-neu-sub font-semibold text-xs">
                含空格
              </span>
            )}
          </div>

          <button
            onClick={() => SpeechService.speak(word.word, settings.accent)}
            className="px-3.5 py-2 rounded-xl neu-btn-sm text-neu-main flex items-center gap-1.5 text-xs font-semibold"
            title="重新播放发音"
          >
            <Volume2 className="w-4 h-4 text-neu-sage" />
            <span>重播发音</span>
          </button>
        </div>

        {/* 核心释义显示屏区 */}
        <div className="my-auto py-6 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-neu-main mb-3 tracking-tight">
            {cleanDuplicatePos(word.translation)}
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-xl neu-inset-sm text-xs text-neu-sub font-mono">
            {word.pos && <span className="text-neu-sage font-bold">{word.pos}</span>}
            <span>{word.phonetic_us}</span>
          </div>
        </div>

        {/* 凹槽拼写输入与实体按键 */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isAnswered}
              placeholder={word.word.includes(' ') ? "听发音拼写英文短语 (词间空格)..." : "听发音拼写英文单词..."}
              className={`w-full px-5 py-4 rounded-2xl neu-input text-center font-mono text-xl tracking-widest ${
                isAnswered
                  ? isCorrect
                    ? 'text-neu-sage font-bold'
                    : 'text-neu-coral font-bold'
                  : 'text-neu-main'
              }`}
            />
          </div>

          {!isAnswered ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSkip}
                className="px-5 py-3.5 rounded-2xl neu-btn text-neu-sub hover:text-neu-main font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0"
                title="跳过本词 (快捷键 Space)"
              >
                <SkipForward className="w-4 h-4 text-neu-muted" />
                <span>跳过 [Space]</span>
              </button>

              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="flex-1 py-3.5 rounded-2xl neu-btn disabled:opacity-45 text-neu-main font-bold text-sm flex items-center justify-center gap-2"
              >
                <span className="neu-led neu-led-amber" />
                <span>检验拼写 [Enter]</span>
                <ArrowRight className="w-4 h-4 text-neu-amber" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 animate-fade-in">
              <div className="p-4 rounded-2xl neu-inset flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl neu-raised flex items-center justify-center ${isCorrect ? 'text-neu-sage' : 'text-neu-coral'}`}>
                    {isCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className={`font-bold text-base ${isCorrect ? 'text-neu-sage' : 'text-neu-coral'}`}>
                      {isCorrect ? '拼写准确无误' : `正确拼写: ${word.word}`}
                    </div>
                    {word.definition_en && (
                      <div className="text-xs text-neu-sub font-mono mt-0.5">{word.definition_en}</div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleProceedNext}
                className="w-full py-3.5 rounded-2xl neu-btn text-neu-main font-bold text-sm flex items-center justify-center gap-2"
              >
                <span className="neu-led neu-led-sage" />
                <span>下一题 [Space]</span>
                <ArrowRight className="w-4 h-4 text-neu-sage" />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
