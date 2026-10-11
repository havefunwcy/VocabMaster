import React from 'react';
import { UserSettings } from '../types';
import { 
  X, 
  Sliders, 
  ShieldCheck, 
  Clock, 
  Volume2, 
  Keyboard, 
  Trash2,
  Sparkles,
  Info,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  updateSettings: (partial: Partial<UserSettings>) => void;
  onClearAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  updateSettings,
  onClearAllData,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="neu-panel rounded-3xl max-w-lg w-full animate-scale-up max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 sm:px-8 pt-6 sm:pt-7 pb-4 shrink-0">
          <div className="flex items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl neu-inset-sm flex items-center justify-center text-neu-sage shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neu-main">
                  记忆算法与系统偏好
                </h3>
                <p className="text-xs text-neu-muted font-mono">FSRS 5.0 · HARDWARE CONSOLE PREFS</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl neu-btn-sm flex items-center justify-center shrink-0 text-neu-sub hover:text-neu-main"
              title="关闭设置"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="neu-groove-h" />
        </div>

        {/* Settings Sections */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-2 space-y-5 text-sm overflow-y-auto flex-1">
          
          {/* 0. 界面色彩外观 */}
          <div className="neu-inset p-4 sm:p-5 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
              <label className="font-bold text-neu-main flex items-center gap-2 text-xs sm:text-sm">
                <Sun className="w-4 h-4 text-neu-amber" />
                <span>面板材质外观</span>
              </label>
              <div className="flex rounded-xl neu-inset-sm p-1 gap-1">
                <button
                  onClick={() => updateSettings({ theme: 'light' })}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    (settings.theme || 'system') === 'light'
                      ? 'neu-raised text-neu-main'
                      : 'text-neu-sub hover:text-neu-main'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-neu-amber" />
                  <span>浅陶灰</span>
                </button>
                <button
                  onClick={() => updateSettings({ theme: 'dark' })}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    settings.theme === 'dark'
                      ? 'neu-raised text-neu-main'
                      : 'text-neu-sub hover:text-neu-main'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 text-neu-steel" />
                  <span>深钛灰</span>
                </button>
                <button
                  onClick={() => updateSettings({ theme: 'system' })}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    (settings.theme || 'system') === 'system'
                      ? 'neu-raised text-neu-sage'
                      : 'text-neu-sub hover:text-neu-main'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>自动</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-neu-sub leading-relaxed">
              支持温润浅陶灰面板、深空哑光钛灰面板或自动跟随系统。顶部导航栏亦可一键切换。
            </p>
          </div>

          {/* 1. 期望记忆保持率 */}
          <div className="neu-inset p-4 sm:p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-neu-main flex items-center gap-2 text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 text-neu-sage" />
                <span>期望记忆保持率 (Desired Retention)</span>
              </label>
              <span className="px-2.5 py-0.5 rounded-lg neu-raised font-mono font-bold text-neu-sage text-sm">
                {Math.round(settings.desiredRetention * 100)}%
              </span>
            </div>
            <p className="text-xs text-neu-sub mb-3 leading-relaxed">
              推荐值 90%。提高保持率（如 95%）将加密复习频次；降低保持率（如 85%）则节约每日复习耗时。
            </p>
            <div className="pt-1 pb-0.5">
              <input
                type="range"
                min="0.80"
                max="0.97"
                step="0.01"
                value={settings.desiredRetention}
                onChange={e => updateSettings({ desiredRetention: parseFloat(e.target.value) })}
                className="neu-range"
              />
              <div className="flex justify-between text-[10px] font-mono text-neu-muted mt-1.5 px-0.5">
                <span>80% (轻量)</span>
                <span>90% (标准)</span>
                <span>97% (高强)</span>
              </div>
            </div>
          </div>

          {/* 2. 反应延迟加权 */}
          <div className="neu-inset p-4 sm:p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-neu-main flex items-center gap-2 text-xs sm:text-sm">
                <Clock className="w-4 h-4 text-neu-steel" />
                <span>反应延迟平滑加权 (Latency Penalty)</span>
              </label>
              <button
                type="button"
                onClick={() => updateSettings({ enableLatencyPenalty: !settings.enableLatencyPenalty })}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${
                  settings.enableLatencyPenalty
                    ? 'neu-btn-sm neu-btn-sm-active text-neu-sage'
                    : 'neu-btn-sm text-neu-muted'
                }`}
              >
                <span className={`neu-led ${settings.enableLatencyPenalty ? 'neu-led-sage' : 'neu-led-off'}`} />
                <span>{settings.enableLatencyPenalty ? 'ON' : 'OFF'}</span>
              </button>
            </div>
            <p className="text-xs text-neu-sub leading-relaxed">
              开启后，若主动回忆耗时超过 <strong>{(settings.latencyThresholdMs / 1000).toFixed(1)}秒</strong>，系统将自动平滑抑制卡片稳定性增幅。
            </p>
          </div>

          {/* 3. 发音口音与自动朗读 */}
          <div className="neu-inset p-4 sm:p-5 rounded-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-neu-main flex items-center gap-2 text-xs sm:text-sm">
                <Volume2 className="w-4 h-4 text-neu-amber" />
                <span>声学发音偏好</span>
              </label>
              <div className="flex rounded-xl neu-inset-sm p-1 gap-1">
                <button
                  onClick={() => updateSettings({ accent: 'us' })}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    settings.accent === 'us'
                      ? 'neu-raised text-neu-sage'
                      : 'text-neu-sub hover:text-neu-main'
                  }`}
                >
                  美音 (US)
                </button>
                <button
                  onClick={() => updateSettings({ accent: 'uk' })}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    settings.accent === 'uk'
                      ? 'neu-raised text-neu-sage'
                      : 'text-neu-sub hover:text-neu-main'
                  }`}
                >
                  英音 (UK)
                </button>
              </div>
            </div>

            <div className="neu-groove-h" />

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neu-sub">切卡时自动播放单词发音</span>
              <button
                type="button"
                onClick={() => updateSettings({ autoPlayAudio: !settings.autoPlayAudio })}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${
                  settings.autoPlayAudio
                    ? 'neu-btn-sm neu-btn-sm-active text-neu-sage'
                    : 'neu-btn-sm text-neu-muted'
                }`}
              >
                <span className={`neu-led ${settings.autoPlayAudio ? 'neu-led-sage' : 'neu-led-off'}`} />
                <span>{settings.autoPlayAudio ? 'AUTO' : 'MUTE'}</span>
              </button>
            </div>

            <div className="neu-groove-h" />

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-neu-main block">实体机械按键微音效 (Tactile Switch Click)</span>
                <span className="text-[11px] text-neu-muted">基于 Web Audio 原生合成柔和按键声与答题反馈音</span>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ tactileSoundEnabled: settings.tactileSoundEnabled === false ? true : false })}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 ${
                  settings.tactileSoundEnabled !== false
                    ? 'neu-btn-sm neu-btn-sm-active text-neu-sage'
                    : 'neu-btn-sm text-neu-muted'
                }`}
              >
                <span className={`neu-led ${settings.tactileSoundEnabled !== false ? 'neu-led-sage' : 'neu-led-off'}`} />
                <span>{settings.tactileSoundEnabled !== false ? 'CLICK ON' : 'SILENT'}</span>
              </button>
            </div>
          </div>

          {/* 4. 快捷键开关与一览 */}
          <div className="neu-inset p-4 sm:p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <label className="font-bold text-neu-main flex items-center gap-2 text-xs sm:text-sm">
                <Keyboard className="w-4 h-4 text-neu-sub" />
                <span>全键盘实体热键 (Hotkeys)</span>
              </label>
              <button
                type="button"
                onClick={() => updateSettings({ keyboardShortcutsEnabled: !settings.keyboardShortcutsEnabled })}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${
                  settings.keyboardShortcutsEnabled
                    ? 'neu-btn-sm neu-btn-sm-active text-neu-sage'
                    : 'neu-btn-sm text-neu-muted'
                }`}
              >
                <span className={`neu-led ${settings.keyboardShortcutsEnabled ? 'neu-led-sage' : 'neu-led-off'}`} />
                <span>{settings.keyboardShortcutsEnabled ? 'ENABLED' : 'OFF'}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-neu-sub font-mono">
              <div className="neu-raised px-2.5 py-1.5 rounded-xl">[Space] 翻卡 / 跳过</div>
              <div className="neu-raised px-2.5 py-1.5 rounded-xl">[1~4] 四阶记忆评级</div>
              <div className="neu-raised px-2.5 py-1.5 rounded-xl">[R] 重播单词发音</div>
              <div className="neu-raised px-2.5 py-1.5 rounded-xl">[S] 收藏生词重点</div>
              <div className="neu-raised px-2.5 py-1.5 rounded-xl">[Ctrl+Z] 撤回上步评分</div>
              <div className="neu-raised px-2.5 py-1.5 rounded-xl">[E] 原地编辑当前词</div>
            </div>
          </div>

          {/* 5. 重置数据 */}
          <div className="pt-1">
            <button
              onClick={() => {
                if (window.confirm('确定要清空所有学习进度和自定义词汇吗？该操作不可撤销。')) {
                  onClearAllData();
                  onClose();
                }
              }}
              className="w-full py-3.5 rounded-2xl neu-btn text-neu-coral text-xs font-bold flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>清空并重置全部学习数据</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
