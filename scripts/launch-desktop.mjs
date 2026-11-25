// 启动 Electron。有些环境会设置 ELECTRON_RUN_AS_NODE=1，那会让 Electron 退化成纯 Node，
// 这里统一清掉，保证双击 / npm run desktop 都能正常开窗。
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
