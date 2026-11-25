import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Windows 上 `next build` 生成 standalone 会整包拷贝 node_modules，很慢；
// 普通网页构建不需要，只有桌面端打包走这个脚本显式开启。
const bin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const r = spawnSync(process.execPath, [bin, 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_OUTPUT: 'standalone' },
});

process.exit(r.status ?? 1);
