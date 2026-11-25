// 把 electron-builder 生成的安装包复制到本机更新目录，并写 latest.json。
// 用法：npm run release:local
// 生成后，已安装的 1.7.2+ 版本在“设置 → 关于与更新”里点检查更新即可。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = String(pkg.version || '').trim();
if (!version) {
  console.error('[release:local] package.json 缺少 version');
  process.exit(1);
}

function findInstaller() {
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^dist(?:-|$)/.test(d.name))
    .map((d) => path.join(root, d.name));

  const files = [];
  for (const dir of dirs) {
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.toLowerCase().endsWith('.exe')) continue;
      if (!name.includes(version)) continue;
      const file = path.join(dir, name);
      try {
        const stat = fs.statSync(file);
        if (stat.isFile()) files.push({ file, mtime: stat.mtimeMs, size: stat.size });
      } catch {
        // 忽略读不到的临时文件
      }
    }
  }

  files.sort((a, b) => b.mtime - a.mtime);
  return files[0] || null;
}

const found = findInstaller();
if (!found) {
  console.error(
    `[release:local] 没找到包含版本 ${version} 的安装包。先运行 npm run desktop:dist，或检查 dist* 目录。`
  );
  process.exit(1);
}

const updatesDir = path.join(root, 'updates');
fs.mkdirSync(updatesDir, { recursive: true });

// 用 ASCII 文件名，避免以后迁到 GitHub / HTTP 更新源时中文 URL 编码问题。
const targetName = `InterviewCopilot-Setup-${version}.exe`;
const target = path.join(updatesDir, targetName);
fs.copyFileSync(found.file, target);

const hash = crypto.createHash('sha256');
const stream = fs.createReadStream(target);
await new Promise((resolve, reject) => {
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('end', resolve);
  stream.on('error', reject);
});
const sha256 = hash.digest('hex');
const stat = fs.statSync(target);

const manifest = {
  version,
  file: targetName,
  sha256,
  size: stat.size,
  notes:
    process.env.UPDATE_NOTES ||
    `版本 ${version}：修复标准问答弱相关误命中；设置 → 关于与更新可直接升级。`,
  publishedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(updatesDir, 'latest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('[release:local] 已生成本机更新源：');
console.log(`  安装包：${target}`);
console.log(`  清单：  ${path.join(updatesDir, 'latest.json')}`);
console.log(`  版本：  ${version}`);
console.log(`  SHA256：${sha256}`);
console.log('\n下一步：在已安装的、带更新功能的应用里打开 设置 → 关于与更新 → 检查更新。');
