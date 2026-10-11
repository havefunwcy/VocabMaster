import { WordItem, WordProgress, State } from '../types';

export const DEFAULT_WORDS_PER_LIST = 20;

export interface ListSummary {
  listIndex: number;
  name: string;
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  newWords: number;
  dueWords: number;
  words: WordItem[];
}

/**
 * 获取单个单词的 List 序号 (从 1 开始)
 * 如果单词未显式指定 listIndex，则按其在词库中的顺序和每组词数计算
 */
export function getWordListIndex(
  word: WordItem,
  deckWords: WordItem[],
  wordsPerList: number = DEFAULT_WORDS_PER_LIST
): number {
  if (word.listIndex && word.listIndex > 0) {
    return word.listIndex;
  }
  const idx = deckWords.findIndex(w => w.id === word.id);
  if (idx >= 0) {
    return Math.floor(idx / Math.max(1, wordsPerList)) + 1;
  }
  return 1;
}

/**
 * 确保词库中所有单词都有明确的 listIndex
 */
export function ensureWordsListIndices(
  words: WordItem[],
  deckId: string,
  wordsPerList: number = DEFAULT_WORDS_PER_LIST
): WordItem[] {
  const deckWords = words.filter(w => (w.deckId || 'deck-cet4') === deckId);
  return words.map(w => {
    if ((w.deckId || 'deck-cet4') === deckId && (!w.listIndex || w.listIndex <= 0)) {
      const idx = deckWords.findIndex(dw => dw.id === w.id);
      return {
        ...w,
        listIndex: Math.floor(Math.max(0, idx) / Math.max(1, wordsPerList)) + 1
      };
    }
    return w;
  });
}

/**
 * 重新均分指定词库的单词 List (如改为每 List 15/20/30词)
 */
export function repartitionDeckWords(
  allWords: WordItem[],
  deckId: string,
  wordsPerList: number = DEFAULT_WORDS_PER_LIST
): WordItem[] {
  let counter = 0;
  return allWords.map(w => {
    if ((w.deckId || 'deck-cet4') === deckId) {
      const listIndex = Math.floor(counter / Math.max(1, wordsPerList)) + 1;
      counter++;
      return {
        ...w,
        listIndex
      };
    }
    return w;
  });
}

/**
 * 统计并归纳词库中各个 List 的统计概况与单词列表
 */
export function getDeckListSummaries(
  deckWords: WordItem[],
  wordsPerList: number = DEFAULT_WORDS_PER_LIST,
  progressMap: Record<string, WordProgress> = {},
  now: number = Date.now()
): ListSummary[] {
  if (!deckWords || deckWords.length === 0) return [];

  // 1. 分组映射
  const listGroups = new Map<number, WordItem[]>();

  deckWords.forEach((word, index) => {
    const listIdx = word.listIndex && word.listIndex > 0 
      ? word.listIndex 
      : Math.floor(index / Math.max(1, wordsPerList)) + 1;

    if (!listGroups.has(listIdx)) {
      listGroups.set(listIdx, []);
    }
    listGroups.get(listIdx)!.push(word);
  });

  // 2. 排序分组
  const sortedIndices = Array.from(listGroups.keys()).sort((a, b) => a - b);

  return sortedIndices.map(listIdx => {
    const words = listGroups.get(listIdx)!;
    let masteredWords = 0;
    let learningWords = 0;
    let newWords = 0;
    let dueWords = 0;

    words.forEach(w => {
      const prog = progressMap[w.id];
      if (!prog || prog.state === State.New) {
        newWords++;
      } else if (prog.isMastered || prog.stability >= 30) {
        masteredWords++;
      } else {
        learningWords++;
      }

      if (prog && prog.nextReview <= now && prog.state !== State.New && !prog.isMastered) {
        dueWords++;
      }
    });

    return {
      listIndex: listIdx,
      name: `List ${listIdx}`,
      totalWords: words.length,
      masteredWords,
      learningWords,
      newWords,
      dueWords,
      words
    };
  });
}
