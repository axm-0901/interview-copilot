import { matchQA, rankQA, qaThreshold } from '../lib/qaMatch';
import type { QAEntry } from '../lib/types';

const entries: QAEntry[] = [
  { id:'1', profileId:'p', question:'能不能接受工作岗位调剂', aliases:['接受岗位调剂吗','岗位调剂可以接受吗'], answer:'岗位答案', tags:[], createdAt:0, updatedAt:0 },
  { id:'2', profileId:'p', question:'能不能接受工作地点调剂', aliases:['接受地点调剂吗','工作地点可以调剂吗'], answer:'地点答案', tags:[], createdAt:0, updatedAt:0 },
  { id:'3', profileId:'p', question:'你期望的薪资是多少', aliases:['期望薪资','薪资要求'], answer:'薪资答案', tags:[], createdAt:0, updatedAt:0 },
  { id:'4', profileId:'p', question:'你最大的优点是什么', aliases:[], answer:'优点答案', tags:[], createdAt:0, updatedAt:0 },
  { id:'5', profileId:'p', question:'你最大的缺点是什么', aliases:[], answer:'缺点答案', tags:[], createdAt:0, updatedAt:0 },
  { id:'6', profileId:'p', question:'为什么选择我们公司', aliases:['为什么想来我们这边','为什么投递我们公司'], answer:'公司答案', tags:[], createdAt:0, updatedAt:0 },
];
const tests = [
  '面试官问你能不能接受工作岗位调剂',
  '能不能接受工作地点调剂',
  '接受岗位调剂吗',
  '接受地点调剂吗',
  '岗位调剂能接受吗',
  '工作地点可以调剂吗',
  '你期望薪资多少',
  '当前薪资多少',
  '你最大的优点是什么',
  '你最大的缺点是什么',
  '为什么选择我们公司',
  '为什么想来我们这边',
  '你平时加班多吗',
];
let failed = 0;
for (const q of tests) {
  const hit = matchQA(q, entries);
  const r = rankQA(q, entries, 3);
  console.log(`\n${q}\n  threshold=${qaThreshold(q)} hit=${hit ? hit.entry.question + ' / ' + hit.variant : 'NULL'}`);
  for (const c of r) console.log(`    ${c.score.toFixed(3)} cov=${c.coverage.toFixed(2)} ${c.entry.question} [${c.variant}]`);
}
const expect: [string,string|null][] = [
  ['能不能接受工作岗位调剂','能不能接受工作岗位调剂'],
  ['能不能接受工作地点调剂','能不能接受工作地点调剂'],
  ['接受岗位调剂吗','能不能接受工作岗位调剂'],
  ['接受地点调剂吗','能不能接受工作地点调剂'],
  ['你期望薪资多少','你期望的薪资是多少'],
  ['当前薪资多少',null],
  ['你最大的优点是什么','你最大的优点是什么'],
  ['你最大的缺点是什么','你最大的缺点是什么'],
  ['为什么选择我们公司','为什么选择我们公司'],
  ['为什么想来我们这边','为什么选择我们公司'],
  ['你平时加班多吗',null],
];
for (const [q, want] of expect) {
  const hit = matchQA(q, entries);
  const got = hit?.entry.question ?? null;
  if (got !== want) { failed++; console.log(`FAIL ${q}: got=${got} want=${want}`); }
}

// 弱相关 / 邻近题必须拒绝：宁可交给模型现场答，也不能贴错标准答案。
const reject = [
  '你了解我们公司吗',
  '你最大的成就是什么',
  '你对这个岗位有什么理解',
  '你还有什么问题问我们',
  '你什么时候能到岗',
  '你结婚了吗',
  '你期望的工作地点是哪里',
  '你能接受出差吗',
  '你上一份工作为什么离职',
  '你平时有什么爱好',
];
for (const q of reject) {
  const hit = matchQA(q, entries);
  if (hit) {
    failed++;
    console.log(`FAIL ${q}: should reject, got=${hit.entry.question} score=${hit.score}`);
  }
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
