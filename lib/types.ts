export type RoundKey = '一面' | '二面' | '三面' | 'HR 面' | '主管面';
export type LangKey = '中文' | '英文';
export type CardStatus = 'draft' | 'confirmed';
export type SessionMode = 'practice' | 'assist';
export type TurnSource = 'asr' | 'manual' | 'image';
export type AnswerStyle = 'concise' | 'standard' | 'detailed';
export type QuestionType = '八股' | '项目深挖' | '行为' | '场景设计' | '压力测试';

/** 实时答稿的题型。和复盘用的 QuestionType 分开：这里更细，且驱动答题结构。 */
export type QuestionKind =
  | 'intro'
  | 'match'
  | 'project'
  | 'role'
  | 'company'
  | 'knowledge'
  | 'scenario'
  | 'behavior'
  | 'pressure'
  | 'motivation'
  | 'salary'
  | 'reverse'
  | 'general';

/** 作答依据：自动判断 / 强制用我的材料 / 纯通用 */
export type AnswerMode = 'auto' | 'material' | 'general';

/** 这道题实际用了什么 */
export type AnswerBasis = 'personal' | 'mixed' | 'general' | 'qa';

export interface Profile {
  id: string;
  name: string;
  targetRole: string;
  company: string;
  round: RoundKey;
  lang: LangKey;
  /** AskCc 式「自定义答题指令」：只影响怎么说，不改变事实来源 */
  instructions?: string;
  createdAt: number;
}

/** 开始本轮时冻结的档案上下文，避免中途改档案影响正在进行的面试 */
export type ProfileSnapshot = Pick<
  Profile,
  'name' | 'targetRole' | 'company' | 'round' | 'lang' | 'instructions'
>;

export interface Doc {
  id: string;
  profileId: string;
  name: string;
  type: 'resume' | 'jd' | 'project' | 'note';
  chars: number;
  source: 'file' | 'paste';
  createdAt: number;
  /** 原文，用于「重新索引」和引用展开 */
  raw?: string;
}

export interface Chunk {
  id: string;
  docId: string;
  profileId: string;
  idx: number;
  text: string;
  tokens: string[];
}

export interface Followup {
  q: string;
  a: string;
}

export interface SkillCard {
  id: string;
  profileId: string;
  project: string;
  period: string;
  role: string;
  background: string;
  actions: string[];
  decisions: string[];
  results: string[];
  followups: Followup[];
  status: CardStatus;
  updatedAt: number;
  fingerprint: string;
}

/** 标准问答：提前写好的答案，命中后原样显示，不经模型改写 */
export interface QAEntry {
  id: string;
  profileId: string;
  question: string;
  /** 同义问法，一行一条 */
  aliases: string[];
  answer: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/* ---------------- 公司 / 岗位调研 ---------------- */

export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  site: string;
  snippet: string;
  query: string;
}

export interface ResearchQuestion {
  question: string;
  type: string;
  why: string;
  angles: string[];
}

export interface ResearchCompetency {
  name: string;
  weight: '高' | '中' | '低';
  evidence: string;
}

export interface CompanyResearch {
  id: string;
  profileId: string;
  company: string;
  role: string;
  createdAt: number;
  updatedAt: number;
  sources: ResearchSource[];
  summary: {
    /** 一句话公司定位 */
    positioning: string;
    business: string[];
    culture: string[];
    recent: string[];
    interviewProcess: string[];
    interviewStyle: string[];
    /** 高频问题 + 回答方向，面试前准备和实战都会用 */
    questions: ResearchQuestion[];
    competencies: ResearchCompetency[];
    risks: string[];
    askBack: string[];
    salary: string;
  };
  model?: string;
  demo?: boolean;
}

export interface Snapshot {
  id: string;
  profileId: string;
  cardIds: string[];
  docIds: string[];
  /** 1.4.0 起：本轮冻结的标准问答 */
  qaIds?: string[];
  /** 本轮冻结的标准问答全文；旧快照没有该字段时按 qaIds 回退 */
  qas?: QAEntry[];
  /** 本轮冻结的技能卡全文；旧快照没有该字段时按 cardIds 回退 */
  cards?: SkillCard[];
  /** 本轮冻结的文档全文；旧快照没有该字段时按 docIds 回退 */
  docs?: Doc[];
  /** 本轮冻结的文档切块；旧快照没有该字段时按 docIds 回退 */
  chunks?: Chunk[];
  /** 1.8.0 起：本轮冻结的公司/岗位调研，保证面试中途重新调研不影响本轮 */
  research?: CompanyResearch;
  /** 1.7.0 起：本轮冻结的档案字段（含自定义答题指令） */
  profile?: ProfileSnapshot;
  label: string;
  createdAt: number;
}

export interface Session {
  id: string;
  profileId: string;
  snapshotId: string;
  mode: SessionMode;
  title: string;
  startedAt: number;
  endedAt?: number;
  avgScore?: number;
  snapshotLabel: string;
}

export interface Citation {
  type: 'card' | 'chunk' | 'qa';
  id: string;
  label: string;
  text: string;
  score: number;
}

export interface Turn {
  id: string;
  sessionId: string;
  question: string;
  source: TurnSource;
  answerMd: string;
  citations: Citation[];
  latencyMs: number;
  createdAt: number;
  style: AnswerStyle;
  degraded: boolean;
  demo: boolean;
  /** 旧数据没有这两个字段，读取时按题目现算 */
  qtype?: QuestionKind;
  basis?: AnswerBasis;
  /** 标准问答命中 */
  qaId?: string;
  qaVariant?: string;
  qaScore?: number;
}

export interface Review {
  id: string;
  turnId: string;
  sessionId: string;
  type: QuestionType;
  score: number;
  fatal: string;
  rewrite: string;
  reminder: string;
  createdAt: number;
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  /** 多模态时允许 content 为 OpenAI 兼容的数组结构 */
  content: unknown;
}

export interface AppSettings {
  apiBase: string;
  apiKey: string;
  model: string;
  temperature: number;
  silenceMs: number;
  autoAnswer: boolean;
  /** always=常开麦克风；ptt=按住空格才采纳识别结果 */
  micMode: 'always' | 'ptt';
  /** 语音识别。留空则复用上面模型的 Base / Key */
  asrBase: string;
  asrKey: string;
  asrModel: string;
  /** 低延迟双模型：partial 用 tiny 求快，final 用 large-v3 求准；留空则都用 asrModel */
  asrPartialModel: string;
  asrFinalModel: string;
  /** auto=优先连 8761 实时流，失败回退分片；stream=强制流式；chunk=只用分片上传 */
  asrMode: 'auto' | 'stream' | 'chunk';
  /** 本地实时转写桥（stream_bridge.py）的 WebSocket 地址 */
  asrStreamUrl: string;
  /** 未命中标准问答时，优先用低延迟模型出稿 */
  fastAnswer: boolean;
  /** 低延迟模型名；留空时按 Base 自动选一个非推理模型 */
  fastModel: string;
  /** 对 DeepSeek 等推理模型关闭思考链，首字可从 3~10s 降到 1s 左右 */
  noThink: boolean;
  style: AnswerStyle;
  lang: LangKey;
  tts: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiBase: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  silenceMs: 600,
  autoAnswer: true,
  micMode: 'always',
  asrBase: '',
  asrKey: '',
  asrModel: 'whisper-1',
  asrPartialModel: '',
  asrFinalModel: '',
  asrMode: 'auto',
  asrStreamUrl: 'ws://127.0.0.1:8761',
  fastAnswer: true,
  fastModel: '',
  noThink: true,
  style: 'standard',
  lang: '中文',
  tts: false,
};

export const STYLE_LABEL: Record<AnswerStyle, string> = {
  concise: '简洁 · 150 字',
  standard: '标准 · 250 字',
  detailed: '详细 · 400 字',
};

export const ROUNDS: RoundKey[] = ['一面', '二面', '三面', 'HR 面', '主管面'];

export const DOC_TYPE_LABEL: Record<Doc['type'], string> = {
  resume: '简历',
  jd: '岗位 JD',
  project: '项目材料',
  note: '备注',
};

/* ---------------- 桌面端窗口布局演示 ---------------- */

export type LayoutPosition = 'center' | 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';

export interface DesktopDisplay {
  id: string;
  label: string;
  width: number;
  height: number;
  scaleFactor: number;
  primary: boolean;
}

export interface DesktopLayoutState {
  open: boolean;
  displayId?: string;
  opacity?: number;
  alwaysOnTop?: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
  displays: DesktopDisplay[];
  primaryId?: string;
}

export interface DesktopUpdateInfo {
  currentVersion: string;
  isPackaged: boolean;
  platform: string;
  updateDir: string;
  hasManifest: boolean;
  error?: string;
}

export interface DesktopUpdateCheck {
  ok: boolean;
  dir: string;
  current: string;
  latest?: string;
  available?: boolean;
  notes?: string;
  file?: string;
  size?: number;
  publishedAt?: string;
  sha256?: string;
  error?: string;
}

export interface DesktopUpdateInstallResult {
  ok: boolean;
  version?: string;
  error?: string;
}

export interface DesktopUpdateChooseResult {
  ok: boolean;
  dir?: string;
  canceled?: boolean;
  error?: string;
}

export interface DesktopUpdateApi {
  info: () => Promise<DesktopUpdateInfo>;
  check: () => Promise<DesktopUpdateCheck>;
  install: () => Promise<DesktopUpdateInstallResult>;
  chooseDir: () => Promise<DesktopUpdateChooseResult>;
  openDir: () => Promise<{ ok: boolean; error?: string }>;
}

export interface DesktopLayoutApi {
  isDesktop: true;
  layout: {
    open: (opts: {
      displayId?: string;
      position?: LayoutPosition;
      opacity?: number;
      alwaysOnTop?: boolean;
    }) => Promise<DesktopLayoutState>;
    close: () => Promise<{ ok: boolean }>;
    apply: (opts: {
      displayId?: string;
      position?: LayoutPosition;
      opacity?: number;
      alwaysOnTop?: boolean;
    }) => Promise<DesktopLayoutState>;
    state: () => Promise<DesktopLayoutState>;
    displays: () => Promise<DesktopDisplay[]>;
  };
  update: DesktopUpdateApi;
}

declare global {
  interface Window {
    copilotDesktop?: DesktopLayoutApi;
  }
}
