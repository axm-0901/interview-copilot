import * as db from './db';
import { cardFingerprint } from './cards';
import { demoReview } from './demo';
import { splitIntoChunks, tokenize } from './retrieval';
import type { Doc, Profile, QAEntry, Review, Session, SkillCard, Turn } from './types';

const NOW = Date.now();
const DAY = 86400000;

const RESUME = `陈屿 / 男 / 1998.06 / 上海
求职方向：后端开发工程师（Java / Go）

教育经历
华东理工大学 · 计算机科学与技术 · 本科 · 2016.09–2020.06

工作经历
2022.07 – 至今　某电商平台 · 交易中台 · 后端开发工程师
- 负责订单履约链路的服务端设计与迭代，日订单量约 120 万，核心接口 P99 从 380ms 降到 95ms
- 主导促销引擎的规则编排重构，把 6 个硬编码活动合并成配置化规则，活动上线周期从 3 天缩短到 4 小时
- 建设慢查询治理机制，MySQL 慢查询数量从日均 1400 条降到 60 条以内
- 带 2 名应届生完成履约看板项目，负责方案评审与 code review

2020.07 – 2022.06　某 SaaS 创业公司 · 后端开发
- 独立负责计费模块，支持按量、包年、阶梯三种计费模式，服务 400+ 企业客户
- 用 Redis + Lua 做配额扣减，避免超卖，压测下 3000 QPS 无重复扣减

技能
Java / Spring Boot / MySQL / Redis / Kafka / Elasticsearch / Kubernetes / Go
熟悉 JVM 调优、分库分表、分布式事务（本地消息表 + 最终一致）`;

const JD = `字节跳动 · 后端开发工程师（增长方向）· 二面

岗位职责
1. 负责增长业务的服务端研发，支撑拉新、留存、召回等核心场景，日均请求量亿级
2. 参与高并发系统的架构设计与性能优化，保障核心链路稳定性
3. 与产品、数据、算法团队协作，快速验证增长实验，支撑 A/B 实验平台
4. 参与服务治理、容量规划与故障演练

职位要求
1. 熟悉 Java 或 Go，理解 JVM / 运行时原理，有扎实的数据结构与算法基础
2. 熟悉 MySQL、Redis、Kafka 等常用中间件，理解其适用边界
3. 有高并发、分布式系统设计经验，能独立完成模块的方案设计与落地
4. 熟悉 Linux 环境，具备线上问题排查能力
5. 有增长、推荐、广告相关业务经验者优先
6. 良好的跨团队沟通能力，能推动方案落地`;

const P1 = `# 订单履约系统重构

## 背景
下单之后，交易主链路要同步调用库存、优惠、履约三个下游服务。任何一段抖动都会拖长响应时间，大促期间 P99 会冲到 800ms 以上，超时导致的订单回滚每天都有几十笔。

## 我做了什么
我负责履约状态机的拆分和异步化改造。第一步是把原来的同步调用改成事件驱动：主链路只写本地业务表和本地消息表，提交事务后由投递器把事件发到 Kafka，下游各自消费。
第二步是重新设计状态机，把原来的 11 个状态压缩到 7 个，去掉三个只在中途短暂出现、没有任何业务查询用到的中间态。
第三步是给履约动作加了幂等键，键是「订单号 + 动作类型 + 版本号」，消费端用 Redis SETNX 做去重，TTL 设 7 天。

## 关键决策与取舍
- 没有直接上 Seata 这类强一致方案，因为大促期间它自己的协调者就是单点，性能也扛不住；最终选了本地消息表 + 最终一致，接受秒级的中间态。
- 状态机压缩时有争议：产品坚持要保留「待分配」状态用于报表。我做了数据核对，这个状态平均只存在 1.2 秒，报表用创建时间和分配时间就能算出来，最后说服了产品。
- 没有做全链路灰度，只对非核心的退款链路先切，因为主链路灰度需要两边同时兼容两套状态机，成本高于收益。

## 结果
- 核心下单接口 P99 从 380ms 降到 95ms，大促峰值 1.8 万 QPS 无超时
- 因超时导致的订单回滚从日均 40 笔降到 0–2 笔
- 履约状态从 11 个减到 7 个，新同学理解成本明显下降`;

const P2 = `# 促销引擎规则编排重构

## 背景
平台有 6 类促销活动：满减、折扣、第二件半价、限时秒杀、优惠券叠加、会员价。之前每一类都是硬编码，每上一个活动要改代码、走发布，平均 3 天。运营侧非常不满。

## 我做了什么
我提出把促销表达成「条件 + 动作」的规则树，用 JSON 描述，引擎负责解析和执行。
- 条件节点支持商品范围、用户分层、时间窗、库存门槛四类原子条件，支持 AND / OR 组合
- 动作节点支持减价、打折、赠品、包邮
- 优先级用显式的 priority 字段，冲突时高优先级独占，同级取最优
- 我在引擎外面加了一层「预算闸门」，每次执行前先做一次 Redis 预扣，避免超发

## 关键决策与取舍
- 没有引入 Drools 这类规则引擎，因为团队没人维护过，出问题排查不动；自己写的解析器只有 1200 行，可控。
- 规则树的执行顺序选了「先算最优，再校验预算」，而不是边算边校验，因为后者在大促高并发下会频繁回滚，反而更慢。
- 放弃了「运营自助配置任意表达式」的能力，只开放结构化字段，牺牲灵活性换稳定性。

## 结果
- 活动上线周期从 3 天缩短到 4 小时
- 6 类活动合并成一套配置，代码量减少约 4000 行
- 上线半年零超发，预算误差控制在 0.3% 以内`;

const P3 = `# 慢查询治理

## 背景
交易库日均慢查询 1400 条左右，主要集中在订单列表和履约查询两个接口。数据库 CPU 长期在 70% 以上，大促前必须解决。

## 我做了什么
先把慢查询日志按 SQL 指纹聚合，发现 83% 来自 4 条 SQL。
- 订单列表：按用户 + 状态 + 时间查，索引只建了用户，回表严重。改成 (user_id, status, created_at) 联合索引，并用覆盖索引把列表页需要的字段带上。
- 履约查询：分页用了 limit 大偏移，改成基于上次游标（created_at + id）的游标分页。
- 两条统计类 SQL 改成走离线宽表，实时链路不再扫明细。

## 关键决策与取舍
- 联合索引不是越多越好。我最初加了 3 个，写入 TPS 掉了 8%，最后只保留 1 个，另外两个用缓存兜住。
- 游标分页不支持跳页，产品那边做了妥协：列表只保留「加载更多」，去掉页码。这是这次治理里唯一的产品改动。
- 没有上读写分离，因为当时主从延迟在 200ms 以上，订单列表读延迟不可接受。

## 结果
- 慢查询从日均 1400 条降到 60 条以内
- 数据库 CPU 从 72% 降到 38%
- 订单列表接口 P99 从 620ms 降到 180ms`;

const PROJECTS: { name: string; text: string }[] = [
  { name: '项目_订单履约系统重构.md', text: P1 },
  { name: '项目_促销引擎规则编排.md', text: P2 },
  { name: '项目_慢查询治理.md', text: P3 },
];

function card(
  profileId: string,
  data: Omit<SkillCard, 'id' | 'profileId' | 'updatedAt' | 'fingerprint'>
): SkillCard {
  const base: SkillCard = {
    ...data,
    id: db.uid('card'),
    profileId,
    updatedAt: NOW - Math.random() * DAY,
    fingerprint: '',
  };
  base.fingerprint = cardFingerprint(base);
  return base;
}

async function addDoc(profileId: string, name: string, type: Doc['type'], text: string) {
  const doc: Doc = {
    id: db.uid('doc'),
    profileId,
    name,
    type,
    chars: text.length,
    source: type === 'jd' ? 'paste' : 'file',
    createdAt: NOW - Math.random() * 2 * DAY,
    raw: text,
  };
  await db.putDoc(doc);
  const parts = splitIntoChunks(text);
  await db.putChunks(
    parts.map((p, idx) => ({
      id: db.uid('ch'),
      docId: doc.id,
      profileId,
      idx,
      text: p,
      tokens: tokenize(p),
    }))
  );
  return doc;
}

export async function seedSample() {
  const profile: Profile = {
    id: db.uid('pf'),
    name: '陈屿 · 字节后端二面',
    targetRole: '后端开发工程师（增长方向）',
    company: '字节跳动',
    round: '二面',
    lang: '中文',
    instructions:
      '第一句话先给结论，再展开两点依据。\n每题控制在 30 秒内，项目题讲清我的动作和取舍。\n不会的题先说不确定，再给判断和推理过程。',
    createdAt: NOW,
  };
  await db.putProfile(profile);
  const pid = profile.id;

  await addDoc(pid, '简历_陈屿_后端开发.pdf', 'resume', RESUME);
  await addDoc(pid, 'JD_字节_后端开发（增长方向）.txt', 'jd', JD);
  for (const p of PROJECTS) await addDoc(pid, p.name, 'project', p.text);

  const cards: SkillCard[] = [
    card(pid, {
      project: '订单履约系统重构',
      period: '2023.03 – 2023.09',
      role: '履约状态机拆分与异步化改造的负责人',
      background: '下单主链路同步调用三个下游，大促 P99 冲到 800ms，超时导致订单回滚',
      actions: [
        '把同步调用改成事件驱动：主链路只写业务表和本地消息表，提交后投递 Kafka',
        '重新设计状态机，把 11 个状态压到 7 个，去掉三个无业务查询的中间态',
        '给履约动作加幂等键（订单号 + 动作类型 + 版本号），消费端用 Redis SETNX 去重',
      ],
      decisions: [
        '没上 Seata 强一致，因为大促时协调者是单点、性能扛不住，接受秒级中间态换吞吐',
        '状态机压缩时产品要保留「待分配」做报表，我用数据证明该状态只存在 1.2 秒，说服了对方',
        '只对退款链路先切，主链路全链路灰度要同时兼容两套状态机，成本高于收益',
      ],
      results: [
        '核心下单接口 P99 从 380ms 降到 95ms，大促 1.8 万 QPS 无超时',
        '超时导致的订单回滚从日均 40 笔降到 0–2 笔',
        '履约状态 11 个减到 7 个，新同学理解成本下降',
      ],
      followups: [
        { q: '本地消息表会不会丢消息？', a: '扫表 + 版本号重投，最坏情况延迟 3 秒，不会丢' },
        { q: '为什么不用事务消息？', a: '当时中间件版本不支持，且团队没有运维经验' },
        { q: '秒级中间态对业务有影响吗？', a: 'C 端查询走读库兜底，实测无用户投诉' },
      ],
      status: 'confirmed',
    }),
    card(pid, {
      project: '促销引擎规则编排重构',
      period: '2022.11 – 2023.02',
      role: '规则引擎方案设计与核心实现',
      background: '6 类促销全是硬编码，每上一个活动要改代码走发布，平均 3 天',
      actions: [
        '把促销表达成「条件 + 动作」的规则树，JSON 描述、引擎解析执行',
        '实现四类原子条件（商品范围 / 用户分层 / 时间窗 / 库存门槛）与 AND、OR 组合',
        '在引擎外挂一层预算闸门，执行前用 Redis 预扣，防止优惠超发',
      ],
      decisions: [
        '没引入 Drools，团队没人维护过、出问题排查不动；自研解析器 1200 行，完全可控',
        '执行顺序选「先算最优再校验预算」，边算边校验在高并发下会频繁回滚、更慢',
        '放弃运营自助配任意表达式，只开放结构化字段，用灵活性换稳定性',
      ],
      results: [
        '活动上线周期从 3 天缩短到 4 小时',
        '6 类活动合并成一套配置，代码量减少约 4000 行',
        '上线半年零超发，预算误差控制在 0.3% 以内',
      ],
      followups: [
        { q: '规则冲突怎么处理？', a: '显式 priority，高优先级独占，同级取最优' },
        { q: '预算预扣失败怎么办？', a: '降级到不参与活动，不阻塞下单' },
        { q: '规则热更新怎么保证一致性？', a: '版本号 + 双缓冲，切换时整份替换' },
      ],
      status: 'confirmed',
    }),
    card(pid, {
      project: '交易库慢查询治理',
      period: '2023.11 – 2023.12',
      role: '主要负责人（一个人做完诊断到落地）',
      background: '慢查询日均 1400 条，数据库 CPU 长期 70% 以上，大促前必须解决',
      actions: [
        '按 SQL 指纹聚合慢日志，定位到 4 条 SQL 占 83%',
        '订单列表改 (user_id, status, created_at) 联合索引，用覆盖索引减少回表',
        '履约查询把 limit 大偏移改成游标分页（created_at + id）',
      ],
      decisions: [
        '最初加了 3 个联合索引，写入 TPS 掉 8%，最后只留 1 个，其余用缓存兜住',
        '游标分页不支持跳页，和产品达成妥协：列表只保留「加载更多」',
        '没上读写分离，主从延迟 200ms 以上，订单列表读延迟不可接受',
      ],
      results: [
        '慢查询从日均 1400 条降到 60 条以内，降幅 95%',
        '数据库 CPU 从 72% 降到 38%',
        '订单列表接口 P99 从 620ms 降到 180ms',
      ],
      followups: [
        { q: '为什么只留一个索引？', a: '写放大明显，TPS 掉 8% 比读优化更伤' },
        { q: '游标分页怎么处理跳页需求？', a: '产品侧去掉页码，只保留加载更多' },
        { q: '怎么验证 CPU 下降是这个改动带来的？', a: '分两批灰度，对比同时间段同机房指标' },
      ],
      status: 'confirmed',
    }),
    card(pid, {
      project: '带 2 名应届生做履约看板',
      period: '2024.03 – 2024.06',
      role: '技术负责人兼 mentor',
      background: '团队缺一个履约时效看板，交给两个应届生，我负责兜底',
      actions: ['拆任务到周粒度', '每周两次 code review，逐行过'],
      decisions: [],
      results: ['看板按期上线，覆盖 6 个核心指标'],
      followups: [{ q: '', a: '' }],
      status: 'draft',
    }),
  ];
  for (const c of cards) await db.putCard(c);

  const qas: QAEntry[] = [
    {
      id: db.uid('qa'),
      profileId: pid,
      question: '请你先做一个自我介绍',
      aliases: ['简单介绍一下自己', '一分钟自我介绍', '介绍一下你的背景', '先自我介绍一下吧'],
      answer:
        '我是陈屿，2020 年本科毕业，做后端开发四年，目前在电商平台的交易中台，主要做订单履约链路。\n\n我比较有代表性的两段经历：一段是把履约状态机从同步调用改成事件驱动，核心下单接口的 P99 从 380ms 降到 95ms，大促 1.8 万 QPS 没有超时；另一段是把促销规则从硬编码改成配置化引擎，活动上线周期从三天缩短到四小时。\n\n我理解增长方向的后端，核心是把实验快速、稳定地落到线上，这和我做履约链路、做规则引擎的经验是通的。我希望在这个方向上继续做深。',
      tags: ['自我介绍'],
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: db.uid('qa'),
      profileId: pid,
      question: '为什么选择我们公司，为什么选择这个岗位',
      aliases: ['为什么想来字节', '为什么投这个岗位', '你选择我们公司的原因', '为什么不去别的公司'],
      answer:
        '我选这个岗位主要看三点。\n\n第一是业务匹配。增长方向的后端要支撑拉新、留存、召回这些场景，本质是高并发下的实验和链路稳定性，我在交易中台做履约链路，处理过大促峰值和下游抖动，这部分是直接对得上的。\n\n第二是能力成长。JD 里提到 A/B 实验平台和容量规划，这两块我做过规则引擎和慢查询治理，但实验体系是我需要补的，我希望在一个把实验做得很成熟的团队里补上这块。\n\n第三是城市和长期投入，我目前就在杭州，也打算长期在这边发展。',
      tags: ['公司', '动机'],
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: db.uid('qa'),
      profileId: pid,
      question: '你最大的缺点是什么',
      aliases: ['说说你的缺点', '你觉得自己有什么不足', '你最大的不足是什么'],
      answer:
        '我比较明显的缺点是早期做方案时容易先钻技术细节，对业务节奏的判断不够快。\n\n之前做履约状态机重构，我一开始想把状态机一次性设计到最完整，评审时才发现产品下个季度才需要其中两个状态，等于提前做了。后来我给自己定了一个习惯：方案评审前先写清楚「这次不做什么、为什么现在不做」，并且先和产品对齐上线节奏。\n\n现在我做技术方案会先确认业务时间点，再决定深度，这个习惯对我带项目帮助很大。',
      tags: ['行为', '缺点'],
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: db.uid('qa'),
      profileId: pid,
      question: '讲一个你最有成就感的项目',
      aliases: ['你最有成就感的经历', '介绍一个你最有成就感的项目', '你最得意的项目是什么'],
      answer:
        '最有成就感的是订单履约系统的重构。\n\n当时下单主链路要同步调用库存、优惠、履约三个下游，大促 P99 会冲到 800ms，超时导致的订单回滚每天有几十笔。我负责履约状态机的拆分和异步化：主链路只写业务表和本地消息表，提交后通过 Kafka 投递，下游各自消费；同时把 11 个状态压到 7 个，并给履约动作加了幂等键。\n\n过程中最大的争议是要不要上强一致方案。我评估后没有上 Seata，因为大促时协调者是单点、性能扛不住，最终选择本地消息表加最终一致，接受秒级中间态。结果是核心下单接口 P99 从 380ms 降到 95ms，大促 1.8 万 QPS 无超时，回滚从日均 40 笔降到 0 到 2 笔。\n\n这件事让我真正理解了「一致性方案要和业务场景匹配」，不是越强越好。',
      tags: ['项目', '成就'],
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: db.uid('qa'),
      profileId: pid,
      question: '如果测评题目要求举例，但你没有完全相同的经历，应该怎么回答',
      aliases: ['没有相关经验怎么回答行为面试', '遇到没有经历过的情况怎么办', '没有相同经历怎么举例'],
      answer:
        '我会先说明差异，再找最接近的经历，而不是硬编一个案例。\n\n我会这样回答：我没有完全相同的场景，但有一件比较接近的事。当时的情况是……我负责的是……我做了……结果是……\n\n如果确实完全没有相关经历，我会明确说这块我暂时没有直接做过，然后给出我的处理原则：先了解清楚目标和约束，再找团队里做过的人对齐，最后小范围验证。我不会假装做过。',
      tags: ['行为', '无经验'],
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: db.uid('qa'),
      profileId: pid,
      question: '你还有什么问题想问我们',
      aliases: ['你有什么想问我的', '反问环节', '你对我们有什么问题'],
      answer:
        '我有三个问题想请教。\n\n第一，这个岗位半年之后做得好的标准是什么？我想知道团队眼里什么样算真正上手。\n\n第二，增长后端目前最头疼的是哪块？是实验效率、链路稳定性，还是数据一致性？我想提前知道重点。\n\n第三，团队接下来一年在技术上的重点投入是什么，比如实验平台、容量规划或者服务治理？我希望自己的成长方向和团队的方向是一致的。',
      tags: ['反问'],
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
  for (const q of qas) await db.putQA(q);

  const snapshotId = db.uid('sn');
  await db.putSnapshot({
    id: snapshotId,
    profileId: pid,
    cardIds: cards.filter((c) => c.status === 'confirmed').map((c) => c.id),
    qaIds: qas.map((q) => q.id),
    docIds: (await db.listDocs(pid)).map((d) => d.id),
    label: '第 2 轮 · 3 张卡 · 4 份文档',
    createdAt: NOW - 2 * DAY,
  });

  const qa = [
    {
      question: '先介绍一下你最近做的项目，你个人负责哪一部分？',
      answer:
        '我最近做的是订单履约链路的重构。我们团队负责交易中台，我主要负责履约状态机的拆分和异步化改造。原来下单之后要同步调用库存、优惠、履约三个服务，链路很长，P99 大概 380 毫秒。我把它改成事件驱动，用 Kafka 解耦，主链路只写本地事务表。改完之后 P99 降到 95 毫秒左右，大促期间也稳住了。这个事情跨了三个团队，推动起来比较费劲。',
    },
    {
      question: '你说的性能提升，具体是怎么定位到瓶颈的？',
      answer:
        '先看监控，发现 P99 毛刺集中在库存扣减那一段。然后用 Arthas 抓了几次慢调用，发现是 Redis 大 key 导致的。我们把 key 拆了。其实当时也考虑过加本地缓存，但是一致性不好保证，最后放弃了。',
    },
    {
      question: '分布式事务你们是怎么做的？为什么不用强一致方案？',
      answer:
        '用的是本地消息表加最终一致。下单的时候在同一个事务里写业务表和消息表，然后有个定时任务扫表投递到 Kafka，下游消费成功就标记完成。失败的话重试三次，超过就进人工补偿队列。这样避免了强一致带来的性能问题。Seata 我们也评估过，但是大促的时候协调者是单点，扛不住。',
    },
    {
      question: '你带过两个应届生，如果其中一个交付质量一直不达标，你会怎么处理？',
      answer:
        '我会先看他具体是哪一块不行。如果是代码质量，我会在 code review 里标出来，让他重写。如果是进度问题，我会拆细任务。实在不行就换人。',
    },
    {
      question: '如果流量突然涨十倍，你觉得履约系统哪里会最先崩？',
      answer:
        '应该是 Kafka 的消费能力先到瓶颈。现在消费组是 12 个分区，单分区大概能扛 8000 QPS，乘起来接近 10 万。涨十倍的话订单量到 1200 万一天，峰值可能就顶不住了。要先扩分区，但是扩分区会打乱顺序性，所以得按订单号做二次分区。',
    },
  ];

  const session: Session = {
    id: db.uid('se'),
    profileId: pid,
    snapshotId,
    mode: 'assist',
    title: '字节 · 后端二面 · 模拟',
    startedAt: NOW - 2 * DAY,
    endedAt: NOW - 2 * DAY + 32 * 60000,
    avgScore: 0,
    snapshotLabel: '第 2 轮 · 3 张卡 · 4 份文档',
  };

  const turns: Turn[] = qa.map((x, i) => ({
    id: db.uid('t'),
    sessionId: session.id,
    question: x.question,
    source: i === 0 ? 'asr' : i === 1 ? 'asr' : 'manual',
    answerMd: x.answer,
    citations:
      i < 3
        ? [
            {
              type: 'card',
              id: cards[i].id,
              label: cards[i].project,
              text: cards[i].actions[0] ?? '',
              score: 3.4 - i * 0.3,
            },
          ]
        : [],
    latencyMs: 900 + i * 130,
    createdAt: session.startedAt + (i + 1) * 4 * 60000,
    style: 'standard',
    degraded: i >= 3,
    demo: true,
  }));

  const payload = demoReview(qa.map((x, i) => ({ i, q: x.question, a: x.answer })));
  session.avgScore = payload.summary.avg;

  const reviews: Review[] = payload.turns.map((r, i) => ({
    id: db.uid('rv'),
    turnId: turns[i].id,
    sessionId: session.id,
    type: r.type,
    score: r.score,
    fatal: r.fatal,
    rewrite: r.rewrite,
    reminder: r.reminder,
    createdAt: turns[i].createdAt + 60000,
  }));

  await db.putSession(session);
  for (const t of turns) await db.putTurn(t);
  await db.putReviews(reviews);
  await db.kvSet(`reviewSummary:${session.id}`, {
    summary: payload.summary,
    local: true,
    at: Date.now(),
  });
  await db.kvSet('sampleSeeded', true);

  return profile;
}
