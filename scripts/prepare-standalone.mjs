// 把 .next/static 和 public 补进 standalone 目录，Electron 里直接 require 那份 server.js
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');

if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  console.error('\n[desktop] 找不到 .next/standalone/server.js，请先执行：npm run desktop:build\n');
  process.exit(1);
}

const jobs = [
  [path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static')],
  [path.join(root, 'public'), path.join(standalone, 'public')],
];

for (const [from, to] of jobs) {
  if (!fs.existsSync(from)) continue;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
  console.log(`[desktop] 已同步 ${path.relative(root, from)} -> ${path.relative(root, to)}`);
}

console.log('[desktop] standalone 产物就绪');
