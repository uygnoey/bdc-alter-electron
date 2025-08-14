const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// 렌더러 프로세스에서 사용할 수 있는 보호된 메서드 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any API methods you want to expose / 노출하고 싶은 API 메서드 추가
  platform: process.platform,
  
  // Example: Send message to main process / 예시: 메인 프로세스에 메시지 전송
  sendMessage: (channel, data) => {
    const validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  // Example: Receive message from main process / 예시: 메인 프로세스에서 메시지 수신
  onMessage: (channel, func) => {
    const validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});