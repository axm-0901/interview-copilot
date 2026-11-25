const {
  app,
  BrowserWindow,
  Menu,
  shell,
  session,
  desktopCapturer,
  dialog,
  ipcMain,
  screen,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const {
  resolveUpdateDir,
  saveUpdateDir,
  checkForUpdate,
  prepareInstall,
} = require('./update.cjs');

const IS_DEV = !app.isPackaged;
const APP_ROOT = path.join(__dirname, '..');
const CAPTURE = process.argv.includes('--capture');
const SMOKE = process.argv.includes('--smoke');

let mainWindow = null;
let stageWindow = null;
// 端口必须固定：IndexedDB / localStorage 是按 origin 隔离的，
// 端口一变，用户之前存的档案、技能卡就"消失"了。
const DEFAULT_PORT = 38217;
let port = Number(process.env.COPILOT_PORT || 0);

function isFree(p) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(p, '127.0.0.1');
  });
}

/** 优先用固定端口；被占用时才往后顺延（极少发生） */
async function ensurePort() {
  if (port) return port;
  for (let p = DEFAULT_PORT; p < DEFAULT_PORT + 20; p++) {
    if (await isFree(p)) return p;
  }
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
}

function standaloneRoot() {
  return IS_DEV ? path.join(APP_ROOT, '.next', 'standalone') : path.join(process.resourcesPath, 'app');
}

function probe(url, timeout = 1500) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
  });
}

async function waitReady(total = 25000) {
  const started = Date.now();
  while (Date.now() - started < total) {
    try {
      const code = await probe(`http://127.0.0.1:${port}/`);
      if (code && code < 500) return true;
    } catch {
      // 还没起来
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function startServer() {
  const root = standaloneRoot();
  const entry = path.join(root, 'server.js');
  if (!fs.existsSync(entry)) {
    throw new Error(
      IS_DEV
        ? '缺少 .next/standalone，请先执行 npm run desktop:build'
        : '安装包缺少应用资源，请重新安装'
    );
  }
  if (!port) port = await ensurePort();

  process.env.NODE_ENV = 'production';
  process.env.PORT = String(port);
  process.env.HOSTNAME = '127.0.0.1';
  process.env.NEXT_TELEMETRY_DISABLED = '1';

  // Next 的 standalone server 是个普通 http server，这里在主进程里直接拉起来
  require(entry);

  const ok = await waitReady();
  if (!ok) throw new Error('本地服务启动超时（25s）');
}

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: '编辑',
        submenu: [
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '重做' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' },
          { role: 'selectAll', label: '全选' },
        ],
      },
      {
        label: '视图',
        submenu: [
          { role: 'reload', label: '重新加载' },
          { role: 'toggleDevTools', label: '开发者工具' },
          { type: 'separator' },
          { role: 'resetZoom', label: '实际大小' },
          { role: 'zoomIn', label: '放大' },
          { role: 'zoomOut', label: '缩小' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: '全屏' },
        ],
      },
    ])
  );
}

function grantMediaPermissions() {
  const ses = session.defaultSession;
  // 麦克风 + 屏幕捕获：本项目唯一的两个媒体权限
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'display-capture') return callback(true);
    callback(false);
  });
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  // 截图解题 + 系统音频：直接给主屏；Windows 上同时开启 loopback，
  // 这样渲染进程能拿到「对方从扬声器出来的声音」而不是靠麦克风收环境音。
  ses.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (!sources.length) return callback({});
      if (process.platform === 'win32') {
        callback({ video: sources[0], audio: 'loopback' });
      } else {
        callback({ video: sources[0] });
      }
    },
    { useSystemPicker: false }
  );
}

/* ---------------- 窗口布局演示（置顶 / 透明度 / 多显示器） ---------------- */

const STAGE_W = 560;
const STAGE_H = 420;

function layoutDisplays() {
  const primaryId = String(screen.getPrimaryDisplay().id);
  return screen.getAllDisplays().map((d, i) => ({
    id: String(d.id),
    label: `${d.label || `显示器 ${i + 1}`}${String(d.id) === primaryId ? '（主屏）' : ''}`,
    width: d.size.width,
    height: d.size.height,
    scaleFactor: d.scaleFactor,
    primary: String(d.id) === primaryId,
  }));
}

function stageState() {
  const displays = layoutDisplays();
  const primaryId = String(screen.getPrimaryDisplay().id);
  if (!stageWindow || stageWindow.isDestroyed()) {
    return { open: false, displays, primaryId };
  }
  const bounds = stageWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  return {
    open: true,
    displayId: String(display.id),
    opacity: Math.round(stageWindow.getOpacity() * 100) / 100,
    alwaysOnTop: stageWindow.isAlwaysOnTop(),
    bounds,
    displays,
    primaryId,
  };
}

function applyStageLayout(opts = {}) {
  if (!stageWindow || stageWindow.isDestroyed()) return stageState();

  if (typeof opts.opacity === 'number' && Number.isFinite(opts.opacity)) {
    stageWindow.setOpacity(Math.max(0.35, Math.min(1, opts.opacity)));
  }
  if (typeof opts.alwaysOnTop === 'boolean') {
    stageWindow.setAlwaysOnTop(opts.alwaysOnTop, 'floating');
  }

  const displays = screen.getAllDisplays();
  const target =
    displays.find((d) => String(d.id) === String(opts.displayId)) || screen.getPrimaryDisplay();
  const area = target.workArea;
  const margin = 18;
  const width = Math.min(STAGE_W, Math.max(320, area.width - margin * 2));
  const height = Math.min(STAGE_H, Math.max(240, area.height - margin * 2));

  let x = area.x + margin;
  let y = area.y + margin;
  switch (opts.position) {
    case 'top-right':
      x = area.x + area.width - width - margin;
      y = area.y + margin;
      break;
    case 'bottom-right':
      x = area.x + area.width - width - margin;
      y = area.y + area.height - height - margin;
      break;
    case 'top-left':
      x = area.x + margin;
      y = area.y + margin;
      break;
    case 'bottom-left':
      x = area.x + margin;
      y = area.y + area.height - height - margin;
      break;
    case 'center':
    default:
      x = area.x + Math.round((area.width - width) / 2);
      y = area.y + Math.round((area.height - height) / 2);
      break;
  }

  stageWindow.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  });
  return stageState();
}

async function openStage(opts = {}) {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.show();
    stageWindow.focus();
    return applyStageLayout(opts);
  }

  stageWindow = new BrowserWindow({
    width: STAGE_W,
    height: STAGE_H,
    minWidth: 360,
    minHeight: 260,
    frame: false,
    backgroundColor: '#0b0e13',
    title: '布局演示窗口（共享中可见）',
    icon: path.join(__dirname, 'app-icon.png'),
    show: false,
    resizable: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  stageWindow.setMenuBarVisibility(false);
  stageWindow.setAlwaysOnTop(true, 'floating');
  stageWindow.setOpacity(0.94);
  stageWindow.on('closed', () => {
    stageWindow = null;
  });

  await stageWindow.loadURL(`http://127.0.0.1:${port}/layout-stage`);
  applyStageLayout(opts);
  stageWindow.show();
  return stageState();
}

function registerLayoutIpc() {
  ipcMain.handle('layout:displays', () => layoutDisplays());
  ipcMain.handle('layout:state', () => stageState());
  ipcMain.handle('layout:open', async (_event, opts) => openStage(opts || {}));
  ipcMain.handle('layout:apply', async (_event, opts) => applyStageLayout(opts || {}));
  ipcMain.handle('layout:close', async () => {
    if (stageWindow && !stageWindow.isDestroyed()) stageWindow.close();
    return { ok: true };
  });
}

function registerUpdateIpc() {
  ipcMain.handle('update:info', async () => {
    const dir = resolveUpdateDir(app);
    const checked = await checkForUpdate(dir, app.getVersion());
    return {
      currentVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
      updateDir: dir,
      hasManifest: checked.ok,
      error: checked.ok ? '' : checked.error || '',
    };
  });

  ipcMain.handle('update:check', async () => {
    return checkForUpdate(resolveUpdateDir(app), app.getVersion());
  });

  ipcMain.handle('update:install', async () => {
    const result = await prepareInstall(resolveUpdateDir(app), app.getVersion());
    if (!result.ok) return result;

    try {
      // 调用 NSIS 安装包。oneClick 安装器会自己处理覆盖安装，
      // 主进程收到响应后退出，让安装器替换 resources/app。
      const child = spawn(result.file, [], { detached: true, stdio: 'ignore' });
      child.unref();
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }

    setTimeout(() => app.quit(), 1200);
    return { ok: true, version: result.version };
  });

  ipcMain.handle('update:choose-dir', async () => {
    const current = resolveUpdateDir(app);
    const options = {
      title: '选择更新目录',
      defaultPath: current,
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    const dir = saveUpdateDir(app, result.filePaths[0]);
    return { ok: true, dir };
  });

  ipcMain.handle('update:open-dir', async () => {
    const dir = resolveUpdateDir(app);
    fs.mkdirSync(dir, { recursive: true });
    const error = await shell.openPath(dir);
    return { ok: !error, error: error || '' };
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0b0e13',
    title: 'Copilot · 面试副驾',
    icon: path.join(__dirname, 'app-icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (SMOKE) {
      console.log('[desktop] window ready');
      setTimeout(() => app.quit(), 1500);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  if (CAPTURE) {
    mainWindow.webContents.once('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 2600));
      try {
        const img = await mainWindow.webContents.capturePage();
        fs.writeFileSync(path.join(APP_ROOT, 'electron-shot.png'), img.toPNG());
        console.log('[desktop] capture saved');
      } catch (e) {
        console.error('[desktop] capture failed', e);
      }
      app.quit();
    });
  }

  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      if (process.platform === 'win32') app.setAppUserModelId('com.interview.copilot');
      buildMenu();
      grantMediaPermissions();
      registerLayoutIpc();
      registerUpdateIpc();
      await startServer();
      await createWindow();
    } catch (err) {
      dialog.showErrorBox('启动失败', String(err && err.message ? err.message : err));
      app.quit();
    }
  });

  app.on('window-all-closed', () => app.quit());
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}
