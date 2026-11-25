'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MANIFEST_NAME = 'latest.json';

/**
 * 只做本机目录更新：
 *   updates/latest.json
 *   updates/InterviewCopilot-Setup-x.y.z.exe
 *
 * latest.json 示例：
 * {
 *   "version": "1.7.2",
 *   "file": "InterviewCopilot-Setup-1.7.2.exe",
 *   "sha256": "...",
 *   "notes": "本版修复了标准问答误命中",
 *   "publishedAt": "2026-11-17T..."
 * }
 *
 * 后续要换 GitHub Releases 时，只需要把 check/prepareInstall 换成
 * electron-updater 的实现，IPC 和设置界面不用动。
 */

function parseVersion(value) {
  const parts = String(value || '')
    .trim()
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .slice(0, 3);
  return [0, 1, 2].map((i) => {
    const m = String(parts[i] ?? '0').match(/^\d+/);
    return m ? Number(m[0]) : 0;
  });
}

function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
}

function resolveDir(dir) {
  return path.resolve(String(dir || ''));
}

function configPath(app) {
  return path.join(app.getPath('userData'), 'update-source.json');
}

function readConfiguredDir(app) {
  try {
    const file = configPath(app);
    if (!fs.existsSync(file)) return '';
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return typeof data?.dir === 'string' && data.dir.trim() ? resolveDir(data.dir) : '';
  } catch {
    return '';
  }
}

function resolveUpdateDir(app) {
  if (process.env.COPILOT_UPDATE_DIR) return resolveDir(process.env.COPILOT_UPDATE_DIR);
  const configured = readConfiguredDir(app);
  if (configured) return configured;

  // 当前项目在这台机器上的默认位置；换机器/换目录时可在设置里改。
  const candidates = [
    'E:\\Offer\\updates',
    path.join(process.cwd(), 'updates'),
    path.join(app.getPath('userData'), 'updates'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return resolveDir(candidate);
  }
  return resolveDir(candidates[0]);
}

function saveUpdateDir(app, dir) {
  const next = resolveDir(dir);
  fs.mkdirSync(path.dirname(configPath(app)), { recursive: true });
  fs.writeFileSync(configPath(app), JSON.stringify({ dir: next }, null, 2), 'utf8');
  return next;
}

function safeAssetPath(dir, name) {
  const root = resolveDir(dir);
  const file = path.resolve(root, String(name || ''));
  if (file === root) return null;
  if (!file.startsWith(root + path.sep)) return null;
  return file;
}

function readManifest(dir) {
  const file = path.join(resolveDir(dir), MANIFEST_NAME);
  if (!fs.existsSync(file)) {
    return { ok: false, error: `未找到更新清单：${file}` };
  }
  try {
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    if (!data || typeof data.version !== 'string' || typeof data.file !== 'string') {
      return { ok: false, error: 'latest.json 缺少 version 或 file 字段' };
    }
    return { ok: true, manifest: data, path: file };
  } catch (e) {
    return { ok: false, error: `latest.json 解析失败：${String(e?.message ?? e)}` };
  }
}

function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function checkForUpdate(dir, currentVersion) {
  const root = resolveDir(dir);
  const loaded = readManifest(root);
  if (!loaded.ok) {
    return { ok: false, dir: root, current: currentVersion, error: loaded.error };
  }

  const manifest = loaded.manifest;
  const file = safeAssetPath(root, manifest.file);
  if (!file) {
    return { ok: false, dir: root, current: currentVersion, error: 'latest.json 的 file 路径不合法' };
  }
  if (!fs.existsSync(file)) {
    return { ok: false, dir: root, current: currentVersion, error: `安装包不存在：${file}` };
  }

  const stat = fs.statSync(file);
  const available = compareVersions(manifest.version, currentVersion) > 0;
  return {
    ok: true,
    dir: root,
    current: currentVersion,
    latest: manifest.version,
    available,
    notes: typeof manifest.notes === 'string' ? manifest.notes : '',
    file,
    size: stat.size,
    publishedAt: typeof manifest.publishedAt === 'string' ? manifest.publishedAt : '',
    sha256: typeof manifest.sha256 === 'string' ? manifest.sha256 : '',
  };
}

async function prepareInstall(dir, currentVersion) {
  const checked = await checkForUpdate(dir, currentVersion);
  if (!checked.ok) return { ok: false, error: checked.error };
  if (!checked.available) {
    return { ok: false, error: `当前已是最新版本：v${currentVersion}` };
  }
  if (process.platform === 'win32' && !checked.file.toLowerCase().endsWith('.exe')) {
    return { ok: false, error: 'Windows 更新包必须是 .exe' };
  }

  const expected = String(checked.sha256 || '').trim().toLowerCase();
  if (!expected) {
    return { ok: false, error: 'latest.json 缺少 sha256，拒绝安装未校验的更新包' };
  }
  const actual = await hashFile(checked.file);
  if (actual !== expected) {
    return { ok: false, error: '安装包校验失败（SHA-256 不一致），请重新生成 latest.json' };
  }

  return {
    ok: true,
    file: checked.file,
    version: checked.latest,
    notes: checked.notes,
  };
}

module.exports = {
  MANIFEST_NAME,
  compareVersions,
  resolveUpdateDir,
  saveUpdateDir,
  readManifest,
  hashFile,
  checkForUpdate,
  prepareInstall,
};
