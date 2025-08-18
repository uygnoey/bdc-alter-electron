import { ipcMain } from 'electron';

/**
 * Electron BrowserView Automation
 * Selenium 대신 Electron의 webContents API를 사용한 자동화
 */

// BMW 드라이빙 센터 로그인 자동화
ipcMain.handle('bmw:login', async (event, { username, password }) => {
  const view = global.activeBrowserView; // 현재 활성 BrowserView
  if (!view) return { success: false, message: 'No active browser view' };

  try {
    // BMW 드라이빙 센터 로그인 페이지로 이동
    await view.webContents.loadURL('https://www.bmw-driving-center.co.kr/login');
    
    // 페이지 로드 완료 대기
    await new Promise(resolve => {
      view.webContents.once('did-finish-load', resolve);
    });

    // JavaScript를 실행하여 로그인 폼 작성
    // 일반 사용자의 타이핑을 시뮬레이션
    const loginScript = `
      async function humanLogin() {
        // 랜덤 지연 함수 (사람처럼 보이기 위해)
        const delay = (min, max) => new Promise(resolve => 
          setTimeout(resolve, Math.random() * (max - min) + min)
        );

        // 타이핑 시뮬레이션
        async function typeText(element, text) {
          element.focus();
          for (let char of text) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(50, 150); // 타이핑 속도 랜덤화
          }
        }

        // 사용자명 입력
        const usernameField = document.querySelector('#username, input[name="username"], input[type="email"]');
        if (usernameField) {
          await typeText(usernameField, '${username}');
          await delay(500, 1000);
        }

        // 비밀번호 입력
        const passwordField = document.querySelector('#password, input[name="password"], input[type="password"]');
        if (passwordField) {
          await typeText(passwordField, '${password}');
          await delay(500, 1000);
        }

        // 로그인 버튼 클릭
        const loginButton = document.querySelector('button[type="submit"], input[type="submit"], .login-button');
        if (loginButton) {
          // 마우스 이동 시뮬레이션
          loginButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          await delay(100, 300);
          loginButton.click();
        }

        return { success: true };
      }

      humanLogin();
    `;

    await view.webContents.executeJavaScript(loginScript);
    
    // 로그인 성공 확인 (URL 변경 감지)
    return new Promise((resolve) => {
      const checkLogin = setInterval(() => {
        const currentURL = view.webContents.getURL();
        if (currentURL.includes('mypage') || currentURL.includes('reservation')) {
          clearInterval(checkLogin);
          resolve({ success: true, message: '로그인 성공' });
        }
      }, 1000);

      // 30초 타임아웃
      setTimeout(() => {
        clearInterval(checkLogin);
        resolve({ success: false, message: '로그인 시간 초과' });
      }, 30000);
    });

  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 예약 가능 여부 확인
ipcMain.handle('bmw:check-availability', async (event) => {
  const view = global.activeBrowserView;
  if (!view) return { available: false };

  try {
    // 예약 페이지로 이동
    await view.webContents.loadURL('https://www.bmw-driving-center.co.kr/reservation');
    
    await new Promise(resolve => {
      view.webContents.once('did-finish-load', resolve);
    });

    // 예약 가능한 슬롯 확인
    const result = await view.webContents.executeJavaScript(`
      (function() {
        const availableSlots = document.querySelectorAll('.calendar-day.available:not(.disabled)');
        const slots = [];
        
        availableSlots.forEach(slot => {
          const date = slot.getAttribute('data-date');
          const program = slot.querySelector('.program-name')?.textContent;
          const time = slot.querySelector('.time-slot')?.textContent;
          
          if (date) {
            slots.push({ date, program, time });
          }
        });
        
        return {
          available: slots.length > 0,
          count: slots.length,
          slots: slots
        };
      })()
    `);

    return result;
  } catch (error) {
    return { available: false, error: error.message };
  }
});

// 페이지 내용 모니터링
ipcMain.handle('bmw:monitor-page', async (event) => {
  const view = global.activeBrowserView;
  if (!view) return;

  // 페이지 변경 감지
  view.webContents.on('did-navigate', (event, url) => {
    mainWindow.webContents.send('bmw:page-changed', { url });
  });

  // 콘솔 메시지 캡처 (디버깅용)
  view.webContents.on('console-message', (event, level, message) => {
    mainWindow.webContents.send('bmw:console-log', { level, message });
  });
});