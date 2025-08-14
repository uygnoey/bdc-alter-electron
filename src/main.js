const { app, BrowserWindow } = require('electron');
const path = require('path');

// Keep a global reference of the window object / 윈도우 객체의 전역 참조 유지
let mainWindow;

function createWindow() {
  // Create the browser window / 브라우저 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true // Enable webview tag / webview 태그 활성화
    }
  });

  // Load the index.html file / index.html 파일 로드
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools (optional) / 개발자 도구 열기 (선택사항)
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed / 윈도우가 닫힐 때 발생
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
// Electron이 초기화를 완료했을 때 호출됨
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when dock icon is clicked
    // macOS에서 독 아이콘 클릭 시 윈도우 재생성
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed / 모든 윈도우가 닫힐 때 종료
app.on('window-all-closed', () => {
  // On macOS, keep application active until explicit quit
  // macOS에서는 명시적으로 종료할 때까지 앱 유지
  if (process.platform !== 'darwin') {
    app.quit();
  }
});