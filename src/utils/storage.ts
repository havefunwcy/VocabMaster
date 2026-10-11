import { WordItem, WordProgress, UserSettings, DeckMetadata, State } from '../types';
import { INITIAL_WORDS, DECKS } from '../data/wordbanks';
import { cleanDuplicatePos, cleanEnglishDefinition } from './formatTranslation';

function sanitizeStoredWord(w: WordItem): WordItem {
  return {
    ...w,
    translation: cleanDuplicatePos(w.translation || ''),
    definition_en: cleanEnglishDefinition(w.definition_en, w.word, w.pos),
  };
}

const STORAGE_KEYS = {
  WORDS: 'vocab_master_words_v1',
  PROGRESS: 'vocab_master_progress_v1',
  DECKS: 'vocab_master_decks_v1',
  DELETED_DECKS: 'vocab_master_deleted_decks_v1',
  SETTINGS: 'vocab_master_settings_v1',
};

// 判断单词是否属于指定词库
export function isWordInDeck(w: WordItem, deck: DeckMetadata): boolean {
  if (w.deckId && w.deckId === deck.id) return true;
  if (deck.id === 'deck-cet4') return w.tags.includes('CET-4');
  if (deck.id === 'deck-cet6') return w.tags.includes('CET-6');
  if (deck.id === 'deck-kaoyan') return w.tags.includes('考研');
  if (deck.id === 'deck-ielts') return w.tags.includes('IELTS') || w.tags.includes('TOEFL');
  if (deck.id === 'deck-gre') return w.tags.includes('GRE');
  if (deck.id === 'deck-phrases') return Boolean(w.isPhrase || w.tags.includes('短语') || w.tags.includes('高频短语'));
  if (deck.id === 'deck-idioms') return Boolean(w.tags.includes('学术短语') || w.tags.includes('习语'));
  return w.tags.includes(deck.name);
}

export const DEFAULT_SETTINGS: UserSettings = {
  dailyNewWords: 15,
  dailyReviewLimit: 50,
  desiredRetention: 0.90,
  autoPlayAudio: true,
  accent: 'us',
  enableLatencyPenalty: true,
  latencyThresholdMs: 4200,
  activeDeckId: 'deck-cet4',
  activeListIndex: 'all',
  soundVolume: 0.8,
  tactileSoundEnabled: true,
  keyboardShortcutsEnabled: true,
  theme: 'system',
};

export class StorageService {
  public static loadDeletedDeckIds(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DELETED_DECKS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load deleted deck ids', e);
    }
    return [];
  }

  public static markDeckDeleted(deckId: string): void {
    try {
      const deleted = new Set(this.loadDeletedDeckIds());
      deleted.add(deckId);
      localStorage.setItem(STORAGE_KEYS.DELETED_DECKS, JSON.stringify(Array.from(deleted)));
    } catch (e) {
      console.error('Failed to save deleted deck ids', e);
    }
  }

  public static unmarkDeckDeleted(deckId: string): void {
    try {
      const deleted = new Set(this.loadDeletedDeckIds());
      deleted.delete(deckId);
      localStorage.setItem(STORAGE_KEYS.DELETED_DECKS, JSON.stringify(Array.from(deleted)));
    } catch (e) {
      console.error('Failed to update deleted deck ids', e);
    }
  }

  public static loadWords(): WordItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORDS);
      if (data) {
        const storedWords: WordItem[] = JSON.parse(data);
        const sanitizedWords = storedWords.map(sanitizeStoredWord);
        const storedIds = new Set(sanitizedWords.map(w => w.id));
        const deletedDeckIds = new Set(this.loadDeletedDeckIds());
        // 仅在词库未被用户主动删除时，补充默认新词
        const missingDefaults = INITIAL_WORDS.filter(w => {
          const deckId = w.deckId || 'deck-cet4';
          return !storedIds.has(w.id) && !deletedDeckIds.has(deckId);
        });
        if (missingDefaults.length > 0) {
          const merged = [...sanitizedWords, ...missingDefaults.map(sanitizeStoredWord)];
          this.saveWords(merged);
          return merged;
        }
        return sanitizedWords;
      }
    } catch (e) {
      console.error('Failed to load words from storage', e);
    }
    // 初次使用，初始化默认词库
    this.saveWords(INITIAL_WORDS);
    return INITIAL_WORDS;
  }

  public static saveWords(words: WordItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.WORDS, JSON.stringify(words));
    } catch (e) {
      console.error('Failed to save words', e);
    }
  }

  public static loadDecks(): DeckMetadata[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DECKS);
      if (data) {
        const storedDecks: DeckMetadata[] = JSON.parse(data);
        const storedIds = new Set(storedDecks.map(d => d.id));
        const deletedDeckIds = new Set(this.loadDeletedDeckIds());
        // 仅在官方词库未被用户主动删除时补充
        const missingDefaultDecks = DECKS.filter(d => !storedIds.has(d.id) && !deletedDeckIds.has(d.id));
        if (missingDefaultDecks.length > 0) {
          const merged = [...storedDecks, ...missingDefaultDecks];
          this.saveDecks(merged);
          return merged;
        }
        return storedDecks;
      }
    } catch (e) {
      console.error('Failed to load decks', e);
    }
    this.saveDecks(DECKS);
    return DECKS;
  }

  public static saveDecks(decks: DeckMetadata[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(decks));
    } catch (e) {
      console.error('Failed to save decks', e);
    }
  }

  public static loadProgress(): Record<string, WordProgress> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load progress', e);
    }
    return {};
  }

  public static saveProgress(progressMap: Record<string, WordProgress>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progressMap));
    } catch (e) {
      console.error('Failed to save progress', e);
    }
  }

  public static getOrCreateWordProgress(wordId: string, progressMap: Record<string, WordProgress>): WordProgress {
    if (progressMap[wordId]) {
      return progressMap[wordId];
    }
    return {
      wordId,
      state: State.New,
      difficulty: 5.0,
      stability: 0.5,
      retrievability: 1.0,
      lastReview: 0,
      nextReview: 0,
      reps: 0,
      lapses: 0,
      history: [],
      isStarred: false,
      isMastered: false
    };
  }

  public static loadSettings(): UserSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    return DEFAULT_SETTINGS;
  }

  public static saveSettings(settings: UserSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  public static clearAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.WORDS);
    localStorage.removeItem(STORAGE_KEYS.PROGRESS);
    localStorage.removeItem(STORAGE_KEYS.DECKS);
    localStorage.removeItem(STORAGE_KEYS.DELETED_DECKS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  }
}
