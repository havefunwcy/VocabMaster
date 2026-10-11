export enum Rating {
  Again = 1, // 忘记 / 重来
  Hard = 2,  // 困难 / 提取迟缓
  Good = 3,  // 掌握 / 正常回忆
  Easy = 4   // 简单 / 瞬间秒杀
}

export enum State {
  New = 0,        // 新词
  Learning = 1,   // 学习中
  Review = 2,     // 复习中
  Relearning = 3  // 遗忘重学
}

export interface ReviewLog {
  timestamp: number;
  rating: Rating;
  state: State;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  latencyMs: number; // 反应时间（毫秒）
  mode: 'flashcard' | 'cloze' | 'spelling' | 'speed';
}

export interface WordItem {
  id: string;
  word: string;
  isPhrase?: boolean; // 是否为短语/固定搭配
  deckId?: string; // 归属词库ID
  listIndex?: number; // List 分卷序号: 1, 2, 3...
  phonetic_us: string;
  phonetic_uk?: string;
  translation: string;
  pos?: string;
  definition_en: string;
  roots_affixes?: string;
  mnemonic?: string; // 科学助记/记忆口诀
  example_en: string;
  example_zh: string;
  tags: string[];
  difficulty_level?: 1 | 2 | 3 | 4 | 5;
  synonyms?: string[];
  antonyms?: string[];
}

export interface WordProgress {
  wordId: string;
  state: State;
  difficulty: number;  // D (1.0 - 10.0)
  stability: number;   // S (记忆存续期，单位：天)
  retrievability: number; // R (当前提取概率 0.0 - 1.0)
  lastReview: number;  // 毫秒时间戳
  nextReview: number;  // 毫秒时间戳
  reps: number;        // 总复习次数
  lapses: number;      // 遗忘/错误次数
  history: ReviewLog[];
  isStarred?: boolean;
  isMastered?: boolean;
}

export interface LearningSessionState {
  startTime: number;
  totalCardsReviewed: number;
  correctCards: number;
  averageLatencyMs: number;
  fatigueScore: number; // 0 - 100
  recentLatencies: number[];
  recentErrors: boolean[];
}

export interface DeckMetadata {
  id: string;
  name: string;
  description: string;
  category: 'gaozhong' | 'cet4' | 'cet6' | 'kaoyan' | 'ielts' | 'toefl' | 'gre' | 'phrases' | 'custom';
  totalWords: number;
  icon: string;
  color: string;
  isCustom?: boolean;
  wordsPerList?: number; // 每 List 词数，默认 20
  targetLevel?: string;  // 适用目标/学段铭牌（例如 "高考冲刺"、"CET-4 425+"、"学术写作"）
  isPinned?: boolean;    // 是否置顶在词库矩阵前排
}

export interface UserSettings {
  dailyNewWords: number;
  dailyReviewLimit: number;
  desiredRetention: number; // 期望记忆保持率 (如 0.90)
  autoPlayAudio: boolean;
  accent: 'us' | 'uk';
  enableLatencyPenalty: boolean; // 是否启用反应超时降权
  latencyThresholdMs: number; // 超过该毫秒判定为困难提取 (例如 4000ms)
  activeDeckId: string;
  activeListIndex?: number | 'all'; // 当前选中的 List 序号 ('all' 为整书)
  soundVolume: number;
  tactileSoundEnabled?: boolean; // 是否启用实体按键微音效
  keyboardShortcutsEnabled: boolean;
  theme?: 'light' | 'dark' | 'system';
}
