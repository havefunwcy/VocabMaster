/**
 * 从原始中文释义中提取第一个精炼核心中文意思（供「单词速听」中文播报使用）
 * 例如: "vt. 抛弃，放弃；n. 放任，狂热" -> "抛弃"
 */
export function extractFirstChineseMeaning(rawTranslation: string): string {
  if (!rawTranslation) return '';

  // 1. 去除词性标记 (如 vt. / vi. / n. / adj. / adv. / prep. / phr. 等)
  let cleaned = rawTranslation
    .replace(/\b(?:vt|vi|v|n|adj|adv|prep|conj|pron|aux|num|art|int|phr|a|ad|pl|abbr)\.\s*/gi, ' ')
    .replace(/^[a-zA-Z.&/\s]+/, '');

  // 2. 去除括号补充说明（如 （尤指...）、(...)、[...]、<...>、【...】）
  cleaned = cleaned
    .replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]|<[^>]*>|【[^】]*】/g, ' ')
    .trim();

  // 3. 按分号、逗号、顿号切分，取第一个有效中文词义
  const segments = cleaned
    .split(/[；;，,、/\n]+/)
    .map(s => s.replace(/^[a-zA-Z0-9.\-\s]+/, '').trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return rawTranslation.replace(/^[a-zA-Z.\s]+/, '').trim();
  }

  // 若第一段仅有 1 个字且存在第二段（如 "使，让"），合并前两段让听感更自然
  if (segments[0].length <= 1 && segments.length > 1 && segments[1].length <= 3) {
    return `${segments[0]}，${segments[1]}`;
  }

  return segments[0];
}

/**
 * 语音发音服务 (Web Speech API + 有道/剑桥多通道发音保障 + 英汉双语随身速听)
 */
export class SpeechService {
  private static currentAudio: HTMLAudioElement | null = null;
  private static currentSessionId: number = 0;
  private static bilingualTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 停止当前所有播放的发音，并使所有进行中的异步音频回调与双语速听队列失效
   */
  public static stop(): void {
    this.currentSessionId += 1;

    if (this.bilingualTimer) {
      clearTimeout(this.bilingualTimer);
      this.bilingualTimer = null;
    }

    if (this.currentAudio) {
      const audio = this.currentAudio;
      this.currentAudio = null;
      try {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch (e) {
        // ignore
      }
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * 播放单词发音，并在播放完毕后触发回调或 resolve Promise
   * @param word 英文单词或短语
   * @param accent 'us' 美音 | 'uk' 英音
   * @param rate 语速 (默认 0.95)
   * @param onEnd 读完后的回调函数
   */
  public static speak(
    word: string, 
    accent: 'us' | 'uk' = 'us', 
    rate: number = 0.95,
    onEnd?: () => void
  ): Promise<void> {
    this.stop();
    const sessionId = this.currentSessionId;
    return this.playEnglishWithSession(word, accent, rate, sessionId, onEnd);
  }

  /**
   * 单词速听专用：先播放英文读音（可设 1~2 遍），随后用中文读一遍第一个核心意思
   * @returns Promise<boolean> 若完整读完返回 true，若中途被 stop/切歌打断返回 false
   */
  public static async speakBilingual(
    word: string,
    rawTranslation: string,
    options?: {
      accent?: 'us' | 'uk';
      enRate?: number;
      zhRate?: number;
      enRepeat?: 1 | 2;
      pauseBetweenMs?: number;
      onPhaseChange?: (phase: 'en' | 'zh' | 'idle') => void;
    }
  ): Promise<boolean> {
    this.stop();
    const sessionId = this.currentSessionId;
    const accent = options?.accent ?? 'us';
    const enRate = options?.enRate ?? 0.96;
    const zhRate = options?.zhRate ?? 1.05;
    const enRepeat = options?.enRepeat ?? 1;
    const pauseBetweenMs = options?.pauseBetweenMs ?? 240;
    const onPhaseChange = options?.onPhaseChange;

    // 1. 播放英文读音（第 1 遍）
    onPhaseChange?.('en');
    await this.playEnglishWithSession(word, accent, enRate, sessionId);
    if (sessionId !== this.currentSessionId) return false;

    // 若设置了英文读 2 遍
    if (enRepeat === 2) {
      const okRepeatPause = await this.waitWithSession(220, sessionId);
      if (!okRepeatPause) return false;
      await this.playEnglishWithSession(word, accent, enRate, sessionId);
      if (sessionId !== this.currentSessionId) return false;
    }

    // 2. 英汉切换微停顿
    const okPause = await this.waitWithSession(pauseBetweenMs, sessionId);
    if (!okPause) return false;

    // 3. 用中文朗读第一个意思
    const firstMeaning = extractFirstChineseMeaning(rawTranslation);
    if (firstMeaning) {
      onPhaseChange?.('zh');
      await this.playChineseWithSession(firstMeaning, zhRate, sessionId);
      if (sessionId !== this.currentSessionId) return false;
    }

    onPhaseChange?.('idle');
    return true;
  }

  private static waitWithSession(ms: number, sessionId: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (sessionId !== this.currentSessionId) {
        resolve(false);
        return;
      }
      this.bilingualTimer = setTimeout(() => {
        this.bilingualTimer = null;
        resolve(sessionId === this.currentSessionId);
      }, ms);
    });
  }

  private static playEnglishWithSession(
    word: string,
    accent: 'us' | 'uk',
    rate: number,
    sessionId: number,
    onEnd?: () => void
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!word || sessionId !== this.currentSessionId) {
        onEnd?.();
        resolve();
        return;
      }

      let isFinished = false;
      let fallbackTriggered = false;

      const finish = () => {
        if (isFinished) return;
        isFinished = true;
        clearTimeout(safetyTimer);
        if (sessionId === this.currentSessionId) {
          onEnd?.();
        }
        resolve();
      };

      const safetyTimer = setTimeout(() => {
        finish();
      }, 3500);

      const type = accent === 'uk' ? 1 : 2;
      const onlineUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`;

      const audio = new Audio(onlineUrl);
      audio.playbackRate = rate;
      this.currentAudio = audio;

      const triggerFallbackOnce = () => {
        if (sessionId !== this.currentSessionId || isFinished || fallbackTriggered) {
          return;
        }
        fallbackTriggered = true;
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        this.speakWithWebSpeech(word, accent, rate, sessionId, finish);
      };

      audio.onended = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        finish();
      };

      audio.onerror = () => {
        triggerFallbackOnce();
      };

      audio.play().catch((err: unknown) => {
        if (sessionId !== this.currentSessionId) {
          finish();
          return;
        }
        const errName = (err as { name?: string })?.name;
        if (errName === 'AbortError') {
          finish();
          return;
        }
        triggerFallbackOnce();
      });
    });
  }

  private static playChineseWithSession(
    text: string,
    rate: number,
    sessionId: number
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!text || sessionId !== this.currentSessionId) {
        resolve();
        return;
      }

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      let isFinished = false;
      const finish = () => {
        if (isFinished) return;
        isFinished = true;
        clearTimeout(safetyTimer);
        resolve();
      };

      const safetyTimer = setTimeout(() => {
        finish();
      }, 3200);

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = rate;

        utterance.onend = () => {
          finish();
        };
        utterance.onerror = () => {
          finish();
        };

        const voices = window.speechSynthesis.getVoices();
        const zhVoice =
          voices.find(v => v.lang === 'zh-CN' || v.lang === 'zh_CN') ||
          voices.find(v => v.lang.toLowerCase().includes('zh'));

        if (zhVoice) {
          utterance.voice = zhVoice;
        }

        if (sessionId === this.currentSessionId) {
          window.speechSynthesis.speak(utterance);
        } else {
          finish();
        }
      } catch (e) {
        finish();
      }
    });
  }

  private static speakWithWebSpeech(
    word: string, 
    accent: 'us' | 'uk', 
    rate: number, 
    sessionId: number,
    onEnd: () => void
  ): void {
    if (sessionId !== this.currentSessionId) {
      onEnd();
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd();
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
      utterance.rate = rate;

      utterance.onend = () => {
        onEnd();
      };
      utterance.onerror = () => {
        onEnd();
      };

      const voices = window.speechSynthesis.getVoices();
      const targetVoice = voices.find(v => 
        accent === 'uk' ? v.lang.includes('GB') || v.lang.includes('en-GB') : v.lang.includes('US') || v.lang.includes('en-US')
      );

      if (targetVoice) {
        utterance.voice = targetVoice;
      }

      if (sessionId === this.currentSessionId) {
        window.speechSynthesis.speak(utterance);
      } else {
        onEnd();
      }
    } catch (e) {
      onEnd();
    }
  }
}

