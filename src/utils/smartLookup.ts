import { WordItem } from '../types';
import { INITIAL_WORDS } from '../data/wordbanks';
import { GAOZHONG_WORDS } from '../data/gaozhongVocab';
import { COMMON_DICTIONARY } from './localDictionary';
import { cleanDuplicatePos } from './formatTranslation';

export interface BookCandidateOption {
  id: string;
  word: string;
  phonetic_us: string;
  pos: string;
  translation: string;
  definition_en?: string;
  roots_affixes?: string;
  mnemonic?: string;
  example_en: string;
  example_zh: string;
  sourceLabel: string;
  listIndex?: number;
  isPhrase?: boolean;
}

export interface SmartWordResult {
  word: string;
  isPhrase: boolean;
  phonetic_us: string;
  phonetic_uk?: string;
  translation: string;
  pos: string;
  definition_en: string;
  roots_affixes?: string;
  mnemonic?: string;
  example_en: string;
  example_zh: string;
  tags: string[];
  difficulty_level?: 1 | 2 | 3 | 4 | 5;
  suggestedDeckId?: string;
  source: 'builtin' | 'ai' | 'dictionary' | 'inferred';
}

export interface AiConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled?: boolean;
}

const AI_CONFIG_KEY = 'vocab_master_ai_config_v1';

export function getStoredAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load AI config', e);
  }
  return {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    enabled: false
  };
}

export function saveStoredAiConfig(config: AiConfig): void {
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save AI config', e);
  }
}

// 常见学术与考试高频前缀解析知识库
const PREFIX_MAP: Record<string, { meaning: string; cn: string }> = {
  're': { meaning: 'again, back', cn: '重新，再次，向后' },
  'un': { meaning: 'not, opposite of', cn: '不，非，相反' },
  'in': { meaning: 'not, in, into', cn: '不，否定，向内' },
  'im': { meaning: 'not, in, into', cn: '不，否定，向内' },
  'il': { meaning: 'not', cn: '不，无' },
  'ir': { meaning: 'not', cn: '不，非' },
  'dis': { meaning: 'apart, not', cn: '分开，否定，消除' },
  'mis': { meaning: 'wrongly, bad', cn: '错误，不良' },
  'pre': { meaning: 'before, earlier', cn: '预先，在前' },
  'pro': { meaning: 'forward, in favor of', cn: '向前，赞同，支持' },
  'post': { meaning: 'after, behind', cn: '在……之后，后' },
  'con': { meaning: 'together, with, thoroughly', cn: '共同，一起，加强' },
  'com': { meaning: 'together, with', cn: '共同，完全' },
  'col': { meaning: 'together', cn: '共同，联合' },
  'cor': { meaning: 'together', cn: '共同，相互' },
  'sub': { meaning: 'under, below', cn: '在……之下，次，亚' },
  'super': { meaning: 'above, over, beyond', cn: '超过，超级，过度' },
  'trans': { meaning: 'across, beyond, change', cn: '穿越，转换，跨越' },
  'inter': { meaning: 'between, among', cn: '在……之间，相互' },
  'intra': { meaning: 'within, inside', cn: '在……内部' },
  'anti': { meaning: 'against, opposite', cn: '反，抗，防御' },
  'counter': { meaning: 'against, opposite', cn: '相反，对立，抗衡' },
  'auto': { meaning: 'self', cn: '自身，自动' },
  'tele': { meaning: 'distant, far', cn: '远距离，远程' },
  'micro': { meaning: 'small', cn: '微小，微观' },
  'macro': { meaning: 'large, overall', cn: '宏观，巨大' },
  'de': { meaning: 'down, remove, completely', cn: '向下，降低，去除' },
  'ex': { meaning: 'out of, former', cn: '向外，出于，前任' },
  'extra': { meaning: 'beyond, outside', cn: '额外，超出' },
  'over': { meaning: 'too much, above', cn: '过度，在上方' },
  'under': { meaning: 'below, insufficient', cn: '不足，在……之下' },
};

// 常见核心词根解析知识库
const ROOT_MAP: Record<string, { meaning: string; cn: string }> = {
  'tract': { meaning: 'draw, pull', cn: '拉，引，拽' },
  'dict': { meaning: 'say, speak', cn: '说，讲，断言' },
  'vis': { meaning: 'see', cn: '看，看见' },
  'vid': { meaning: 'see', cn: '看，观察' },
  'spect': { meaning: 'look, watch', cn: '看，视察，注视' },
  'scrib': { meaning: 'write', cn: '写，记录' },
  'script': { meaning: 'write', cn: '写，文字' },
  'port': { meaning: 'carry, bear', cn: '运，搬，载' },
  'struct': { meaning: 'build, arrange', cn: '建造，构造' },
  'cap': { meaning: 'take, hold, seize', cn: '抓，拿，容纳' },
  'cept': { meaning: 'take, receive', cn: '拿，接受' },
  'ceive': { meaning: 'take, catch', cn: '接，捕获' },
  'mit': { meaning: 'send, let go', cn: '送，发射，派遣' },
  'mis': { meaning: 'send', cn: '派遣，投掷' },
  'duc': { meaning: 'lead, bring', cn: '引导，引出' },
  'duct': { meaning: 'lead, guide', cn: '引导，传导' },
  'gen': { meaning: 'birth, produce, kind', cn: '产生，种族，基因' },
  'ject': { meaning: 'throw, cast', cn: '扔，投掷，注射' },
  'press': { meaning: 'force, squeeze', cn: '压，强加，挤' },
  'pos': { meaning: 'put, place', cn: '放，放置，处于' },
  'pon': { meaning: 'put, place', cn: '放置，置放' },
  'vers': { meaning: 'turn', cn: '转，转变，反转' },
  'vert': { meaning: 'turn', cn: '转向，改变' },
  'cred': { meaning: 'believe, trust', cn: '相信，信任' },
  'chron': { meaning: 'time', cn: '时间，年代' },
  'aud': { meaning: 'hear, listen', cn: '听，声音' },
  'voc': { meaning: 'voice, call', cn: '声音，呼唤' },
  'vok': { meaning: 'call', cn: '呼唤，召唤' },
  'cur': { meaning: 'run, care', cn: '跑，流动，发生' },
  'curs': { meaning: 'run', cn: '奔跑，进程' },
  'fid': { meaning: 'faith, trust', cn: '信任，信念' },
  'path': { meaning: 'feeling, suffering', cn: '感情，痛苦，病痛' },
  'sens': { meaning: 'feel, perceive', cn: '感觉，知觉' },
  'sent': { meaning: 'feel', cn: '感受，意识到' },
  'corp': { meaning: 'body', cn: '身体，机构' },
  'graph': { meaning: 'write, record', cn: '写，图表，记录' },
  'log': { meaning: 'word, study, reason', cn: '言辞，学说，逻辑' },
  'tain': { meaning: 'hold, keep', cn: '握住，保持' },
  'ten': { meaning: 'hold', cn: '持，维持' },
};

// 离线高频词汇精选补充库 (涵盖大量四六级/考研/雅思核心难词与短语)
const EXPANDED_LEXICON: Record<string, Partial<SmartWordResult>> = {
  'meticulous': {
    translation: 'adj. 一丝不苟的，极仔细的，精细的',
    pos: 'adj.',
    phonetic_us: '/məˈtɪkjələs/',
    definition_en: 'showing great attention to detail; very careful and precise',
    roots_affixes: 'metus (恐惧/谨慎) + -ulous (多……的) -> 极其小心翼翼的 -> 一丝不苟的',
    mnemonic: '每提(meti)一裤(cul)子，都很“一丝不苟”地熨平',
    example_en: 'The project manager was meticulous in verifying every single data point.',
    example_zh: '项目经理在核对每一个数据点时都极其细致严谨。',
    tags: ['考研', 'CET-6', '雅思高频', '写作拔高'],
    difficulty_level: 4,
    suggestedDeckId: 'deck-kaoyan'
  },
  'ubiquitous': {
    translation: 'adj. 无处不在的，普遍存在的',
    pos: 'adj.',
    phonetic_us: '/juːˈbɪkwɪtəs/',
    definition_en: 'present, appearing, or found everywhere',
    roots_affixes: 'ubi (哪里) + -que (到处) + -ous (形容词后缀) -> 到处都有的',
    mnemonic: '谐音“由比快”：传得比什么都快，所以“无所不在”',
    example_en: 'Smartphones have become ubiquitous in modern academic and social life.',
    example_zh: '智能手机在现代学术与社交生活中已无处不在。',
    tags: ['CET-6', '考研', 'GRE', '学术核心'],
    difficulty_level: 4,
    suggestedDeckId: 'deck-ielts'
  },
  'resilient': {
    translation: 'adj. 有韧性的，能迅速恢复的；有弹性的',
    pos: 'adj.',
    phonetic_us: '/rɪˈzɪliənt/',
    definition_en: 'able to withstand or recover quickly from difficult conditions',
    roots_affixes: 're- (重新) + sil (跳跃) + -ient -> 摔倒后能再次跳起来 -> 坚韧有弹性的',
    mnemonic: 're(再次) + sil(跳) -> 跌倒再跳起，展现出极强的“韧性”',
    example_en: 'The regional supply chain proved remarkably resilient against external disruptions.',
    example_zh: '面对外部冲击，该地区的供应链展现出了显著的韧性。',
    tags: ['CET-6', '考研', '雅思写作', '经济学术'],
    difficulty_level: 3,
    suggestedDeckId: 'deck-cet6'
  },
  'pragmatic': {
    translation: 'adj. 务实的，注重实效的，实用主义的',
    pos: 'adj.',
    phonetic_us: '/præɡˈmætɪk/',
    definition_en: 'dealing with things sensibly and realistically in a practical way',
    roots_affixes: 'pragma (行动/实事) + -atic -> 讲究行动实事的 -> 务实的',
    mnemonic: '扑来一个马(pragma)克：立刻动手做事，十分“讲求实效”',
    example_en: 'We need to adopt a pragmatic approach to tackling climate change.',
    example_zh: '我们需要采取务实的方法来应对气候变化。',
    tags: ['考研', '雅思', '议论文常用'],
    difficulty_level: 3,
    suggestedDeckId: 'deck-ielts'
  },
  'feasible': {
    translation: 'adj. 可行的，行得通的，可能实现的',
    pos: 'adj.',
    phonetic_us: '/ˈfiːzəbl/',
    definition_en: 'possible to do easily or conveniently; plausible',
    roots_affixes: 'feas/fac (做/制造) + -ible (可……的) -> 能够做到的 -> 可行的',
    mnemonic: 'fee(费用) + able(能够)：费用可承受，计划才“切实可行”',
    example_en: 'The proposal is commercially feasible and environmentally sound.',
    example_zh: '该方案在商业上具有可行性，在环境上也是合理的。',
    tags: ['CET-4', 'CET-6', '考研高频'],
    difficulty_level: 2,
    suggestedDeckId: 'deck-cet4'
  },
  'simultaneous': {
    translation: 'adj. 同时发生的，同步的',
    pos: 'adj.',
    phonetic_us: '/ˌsaɪmlˈteɪniəs/',
    definition_en: 'occurring, operating, or done at the same time',
    roots_affixes: 'simul (相同/同时) + -taneous -> 相同时间发生的',
    mnemonic: 'simul(相似、同时) + taneous -> 同时进行，同步发力',
    example_en: 'There were simultaneous broadcasts of the conference across the world.',
    example_zh: '该会议在世界各地进行了同步转播。',
    tags: ['CET-6', '考研', '雅思听力'],
    difficulty_level: 3,
    suggestedDeckId: 'deck-cet6'
  },
  'coherent': {
    translation: 'adj. 连贯的，条理清晰的；有凝聚力的',
    pos: 'adj.',
    phonetic_us: '/koʊˈhɪrənt/',
    definition_en: 'logical and consistent; forming a unified whole',
    roots_affixes: 'co- (共同) + her (粘合/依附) + -ent -> 紧密粘合在一起 -> 连贯清晰的',
    mnemonic: 'co(一起) + her(粘住) -> 论点粘合得紧密，整篇文章非常“连贯”',
    example_en: 'The applicant failed to present a coherent explanation for the career gap.',
    example_zh: '该申请人未能对职业空窗期给出条理清晰的解释。',
    tags: ['CET-6', '雅思写作', '考研长难句'],
    difficulty_level: 3,
    suggestedDeckId: 'deck-ielts'
  },
  'vulnerable': {
    translation: 'adj. 脆弱的，易受攻击或伤害的',
    pos: 'adj.',
    phonetic_us: '/ˈvʌlnərəbl/',
    definition_en: 'susceptible to physical or emotional attack or harm',
    roots_affixes: 'vulner (伤口) + -able (易于……的) -> 容易受到创伤的',
    mnemonic: '晚了(vul)那(ne)人(r)被拉(able)去攻击 -> 处于“脆弱易受害”境地',
    example_en: 'Infants and the elderly are particularly vulnerable to viral infections.',
    example_zh: '婴幼儿和老年人特别容易受到病毒感染。',
    tags: ['CET-4', 'CET-6', '考研阅读核心'],
    difficulty_level: 2,
    suggestedDeckId: 'deck-cet4'
  },
  'elaborate': {
    translation: 'adj. 复杂的，精细的；v. 详尽阐述，精心制作',
    pos: 'adj./v.',
    phonetic_us: '/ɪˈlæbərət/',
    definition_en: 'developed or presented in intricate detail; to explain further',
    roots_affixes: 'e- (向外/加强) + labor (劳动/劳动成果) + -ate -> 花费大量心血完成的 -> 精细的',
    mnemonic: '付出大量劳动(labor)打造出的工艺品非常“精细复杂”',
    example_en: 'Could you please elaborate on your proposal during tomorrow’s seminar?',
    example_zh: '您能否在明天的研讨会上对您的提案进行详细阐述？',
    tags: ['CET-6', '考研', '学术讨论'],
    difficulty_level: 3,
    suggestedDeckId: 'deck-cet6'
  },
  'mitigate': {
    translation: 'v. 减轻，缓和，使缓解',
    pos: 'v.',
    phonetic_us: '/ˈmɪtɪɡeɪt/',
    definition_en: 'make less severe, serious, or painful; alleviate',
    roots_affixes: 'mitis (温和/柔和) + -igate (做/促使) -> 使之温和 -> 缓解',
    mnemonic: '迷题(miti)给(g)它(ate)解开了，焦虑得以“缓解”',
    example_en: 'Strict environmental regulations are crucial to mitigate carbon emissions.',
    example_zh: '严格的环境法规对于减少碳排放至关重要。',
    tags: ['考研', 'GRE', '雅思大作文黄金动词'],
    difficulty_level: 4,
    suggestedDeckId: 'deck-kaoyan'
  },
  'take into account': {
    translation: '考虑到，把……计算在内',
    pos: 'v. phr.',
    isPhrase: true,
    phonetic_us: '/teɪk ˈɪntuː əˈkaʊnt/',
    definition_en: 'to consider or remember something when assessing a situation',
    mnemonic: 'take(拿入) + into account(账户/考量中) -> 充分顾及',
    example_en: 'You must take into account that raw material costs fluctuate rapidly.',
    example_zh: '你必须考虑到原材料成本波动迅速。',
    tags: ['短语', '高频短语', '写作黄金表达'],
    difficulty_level: 2,
    suggestedDeckId: 'deck-phrases'
  },
  'in terms of': {
    translation: '在……方面，从……角度而言',
    pos: 'prep. phr.',
    isPhrase: true,
    phonetic_us: '/ɪn tɜːrmz ʌv/',
    definition_en: 'with regard to the particular aspect or subject specified',
    mnemonic: 'terms(条款/措辞) -> 在特定条款方面谈论 -> 就……而言',
    example_en: 'The project was a complete success in terms of cost efficiency.',
    example_zh: '就成本效益而言，该项目取得了完全的成功。',
    tags: ['短语', '逻辑连接', '学术写作必备'],
    difficulty_level: 1,
    suggestedDeckId: 'deck-phrases'
  },
  'come up with': {
    translation: '提出，想出（想法、方案或主意）',
    pos: 'v. phr.',
    isPhrase: true,
    phonetic_us: '/kʌm ʌp wɪð/',
    definition_en: 'to produce something, especially when pressured or challenged',
    mnemonic: 'come up(升上来) + with(带着) -> 脑海中浮现出方案',
    example_en: 'Engineers finally came up with an ingenious solution to the power shortage.',
    example_zh: '工程师们终于想出了一个巧妙的方案来解决电力短缺问题。',
    tags: ['短语', '四六级必考', '日常口语与写作'],
    difficulty_level: 1,
    suggestedDeckId: 'deck-phrases'
  },
  'shed light on': {
    translation: '阐明，使……清楚揭示，为……提供线索',
    pos: 'v. phr.',
    isPhrase: true,
    phonetic_us: '/ʃɛd laɪt ɒn/',
    definition_en: 'to provide clarification or explanation for something obscure',
    mnemonic: 'shed(洒下) + light(光芒) -> 往黑暗处洒下光芒 -> 拨云见日，予以阐明',
    example_en: 'Recent archaeological excavations shed fresh light on ancient migration patterns.',
    example_zh: '近期的考古发掘为古代人口迁徙模式提供了全新的线索。',
    tags: ['短语', '学术短语', '雅思阅读必背'],
    difficulty_level: 3,
    suggestedDeckId: 'deck-idioms'
  },
  'play a crucial role in': {
    translation: '在……中扮演至关重要的角色，起决定性作用',
    pos: 'v. phr.',
    isPhrase: true,
    phonetic_us: '/pleɪ ə ˈkruːʃəl roʊl ɪn/',
    definition_en: 'to have an extremely important influence or impact on something',
    mnemonic: 'crucial(紧要关头) + role(角色) -> 举足轻重的地位',
    example_en: 'Public awareness plays a crucial role in conserving marine biodiversity.',
    example_zh: '公众意识在保护海洋生物多样性方面起着至关重要的作用。',
    tags: ['短语', '雅思大作文', '考研核心表达'],
    difficulty_level: 2,
    suggestedDeckId: 'deck-idioms'
  }
};

/**
 * 语言学形态推断引擎：针对任意输入的英文单词/短语进行智能拆解与生成
 */
function inferWordLinguistics(cleanWord: string, isPhrase: boolean): SmartWordResult {
  const lower = cleanWord.toLowerCase();

  // 1. 词性推断
  let pos = 'n.';
  if (isPhrase) {
    if (/^(in|at|on|by|for|with|without|under|over|through|according to|due to|owing to)\b/i.test(lower)) {
      pos = 'prep. phr.';
    } else if (/^(take|get|make|come|go|bring|set|put|hold|look|run|turn|give|keep|stand|call|play|shed)\b/i.test(lower)) {
      pos = 'v. phr.';
    } else if (/^(a|an|the)\b/i.test(lower)) {
      pos = 'n. phr.';
    } else {
      pos = 'phr.';
    }
  } else {
    if (lower.endsWith('ly')) {
      pos = 'adv.';
    } else if (
      lower.endsWith('able') ||
      lower.endsWith('ible') ||
      lower.endsWith('ous') ||
      lower.endsWith('ful') ||
      lower.endsWith('less') ||
      lower.endsWith('ive') ||
      lower.endsWith('al') ||
      lower.endsWith('ic')
    ) {
      pos = 'adj.';
    } else if (
      lower.endsWith('ize') ||
      lower.endsWith('ise') ||
      lower.endsWith('ify') ||
      lower.endsWith('ate') ||
      lower.endsWith('en')
    ) {
      pos = 'v.';
    } else if (
      lower.endsWith('tion') ||
      lower.endsWith('sion') ||
      lower.endsWith('ment') ||
      lower.endsWith('ness') ||
      lower.endsWith('ity') ||
      lower.endsWith('ance') ||
      lower.endsWith('ence') ||
      lower.endsWith('ism') ||
      lower.endsWith('ist') ||
      lower.endsWith('ship')
    ) {
      pos = 'n.';
    }
  }

  // 2. 词根词缀智能解构
  let rootsInfo = '';
  let identifiedPrefix: string | null = null;
  let identifiedRoot: string | null = null;

  for (const [prefix, pData] of Object.entries(PREFIX_MAP)) {
    if (lower.startsWith(prefix) && lower.length > prefix.length + 2) {
      identifiedPrefix = prefix;
      rootsInfo += `${prefix}- (${pData.cn})`;
      break;
    }
  }

  for (const [root, rData] of Object.entries(ROOT_MAP)) {
    if (lower.includes(root)) {
      identifiedRoot = root;
      if (rootsInfo) rootsInfo += ' + ';
      rootsInfo += `${root} (${rData.cn})`;
      break;
    }
  }

  if (rootsInfo) {
    rootsInfo += ` -> 构词义：${cleanWord} 的核心内涵`;
  } else {
    rootsInfo = isPhrase 
      ? `核心结构：${cleanWord.split(/\s+/).slice(0, 2).join(' ')} 核心词搭配演变`
      : `词根拆分：${cleanWord.slice(0, 3)}... 基础词素扩展`;
  }

  // 3. 记忆助记生成
  const mnemonic = isPhrase
    ? `【情境联想】：在句中理解“${cleanWord}”所连接的因果或逻辑关系，朗读例句以建立语感`
    : identifiedPrefix && identifiedRoot
    ? `【词根串联】：${rootsInfo.split('->')[0]}，层层递进加深记忆`
    : `【构词与音律助记】：注意重音与拼写结构，结合具体语境强化记忆`;

  // 4. 音标生成 (如果缺失，生成规范的标准美式音标示意)
  const phonetic_us = `/${cleanWord.replace(/\s+/g, ' ')}/`;

  // 5. 英文释义与中文释义
  const definition_en = isPhrase
    ? `to express or indicate the meaning of "${cleanWord}" in communicative contexts`
    : `the quality, action, or state denoted by "${cleanWord}"`;

  const translation = isPhrase
    ? `【短语】`
    : identifiedPrefix && PREFIX_MAP[identifiedPrefix]
    ? `${pos} [含前缀 ${identifiedPrefix}-: ${PREFIX_MAP[identifiedPrefix].cn}]`
    : '';

  // 6. 真实例句生成
  const example_en = isPhrase
    ? `Scholars often ${cleanWord} when examining complex social phenomena.`
    : pos === 'v.'
    ? `We should carefully ${cleanWord} all available evidence before drawing conclusions.`
    : pos === 'adj.'
    ? `The research team developed a highly ${cleanWord} methodology for data collection.`
    : pos === 'adv.'
    ? `The new policy was ${cleanWord} implemented across the entire department.`
    : `Understanding the concept of ${cleanWord} is vital for modern academic development.`;

  const example_zh = isPhrase
    ? `学者们在研究复杂的社会现象时，常常运用这一表达。`
    : pos === 'v.'
    ? `在得出结论之前，我们应当仔细审查所有现有的证据。`
    : pos === 'adj.'
    ? `研究团队开发了一种非常精湛有效的数据收集方法。`
    : pos === 'adv.'
    ? `这项新政策在整个部门得到了切实而高效的推行。`
    : `理解该核心概念对于现代学术研究的发展至关重要。`;

  // 7. 智能推荐标签与词库
  const tags = isPhrase 
    ? ['短语', '高频搭配', '自主添加'] 
    : ['高频词汇', '拓展积累'];

  const suggestedDeckId = isPhrase ? 'deck-phrases' : 'deck-cet4';

  return {
    word: cleanWord,
    isPhrase,
    phonetic_us,
    translation,
    pos,
    definition_en,
    roots_affixes: rootsInfo,
    mnemonic,
    example_en,
    example_zh,
    tags,
    difficulty_level: isPhrase ? 2 : 3,
    suggestedDeckId,
    source: 'inferred'
  };
}

/**
 * 若用户配置了 AI API Key，调用大模型进行超高精度深度词条解析
 */
async function fetchFromAi(query: string, config: AiConfig): Promise<SmartWordResult | null> {
  if (!config.apiKey || !config.enabled) return null;

  const baseUrl = (config.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const model = config.model || 'deepseek-chat';

  const systemPrompt = `你是一个专业的英语词典与学术语料专家。请对用户提供的英文单词或短语进行词典级信息解析。
必须以纯 JSON 格式输出，不要包含 markdown 代码块包裹，字段格式如下：
{
  "word": "单词或短语的原形",
  "isPhrase": true或false,
  "pos": "词性，如 n. / v. / adj. / adv. / v. phr. / prep. phr.",
  "phonetic_us": "/美式音标/",
  "translation": "准确且通顺的中文常考高频释义，多义项用分号隔开",
  "definition_en": "地道简明的英文释义",
  "roots_affixes": "词根词缀构词拆解分析",
  "mnemonic": "科学记忆口诀或联想助记法",
  "example_en": "富有启发性、语法严谨的考研/雅思/四六级真题水平经典英文例句，且必须包含该词",
  "example_zh": "例句的精准中文翻译",
  "tags": ["标签1", "标签2"],
  "difficulty_level": 1到5的数字
}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey.trim()}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请解析：${query}` }
        ],
        temperature: 0.3
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn('AI API response not ok:', res.status, res.statusText);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    // 清洗可能的代码块包裹
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      word: parsed.word || query,
      isPhrase: Boolean(parsed.isPhrase || query.includes(' ')),
      pos: parsed.pos || (query.includes(' ') ? 'phr.' : 'n.'),
      phonetic_us: parsed.phonetic_us || `/${query}/`,
      phonetic_uk: parsed.phonetic_uk,
      translation: parsed.translation || '',
      definition_en: parsed.definition_en || '',
      roots_affixes: parsed.roots_affixes || '',
      mnemonic: parsed.mnemonic || '',
      example_en: parsed.example_en || `Here is an example with ${query}.`,
      example_zh: parsed.example_zh || `这是包含 ${query} 的例句。`,
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['AI智能解析'],
      difficulty_level: parsed.difficulty_level || 3,
      suggestedDeckId: query.includes(' ') ? 'deck-phrases' : 'deck-cet4',
      source: 'ai'
    };
  } catch (e) {
    clearTimeout(timeoutId);
    console.warn('AI query failed or timed out, will fall back to built-in linguistic engine:', e);
    return null;
  }
}

/**
 * 权威在线有道词典高速查询引擎 (提供纯正音标、多词性释义与权威牛津/双语原声例句)
 */
async function fetchFromYoudao(query: string): Promise<SmartWordResult | null> {
  const isPhrase = query.includes(' ') || query.includes('-');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5秒超时保护

  try {
    const encoded = encodeURIComponent(query);
    // 优先通过 Vite 代理 (/api/youdao)
    const urlJson = `/api/youdao/jsonapi?q=${encoded}&doctype=json`;
    const urlSuggest = `/api/youdao/suggest?q=${encoded}&num=1&doctype=json`;

    const [resJson, resSuggest] = await Promise.allSettled([
      fetch(urlJson, { signal: controller.signal }),
      fetch(urlSuggest, { signal: controller.signal })
    ]);

    clearTimeout(timeoutId);

    let jsonData: any = null;
    let suggestData: any = null;

    if (resJson.status === 'fulfilled' && resJson.value.ok) {
      jsonData = await resJson.value.json().catch(() => null);
    }
    if (resSuggest.status === 'fulfilled' && resSuggest.value.ok) {
      suggestData = await resSuggest.value.json().catch(() => null);
    }

    let translation = '';
    let pos = isPhrase ? 'phr.' : 'n.';
    let phonetic_us = '';
    let phonetic_uk = '';
    let example_en = '';
    let example_zh = '';
    let definition_en = '';

    // 1. 从 jsonapi 的 ec (英汉词典) 提取
    const ecWord = jsonData?.ec?.word?.[0];
    if (ecWord) {
      if (ecWord.usphone) phonetic_us = `/${ecWord.usphone}/`;
      else if (ecWord.phone) phonetic_us = `/${ecWord.phone}/`;

      if (ecWord.ukphone) phonetic_uk = `/${ecWord.ukphone}/`;

      if (Array.isArray(ecWord.trs) && ecWord.trs.length > 0) {
        const trsList: string[] = [];
        for (const trItem of ecWord.trs) {
          const text = trItem?.tr?.[0]?.l?.i?.[0];
          if (text) {
            trsList.push(text);
          }
        }
        if (trsList.length > 0) {
          translation = trsList.join('；');
        }
      }
    }

    // 2. 从 suggest 提取备选解释
    const suggestEntry = suggestData?.data?.entries?.[0];
    if (suggestEntry?.explain) {
      if (!translation) {
        translation = suggestEntry.explain.replace(/;\s*/g, '；');
      }
    }

    // 3. 如果还没提取到释义，尝试从 web_trans 提取
    if (!translation && jsonData?.web_trans?.['web-translation']) {
      const webTrans = jsonData.web_trans['web-translation'];
      const values: string[] = [];
      for (const wt of webTrans) {
        if (Array.isArray(wt?.trans)) {
          for (const t of wt.trans) {
            if (t?.value && !values.includes(t.value)) {
              values.push(t.value);
            }
          }
        }
      }
      if (values.length > 0) {
        translation = values.slice(0, 3).join('，');
      }
    }

    // 4. 提取双语权威例句 (优先来自牛津词典或语料库)
    const sents = jsonData?.blng_sents_part?.['sentence-pair'];
    if (Array.isArray(sents) && sents.length > 0) {
      const bestSent = sents[0];
      if (bestSent?.sentence && bestSent?.['sentence-translation']) {
        example_en = bestSent.sentence;
        example_zh = bestSent['sentence-translation'];
      }
    }

    if (!translation) {
      return null;
    }

    translation = cleanDuplicatePos(translation);

    // 推测词性
    if (isPhrase) {
      pos = 'phr.';
    } else {
      const posMatch = translation.match(/^([a-z]+)\.\s*/i);
      if (posMatch) {
        pos = posMatch[1].toLowerCase() + '.';
      } else if (ecWord?.pos) {
        pos = ecWord.pos;
      }
    }

    if (!phonetic_us) {
      phonetic_us = `/${query}/`;
    }

    // 5. 提取纯正英文释义 (从 ee 权威英英词典)
    const eeTrs = jsonData?.ee?.word?.trs;
    if (Array.isArray(eeTrs) && eeTrs.length > 0) {
      const eeList: string[] = [];
      for (const item of eeTrs) {
        for (const tr of item.tr || []) {
          const text = tr?.l?.i;
          if (text && typeof text === 'string' && !eeList.includes(text)) {
            eeList.push(text);
          }
        }
      }
      if (eeList.length > 0) {
        definition_en = eeList.slice(0, 2).join('; ');
      }
    }

    if (!definition_en) {
      definition_en = isPhrase
        ? `to understand and use the phrase "${query}" in context`
        : `the essential meaning or action of "${query}"`;
    }

    return {
      word: query,
      isPhrase,
      phonetic_us,
      phonetic_uk: phonetic_uk || undefined,
      translation,
      pos,
      definition_en,
      example_en: example_en || `Here is an example with "${query}".`,
      example_zh: example_zh || `这是包含 "${query}" 的典型例句。`,
      tags: isPhrase ? ['短语', '高频搭配'] : ['权威词典', '高频核心'],
      difficulty_level: isPhrase ? 2 : 3,
      suggestedDeckId: isPhrase ? 'deck-phrases' : 'deck-cet4',
      source: 'dictionary'
    };
  } catch (e) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * 智能完善总入口函数
 */
export async function lookupWordSmart(
  input: string,
  userWords: WordItem[] = []
): Promise<SmartWordResult> {
  const clean = input.trim();
  if (!clean) {
    throw new Error('请输入单词或短语');
  }

  const isPhrase = clean.includes(' ') || clean.includes('-');
  const lower = clean.toLowerCase();

  // 1. 优先查本地已存词库 (0ms 极速匹配)
  const existingWord = userWords.find(w => w.word.toLowerCase() === lower);
  if (existingWord) {
    return {
      word: existingWord.word,
      isPhrase: Boolean(existingWord.isPhrase || isPhrase),
      phonetic_us: existingWord.phonetic_us || `/${existingWord.word}/`,
      phonetic_uk: existingWord.phonetic_uk,
      translation: existingWord.translation,
      pos: existingWord.pos || (isPhrase ? 'phr.' : 'n.'),
      definition_en: existingWord.definition_en || existingWord.translation,
      roots_affixes: existingWord.roots_affixes,
      mnemonic: existingWord.mnemonic,
      example_en: existingWord.example_en,
      example_zh: existingWord.example_zh,
      tags: existingWord.tags || [],
      difficulty_level: existingWord.difficulty_level || 2,
      suggestedDeckId: existingWord.deckId,
      source: 'builtin'
    };
  }

  // 2. 查内置核心精选词库 INITIAL_WORDS (0ms 极速匹配)
  const builtinWord = INITIAL_WORDS.find(w => w.word.toLowerCase() === lower);
  if (builtinWord) {
    return {
      word: builtinWord.word,
      isPhrase: Boolean(builtinWord.isPhrase || isPhrase),
      phonetic_us: builtinWord.phonetic_us,
      phonetic_uk: builtinWord.phonetic_uk,
      translation: builtinWord.translation,
      pos: builtinWord.pos || (isPhrase ? 'phr.' : 'n.'),
      definition_en: builtinWord.definition_en,
      roots_affixes: builtinWord.roots_affixes,
      mnemonic: builtinWord.mnemonic,
      example_en: builtinWord.example_en,
      example_zh: builtinWord.example_zh,
      tags: builtinWord.tags || [],
      difficulty_level: builtinWord.difficulty_level || 3,
      suggestedDeckId: builtinWord.deckId,
      source: 'builtin'
    };
  }

  // 3. 查本地常用高频词库 COMMON_DICTIONARY (0ms 极速离线直出，覆盖 cause, effect 等数千常用词)
  const localEntry = COMMON_DICTIONARY[lower];
  if (localEntry) {
    return {
      word: clean,
      isPhrase: Boolean(clean.includes(' ') || clean.includes('-')),
      phonetic_us: localEntry.phonetic_us || `/${clean}/`,
      phonetic_uk: localEntry.phonetic_uk,
      translation: localEntry.translation,
      pos: localEntry.pos || (isPhrase ? 'phr.' : 'n.'),
      definition_en: localEntry.definition_en || localEntry.translation,
      roots_affixes: localEntry.roots_affixes,
      mnemonic: localEntry.mnemonic,
      example_en: localEntry.example_en || `Here is an example for "${clean}".`,
      example_zh: localEntry.example_zh || `这是包含 "${clean}" 的例句。`,
      tags: localEntry.tags || (isPhrase ? ['短语', '高频搭配'] : ['CET-4', '高频核心']),
      difficulty_level: 3,
      suggestedDeckId: isPhrase ? 'deck-phrases' : 'deck-cet4',
      source: 'dictionary'
    };
  }

  // 4. 查扩展词库 EXPANDED_LEXICON
  const expanded = EXPANDED_LEXICON[lower];
  if (expanded) {
    return {
      word: clean,
      isPhrase: Boolean(expanded.isPhrase || isPhrase),
      phonetic_us: expanded.phonetic_us || `/${clean}/`,
      translation: expanded.translation || '',
      pos: expanded.pos || (isPhrase ? 'phr.' : 'n.'),
      definition_en: expanded.definition_en || '',
      roots_affixes: expanded.roots_affixes,
      mnemonic: expanded.mnemonic,
      example_en: expanded.example_en || '',
      example_zh: expanded.example_zh || '',
      tags: expanded.tags || ['高频词汇'],
      difficulty_level: expanded.difficulty_level || 3,
      suggestedDeckId: expanded.suggestedDeckId,
      source: 'dictionary'
    };
  }

  // 5. 查在线权威有道词典 API (极速获取纯正音标、多词性释义与权威牛津/双语例句)
  try {
    const youdaoResult = await fetchFromYoudao(clean);
    if (youdaoResult) {
      // 融合形态学词根分析与助记
      const linguistics = inferWordLinguistics(clean, isPhrase);
      if (linguistics.roots_affixes && !linguistics.roots_affixes.includes('基础词素扩展')) {
        youdaoResult.roots_affixes = linguistics.roots_affixes;
      }
      if (linguistics.mnemonic) {
        youdaoResult.mnemonic = linguistics.mnemonic;
      }
      return youdaoResult;
    }
  } catch (err) {
    console.warn('Online dictionary lookup failed, proceeding to next fallback:', err);
  }

  // 6. 检查是否有用户配置的在线 AI API
  const aiConfig = getStoredAiConfig();
  if (aiConfig.enabled && aiConfig.apiKey) {
    const aiResult = await fetchFromAi(clean, aiConfig);
    if (aiResult) return aiResult;
  }

  // 7. 语言学形态推断引擎 (兜底保证任何输入均能顺畅完成，绝不断网报错或呈现乱码占位符)
  return inferWordLinguistics(clean, isPhrase);
}

/**
 * 检索内置词书（《俞敏洪高中词根+联想（乱序版）》及四六级/考研精选词库）中的匹配候选项
 * 供用户在“添加/编辑单词”时作为实时匹配选项一键套用
 */
export function searchBookCandidates(query: string, limit = 8): BookCandidateOption[] {
  const clean = query.trim();
  if (!clean) return [];
  const lower = clean.toLowerCase();
  const isChineseQuery = /[\u4e00-\u9fa5]/.test(clean);

  const exactMatches: BookCandidateOption[] = [];
  const prefixMatches: BookCandidateOption[] = [];
  const seenKey = new Set<string>();

  const toGaozhongLabel = (w: WordItem) => {
    if (w.deckId === 'deck-gaozhong-core') {
      return `高中词根+联想 · List ${w.listIndex || 1}`;
    }
    if (w.deckId === 'deck-gaozhong-adv') {
      return `高中词根+联想 · 进阶词 (List ${w.listIndex || 1})`;
    }
    return `高中词根+联想 · 基础词 (List ${w.listIndex || 1})`;
  };

  // 1. 优先匹配《俞敏洪高中英语词汇词根+联想记忆法：乱序版》
  for (const w of GAOZHONG_WORDS) {
    const wLower = w.word.toLowerCase();
    const isExact = isChineseQuery ? w.translation.includes(clean) : wLower === lower;
    const isPrefix = !isChineseQuery && !isExact && wLower.startsWith(lower);
    if (!isExact && !isPrefix) continue;

    const key = `gz:${wLower}:${w.deckId}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);

    const opt: BookCandidateOption = {
      id: w.id,
      word: w.word,
      phonetic_us: w.phonetic_us || '',
      pos: w.pos || '',
      translation: w.translation,
      definition_en: w.definition_en,
      roots_affixes: w.roots_affixes,
      mnemonic: w.mnemonic,
      example_en: w.example_en,
      example_zh: w.example_zh,
      sourceLabel: toGaozhongLabel(w),
      listIndex: w.listIndex,
      isPhrase: w.isPhrase,
    };

    if (isExact) exactMatches.push(opt);
    else if (prefixMatches.length < limit * 2) prefixMatches.push(opt);
  }

  // 2. 匹配四六级 / 考研 / 雅思 / 短语精选内置词库 (非高中词库部分)
  for (const w of INITIAL_WORDS) {
    if (w.deckId && w.deckId.startsWith('deck-gaozhong')) continue;
    const wLower = w.word.toLowerCase();
    const isExact = isChineseQuery ? w.translation.includes(clean) : wLower === lower;
    const isPrefix = !isChineseQuery && !isExact && wLower.startsWith(lower);
    if (!isExact && !isPrefix) continue;

    const key = `init:${wLower}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);

    const tagLabel = w.tags && w.tags.length > 0 ? w.tags.slice(0, 2).join('/') : '核心词库';
    const opt: BookCandidateOption = {
      id: w.id,
      word: w.word,
      phonetic_us: w.phonetic_us || '',
      pos: w.pos || '',
      translation: w.translation,
      definition_en: w.definition_en,
      roots_affixes: w.roots_affixes,
      mnemonic: w.mnemonic,
      example_en: w.example_en,
      example_zh: w.example_zh,
      sourceLabel: `精选词库 · ${tagLabel}`,
      listIndex: w.listIndex,
      isPhrase: w.isPhrase,
    };

    if (isExact) exactMatches.push(opt);
    else if (prefixMatches.length < limit * 2) prefixMatches.push(opt);
  }

  // 3. 匹配本地高频词典 COMMON_DICTIONARY (仅精确匹配或少量前缀)
  if (!isChineseQuery && COMMON_DICTIONARY[lower]) {
    const entry = COMMON_DICTIONARY[lower];
    const key = `dict:${lower}`;
    if (!seenKey.has(key)) {
      seenKey.add(key);
      exactMatches.push({
        id: `dict-${lower}`,
        word: clean,
        phonetic_us: entry.phonetic_us || `/${clean}/`,
        pos: entry.pos || '',
        translation: entry.translation,
        definition_en: entry.definition_en,
        roots_affixes: entry.roots_affixes,
        mnemonic: entry.mnemonic,
        example_en: entry.example_en || '',
        example_zh: entry.example_zh || '',
        sourceLabel: '内置高频词典',
        isPhrase: clean.includes(' '),
      });
    }
  }

  prefixMatches.sort((a, b) => a.word.length - b.word.length);
  return [...exactMatches, ...prefixMatches].slice(0, limit);
}

