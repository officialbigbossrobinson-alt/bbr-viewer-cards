// First-run window only: a small, fixed set of calls to the app (no Node in the page).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bbr', { call: (action, args) => ipcRenderer.invoke('fr', action, args || {}) });
