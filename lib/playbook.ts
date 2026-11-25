import type { QuestionKind } from './types';

/**
 * 面试题型识别 + 答题方法论。
 *
 * 这一层是「怎么面」的知识，不依赖模型：
 * - 先判断题目类型，再决定注入哪一段答题骨架
 * - 同时决定要不要拉技能卡 / 简历 / JD
 *
 * 识别必须足够便宜（纯本地正则，0 延迟），因为实时答稿等不起第二次模型调用。
 */

export interface QuestionAnalysis {
  kind: QuestionKind;
  /** 给界面看的题型名 */
  label: string;
  /** 给界面看的一句话考点 */
  tip: string;
  /** 要不要拉候选人的个人材料（卡片 / 简历） */
  needsMaterial: boolean;
  /** 要不要拉岗位 / 公司上下文（JD） */
  needsCompany: boolean;
  /** 题目本身要求列举、对比、分层 */
  wantsList: boolean;
}

interface Guide {
  label: string;
  tip: string;
  needsMaterial: boolean;
  needsCompany: boolean;
  /** 答题骨架，会被塞进系统提示词 */
  guide: string;
}

const GUIDES: Record<QuestionKind, Guide> = {
  intro: {
    label: '自我介绍',
    tip: '60 秒建立坐标：你是谁、做过什么、为什么是这里',
    needsMaterial: true,
    needsCompany: false,
    guide: `按 PREP 变体（定位—证据—匹配—意愿）四段说，连成一口气，不要列清单：
1) 一句话定位：学历/专业/届别 + 方向（例："我是 XX 大学 XX 专业的，2026 届，方向是后端开发"）。
2) 一段最相关的经历：什么场景、我负责哪块、做成了什么，带一个可信的数字。只挑一段，讲透。
3) 为什么是这个岗位/这家公司：把岗位最需要的 1-2 个能力和刚才那段经历对上。
4) 一句收尾：我想在这个方向上长期做下去。
不要复述简历，不要报技能清单，不要说"性格开朗、爱好广泛"，不要反问。`,
  },
  match: {
    label: '经历匹配',
    tip: '岗位要什么 + 我哪段经历能证明',
    needsMaterial: true,
    needsCompany: true,
    guide: `按「需求—证据—可迁移—补足」三段：
1) 先说这个岗位最需要的 2 个能力（从 JD 和岗位常识来，要具体）。
2) 每个能力配一段我的真实经历：场景 + 我的动作 + 结果，不要只说"我做过"。
3) 最后诚实说一句我还缺什么、准备怎么补。
不要只讲经历不贴岗位，也不要只表态"我很适合"。`,
  },
  project: {
    label: '项目深挖',
    tip: '归因清楚 + 数字有口径，别把团队成果说成自己的',
    needsMaterial: true,
    needsCompany: false,
    guide: `按 STAR 展开：项目背景一句（业务 + 规模，给面试官一个坐标系）→ 我的任务与边界（我负责哪块，团队多大）→ 2-3 个关键动作（每个都说清为什么这么做、怎么做、结果）→ 结果与一句取舍/反思。
用"我"讲；团队成果要说明哪部分是我做的。不要从技术栈开始背，不要通篇"我们"。`,
  },
  role: {
    label: '岗位理解',
    tip: '你是不是真知道这活每天干什么',
    needsMaterial: true,
    needsCompany: true,
    guide: `按「目标—日常—要求—准备」三层：
1) 这个岗位在业务链里解决什么问题（一句）。
2) 日常最花时间的三件事，按重要性说，不要背 JD 条目。
3) 我入职后 30/60/90 天会先做什么（具体动作）。
最后可以补一句：我还需要补什么、怎么补。不要空泛夸平台和行业前景。`,
  },
  company: {
    label: '公司了解',
    tip: '有没有做功课，能不能落到岗位上',
    needsMaterial: false,
    needsCompany: true,
    guide: `按「业务—岗位—匹配—行动」四句：
1) 它靠什么赚钱 / 核心业务是什么（具体到板块或客群）。
2) 最近在推什么（战略、技术、区域布局），用公开信息；不确定的数字说"我印象里"。
3) 这跟我要做的岗位有什么关系。
4) 我为什么匹配。
不要用"我了解不多"开头；先说 2-3 个具体事实。不要编财报数字，不确定就说不确定，然后把话题拉回业务逻辑。`,
  },
  knowledge: {
    label: '知识题',
    tip: '结论准不准 + 有没有实践，别背教材',
    needsMaterial: false,
    needsCompany: false,
    guide: `按「定义—原理—场景—边界」四步：一句定义/结论 → 2-3 句机制（关键步骤、为什么这样）→ 一句项目里怎么用 / 踩过什么坑 → 一句边界（什么场景不适用）。
不要从起源讲起，不要背教材。不会就说"这块我没系统用过，我的理解是…"，给推理，不要硬编。`,
  },
  scenario: {
    label: '场景设计',
    tip: '先澄清约束，再给框架和取舍',
    needsMaterial: false,
    needsCompany: true,
    guide: `按「澄清—拆解—取舍—验证」：先澄清 1-2 个关键约束（量级、目标、现有条件）→ 给框架（分层 / 分阶段 / 分优先级）→ 说关键取舍（为什么不用另一种）→ 怎么验证。
允许说"我会先确认…"。不要一上来就给终极方案，也不要只背八股。`,
  },
  behavior: {
    label: '行为题',
    tip: '一件事讲透，别讲一类',
    needsMaterial: true,
    needsCompany: false,
    guide: `选一件真实的事，STAR：当时的情况（1 句）→ 我的任务（1 句）→ 我具体做了什么（2-3 句，要有动作）→ 结果（1 句，带数字或评价）→ 反思（1 句）。
不要用"我一般都会…"，要讲那一次。缺点题：说一个真实的、不影响核心胜任力的，再讲怎么改。
"能不能加班/出差"这类意愿题，直接表态，再给一个做过的事实，不要套 STAR。`,
  },
  pressure: {
    label: '压力题',
    tip: '先接住，再用事实回应',
    needsMaterial: true,
    needsCompany: false,
    guide: `按「认可—事实—改进」：先接住"您这个质疑有道理，我说下当时的情况"，然后用具体事实回应，最后给边界或改进。
不辩解、不讨好、不情绪化，也不要顺着对方说"我确实不行"。`,
  },
  motivation: {
    label: '动机规划',
    tip: '过去—现在—未来，别贬低前东家',
    needsMaterial: true,
    needsCompany: true,
    guide: `按「过去—现在—未来」三层：
1) 过去：我做过什么、积累了什么（一句，落在能力上）。
2) 现在：我为什么看这个机会（和岗位对上；离职只说事实和方向差异，不抱怨、不甩锅）。
3) 未来 3 年：我想在这个方向做到什么程度（具体，不要喊口号）。
不要空泛说"想挑战自己""贵公司平台好"；也不要说"为了稳定"。`,
  },
  salary: {
    label: '薪资/Offer',
    tip: '先问结构，再给区间，别先报死数',
    needsMaterial: false,
    needsCompany: true,
    guide: `按「结构—区间—发展」：先确认薪资结构（base、绩效、补贴、城市），再给区间，不给死数。
话术："我对这个岗位更看重长期发展，薪资我了解市场大概在 X 到 Y，具体可以结合咱们的结构再聊。"
手里有其他 offer 只说"还在流程中"，不要拿来抬价，也不要编。
不要一上来报一个数，也不要说"都可以"。`,
  },
  reverse: {
    label: '反问环节',
    tip: '你在不在乎这份工作',
    needsMaterial: false,
    needsCompany: true,
    guide: `按「工作—团队—成长—标准」给 2-3 个问题，问业务、团队、成长，不问薪资福利和加班。
可用：这个岗位半年后做得好的标准是什么？团队现在最头疼的问题是哪块？这个方向接下来一年重点投入在哪？`,
  },
  general: {
    label: '综合题',
    tip: '结论先行，别绕',
    needsMaterial: false,
    needsCompany: false,
    guide: `按「结论—依据—收束」：结论先行 → 2 个理由或要点（每个一句）→ 一句收束。
题目很大时，先给判断，再给一个例子。不要面面俱到。`,
  },
};

const INTRO_RE = /(自我介绍|介绍下?你自己|介绍下?自己|先做个?介绍|简单介绍下?自己|介绍一下你的情况)/;
const REVERSE_RE =
  /(你有什么问题|有什么想问|还有(什么)?问题(要|想)?问|想了解我们什么|反问环节|你问问我|你有什么想了解)/;
const BEHAVIOR_RE =
  /(举个例子|讲一个|说一个|一次.{0,6}(经历|冲突|失败|挫折|困难|挑战)|最有?(成就|成功|挫败|骄傲|难忘|遗憾)感?|团队合作|和同事.{0,6}(冲突|分歧)|你.{0,8}(优点|缺点)|优缺点|能不能加班|抗压能力)/;
const PRESSURE_RE =
  /(凭什么|你觉得你(配|行|值)|不录用|没通过|这么简单|就这|质疑|不太满意|如果我说你|压力面|你觉得(你|自己).{0,4}表现)/;
const MOTIVATION_RE =
  /(职业规划|未来.{0,6}(打算|规划)|为什么(离职|离开|跳槽|换工作)|离职原因|求职动机|为什么想换|为什么做.{0,8}方向)/;
const SALARY_RE = /(薪资|工资|薪酬|待遇|offer|年薪|月薪|期望薪|总包|打包价)/i;
const PERSONAL_DECISION_RE =
  /(你|您).{0,8}(项目|系统|业务|代码|架构).{0,14}(为什么|怎么|如何|用过|做过|选的|用的|踩过)/;
const MATCH_RE =
  /(哪(项|个|些)能力.{0,16}(有帮助|用得上|帮助|加分)|什么能力.{0,16}(有帮助|用得上)|你.{0,10}(优势|长处).{0,12}(岗位|工作|职位)|为什么.{0,8}(觉得)?你.{0,8}(适合|匹配|胜任)|你.{0,8}(为什么|凭什么).{0,8}(适合|匹配)|(这段|你的).{0,10}经历.{0,14}(帮助|用得上|匹配))/;
const COMPANY_RE =
  /((为什么|为何).{0,8}(选|选择|来|加入|投递|投).{0,8}(我们|贵公司|公司|这里)|对.{0,16}(我们|贵公司|公司|农行|工行|建行|中行|交行|邮储|招行|字节|腾讯|阿里|美团|京东|华为|百度|小米|拼多多|网易|滴滴|快手|银行|集团|行业).{0,14}(了解|理解|看法|印象|认识)|(我们|贵)公司.{0,16}(了解|怎么样|特色|优势|文化|业务|战略|发展)|(行业|赛道).{0,10}(看法|理解|趋势|判断|怎么看)|(相比|对比).{0,12}(银行|公司|同行).{0,12}(特色|优势|不同))/;
const ROLE_RE =
  /(这个?岗位|该岗位|岗位.{0,10}(理解|认识|职责|日常|要求|内容)|日常.{0,10}(工作|做什么|涉及)|入职后.{0,10}(怎么|如何|打算|先)|如何开展.{0,6}工作|为什么.{0,8}(适合|胜任|能胜任).{0,8}(这个)?岗位|你.{0,6}(能|可以).{0,6}(为|给).{0,6}(团队|公司|部门).{0,6}(带来|做|贡献))/;
const DEFINITION_RE = /(什么是|是什么|原理|区别|差异|底层|如何实现|怎么实现|时间复杂度|空间复杂度)/;
const SCENARIO_RE =
  /(如果|假如|假设|设计一个|设计.{0,8}(系统|方案|模块)|怎么(排查|优化|设计|保证|处理|定位|解决)|如何(排查|优化|设计|保证|处理|定位|解决)|方案|架构|并发|量级|故障|上线|扩容|降级|限流|压测)/;
const KNOWLEDGE_RE =
  /(索引|事务|隔离级别|死锁|GC|JVM|TCP|UDP|HTTP|HTTPS|缓存|Redis|MySQL|Kafka|消息队列|分布式|一致性|幂等|线程|进程|排序|链表|哈希|算法|设计模式|Spring|微服务|容器|K8s|Kubernetes|Docker|Linux|SQL)/;
const PROJECT_RE =
  /(项目|实习|经历|负责|做过|这段|工作内容|业务|技术栈|难点|挑战|指标|效果|成果|上线|需求|接口|联调|驻场)/;

/** 去掉标点，避免 ASR 断句差异影响匹配 */
function clean(q: string) {
  return (q ?? '')
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：""''（）()\-—…·,.!?;:]/g, '');
}

export function analyzeQuestion(question: string): QuestionAnalysis {
  const q = clean(question);
  const wantsList = /(三点|三个|几条|几个点|列举|分别|对比|区别|优缺点|哪些)/.test(q);

  let kind: QuestionKind = 'general';
  if (INTRO_RE.test(q)) kind = 'intro';
  else if (REVERSE_RE.test(q)) kind = 'reverse';
  else if (SALARY_RE.test(q)) kind = 'salary';
  else if (MOTIVATION_RE.test(q)) kind = 'motivation';
  else if (BEHAVIOR_RE.test(q)) kind = 'behavior';
  else if (PRESSURE_RE.test(q)) kind = 'pressure';
  else if (MATCH_RE.test(q)) kind = 'match';
  else if (COMPANY_RE.test(q)) kind = 'company';
  else if (ROLE_RE.test(q)) kind = 'role';
  else if (PERSONAL_DECISION_RE.test(q)) kind = 'project';
  else if (DEFINITION_RE.test(q)) kind = 'knowledge';
  else if (SCENARIO_RE.test(q)) kind = 'scenario';
  else if (KNOWLEDGE_RE.test(q)) kind = 'knowledge';
  else if (PROJECT_RE.test(q)) kind = 'project';

  const g = GUIDES[kind];
  // "你简历上写了 K8s，讲讲…" 这类题本质是知识题，但最好带上简历做衔接
  const personalRef =
    (kind === 'knowledge' || kind === 'scenario') &&
    /(你|您).{0,6}(简历|项目|写过|用过|做过)/.test(q);

  return {
    kind,
    label: g.label,
    tip: g.tip,
    needsMaterial: g.needsMaterial || personalRef,
    needsCompany: g.needsCompany,
    wantsList,
  };
}

export function guideFor(kind: QuestionKind): string {
  return GUIDES[kind].guide;
}

export function metaFor(kind: QuestionKind): { label: string; tip: string } {
  const g = GUIDES[kind];
  return { label: g.label, tip: g.tip };
}

/** 判断题是否在问「我」——决定要不要拉个人材料 */
export function asksAboutMe(question: string): boolean {
  const q = clean(question);
  return /(我|你|您|自己)/.test(q) && /(项目|实习|经历|做过|负责|工作|能力|优势|缺点|规划|为什么|介绍)/.test(q);
}
