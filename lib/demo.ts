import { analyzeQuestion, type QuestionAnalysis } from './playbook';
import type { AnswerStyle, QuestionType, SkillCard } from './types';

const clamp = (s: string, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const m = cut.match(/^[\s\S]*[，、；：,;:]/);
  if (m && m[0].length >= n * 0.5) return m[0].slice(0, -1) + '…';
  // 不要在括号中间截断，读起来像半句话
  const open = cut.lastIndexOf('（');
  if (open >= 0 && cut.indexOf('）', open) < 0) return cut.slice(0, open) + '…';
  return cut.slice(0, n - 1) + '…';
};

const sentenceList = (md: string) =>
  md
    .replace(/[#*`>]/g, ' ')
    .replace(/^- /gm, '')
    .split(/(?<=[。！？!?])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

/* =================== 答稿 =================== */

export function demoAnswer(
  question: string,
  cards: SkillCard[],
  hits: { label: string; text: string }[],
  style: AnswerStyle,
  analysis?: QuestionAnalysis
): string {
  const kind = (analysis ?? analyzeQuestion(question)).kind;
  const c = cards[0];
  const detail = style === 'detailed' ? 3 : style === 'concise' ? 1 : 2;
  const acts = (c?.actions ?? []).filter(Boolean).slice(0, detail).map((x) => clamp(x, 34));
  const result = (c?.results ?? []).filter(Boolean)[0] ?? '';
  const decision = (c?.decisions ?? []).filter(Boolean)[0] ?? '';
  const project = c ? clamp(c.project, 18) : '';
  const role = c ? clamp((c.role || '核心实现').replace(/[（(][^）)]*[）)]/g, ''), 16) : '';

  if (kind === 'reverse') {
    return '我想了解三件事：这个岗位半年后做得好的标准是什么；团队现在最头疼的问题是哪块；这个方向接下来一年重点投入在哪。薪资和作息我反而不着急问，先把事情聊清楚。';
  }

  if (kind === 'intro') {
    if (!c) {
      return '我先简单介绍一下自己。我主要做的是后端开发和系统运维这一类工作，平时更偏把系统跑稳、把接口调通。这次想找的还是能长期做下去的技术岗位，方向跟咱们这个岗位是对得上的。';
    }
    return `我是做${role || '技术'}的，之前主要在${project}这个项目上。${clamp(c.background, 46) || ''}我负责的是${role}，${acts.join('，')}。${result ? `最后${clamp(result, 34)}。` : ''}这段经历让我对${clamp(c.project, 12)}这类系统怎么落地有了底，我也想在这个方向上长期做下去。`;
  }

  if (kind === 'project') {
    if (!c) {
      return '这段我讲我最熟的一个。背景是我们当时要把一套老系统的接口重新梳理，我负责其中联调和问题定位这一块，先把调用链摸清楚，再把高频问题做成脚本去复现。最后接口的定位时间从半天压到一两个小时。这件事让我养成了先把问题拆小的习惯。';
    }
    return `${project}这个项目，背景是${clamp(c.background, 44)}。我负责${role}，主要做了几件事：${acts.join('；')}。${result ? `结果是${clamp(result, 32)}。` : ''}${decision ? `当时最难的是取舍，${clamp(decision.replace(/^因为/, ''), 40)}。` : ''}`;
  }

  if (kind === 'match') {
    if (!c) {
      return '这个岗位我看下来最看重两点：一是能不能把现有系统守住，二是遇到问题能不能自己定位。我这边能对上的是之前做接口联调和排障那段，先看日志和调用链，再用脚本复现，最后把问题收敛到具体参数或规则上。这套方法换到哪个系统都能用。';
    }
    return `这个岗位我看下来最看重两点：一是系统能不能稳住，二是出了问题能不能自己定位。我这边能对上的是${project}那段，我负责${role}，${acts.join('，')}。${result ? `${clamp(result, 30)}。` : ''}我不敢说全都熟，但这类问题的处理方法是通的。`;
  }

  if (kind === 'behavior') {
    return '我讲一次比较典型的。当时项目临近上线，联调里有一个接口一直偶发失败，大家一开始怀疑是网络。我把日志按时间对齐，发现是参数在某个边界值下被截断了，改了校验之后问题就没了。这件事之后我养成了一个习惯：先复现，再下结论。';
  }

  if (kind === 'pressure') {
    return '您这个质疑有道理，我说下当时的情况。那块确实不是我一个人做的，我负责的是联调和问题定位，方案是组长定的，但落地过程中遇到的坑基本是我在跟。您要是问细节，我可以把当时怎么定位的讲清楚。';
  }

  if (kind === 'company') {
    return '我理解这家公司的主业还是围绕它最擅长的客群在做，一块是传统业务的存量，一块是这两年在推的数字化和下沉市场。具体数字我不敢说得很准，但从公开信息看，它现在的重点是把网点和线上渠道打通，同时把服务成本降下来。这跟我要做的岗位是能对上的，因为我做的事本质上也是让系统和流程更稳、更省人。';
  }

  if (kind === 'role') {
    return '我理解这个岗位日常主要三块：一是把现有系统守住，巡检、告警、故障定位；二是配合业务做变更和上线，保证不出问题；三是慢慢参与一些优化和建设。新人前期大概率是从跟着做变更、处理告警开始。我 Linux 和 Docker 这块能直接上手，业务侧还需要补。';
  }

  if (kind === 'knowledge') {
    if (hits.length) {
      return `这块我按自己的理解说。${clamp(hits[0].text.replace(/\s+/g, ' '), 80)}。放到项目里，我一般会先看它解决的是哪类问题，再看代价能不能接受。边界这块我还在补。`;
    }
    return '这块我按自己的理解说。它本质上是在解决资源和一致性之间的取舍，核心机制一般是先做一层抽象，再用某种策略把冲突收敛掉。项目里我用过类似的思路，当时是先保证正确性，再谈性能。边界这块我还在补。';
  }

  if (kind === 'scenario') {
    return '我先确认两个前提：现在的量级大概多少，目标是先稳住还是先降成本。如果是前者，我会先把链路拆开，找到最慢或最容易出问题的一段，先做限流和降级兜底，再谈优化。方案上我会优先选改动小、可回滚的做法，验证就看两个指标：错误率和 P99 延迟。';
  }

  if (hits.length) {
    return `这块我按材料里的做法讲。${clamp(hits[0].text.replace(/\s+/g, ' '), 70)}。再细的部分我可以对着材料跟您过一遍。`;
  }

  return '我的判断是，这件事的关键不在做多少，而在先想清楚目标是什么。我一般会先把问题拆成两三层，找到最影响结果的那一层，再决定投入。这样做的好处是每一步都能验证，不会做完才发现方向错了。';
}

/* =================== 追问官 =================== */

const PREP_BANK: { key: string; q: string; note: string }[] = [
  {
    key: '数字',
    q: '你说的这个提升，基线是多少？怎么测的，口径是什么？',
    note: '数字没有基线，面试官会默认是你自己算的',
  },
  {
    key: '我们',
    q: '这段里哪一部分是你亲手写的？团队其他人负责什么？',
    note: '「我们」是面试里最容易被扣分的主语',
  },
  {
    key: '取舍',
    q: '当时有没有考虑过另一种方案？最后为什么放弃了它？',
    note: '只讲做了什么，听不出你的判断力',
  },
  {
    key: '分歧',
    q: '方案是谁定的？有人反对过吗，你怎么处理的？',
    note: '边界模糊会被当成执行者，不是负责人',
  },
  {
    key: '最深',
    q: '这个项目里最难的一个技术点是什么？你当时卡在哪一步？',
    note: '要看你是不是真的在一线写过',
  },
];

export function demoPrep(card: Partial<SkillCard>, turnIndex: number) {
  const text = [
    card.project,
    card.background,
    ...(card.actions ?? []),
    ...(card.decisions ?? []),
    ...(card.results ?? []),
  ].join(' ');
  const lacksNumber = !/\d/.test(text);
  const usesWe = /我们/.test(text) && !/我(负责|主导|写|做)/.test(text);
  const lacksDecision = (card.decisions ?? []).length === 0;

  let q = PREP_BANK[turnIndex % PREP_BANK.length];
  if (lacksNumber) q = PREP_BANK[0];
  else if (usesWe) q = PREP_BANK[1];
  else if (lacksDecision) q = PREP_BANK[2];

  return {
    q: `问：${q.q}\n旁注：${q.note}`,
    question: q.q,
    note: q.note,
  };
}

/* =================== 岗位洞察 =================== */

export interface Insight {
  核心考察: { 点: string; 权重: string; 依据: string }[];
  你的匹配优势: { 优势: string; 对应JD要求: string }[];
  你的风险点: { 风险: string; 面试官会怎么问: string }[];
  必问5题: { 问题: string; 考察点: string }[];
  一句话判断: string;
}

const SKILLS = [
  'Java', 'Go', 'Python', 'C++', 'TypeScript', 'JavaScript', 'React', 'Vue', 'Next.js',
  'Spring', 'SpringBoot', 'MySQL', 'Redis', 'Kafka', 'RocketMQ', 'Elasticsearch',
  'Kubernetes', 'Docker', '微服务', '高并发', '分布式', '性能优化', 'JVM', 'Linux',
  'SQL', '数据分析', 'A/B 测试', '机器学习', '大模型', 'LLM', 'RAG', 'Agent',
  '项目管理', '跨部门', '财务', '预算', 'Excel', 'Tableau', '用户增长',
];

export function demoInsight(
  resume: string,
  jd: string,
  role: string,
  company: string
): Insight {
  const jdLines = jd.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 4);
  const hit = (text: string) => SKILLS.filter((s) => text.toLowerCase().includes(s.toLowerCase()));
  const jdSkills = hit(jd);
  const mySkills = hit(resume);
  const overlap = jdSkills.filter((s) => mySkills.includes(s));
  const missing = jdSkills.filter((s) => !mySkills.includes(s));
  const core = (jdSkills.length ? jdSkills : ['沟通表达', '项目复盘']).slice(0, 3);

  const evidence = (s: string) =>
    jdLines.find((l) => l.toLowerCase().includes(s.toLowerCase())) ?? `JD 中与「${s}」相关的职责描述`;

  const 核心考察 = core.map((s, i) => ({
    点: `${s} 的实际落地深度`,
    权重: i === 0 ? '高' : i === 1 ? '高' : '中',
    依据: clamp(evidence(s), 54),
  }));

  const 你的匹配优势 = (overlap.length ? overlap : mySkills).slice(0, 3).map((s) => ({
    优势: `${s} 有可讲的项目经历`,
    对应JD要求: `JD 明确要求 ${s}`,
  }));

  const 你的风险点 = (missing.length ? missing : ['项目数字口径', '跨团队协作细节'])
    .slice(0, 3)
    .map((s) => ({
      风险: `JD 要求 ${s}，你的简历里没有直接对应的段落`,
      面试官会怎么问: `你哪个项目里真正用过 ${s}？当时为什么选它，而不是更常见的方案？`,
    }));

  const 必问5题 = [
    {
      问题: `挑一个你最有把握的项目，讲清楚你个人做了什么。`,
      考察点: '归因是否清楚，会不会把团队成果说成自己的',
    },
    {
      问题: `（针对 ${core[0] ?? '核心技能'}）这个方案为什么这么定？放弃过什么？`,
      考察点: '决策过程与取舍',
    },
    {
      问题: `你提到的那次优化，基线是多少，怎么测的？`,
      考察点: '数字是否有出处、口径是否一致',
    },
    ...(missing[0]
      ? [
          {
            问题: `你没写过 ${missing[0]}，如果下周要上手，你打算怎么补？`,
            考察点: '学习路径是否具体，会不会硬撑',
          },
        ]
      : [
          {
            问题: `如果给你一个比现在大十倍的量，哪一步会先崩？`,
            考察点: '系统边界的判断',
          },
        ]),
    {
      问题: `你为什么从上一段离开，为什么是这家公司？`,
      考察点: '动机是否自洽，会不会说前东家坏话',
    },
  ];

  const 一句话判断 = `${company || '这家公司'}这个${role || '岗位'}，本质是在找能把 ${
    core.slice(0, 2).join('、') || '业务问题'
  } 落到具体结果上的人；你的 ${overlap[0] ?? '项目经历'} 是入口，数字口径是门槛。`;

  return { 核心考察, 你的匹配优势, 你的风险点, 必问5题, 一句话判断 };
}

/* =================== 复盘 =================== */

export interface DemoReviewTurn {
  i: number;
  type: QuestionType;
  score: number;
  fatal: string;
  rewrite: string;
  reminder: string;
}

export interface DemoReviewPayload {
  turns: DemoReviewTurn[];
  summary: {
    avg: number;
    strongest: string;
    weakest: string;
    top3: string[];
    facts: string[];
  };
}

function detectType(q: string): QuestionType {
  if (/算法|复杂度|手写|实现一个|时间复杂度|排序|动态规划/.test(q)) return '八股';
  if (/原理|区别|是什么|底层|索引|缓存|线程|GC|事务|八股/.test(q)) return '八股';
  if (/冲突|团队|失败|压力|为什么离职|职业规划|缺点/.test(q)) return '行为';
  if (/如果|设计一个|怎么做|方案|架构/.test(q)) return '场景设计';
  if (/为什么不能|凭什么|你觉得你|质疑|确定吗/.test(q)) return '压力测试';
  return '项目深挖';
}

export function demoReview(pairs: { i: number; q: string; a: string }[]): DemoReviewPayload {
  const turns: DemoReviewTurn[] = pairs.map(({ i, q, a }) => {
    const sents = sentenceList(a);
    const len = a.replace(/\s+/g, '').length;
    const type = detectType(q);
    const hasNum = /\d+\s*(%|倍|ms|s|万|qps|QPS|TPS|人|天|周)/.test(a);
    const hasWhy = /因为|所以|取舍|权衡|放弃|最终选/.test(a);
    const weCount = (a.match(/我们/g) ?? []).length;
    const hasBaseline = /基线|之前是|原来|从\s*\d|对比/.test(a);

    let score = 3;
    if (len >= 160) score += 0.5;
    if (len >= 320) score += 0.5;
    if (hasNum) score += 0.5;
    if (hasWhy) score += 0.5;
    if (weCount >= 3) score -= 0.5;
    if (len < 70) score -= 1;
    score = Math.max(1, Math.min(5, Math.round(score)));

    let fatal: string;
    const quote = clamp(sents[0] ?? '这块我参与了', 26);
    if (hasNum && !hasBaseline) {
      fatal = `你说“${quote}”里的数字，但没给基线；对方下一句一定会追口径。`;
    } else if (weCount >= 3) {
      fatal = `“我们”出现了 ${weCount} 次，面试官会默认这不是你亲手做的。`;
    } else if (len < 70) {
      fatal = `只答了 ${len} 字，等于把追问权交回给对方。`;
    } else if (!hasWhy) {
      fatal = `通篇只有动作没有取舍，听不出你做过判断。`;
    } else if (type === '八股' && len > 280) {
      fatal = `八股题讲了 ${len} 字，前两句就够，后面全是自我消耗。`;
    } else {
      fatal = `你开口是“${quote}”，这是铺垫不是结论；对方要听完才知道你想说什么。`;
    }

    const head = clamp(sents[0] ?? '这件事我主要负责落地', 34);
    const lines: string[] = [];

    if (sents.length >= 2) {
      const numIdx = sents.findIndex((s, i) => i !== 0 && /\d/.test(s));
      const ev1Sentence = numIdx > 0 ? sents[numIdx] : sents[1] ?? '';
      const whyIdx = sents.findIndex(
        (s, i) => i !== 0 && i !== numIdx && /因为|取舍|放弃|最终选|权衡/.test(s)
      );
      const ev2Sentence = whyIdx > 0 ? sents[whyIdx] : '';
      const ev1 = ev1Sentence && ev1Sentence !== sents[0] ? clamp(ev1Sentence, 42) : '';
      const ev2 = ev2Sentence && ev2Sentence !== ev1Sentence ? clamp(ev2Sentence, 42) : '';
      lines.push(`**${head}**`);
      if (ev1) lines.push(`- ${ev1}`);
      if (ev2) lines.push(`- ${ev2}`);
    } else {
      // 一句话答完的情况：按逗号拆成「结论 / 取舍 / 结果」三段重建
      const cs = a
        .replace(/\n/g, '，')
        .split(/[，,。；;]/)
        .map((x) => x.trim())
        .filter((x) => x.length > 2);
      const result = cs.filter((c) => /\d/.test(c)).join('，');
      const trade = cs
        .filter((c) => !/\d/.test(c) && /因为|但|牺牲|放弃|最后选|所以|反而|换成/.test(c))
        .join('，');
      const rest = cs.filter((c) => c !== result && !trade.includes(c));
      lines.push(`**${clamp(rest[0] ?? cs[0] ?? a, 28)}**`);
      if (trade) lines.push(`- 取舍：${clamp(trade, 44)}`);
      if (result) lines.push(`- 结果：${clamp(result, 40)}`);
    }
    lines.push('细节您想听哪一段，我可以展开。');
    const rewrite = lines.join('\n');

    const reminder =
      type === '八股'
        ? '先结论后展开'
        : type === '行为'
        ? '讲一件事，别讲一类'
        : type === '场景设计'
        ? '先问约束再给方案'
        : type === '压力测试'
        ? '先接住情绪再答'
        : '数字必带基线';

    return { i, type, score, fatal, rewrite, reminder };
  });

  const avg = turns.length
    ? Math.round((turns.reduce((s, t) => s + t.score, 0) / turns.length) * 10) / 10
    : 0;

  const byType = new Map<string, { sum: number; n: number }>();
  for (const t of turns) {
    const cur = byType.get(t.type) ?? { sum: 0, n: 0 };
    cur.sum += t.score;
    cur.n += 1;
    byType.set(t.type, cur);
  }
  const ranked = [...byType.entries()]
    .map(([k, v]) => ({ k, avg: v.sum / v.n }))
    .sort((a, b) => b.avg - a.avg);

  return {
    turns,
    summary: {
      avg,
      strongest: ranked[0]?.k ?? '项目深挖',
      weakest: ranked[ranked.length - 1]?.k ?? '八股',
      top3: [
        '每个数字都补上基线和口径，说不清就用「大概」',
        '把「我们」改成「我负责的那部分」，先说边界',
        '结论前置，30 秒内说完主干，把追问权握在手里',
      ],
      facts: [
        '项目里那次优化的前后对比数据，补进技能卡',
        '你主导的方案评审过程，可以作为取舍的证据',
        '跨团队推进的具体动作，补一条「怎么让人配合」',
      ],
    },
  };
}
