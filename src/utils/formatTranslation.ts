export interface MeaningItem {
  pos?: string;
  text: string;
}

export interface ParsedMeanings {
  pos: string;
  coreItems: MeaningItem[];
  extendedItems: MeaningItem[];
  coreText: string;
  extendedText: string;
  hasExtended: boolean;
  totalCount: number;
}

/**
 * 清除任何连续重复的词性标签（如 "v. v. "、"n. n. "）
 */
export function cleanDuplicatePos(text: string): string {
  if (!text) return '';
  return text
    .replace(/\b([a-z]{1,6}\.)\s*\1\b/gi, '$1')
    .replace(/^([a-z]{1,6}\.)\s+\1\s*/i, '$1 ')
    .trim();
}

/**
 * 将分词列表按词性友好聚合排版，避免重复标出词性
 */
function formatGrouped(items: MeaningItem[]): string {
  if (items.length === 0) return '';
  const groups: { pos?: string; list: string[] }[] = [];
  let currentGroup: { pos?: string; list: string[] } | null = null;

  for (const it of items) {
    const p = it.pos ? it.pos.trim().toLowerCase() : '';
    if (!currentGroup || currentGroup.pos !== p) {
      currentGroup = { pos: p, list: [it.text] };
      groups.push(currentGroup);
    } else {
      currentGroup.list.push(it.text);
    }
  }

  return groups
    .map(g => (g.pos ? `${g.pos} ` : '') + g.list.join('；'))
    .join('；');
}

/**
 * 将释义拆解为常见高频考意 (Core) 与扩展/次要释义 (Extended)
 */
export function parseMeanings(rawTranslation: string, wordPos?: string): ParsedMeanings {
  const cleaned = cleanDuplicatePos(rawTranslation || '');
  const normalizedPos = (wordPos || '').trim().replace(/\b([a-z]{1,6}\.)\s*\1\b/gi, '$1');

  if (!cleaned) {
    return {
      pos: normalizedPos,
      coreItems: [],
      extendedItems: [],
      coreText: '',
      extendedText: '',
      hasExtended: false,
      totalCount: 0
    };
  }

  // 初步按分号或换行切分
  const rawSegments = cleaned.split(/[；;\n]+/).map(s => s.trim()).filter(Boolean);
  const items: MeaningItem[] = [];
  let currentPos = normalizedPos;

  for (const seg of rawSegments) {
    // 检查此分句是否带有词性标记，如 "v. 咒骂" 或 "n. 宣誓"
    const pMatch = seg.match(/^([a-z]{1,6}\.)\s*(.*)/i);
    if (pMatch) {
      currentPos = pMatch[1].toLowerCase();
      const content = pMatch[2].trim();
      if (content) {
        items.push({ pos: currentPos, text: content });
      }
    } else {
      items.push({ pos: currentPos, text: seg });
    }
  }

  // 若总条目数 <= 2，全作为核心考意，不折叠
  if (items.length <= 2) {
    return {
      pos: normalizedPos || currentPos,
      coreItems: items,
      extendedItems: [],
      coreText: formatGrouped(items),
      extendedText: '',
      hasExtended: false,
      totalCount: items.length
    };
  }

  // 核心考意规则：
  // 1. 每个词性取前 1~2 个最简明精炼的考意
  // 2. 避免将长括号补充（如 "（尤指在法庭）宣誓" 或 "<非正式>暗杀协议"）排入常见考意
  // 3. 总数最多保留 2~3 个核心含义
  const coreItems: MeaningItem[] = [];
  const extendedItems: MeaningItem[] = [];
  const posUsageCount: Record<string, number> = {};

  for (const it of items) {
    const pKey = it.pos || 'default';
    const used = posUsageCount[pKey] || 0;

    // 是否是长说明/次要补充项 (比如以长括号或 <...> 开头)
    const isExplanatory = it.text.startsWith('（') || it.text.startsWith('(') || it.text.startsWith('<');

    if (used < 2 && coreItems.length < 3 && (!isExplanatory || items.length === 1)) {
      coreItems.push(it);
      posUsageCount[pKey] = used + 1;
    } else {
      extendedItems.push(it);
    }
  }

  // 兜底：如果过滤后 coreItems 为空，放首项
  if (coreItems.length === 0 && items.length > 0) {
    coreItems.push(items[0]);
    extendedItems.shift();
  }

  const coreText = formatGrouped(coreItems);
  const extendedText = formatGrouped(extendedItems);

  return {
    pos: normalizedPos || currentPos,
    coreItems,
    extendedItems,
    coreText,
    extendedText,
    hasExtended: extendedItems.length > 0,
    totalCount: items.length
  };
}

/**
 * 清理英文释义，防止显示重复词性或全中文
 */
export function cleanEnglishDefinition(defEn: string | undefined, word: string, pos?: string): string {
  if (!defEn) return '';
  let cleaned = defEn.replace(/\b([a-z]{1,6}\.)\s*\1\b/gi, '$1').trim();
  cleaned = cleaned.replace(/^([a-z]{1,6}\.)\s+\1\s*/i, '$1 ');

  // 检查是否全为中文（即误把中文释义填到了 definition_en）
  const chineseChars = cleaned.match(/[\u4e00-\u9fa5]/g);
  if (chineseChars && chineseChars.length > cleaned.length * 0.4) {
    // 超过40%为中文，不显示为英文释义
    return '';
  }
  return cleaned;
}
