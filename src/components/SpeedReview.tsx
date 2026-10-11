import React, { useState, useEffect, useRef } from 'react';
import { WordItem, WordProgress, Rating, UserSettings } from '../types';
import { SpeechService } from '../utils/speech';
import { cleanDuplicatePos } from '../utils/formatTranslation';
import { Zap, Volume2, Flame, Check, X, SkipForward } from 'lucide-react';
import confetti from 'canvas-confetti';

interface SpeedReviewProps {
  card: { word: WordItem; progress: WordProgress };
  allWords: WordItem[];
  settings: UserSettings;
  onRate: (rating: Rating, latencyMs: number) => void;
  onNext: () => void;
}

export const SpeedReview: React.FC<SpeedReviewProps> = ({
  card,
  allWords,
  settings,
  onRate,
  onNext,
}) => {
  const { word } = card;
  const [displayedTranslation, setDisplayedTranslation] = useState('');
  const [isMatch, setIsMatch] = useState(true);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(8);
  const [startTime, setStartTime] = useState(Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const shouldMatch = Math.random() > 0.45;
    setIsMatch(shouldMatch);

    if (shouldMatch) {
      setDisplayedTranslation(word.translation);
    } else {
      const others = allWords.filter(w => w.id !== word.id);
      const randomOther = others[Math.floor(Math.random() * others.length)];
      setDisplayedTranslation(randomOther ? randomOther.translation : word.translation);
    }

    setTimeLeft(8);
    const startCountdown = () => {
      const start = Date.now();
      setStartTime(start);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    if (settings.autoPlayAudio) {
      SpeechService.speak(word.word, settings.accent, 1.0, () => {
        startCountdown();
      });
    } else {
      startCountdown();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      SpeechService.stop();
    };
  }, [word.id]);

  const handleTimeout = () => {
    SpeechService.stop();
    setCombo(0);
    onRate(Rating.Again, 8000);
    onNext();
  };

  const handleJudge = (userChoice: boolean) => {
    SpeechService.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    const latency = Date.now() - startTime;
    const isCorrect = userChoice === isMatch;

    if (isCorrect) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      setScore(s => s + 10 * Math.min(newCombo, 5));
      if (newCombo % 5 === 0) {
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
      }
      onRate(latency < 2000 ? Rating.Easy : Rating.Good, latency);
    } else {
      setCombo(0);
      onRate(Rating.Again, latency);
    }
    onNext();
  };

  const handleSkip = () => {
    SpeechService.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setCombo(0);
    const latency = Date.now() - startTime;
    onRate(Rating.Again, latency);
    onNext();
  };

  const handleSkipRef = useRef(handleSkip);
  handleSkipRef.current = handleSkip;

  const handleJudgeRef = useRef(handleJudge);
  handleJudgeRef.current = handleJudge;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleSkipRef.current();
      } else if (e.key === 'ArrowLeft' || e.key === '1') {
        e.preventDefault();
        handleJudgeRef.current(false);
      } else if (e.key === 'ArrowRight' || e.key === '2') {
        e.preventDefault();
        handleJudgeRef.current(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5 animate-fade-in">
      {/* 顶部连击与得分读数槽 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl neu-inset-sm text-xs">
          <Zap className="w-4 h-4 text-neu-amber" />
          <span className="text-neu-muted font-medium">SCORE</span>
          <strong className="font-mono text-sm text-neu-main">{score}</strong>
        </div>

        {combo > 1 && (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 neu-raised text-neu-amber rounded-xl font-bold text-xs">
            <span className="neu-led neu-led-amber" />
            <Flame className="w-3.5 h-3.5" />
            <span className="font-mono">{combo} COMBO</span>
          </div>
        )}

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl neu-inset-sm text-xs font-mono">
          <span className="text-neu-muted">TIMER</span>
          <strong className={`text-sm ${timeLeft <= 3 ? 'text-neu-coral font-bold animate-pulse' : 'text-neu-main'}`}>
            {timeLeft}s
          </strong>
        </div>
      </div>

      {/* 凹槽进度条倒计时 */}
      <div className="w-full neu-inset-sm h-3 rounded-full p-0.5 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${timeLeft <= 3 ? 'bg-neu-coral' : 'bg-neu-sage'}`}
          style={{ width: `${(timeLeft / 8) * 100}%` }}
        />
      </div>

      {/* 极速刷词主硬件面板 */}
      <div className="neu-panel rounded-3xl p-8 flex flex-col items-center justify-center min-h-[370px] text-center">
        <div className="flex items-center gap-3.5 mb-2">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-neu-main">
            {word.word}
          </h2>
          <button
            onClick={() => SpeechService.speak(word.word, settings.accent)}
            className="w-11 h-11 rounded-full neu-btn flex items-center justify-center text-neu-sage shrink-0"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {word.phonetic_us && (
          <span className="inline-block px-3 py-0.5 rounded-lg neu-inset-sm font-mono text-xs text-neu-sub mb-7">
            {word.phonetic_us}
          </span>
        )}

        <div className="p-6 rounded-2xl neu-inset w-full max-w-md">
          <span className="neu-label block mb-2">MATCH VERIFICATION · 释义是否匹配？</span>
          <span className="text-xl font-bold text-neu-main leading-relaxed block">
            {cleanDuplicatePos(displayedTranslation)}
          </span>
        </div>

        {/* 底部三键实体踏板控制器 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-lg mt-8">
          <button
            onClick={() => handleJudge(false)}
            className="py-4 px-3 rounded-2xl neu-btn text-neu-main font-bold text-sm flex items-center justify-center gap-2"
            title="快捷键：1 或 ←"
          >
            <span className="neu-led neu-led-coral" />
            <X className="w-4 h-4 text-neu-coral" />
            <span>不匹配 [1]</span>
          </button>

          <button
            onClick={handleSkip}
            className="py-4 px-3 rounded-2xl neu-btn text-neu-sub hover:text-neu-main font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5"
            title="快捷键：空格 Space"
          >
            <SkipForward className="w-4 h-4 text-neu-muted" />
            <span>跳过 [Space]</span>
          </button>

          <button
            onClick={() => handleJudge(true)}
            className="py-4 px-3 rounded-2xl neu-btn text-neu-main font-bold text-sm flex items-center justify-center gap-2"
            title="快捷键：2 或 →"
          >
            <span className="neu-led neu-led-sage" />
            <Check className="w-4 h-4 text-neu-sage" />
            <span>匹配 [2]</span>
          </button>
        </div>

        <p className="text-[11px] text-neu-muted mt-5 font-mono hidden sm:block">
          [1 / ←] 错误 · [Space] 跳过 · [2 / →] 正确
        </p>
      </div>
    </div>
  );
};
