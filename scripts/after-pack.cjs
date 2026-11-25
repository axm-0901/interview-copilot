// electron-builder 会用 files 的排除规则过滤 extraResources，
// standalone 里的 node_modules 因此被漏掉。这里在打包后显式补齐。
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const from = path.join(projectDir, '.next', 'standalone', 'node_modules');
  const to = path.join(context.appOutDir, 'resources', 'app', 'node_modules');

  if (!fs.existsSync(from)) {
    throw new Error(`[afterPack] 找不到 ${from}，先跑 npm run desktop:build`);
  }
  fs.cpSync(from, to, { recursive: true, force: true });
  console.log('[afterPack] 已补齐 standalone/node_modules');
};
