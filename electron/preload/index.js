const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  browser: {
    createTab: (url) => ipcRenderer.invoke('browser:create-tab', url),
    switchTab: (id) => ipcRenderer.invoke('browser:switch-tab', id),
    closeTab: (id) => ipcRenderer.invoke('browser:close-tab', id),
    navigate: (data) => ipcRenderer.invoke('browser:navigate', data),
    goBack: (id) => ipcRenderer.invoke('browser:go-back', id),
    goForward: (id) => ipcRenderer.invoke('browser:go-forward', id),
    reload: (id) => ipcRenderer.invoke('browser:reload', id),
    
    onUrlChanged: (callback) => {
      ipcRenderer.on('browser:url-changed', (event, data) => callback(data));
    },
    onTitleChanged: (callback) => {
      ipcRenderer.on('browser:title-changed', (event, data) => callback(data));
    },
    onLoadingState: (callback) => {
      ipcRenderer.on('browser:loading-state', (event, data) => callback(data));
    }
  },
  
  bmw: {
    analyzeSite: () => ipcRenderer.invoke('bmw:analyze-site'),
    autoLogin: (credentials) => ipcRenderer.invoke('bmw:auto-login', credentials),
    checkReservation: (programs) => ipcRenderer.invoke('bmw:check-reservation', programs),
    fetchPrograms: () => ipcRenderer.invoke('bmw:fetch-programs'),
    onAnalysisProgress: (callback) => {
      ipcRenderer.on('bmw:analysis-progress', (event, data) => callback(data));
    },
    onProgramsUpdated: (callback) => {
      ipcRenderer.on('bmw:programs-updated', (event, data) => callback(data));
    }
  }
});