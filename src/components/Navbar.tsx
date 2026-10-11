import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Flame, 
  Layers, 
  PenTool, 
  Zap, 
  BarChart3, 
  BookMarked, 
  Settings, 
  Volume2, 
  VolumeX,
  Sparkles,
  Coffee,
  Sun,
  Moon,
  Headphones
} from 'lucide-react';
import { CognitiveState } from '../algorithms/cognitive';
import { UserSettings } from '../types';

export type TabType = 'flashcard' | 'listen' | 'cloze' | 'spelling' | 'speed' | 'analytics' | 'decks';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  cognitiveState: CognitiveState;
  settings: UserSettings;
  updateSettings: (partial: Partial<UserSettings>) => void;
  onOpenSettings: () => void;
  dueCount: number;
  newCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  cognitiveState,
  settings,
  updateSettings,
  onOpenSettings,
  dueCount,
  newCount,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const currentlyDark = document.documentElement.classList.contains('dark');
    const nextTheme = currentlyDark ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
  };
  const getFatigueDotClass = (level: CognitiveState['fatigueLevel']) => {
    switch (level) {
      case 'fresh': return 'neu-led-sage';
      case 'focused': return 'neu-led-steel';
      case 'moderate': return 'neu-led-amber';
      case 'fatigued': return 'neu-led-amber animate-pulse';
      case 'exhausted': return 'neu-led-coral animate-pulse';
    }
  };

  const getFatigueText = (level: CognitiveState['fatigueLevel']) => {
    switch (level) {
      case 'fresh': return '脑力饱满';
      case 'focused': return '深度专注';
      case 'moderate': return '轻微负荷';
      case 'fatigued': return '认知疲劳';
      case 'exhausted': return '建议小憩';
    }
  };

  const navItems: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'flashcard',
      label: '闪卡复习',
      icon: <Layers className="w-3.5 h-3.5" />,
      badge: dueCount + newCount > 0 ? dueCount + newCount : undefined,
    },
    {
      id: 'listen',
      label: '单词速听',
      icon: <Headphones className="w-3.5 h-3.5" />,
    },
    {
      id: 'cloze',
      label: '语境填空',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    {
      id: 'spelling',
      label: '听写拼写',
      icon: <PenTool className="w-3.5 h-3.5" />,
    },
    {
      id: 'speed',
      label: '极限速刷',
      icon: <Zap className="w-3.5 h-3.5" />,
    },
    {
      id: 'analytics',
      label: '记忆画像',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
    },
    {
      id: 'decks',
      label: '词库',
      icon: <BookMarked className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full neu-surface shadow-neu-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        
        {/* Tactile Hardware Brand Plate */}
        <div
          className="flex items-center gap-3.5 cursor-pointer select-none group"
          onClick={() => setActiveTab('flashcard')}
        >
          <div className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center text-neu-sage group-active:shadow-neu-pressed transition-all">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-neu-main">
                VocabMaster
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider uppercase neu-inset-sm text-neu-sub rounded-md">
                FSRS 5.0
              </span>
            </div>
            <p className="text-[11px] text-neu-muted font-medium hidden sm:block tracking-wide">
              TACTILE COGNITIVE MEMORY CONSOLE
            </p>
          </div>
        </div>

        {/* Recessed Mode Selector Track */}
        <nav className="flex items-center gap-1.5 neu-inset p-1.5 rounded-2xl overflow-x-auto no-scrollbar max-w-full">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'neu-raised text-neu-main'
                    : 'text-neu-sub hover:text-neu-main'
                }`}
              >
                <span
                  className={
                    isActive ? 'text-neu-sage' : 'text-neu-muted'
                  }
                >
                  {item.icon}
                </span>
                <span className="hidden md:inline">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold neu-inset-sm text-neu-sage">
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <span className="neu-led neu-led-sage ml-0.5" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Hardware Readouts & Push Keys */}
        <div className="flex items-center gap-2.5">
          {/* Cognitive Load LCD Readout */}
          <div
            title={cognitiveState.advice}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl neu-inset-sm text-xs cursor-help"
          >
            <span className={`neu-led ${getFatigueDotClass(cognitiveState.fatigueLevel)}`} />
            {cognitiveState.fatigueIndex > 70 ? (
              <Coffee className="w-3.5 h-3.5 text-neu-amber" />
            ) : null}
            <span className="font-medium text-neu-main">{getFatigueText(cognitiveState.fatigueLevel)}</span>
            <span className="text-[10px] text-neu-muted font-mono">
              {cognitiveState.fatigueIndex}%
            </span>
          </div>

          {/* Streak Counter Readout */}
          {cognitiveState.streak > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold neu-inset-sm text-neu-amber">
              <Flame className="w-3.5 h-3.5" />
              <span className="font-mono">{cognitiveState.streak}</span>
            </div>
          )}

          {/* Audio Auto-play Tactile Key */}
          <button
            onClick={() => updateSettings({ autoPlayAudio: !settings.autoPlayAudio })}
            className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              settings.autoPlayAudio
                ? 'neu-btn-sm neu-btn-sm-active text-neu-sage'
                : 'neu-btn-sm text-neu-muted hover:text-neu-main'
            }`}
            title={settings.autoPlayAudio ? '自动发音已开启' : '自动发音已静音'}
          >
            {settings.autoPlayAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span
              className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                settings.autoPlayAudio ? 'neu-led-sage' : 'neu-led-off'
              }`}
            />
          </button>

          {/* Dark / Light Hardware Surface Toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl neu-btn-sm flex items-center justify-center text-neu-sub hover:text-neu-main"
            title={isDarkMode ? '当前为深空灰面板（点击切换温润浅灰）' : '当前为温润浅灰面板（点击切换深空灰）'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-neu-amber transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-neu-steel transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* Settings Tactile Key */}
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-xl neu-btn-sm flex items-center justify-center text-neu-sub hover:text-neu-main"
            title="学习与记忆算法配置"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
