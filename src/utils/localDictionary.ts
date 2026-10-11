export interface LocalDictEntry {
  translation: string;
  pos: string;
  phonetic_us?: string;
  phonetic_uk?: string;
  definition_en?: string;
  roots_affixes?: string;
  mnemonic?: string;
  example_en?: string;
  example_zh?: string;
  tags?: string[];
}

export const COMMON_DICTIONARY: Record<string, LocalDictEntry> = {
  'cause': {
    translation: 'n. 原因，起因；事业，目标；理由；v. 引起，使发生，导致',
    pos: 'n./v.',
    phonetic_us: '/kɔːz/',
    phonetic_uk: '/kɔːz/',
    definition_en: 'a person or thing that gives rise to an action, phenomenon, or condition; make happen',
    roots_affixes: 'caus (理由/原因) -> 带来后果的原动力',
    mnemonic: '因为(because)前面有考(cau)试，所以“引起”大家重视',
    example_en: 'Heavy rainfall was the primary cause of the severe flooding.',
    example_zh: '强降雨是造成这次严重洪灾的主要原因。',
    tags: ['CET-4', '高频核心', '动名词']
  },
  'effect': {
    translation: 'n. 影响，效果，作用；结果；v. 使发生，产生，引起',
    pos: 'n./v.',
    phonetic_us: '/ɪˈfekt/',
    phonetic_uk: '/ɪˈfekt/',
    definition_en: 'a change that is a result or consequence of an action or other cause',
    roots_affixes: 'ef/ex (出) + fect (做/制造) -> 制造出来的产物 -> 效果，结果',
    mnemonic: 'ef(向外) + fect(做) -> 做出来的外部反应就是“影响与结果”',
    example_en: 'The new regulations will have a profound effect on the educational sector.',
    example_zh: '新规将对教育领域产生深远的影响。',
    tags: ['CET-4', '高频核心', '写作必背']
  },
  'affect': {
    translation: 'v. 影响；感染；深深打动，震撼',
    pos: 'v.',
    phonetic_us: '/əˈfekt/',
    phonetic_uk: '/əˈfekt/',
    definition_en: 'have an effect on; make a difference to; touch the feelings of',
    roots_affixes: 'af- (向/施加) + fect (做) -> 施加作用于 -> 影响',
    mnemonic: 'a(一个) + fect(做) -> 施加作用，产生“影响”',
    example_en: 'Climate conditions directly affect agricultural productivity.',
    example_zh: '气候条件直接影响着农业生产力。',
    tags: ['CET-4', '易混淆词', '高频动词']
  },
  'lead': {
    translation: 'v. 引导，带领；导致，引起(lead to)；n. 领先，榜样，线索',
    pos: 'v./n.',
    phonetic_us: '/liːd/',
    phonetic_uk: '/liːd/',
    definition_en: 'guide or direct in a course or direction; result in',
    mnemonic: 'leader(领导者)负责“带领，引领”方向',
    example_en: 'Careless driving often leads to serious traffic accidents.',
    example_zh: '粗心驾驶往往会导致严重的交通事故。',
    tags: ['CET-4', '短语搭配', '核心词']
  },
  'result': {
    translation: 'n. 结果，后果，成绩；v. 发生，产生，导致(result in/from)',
    pos: 'n./v.',
    phonetic_us: '/rɪˈzʌlt/',
    phonetic_uk: '/rɪˈzʌlt/',
    definition_en: 'a thing that is caused or produced by something else; an outcome',
    roots_affixes: 're- (反/回) + sult (跳) -> 跳回来的反应 -> 结果',
    example_en: 'The experiment produced promising results for further research.',
    example_zh: '该实验为进一步的研究得出了令人振奋的结果。',
    tags: ['CET-4', '高频核心', '写作词汇']
  },
  'produce': {
    translation: 'v. 生产，制造；产生，引起；n. 农产品，产品',
    pos: 'v./n.',
    phonetic_us: '/prəˈduːs/',
    phonetic_uk: '/prəˈdjuːs/',
    definition_en: 'make or manufacture from components or raw materials; cause to exist',
    roots_affixes: 'pro- (向前) + duc (引导/带出) -> 往前带出来 -> 生产，产生',
    example_en: 'Technological innovations have helped produce higher crop yields.',
    example_zh: '技术创新帮助提高了农作物产量。',
    tags: ['CET-4', '核心动词']
  },
  'provide': {
    translation: 'v. 提供，供给；给予；规定(provide for)',
    pos: 'v.',
    phonetic_us: '/prəˈvaɪd/',
    phonetic_uk: '/prəˈvaɪd/',
    definition_en: 'make available for use; supply',
    roots_affixes: 'pro- (向前/预先) + vid (看) -> 预先看到需要 -> 提供，供应',
    example_en: 'The government aims to provide equal access to healthcare.',
    example_zh: '政府旨在提供平等的医疗保健机会。',
    tags: ['CET-4', '基础核心']
  },
  'require': {
    translation: 'v. 需要；要求，规定；命令',
    pos: 'v.',
    phonetic_us: '/rɪˈkwaɪər/',
    phonetic_uk: '/rɪˈkwaɪə/',
    definition_en: 'need for a particular purpose; demand as a condition',
    roots_affixes: 're- (再次/加强) + quir (寻求) -> 反复寻求 -> 需要，要求',
    example_en: 'This challenging task requires exceptional concentration and patience.',
    example_zh: '这项艰巨的任务需要极度的专注和耐心。',
    tags: ['CET-4', '高频核心']
  },
  'include': {
    translation: 'v. 包括，包含；列入',
    pos: 'v.',
    phonetic_us: '/ɪnˈkluːd/',
    phonetic_uk: '/ɪnˈkluːd/',
    definition_en: 'comprise or contain as part of a whole',
    roots_affixes: 'in- (内) + clud (关) -> 关在里面 -> 包括，包含',
    example_en: 'The total price includes airport taxes and meal services.',
    example_zh: '总价格包括机场税和餐饮服务。',
    tags: ['CET-4', '高频核心']
  },
  'consider': {
    translation: 'v. 考虑，斟酌；认为，觉得；体谅',
    pos: 'v.',
    phonetic_us: '/kənˈsɪdər/',
    phonetic_uk: '/kənˈsɪdə/',
    definition_en: 'think carefully about; regard as',
    roots_affixes: 'con- (共同) + sider (星星) -> 像观察星象一样深思 -> 仔细考虑',
    example_en: 'We must consider both the environmental and economic impacts.',
    example_zh: '我们必须同时考虑环境与经济两方面的影响。',
    tags: ['CET-4', '写作核心']
  },
  'suggest': {
    translation: 'v. 建议，提议；表明，暗示；启发',
    pos: 'v.',
    phonetic_us: '/səɡˈdʒest/',
    phonetic_uk: '/səˈdʒest/',
    definition_en: 'put forward for consideration; cause one to think that something exists or is the case',
    roots_affixes: 'sug/sub- (在下面) + gest (带) -> 从底下带上来 -> 暗示，建议',
    example_en: 'Recent findings suggest that regular exercise improves memory retention.',
    example_zh: '近期的研究结果表明，规律运动有助于提高记忆力。',
    tags: ['CET-4', '考研高频']
  },
  'occur': {
    translation: 'v. 发生，出现；存在；被想到(occur to sb.)',
    pos: 'v.',
    phonetic_us: '/əˈkɜːr/',
    phonetic_uk: '/əˈkɜː/',
    definition_en: 'happen; take place; exist or be found',
    roots_affixes: 'oc- (迎面) + cur (跑) -> 迎面跑来 -> 发生，出现',
    example_en: 'Earthquakes frequently occur along continental fault lines.',
    example_zh: '地震频繁发生在大桥大陆断裂带附近。',
    tags: ['CET-4', '高频核心']
  },
  'develop': {
    translation: 'v. 发展，开发；形成，逐渐养成；患(病)',
    pos: 'v.',
    phonetic_us: '/dɪˈveləp/',
    phonetic_uk: '/dɪˈveləp/',
    definition_en: 'grow or cause to grow and become more mature, advanced, or elaborate',
    roots_affixes: 'de- (去除) + velop (包住) -> 揭开包装 -> 展现，开发',
    example_en: 'Students are encouraged to develop critical thinking skills.',
    example_zh: '鼓励学生培养批判性思维能力。',
    tags: ['CET-4', '基础核心']
  },
  'increase': {
    translation: 'v./n. 增加，增长，提高，增多',
    pos: 'v./n.',
    phonetic_us: '/ɪnˈkriːs/',
    phonetic_uk: '/ɪnˈkriːs/',
    definition_en: 'become or make greater in size, amount, intensity, or degree',
    roots_affixes: 'in- (进入/向内) + creas (生长) -> 持续往里生长 -> 增加',
    example_en: 'Demand for renewable energy continues to increase globally.',
    example_zh: '全球对可再生能源的需求持续增长。',
    tags: ['CET-4', '图表作文核心']
  },
  'decrease': {
    translation: 'v./n. 减少，降低，减小，衰减',
    pos: 'v./n.',
    phonetic_us: '/dɪˈkriːs/',
    phonetic_uk: '/dɪˈkriːs/',
    definition_en: 'make or become smaller or fewer in size, amount, intensity, or degree',
    roots_affixes: 'de- (向下/减少) + creas (生长) -> 生长变缓 -> 减少',
    example_en: 'Unemployment rates have decreased significantly this quarter.',
    example_zh: '本季度失业率显著下降。',
    tags: ['CET-4', '图表作文核心']
  },
  'improve': {
    translation: 'v. 改善，改进，提高；变好',
    pos: 'v.',
    phonetic_us: '/ɪmˈpruːv/',
    phonetic_uk: '/ɪmˈpruːv/',
    definition_en: 'make or become better',
    roots_affixes: 'im- (使) + prove (有利/收益) -> 使获得更多收益 -> 改善',
    example_en: 'Regular practice will greatly improve your oral English fluency.',
    example_zh: '经常练习将大大提高你的英语口语流利度。',
    tags: ['CET-4', '写作核心']
  },
  'reduce': {
    translation: 'v. 减少，降低；减小；简化',
    pos: 'v.',
    phonetic_us: '/rɪˈduːs/',
    phonetic_uk: '/rɪˈdjuːs/',
    definition_en: 'make smaller or less in amount, degree, or size',
    roots_affixes: 're- (往回) + duc (引导) -> 往回带 -> 缩减，降低',
    example_en: 'New technologies help companies reduce operational expenditures.',
    example_zh: '新技术帮助企业降低运营开支。',
    tags: ['CET-4', '写作核心']
  },
  'achieve': {
    translation: 'v. 实现，达到；取得成功，完成',
    pos: 'v.',
    phonetic_us: '/əˈtʃiːv/',
    phonetic_uk: '/əˈtʃiːv/',
    definition_en: 'successfully bring about or reach a desired objective or result',
    roots_affixes: 'a- (到) + chief/cap (头/顶部) -> 达到顶峰 -> 获得成功',
    example_en: 'She worked diligently to achieve academic excellence.',
    example_zh: '她勤奋努力以取得优异的学业成绩。',
    tags: ['CET-4', '高频核心']
  },
  'perspective': {
    translation: 'n. 视角，观点，看法；透视法；远景',
    pos: 'n.',
    phonetic_us: '/pərˈspektɪv/',
    phonetic_uk: '/pəˈspektɪv/',
    definition_en: 'a particular attitude toward or way of regarding something; a point of view',
    roots_affixes: 'per- (完全/穿透) + spect (看) + -ive -> 彻底看清全局的视角',
    mnemonic: 'per(每一个) + spect(看) -> 从每个角度看 -> 视角，观点',
    example_en: 'Studying abroad gives young people a broader global perspective.',
    example_zh: '出国留学为年轻人提供了更广阔的全球视野。',
    tags: ['CET-6', '考研', '雅思高频']
  },
  'factor': {
    translation: 'n. 因素，要素；因子，因数',
    pos: 'n.',
    phonetic_us: '/ˈfæktər/',
    phonetic_uk: '/ˈfæktə/',
    definition_en: 'a circumstance, fact, or influence that contributes to a result or outcome',
    roots_affixes: 'fact (做/造) + -or -> 促成事物做成的事物 -> 因素',
    example_en: 'Diet and physical exercise are key factors in maintaining physical wellness.',
    example_zh: '饮食和体育锻炼是维持身体健康的关键因素。',
    tags: ['CET-4', '高频核心']
  },
  'feature': {
    translation: 'n. 特征，特色；容貌；特写；v. 以……为特色，起主要作用',
    pos: 'n./v.',
    phonetic_us: '/ˈfiːtʃər/',
    phonetic_uk: '/ˈfiːtʃə/',
    definition_en: 'a distinctive attribute or aspect of something; have as a prominent attribute',
    roots_affixes: 'feat/fact (做/造成) + -ure -> 造成的特有样貌 -> 特征',
    example_en: 'An intuitive user interface is a standout feature of this software.',
    example_zh: '直观的用户界面是该软件的一大显著特色。',
    tags: ['CET-4', '高频核心']
  },
  'evidence': {
    translation: 'n. 证据，证明；迹象，根据；v. 证实，证明',
    pos: 'n.',
    phonetic_us: '/ˈevɪdəns/',
    phonetic_uk: '/ˈevɪdəns/',
    definition_en: 'the available body of facts or information indicating whether a belief is true',
    roots_affixes: 'e- (出) + vid (看) + -ence -> 明显能看出来的东西 -> 证据',
    example_en: 'There is compelling evidence that human activity causes global warming.',
    example_zh: '有令人信服的证据表明人类活动导致了全球变暖。',
    tags: ['CET-4', 'CET-6', '考研高频']
  },
  'context': {
    translation: 'n. 语境，上下文；背景，环境',
    pos: 'n.',
    phonetic_us: '/ˈkɑːntekst/',
    phonetic_uk: '/ˈkɒntekst/',
    definition_en: 'the circumstances that form the setting for an event, statement, or idea',
    roots_affixes: 'con- (共同) + text (编织) -> 编织在一起的文字背景 -> 上下文，语境',
    example_en: 'Words should always be studied within meaningful linguistic context.',
    example_zh: '单词应当总是在有意义的语言情境中进行学习。',
    tags: ['CET-4', 'CET-6', '学术核心']
  },
  'principle': {
    translation: 'n. 原则，准则；原理，道义；本质',
    pos: 'n.',
    phonetic_us: '/ˈprɪnsəpl/',
    phonetic_uk: '/ˈprɪnsəpl/',
    definition_en: 'a fundamental truth or proposition that serves as the foundation for a system of belief',
    roots_affixes: 'prim/prin (第一) + cip (抓/拿) -> 最初定下的规矩 -> 原则',
    example_en: 'He refuses to compromise his moral principles for personal gain.',
    example_zh: '他拒绝为了个人利益而在道德原则上妥协。',
    tags: ['CET-4', '高频核心']
  },
  'approach': {
    translation: 'v. 接近，走近；着手处理；n. 方法，途径；接近',
    pos: 'v./n.',
    phonetic_us: '/əˈproʊtʃ/',
    phonetic_uk: '/əˈprəʊtʃ/',
    definition_en: 'come near or nearer to in distance or time; a way of dealing with something',
    roots_affixes: 'ap- (向) + proach (近) -> 靠近 -> 接近；着手处理的方法',
    example_en: 'We need to adopt a multidisciplinary approach to solve the crisis.',
    example_zh: '我们需要采取多学科方法来化解危机。',
    tags: ['CET-4', 'CET-6', '高频核心']
  },
  'maintain': {
    translation: 'v. 维持，保持；保养，维修；坚称，主张',
    pos: 'v.',
    phonetic_us: '/meɪnˈteɪn/',
    phonetic_uk: '/meɪnˈteɪn/',
    definition_en: 'cause or enable a condition or state of affairs to continue; state strongly',
    roots_affixes: 'main/man (手) + tain (握住) -> 手中紧握不放 -> 维持，保持',
    example_en: 'It is essential to maintain emotional equilibrium during difficult trials.',
    example_zh: '在逆境中保持内心的平静至关重要。',
    tags: ['CET-4', 'CET-6', '高频核心']
  },
  'significant': {
    translation: 'adj. 显著的，相当数量的；重大的，有重要意义的',
    pos: 'adj.',
    phonetic_us: '/sɪɡˈnɪfɪkənt/',
    phonetic_uk: '/sɪɡˈnɪfɪkənt/',
    definition_en: 'sufficiently great or important to be worthy of attention; noteworthy',
    roots_affixes: 'sign (记号) + fic (做) + -ant -> 做出标记的 -> 值得注目的，显著的',
    example_en: 'The breakthrough marks a significant milestone in cancer research.',
    example_zh: '这项突破标志着癌症研究领域的一个重大里程碑。',
    tags: ['CET-4', 'CET-6', '写作核心']
  },
  'challenge': {
    translation: 'n. 挑战，艰巨任务；质疑；v. 挑战，质疑，考验',
    pos: 'n./v.',
    phonetic_us: '/ˈtʃælɪndʒ/',
    phonetic_uk: '/ˈtʃælɪndʒ/',
    definition_en: 'a task or situation that tests someone\'s abilities; dispute the truth of',
    example_en: 'Meeting climate targets presents a monumental challenge for industries.',
    example_zh: '实现气候目标给各工业行业带来了极其艰巨的挑战。',
    tags: ['CET-4', '高频核心']
  },
  'opportunity': {
    translation: 'n. 机会，良机，时机',
    pos: 'n.',
    phonetic_us: '/ˌɑːpərˈtuːnəti/',
    phonetic_uk: '/ˌɒpəˈtjuːnəti/',
    definition_en: 'a set of circumstances that makes it possible to do something',
    roots_affixes: 'op- (向) + port (港口) + -unity -> 船开往港口的好时机 -> 机会',
    example_en: 'The digital transformation opens up unprecedented opportunities.',
    example_zh: '数字化转型开辟了前所未有的机遇。',
    tags: ['CET-4', '高频核心']
  }
};
