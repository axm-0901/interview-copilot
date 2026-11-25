const { contextBridge, ipcRenderer } = require('electron');

/**
 * 只暴露「窗口布局演示」和「本机更新」需要的 IPC。
 * 这里没有任何隐藏窗口、捕获排除、绕过录屏的能力。
 */
contextBridge.exposeInMainWorld('copilotDesktop', {
  isDesktop: true,
  layout: {
    open: (opts) => ipcRenderer.invoke('layout:open', opts || {}),
    close: () => ipcRenderer.invoke('layout:close'),
    apply: (opts) => ipcRenderer.invoke('layout:apply', opts || {}),
    state: () => ipcRenderer.invoke('layout:state'),
    displays: () => ipcRenderer.invoke('layout:displays'),
  },
  update: {
    info: () => ipcRenderer.invoke('update:info'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    chooseDir: () => ipcRenderer.invoke('update:choose-dir'),
    openDir: () => ipcRenderer.invoke('update:open-dir'),
  },
});
