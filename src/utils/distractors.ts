import { WordItem } from '../types';

export function calculateLevenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * 提取中文释义的核心实词关键词（过滤掉虚词、标点和词性助记符）
 */
function extractSemanticKeywords(text: string): { words2: Set<string>; chars: Set<string> } {
  // 移除常见英文词性标号与标点符号
  const cleaned = text
    .replace(/[a-zA-Z\.\s，；、：:,\(\)（）/]/g, '')
    .trim();

  const chars = new Set<string>();
  const words2 = new Set<string>();
  const stopwords = new Set('的是在了和于以或与及将中着为所被从'.split(''));

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (!stopwords.has(c)) {
      chars.add(c);
    }
    if (i < cleaned.length - 1) {
      const bi = cleaned.slice(i, i + 2);
      if (!stopwords.has(bi[0]) && !stopwords.has(bi[1])) {
        words2.add(bi);
      }
    }
  }

  return { words2, chars };
}

/**
 * 判断两个中文释义之间是否存在显著的语义重叠（即是否意思过于相近）
 */
export function hasSemanticOverlap(transA: string, transB: string): boolean {
  if (!transA || !transB) return false;

  const a = extractSemanticKeywords(transA);
  const b = extractSemanticKeywords(transB);

  // 1. 2字核心词重叠检测 (例如两边都有 "导致"、"放弃"、"模棱"、"重要"、"提出"、"阐明")
  for (const w2 of a.words2) {
    if (b.words2.has(w2)) {
      return true; // 存在相同核心词，直接认定为意思差别不大！
    }
  }

  // 2. 单字交集过大检测 (当出现 2 个以上实词单字重合，如 "敏捷" vs "敏锐")
  let charOverlapCount = 0;
  for (const c of a.chars) {
    if (b.chars.has(c)) {
      charOverlapCount++;
      if (charOverlapCount >= 2) {
        return true;
      }
    }
  }

  return false;
}

// 预设按词性/类型分类的高质量典型干扰项词库 (含义清晰、差异鲜明)
const CURATED_DISTRACTOR_POOLS: Record<'verb' | 'adj' | 'noun' | 'phrase' | 'adv', string[]> = {
  verb: [
    '维持，保持，维护存在',
    '延迟，推迟，耽搁安排',
    '证实，证明，确证真实性',
    '克制，抑制，控制欲望',
    '促进，加速，推动发展',
    '揭露，揭发，公之于众',
    '忽视，忽略，视而不见',
    '适应，调节，使之习惯',
    '消耗，耗尽，消减储备',
    '分配，分派，配置资源',
    '辩护，辩解，证明合理',
    '阐明，解释，指明缘由',
    '吸收，接纳，合并同化',
    '阻碍，妨碍，阻止发生',
    '放弃，遗弃，彻底舍弃',
  ],
  adj: [
    '清晰的，明白无误的，显而易见的',
    '持久的，永久不变的，长期的',
    '脆弱的，易受伤害的，易损的',
    '广泛的，大范围的，普遍存在的',
    '微小的，微不足道的，忽略不计的',
    '极其重要的，关键性的，决定性的',
    '模棱两可的，含糊不清的，多义的',
    '谨小慎微的，一丝不苟的，缜密的',
    '短暂的，转瞬即逝的，朝生暮死的',
    '无处不在的，各处皆有的',
    '有弹性的，适应力强的，韧性的',
    '貌似合理的，讲得通的，看似对的',
    '矛盾的，相互对立的，冲突的',
    '新颖的，前所未有的，独创的',
  ],
  noun: [
    '容量，才能，生产负荷量',
    '危机，困境，严峻形势',
    '障碍，阻力，绊脚石',
    '繁荣，兴盛，蓬勃发展期',
    '倾向，偏好，特有癖好',
    '假说，推测，未经证实的设想',
    '特权，优待，专属豁免权',
    '先驱，倡导者，领域先锋',
    '范式，典范，标准范式模型',
    '出入，差异，显著不一致',
    '后果，余波，长期不良影响',
    '多样性，丰富性，多面性',
  ],
  phrase: [
    '考虑到，把...计入考量',
    '想出，提出，构想出方案',
    '在...方面，从...角度来看',
    '处理，应付，战胜危机',
    '导致，引起，造成新局面',
    '正相反，恰恰相反，反之',
    '得到回报，取得成功，付清',
    '扮演至关重要的角色，起关键作用',
    '阐明，解释，使...清晰明了',
    '为...铺平道路，创造有利条件',
    '以...为代价，牺牲...换取',
    '牢记在心，时刻记住',
    '致力于，全心投身于',
    '摆脱，除掉，彻底规避',
    '由...组成，包含多种成分',
  ],
  adv: [
    '正相反，反倒，恰恰相反',
    '显著地，值得注意地',
    '不可避免地，必然地',
    '谨慎地，极其小心地',
    '广泛地，普遍地',
  ]
};

function detectCategory(word: WordItem): 'phrase' | 'verb' | 'adj' | 'noun' | 'adv' {
  if (word.isPhrase || word.word.trim().includes(' ') || word.pos?.includes('phr')) {
    return 'phrase';
  }
  const pos = (word.pos || '').toLowerCase();
  if (pos.startsWith('v') || pos.includes('verb') || pos.includes('v.')) return 'verb';
  if (pos.startsWith('adj') || pos.includes('adj.')) return 'adj';
  if (pos.startsWith('adv') || pos.includes('adv.')) return 'adv';
  if (pos.startsWith('n') || pos.includes('noun') || pos.includes('n.')) return 'noun';
  
  // 默认根据首尾推断
  return 'verb';
}

/**
 * 认知科学高辨识度干扰项生成器
 * 确保选项之间：
 * 1. 语法词性一致（全动词、全形容词或全短语）
 * 2. 核心中文释义完全互斥，杜绝“意思差不多”的近义词或近同选项
 * 3. 错项清晰、确凿、有说服力
 */
export function generateSmartDistractors(
  targetWord: WordItem,
  allWords: WordItem[],
  count: number = 3
): WordItem[] {
  const category = detectCategory(targetWord);
  const selectedDistractors: WordItem[] = [];
  const selectedTranslations: string[] = [targetWord.translation];

  // 1. 优先在词库候选词中寻找语法词性相同且意思完全不同的词
  const candidates = allWords.filter(w => {
    if (w.id === targetWord.id) return false;
    if (w.word.toLowerCase() === targetWord.word.toLowerCase()) return false;

    // 严禁近义词互为干扰项 (如 abandon 与 relinquish)
    if (targetWord.synonyms && targetWord.synonyms.some(s => s.toLowerCase() === w.word.toLowerCase())) return false;
    if (w.synonyms && w.synonyms.some(s => s.toLowerCase() === targetWord.word.toLowerCase())) return false;

    // 严禁语义重叠 (如 "引起导致" 与 "产生导致")
    if (hasSemanticOverlap(targetWord.translation, w.translation)) {
      return false;
    }

    return true;
  });

  // 按词性/短语属性匹配度与词形迷惑度排序
  const scored = candidates.map(candidate => {
    let score = 0;
    const candCat = detectCategory(candidate);
    if (candCat === category) score += 10;

    // 首字母相同轻微加分
    if (targetWord.word[0].toLowerCase() === candidate.word[0].toLowerCase()) {
      score += 2;
    }

    return { candidate, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // 从候选池中挑选互不冲突的词条
  for (const item of scored) {
    if (selectedDistractors.length >= count) break;
    const cand = item.candidate;

    // 确保与已选中的其他干扰项也没有语义重叠
    const conflicts = selectedTranslations.some(t => hasSemanticOverlap(t, cand.translation));
    if (!conflicts) {
      selectedDistractors.push(cand);
      selectedTranslations.push(cand.translation);
    }
  }

  // 2. 如果当前词库中词汇量不足，或剩余词汇语义太接近，从高质量典型语义库中补齐
  if (selectedDistractors.length < count) {
    const fallbackList = CURATED_DISTRACTOR_POOLS[category] || CURATED_DISTRACTOR_POOLS.verb;
    const shuffledPool = [...fallbackList].sort(() => Math.random() - 0.5);

    for (const poolMeaning of shuffledPool) {
      if (selectedDistractors.length >= count) break;

      const conflicts = selectedTranslations.some(t => hasSemanticOverlap(t, poolMeaning));
      if (!conflicts) {
        selectedDistractors.push({
          id: `distractor-fallback-${selectedDistractors.length}-${Date.now()}`,
          word: `option-${selectedDistractors.length}`,
          isPhrase: category === 'phrase',
          phonetic_us: '',
          translation: poolMeaning,
          pos: category === 'phrase' ? 'phr.' : category === 'adj' ? 'adj.' : category === 'noun' ? 'n.' : 'v.',
          definition_en: poolMeaning,
          example_en: '',
          example_zh: '',
          tags: ['干扰项'],
        });
        selectedTranslations.push(poolMeaning);
      }
    }
  }

  return selectedDistractors.slice(0, count);
}
