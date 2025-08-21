import { ipcMain, BrowserView, BrowserWindow } from 'electron';
import { solveCaptcha } from './solvecaptcha-wrapper.js';
import dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

/**
 * BMW 드라이빙 센터 자동화 모듈
 * 스케줄 페이지 직접 접근 방식으로 새로 구현
 */

// 로그인 상태 확인 및 처리
async function ensureLoggedIn(view, username, password) {
  try {
    // 현재 URL 확인
    const currentURL = view.webContents.getURL();
    console.log('현재 페이지:', currentURL);
    
    // OAuth 로그인 페이지로 리다이렉트 되었는지 확인
    if (currentURL.includes('oneid.bmw.co.kr') || currentURL.includes('customer.bmwgroup.com')) {
      console.log('로그인이 필요합니다. 로그인 프로세스 시작...');
      
      // 로그인 처리
      const loginResult = await performLogin(view, username, password);
      if (!loginResult.success) {
        return loginResult;
      }
    } else if (currentURL.includes('driving-center.bmw.co.kr')) {
      console.log('이미 로그인되어 있습니다.');
    }
    
    // 이미 로그인되어 있거나 로그인 완료
    return { success: true, message: '로그인 확인 완료' };
  } catch (error) {
    console.error('로그인 확인 중 오류:', error);
    return { success: false, message: error.message };
  }
}

// OAuth 로그인 처리
async function performLogin(view, username, password) {
  try {
    console.log('OAuth 로그인 시작...');
    const currentURL = view.webContents.getURL();
    console.log('로그인 페이지 URL:', currentURL);
    
    // 페이지 로드 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 이메일 입력
    const emailResult = await view.webContents.executeJavaScript(`
      (function() {
        // 이메일 입력 필드 찾기
        const emailInput = document.querySelector('input[type="email"], input[type="text"], input[name="username"], #username');
        if (emailInput && emailInput.offsetParent !== null) {
          console.log('이메일 필드 발견');
          emailInput.focus();
          emailInput.value = '${username}';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          // 다음/로그인 버튼 클릭
          setTimeout(() => {
            const nextBtn = document.querySelector('button[type="submit"], button.btn-next, button.btn-primary, button');
            if (nextBtn && !nextBtn.disabled) {
              console.log('다음 버튼 클릭:', nextBtn.textContent);
              nextBtn.click();
            }
          }, 500);
          return true;
        }
        console.log('이메일 필드를 찾을 수 없음');
        return false;
      })()
    `);
    
    // 비밀번호 입력 단계 대기
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 비밀번호 입력
    const passwordResult = await view.webContents.executeJavaScript(`
      (function() {
        const passwordInput = document.querySelector('input[type="password"], input[name="password"], #password');
        if (passwordInput && passwordInput.offsetParent !== null) {
          console.log('비밀번호 필드 발견');
          passwordInput.focus();
          passwordInput.value = '${password}';
          passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
          passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        console.log('비밀번호 필드를 찾을 수 없음');
        return false;
      })()
    `);
    
    if (!passwordResult) {
      console.log('비밀번호 필드를 찾을 수 없습니다.');
      return { success: false, message: '비밀번호 필드를 찾을 수 없습니다.' };
    }
    
    // 비밀번호 입력 후 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 로그인 버튼 클릭
    const buttonResult = await view.webContents.executeJavaScript(`
      (function() {
        // 모든 버튼 찾기
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        console.log('발견된 버튼 개수:', buttons.length);
        
        for (let btn of buttons) {
          const text = (btn.textContent || btn.value || '').trim();
          console.log('버튼 텍스트:', text, '타입:', btn.type, '비활성화:', btn.disabled);
          
          // 로그인 관련 텍스트를 포함하는 버튼 찾기
          if (!btn.disabled && (
            text.toLowerCase().includes('login') ||
            text.toLowerCase().includes('sign') ||
            text.includes('로그인') ||
            text.includes('확인') ||
            btn.type === 'submit'
          )) {
            console.log('로그인 버튼 클릭:', text);
            btn.click();
            return true;
          }
        }
        
        console.log('로그인 버튼을 찾을 수 없음');
        return false;
      })()
    `);
    
    // 로그인 성공 확인 (URL 변경 모니터링)
    console.log('로그인 처리 중... URL 변경 대기');
    
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const currentURL = view.webContents.getURL();
      console.log(`[${i+1}초] 현재 URL:`, currentURL);
      
      // 드라이빙 센터 페이지로 돌아왔으면 로그인 성공
      if (currentURL.includes('driving-center.bmw.co.kr') && 
          !currentURL.includes('customer.bmwgroup.com') &&
          !currentURL.includes('oneid.bmw.co.kr')) {
        console.log('✅ 로그인 성공!');
        return { success: true, message: '로그인 성공' };
      }
      
      // 3초 후부터 hCaptcha 체크 (로그인 버튼 클릭 후 나타날 수 있음)
      if (i === 3) {
        const captchaCheck = await view.webContents.executeJavaScript(`
          (function() {
            const hcaptchaIframe = document.querySelector('iframe[src*="hcaptcha.com"]:not([style*="display: none"])');
            const hcaptchaElement = document.querySelector('.h-captcha');
            
            if (hcaptchaIframe && hcaptchaIframe.offsetParent !== null) {
              // iframe이 실제로 보이는지 확인
              const rect = hcaptchaIframe.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                // sitekey 추출
                const src = hcaptchaIframe.src;
                const match = src.match(/sitekey=([^&]+)/);
                return {
                  hasCaptcha: true,
                  sitekey: match ? match[1] : null
                };
              }
            }
            return { hasCaptcha: false };
          })()
        `);
        
        if (captchaCheck.hasCaptcha) {
          console.log('⚠️ hCaptcha가 나타났습니다. 수동으로 해결해주세요.');
          // SolveCaptcha는 작동하지 않으므로 사용자가 수동으로 해결하도록 안내
          return { success: false, message: 'hCaptcha 인증이 필요합니다. 브라우저에서 직접 체크해주세요.', captcha: true };
        }
      }
    }
    
    // 15초 후에도 로그인이 완료되지 않음
    return { success: false, message: '로그인 시간 초과' };
    
  } catch (error) {
    console.error('로그인 중 오류:', error);
    return { success: false, message: error.message };
  }
}

// 프로그램 목록 파싱 (로그인 불필요)
async function parsePrograms(view) {
  try {
    console.log('프로그램 페이지로 이동...');
    // 프로그램 정보 페이지로 이동
    await view.webContents.loadURL('https://driving-center.bmw.co.kr/useAmount/view');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 프로그램 목록 파싱 - 더 정확한 방법
    const programs = await view.webContents.executeJavaScript(`
      (function() {
        const programs = [];
        const processedNames = new Set();
        
        // 페이지 전체 HTML 확인
        console.log('페이지 타이틀:', document.title);
        console.log('페이지 URL:', window.location.href);
        
        // 모든 테이블 찾기
        const tables = document.querySelectorAll('table');
        console.log('찾은 테이블 개수:', tables.length);
        
        if (tables.length === 0) {
          console.log('테이블이 없음! HTML 구조 확인:');
          console.log('body innerHTML 길이:', document.body.innerHTML.length);
          console.log('body 첫 500자:', document.body.innerHTML.substring(0, 500));
        }
        
        // 각 테이블 순회
        tables.forEach((table, tableIndex) => {
          console.log('=== 테이블', tableIndex, '분석 시작 ===');
          
          // 모든 행 가져오기
          const allRows = table.querySelectorAll('tr');
          console.log('총 행 개수:', allRows.length);
          
          let currentCategory = 'Unknown';
          let skipNextRows = 0; // rowspan 처리용
          
          allRows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length === 0) return;
            
            // 첫 번째 셀 내용
            const firstCell = cells[0];
            const cellText = firstCell.textContent.trim();
            
            console.log('행', rowIndex, '첫 셀:', cellText, '셀 개수:', cells.length);
            
            // 카테고리 헤더 체크 (th 태그 또는 특정 텍스트)
            if (firstCell.tagName === 'TH' || 
                cellText === 'Experience' || 
                cellText === 'Training' || 
                cellText === 'Owner' ||
                cellText === 'Test Drive' ||
                cellText === 'Off-Road' ||
                cellText === '프로그램') {
              if (cellText === 'Experience' || cellText === 'Training' || cellText === 'Owner' ||
                  cellText === 'Test Drive' || cellText === 'Off-Road') {
                currentCategory = cellText;
                console.log('>>> 카테고리 변경:', currentCategory);
              }
              return; // 헤더 행은 스킵
            }
            
            // 프로그램명 처리
            let programName = cellText;
            
            // 불필요한 정보 제거
            // 시간(분) 정보 제거: "90분" 등
            programName = programName.replace(/\\d+분/g, '').trim();
            // 금액 정보 제거: "550,000원" 등  
            programName = programName.replace(/[\\d,]+원/g, '').trim();
            // 연속 공백 제거
            programName = programName.replace(/\\s+/g, ' ').trim();
            
            // 유효성 검사
            if (!programName || 
                programName.length < 3 ||
                programName === '시간' || 
                programName === '금액' ||
                /^\\d+$/.test(programName)) {
              return;
            }
            
            // Junior 제외
            if (programName.includes('Junior') || programName.includes('주니어')) {
              console.log('Junior 프로그램 제외:', programName);
              return;
            }
            
            // rowspan 체크 (Taxi 등 여러 행에 걸친 프로그램)
            if (firstCell.hasAttribute('rowspan')) {
              const rowspanValue = parseInt(firstCell.getAttribute('rowspan'));
              console.log('>>> Rowspan 프로그램 발견:', programName, 'rowspan:', rowspanValue);
              skipNextRows = rowspanValue - 1; // 다음 행들은 스킵
            }
            
            // rowspan으로 인한 스킵
            if (skipNextRows > 0) {
              skipNextRows--;
              return;
            }
            
            // 중복 체크 및 추가
            if (!processedNames.has(programName)) {
              processedNames.add(programName);
              
              // 카테고리 추론 (현재 카테고리가 Unknown인 경우)
              if (currentCategory === 'Unknown') {
                if (programName.includes('M ') || programName.includes('M Town') || programName.includes('M Track')) {
                  currentCategory = 'Experience';
                } else if (programName.includes('Advanced') || programName.includes('어드밴스드')) {
                  currentCategory = 'Training';
                } else if (programName.includes('Taxi')) {
                  currentCategory = 'Owner';
                }
              }
              
              programs.push(programName);
              
              console.log('>>> 프로그램 추가:', programName, '카테고리:', currentCategory);
            }
          });
        });
        
        // 프로그램을 못 찾은 경우 페이지 텍스트에서 직접 검색
        if (programs.length === 0) {
          console.log('\\n=== 테이블에서 프로그램을 찾지 못함. 텍스트 패턴 매칭 시도 ===');
          
          const bodyText = document.body.innerText;
          console.log('페이지 텍스트 길이:', bodyText.length);
          
          // 알려진 BMW 프로그램 패턴들
          const knownPrograms = [
            'M Town Driving (KOR)',
            'M Town Driving (ENG)',
            'M Track Experience (KOR)',
            'M Track Experience (ENG)',
            'M Taxi Experience (KOR)',
            'M Taxi Experience (ENG)',
            'Driving Experience i4 M50 (KOR)',
            'Driving Experience i4 M50 (ENG)',
            'Advanced Course 1 (KOR)',
            'Advanced Course 1 (ENG)',
            'Advanced Course 2 (KOR)',
            'Advanced Course 2 (ENG)',
            'Track Day (KOR)',
            'Track Day (ENG)',
            'Taxi Program'
          ];
          
          knownPrograms.forEach(programName => {
            if (bodyText.includes(programName) && !programName.includes('Junior')) {
              if (!processedNames.has(programName)) {
                processedNames.add(programName);
                
                let category = 'Unknown';
                if (programName.includes('M ')) category = 'Experience';
                else if (programName.includes('Advanced')) category = 'Training';
                else if (programName.includes('Taxi')) category = 'Owner';
                else if (programName.includes('Track Day')) category = 'Training';
                
                programs.push(programName);
                
                console.log('>>> 텍스트에서 프로그램 발견:', programName);
              }
            }
          });
        }
        
        console.log('\\n=== 최종 파싱 결과 ===');
        console.log('총 프로그램 수:', programs.length);
        programs.forEach(p => console.log('-', p));
        
        return programs;
      })()
    `);
    
    console.log('파싱된 프로그램:', programs);
    return programs;
    
  } catch (error) {
    console.error('프로그램 파싱 중 오류:', error);
    return [];
  }
}

// 예약 가능 여부 확인
async function checkAvailability(view, selectedPrograms) {
  try {
    const availability = await view.webContents.executeJavaScript(`
      (function() {
        const results = [];
        const programs = ${JSON.stringify(selectedPrograms)};
        
        // 각 프로그램에 대해 예약 가능 여부 확인
        programs.forEach(program => {
          // 프로그램별 예약 가능 날짜 확인
          const availableDates = document.querySelectorAll(
            '.calendar-day[data-program="' + program.id + '"]:not(.disabled), ' +
            '.schedule-slot[data-program="' + program.id + '"].available'
          );
          
          if (availableDates.length > 0) {
            availableDates.forEach(slot => {
              const date = slot.getAttribute('data-date') || slot.querySelector('.date')?.textContent;
              const time = slot.getAttribute('data-time') || slot.querySelector('.time')?.textContent;
              
              results.push({
                program: program.name,
                date: date,
                time: time,
                available: true
              });
            });
          }
        });
        
        // 일반적인 예약 가능 슬롯 확인 (프로그램 구분 없이)
        if (results.length === 0) {
          const generalSlots = document.querySelectorAll('.available-slot, .can-reserve, [class*="available"]');
          generalSlots.forEach(slot => {
            const text = slot.textContent || '';
            if (text && !text.includes('마감') && !text.includes('불가')) {
              results.push({
                program: 'Unknown',
                available: true,
                element: slot.className
              });
            }
          });
        }
        
        return {
          hasAvailability: results.length > 0,
          count: results.length,
          slots: results
        };
      })()
    `);
    
    return availability;
    
  } catch (error) {
    console.error('예약 가능 여부 확인 중 오류:', error);
    return { hasAvailability: false, count: 0, slots: [] };
  }
}

// BrowserView 가져오기 헬퍼 함수
function getActiveBrowserView() {
  // global.activeBrowserView 또는 global.browserViews에서 활성 뷰 가져오기
  if (global.activeBrowserView) {
    return global.activeBrowserView;
  }
  
  // browserViews Map에서 활성 뷰 찾기
  if (global.browserViews && global.activeBrowserViewId) {
    return global.browserViews.get(global.activeBrowserViewId);
  }
  
  return null;
}

// IPC 핸들러 등록

// 로그인 및 초기화
ipcMain.handle('bmw:initialize', async (event, { username, password }) => {
  // BrowserView가 없으면 생성
  let view = getActiveBrowserView();
  
  if (!view) {
    console.log('BrowserView가 없음. 새로 생성...');
    
    // Electron 모듈은 이미 import됨
    
    // 메인 윈도우 찾기
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      return { success: false, message: 'No main window found' };
    }
    
    // 새 BrowserView 생성
    const id = Date.now().toString();
    view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:bmw'
      }
    });
    
    mainWindow.setBrowserView(view);
    
    const bounds = mainWindow.getContentBounds();
    view.setBounds({ 
      x: Math.floor(bounds.width / 2), 
      y: 40,
      width: Math.floor(bounds.width / 2), 
      height: bounds.height - 40
    });
    
    view.setAutoResize({ width: true, height: true });
    
    // global 변수 업데이트
    if (!global.browserViews) {
      global.browserViews = new Map();
    }
    global.browserViews.set(id, view);
    global.activeBrowserViewId = id;
    global.activeBrowserView = view;
    
    console.log('BrowserView 생성 완료');
  }
  
  try {
    // 스케줄 페이지로 이동 시도
    console.log('스케줄 페이지로 이동 시도...');
    
    // 페이지가 로드되거나 리다이렉트될 때까지 대기
    const navigationResult = await new Promise((resolve) => {
      let resolved = false;
      let hasError = false;
      
      // did-navigate 이벤트 리스너 (리다이렉트 포함)
      const handleNavigate = (event, url) => {
        if (!resolved) {
          console.log('페이지 이동 완료:', url);
          resolved = true;
          view.webContents.off('did-navigate', handleNavigate);
          view.webContents.off('did-fail-load', handleFailLoad);
          resolve({ success: true, url: url });
        }
      };
      
      // did-fail-load 이벤트 리스너 (ERR_ABORTED 무시)
      const handleFailLoad = (event, errorCode, errorDescription, validatedURL) => {
        if (errorCode === -3) { // ERR_ABORTED
          console.log('리다이렉트 감지, 대기 중...');
          // ERR_ABORTED는 무시하고 계속 대기
          hasError = false; // 에러로 처리하지 않음
        } else if (!resolved) {
          console.error('페이지 로드 실패:', errorDescription);
          hasError = true;
          resolved = true;
          view.webContents.off('did-navigate', handleNavigate);
          view.webContents.off('did-fail-load', handleFailLoad);
          resolve({ success: false, error: errorDescription });
        }
      };
      
      view.webContents.on('did-navigate', handleNavigate);
      view.webContents.on('did-fail-load', handleFailLoad);
      
      // 페이지 네비게이션 시작 (catch로 에러 무시)
      view.webContents.loadURL('https://driving-center.bmw.co.kr/orders/programs/schedules/view')
        .catch(err => {
          // 모든 에러 무시 (리다이렉트로 인한 ERR_ABORTED 포함)
          console.log('네비게이션 시작, 리다이렉트 대기 중...');
        });
      
      // 타임아웃 설정 (5초)
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          view.webContents.off('did-navigate', handleNavigate);
          view.webContents.off('did-fail-load', handleFailLoad);
          const currentUrl = view.webContents.getURL();
          resolve({ success: true, url: currentUrl });
        }
      }, 5000);
    });
    
    // 네비게이션 실패한 경우 (ERR_ABORTED 제외)
    if (!navigationResult.success && navigationResult.error && !navigationResult.error.includes('ERR_ABORTED')) {
      return { success: false, message: navigationResult.error };
    }
    
    // 추가 대기 (페이지 완전 로드)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 로그인 확인 및 처리
    const loginResult = await ensureLoggedIn(view, username, password);
    if (!loginResult.success) {
      return loginResult;
    }
    
    // 로그인 성공 후 스케줄 페이지로 이동
    console.log('로그인 성공, 스케줄 페이지로 이동...');
    await view.webContents.loadURL('https://driving-center.bmw.co.kr/orders/programs/schedules/view');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      message: '로그인 및 초기화 완료'
    };
    
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 예약 모니터링
ipcMain.handle('bmw:monitor', async (event, { selectedPrograms }) => {
  const view = getActiveBrowserView();
  if (!view) return { success: false, message: 'No active browser view' };
  
  try {
    // 현재 페이지가 스케줄 페이지인지 확인
    const currentURL = view.webContents.getURL();
    if (!currentURL.includes('schedules/view')) {
      await view.webContents.loadURL('https://driving-center.bmw.co.kr/orders/programs/schedules/view');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // 페이지 새로고침 (최신 데이터 확인)
    await view.webContents.reload();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 예약 가능 여부 확인
    const availability = await checkAvailability(view, selectedPrograms);
    
    return {
      success: true,
      ...availability
    };
    
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 페이지 네비게이션
ipcMain.handle('bmw:navigate', async (event, { url }) => {
  const view = getActiveBrowserView();
  if (!view) return { success: false, message: 'No active browser view' };
  
  try {
    await view.webContents.loadURL(url);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      currentURL: view.webContents.getURL()
    };
    
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 프로그램 목록만 가져오기 (로그인 불필요)
ipcMain.handle('bmw:fetch-programs-only', async (event) => {
  try {
    
    // 임시 BrowserView 생성 (화면에 표시 안함)
    const tempView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    console.log('임시 BrowserView로 프로그램 목록 가져오기...');
    
    // 프로그램 페이지 직접 로드 (로그인 불필요)
    await tempView.webContents.loadURL('https://driving-center.bmw.co.kr/useAmount/view');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 페이지에서 직접 프로그램 파싱
    const programs = await tempView.webContents.executeJavaScript(`
      (function() {
        try {
          const programs = [];
          const processedNames = new Set();
          
          // chargeCont2 (Junior Campus) 영역 제외
          const chargeCont2 = document.querySelector('#chargeCont2') || 
                             document.querySelector('.chargeCont2') || 
                             document.querySelector('[id*="chargeCont2"]');
          
          // 모든 테이블 찾기
          const allTables = document.querySelectorAll('table');
          const tablesToParse = [];
          
          for (let table of allTables) {
            // chargeCont2 안에 있는 테이블은 제외
            if (chargeCont2 && chargeCont2.contains(table)) {
              console.log('Junior Campus 영역 테이블 제외');
              continue;
            }
            tablesToParse.push(table);
          }
          
          console.log('파싱할 테이블 개수:', tablesToParse.length);
          
          let currentCategory = null;
          
          for (let tableIndex = 0; tableIndex < tablesToParse.length; tableIndex++) {
            const table = tablesToParse[tableIndex];
            const rows = table.querySelectorAll('tr');
            let isInRowspan = false;
            let rowspanCount = 0;
            
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
              const row = rows[rowIndex];
              const cells = row.querySelectorAll('td');
              if (cells.length === 0) continue;
              
              // 첫 번째 셀 확인
              const firstCell = cells[0];
              const cellText = (firstCell.textContent || '').trim();
              
              // 카테고리 행인지 확인 (보통 colspan을 가짐)
              if (firstCell.hasAttribute && firstCell.hasAttribute('colspan') && cells.length === 1) {
                // 단일 셀이고 colspan이 있으면 카테고리일 가능성 높음
                if (cellText && !cellText.includes('프로그램') && !cellText.includes('시간')) {
                  currentCategory = cellText;
                  console.log('>>> 카테고리 감지:', currentCategory);
                }
                continue;
              }
              
              // 헤더 행 스킵 (프로그램, 시간, 금액 등)
              if (cells.length >= 3) {
                let isHeader = false;
                for (let cell of cells) {
                  const text = (cell.textContent || '').trim();
                  if (text === '프로그램' || text === '시간' || text === '금액') {
                    isHeader = true;
                    break;
                  }
                }
                if (isHeader) {
                  console.log('헤더 행 스킵');
                  continue;
                }
              }
              
              // rowspan 처리
              if (isInRowspan && rowspanCount > 0) {
                rowspanCount--;
                if (rowspanCount === 0) {
                  isInRowspan = false;
                }
                console.log('Rowspan 영역 내 행 스킵 (남은 카운트:', rowspanCount, ')');
                continue;
              }
              
              // 첫 번째 셀이 rowspan을 가지고 있는지 확인
              if (firstCell.hasAttribute && firstCell.hasAttribute('rowspan')) {
                const rowspanValue = parseInt(firstCell.getAttribute('rowspan') || '1');
                if (rowspanValue > 1) {
                  isInRowspan = true;
                  rowspanCount = rowspanValue - 1;
                }
                
                // rowspan 셀의 텍스트가 프로그램명
                let programName = cellText;
                
                // 빈 텍스트, 숫자만 있는 경우, 시간/금액 정보는 스킵
                if (!programName || 
                    /^\\d+$/.test(programName) || 
                    /^\\d+분$/.test(programName) || 
                    /^[\\d,]+원$/.test(programName)) {
                  continue;
                }
                
                // Junior 제외
                if (programName.includes('Junior') || programName.includes('주니어')) {
                  console.log('Junior 프로그램 제외:', programName);
                  continue;
                }
                
                // 시간과 금액 정보 제거
                programName = programName.replace(/\\d+분/g, '').replace(/[\\d,]+원/g, '').trim();
                
                if (programName && programName.length >= 2 && !processedNames.has(programName)) {
                  processedNames.add(programName);
                  
                  programs.push(programName);
                  
                  console.log('프로그램 추가 (rowspan):', programName, '카테고리:', currentCategory);
                }
              } else if (!isInRowspan) {
                // rowspan이 없는 일반 행
                let programName = cellText;
                
                // 빈 텍스트, 숫자만, 시간/금액 정보는 스킵
                if (!programName || 
                    /^\\d+$/.test(programName) || 
                    /^\\d+분$/.test(programName) || 
                    /^[\\d,]+원$/.test(programName)) {
                  continue;
                }
                
                // Junior 제외
                if (programName.includes('Junior') || programName.includes('주니어')) {
                  console.log('Junior 프로그램 제외:', programName);
                  continue;
                }
                
                // 시간과 금액 정보 제거
                programName = programName.replace(/\\d+분/g, '').replace(/[\\d,]+원/g, '').trim();
                
                if (programName && programName.length >= 2 && !processedNames.has(programName)) {
                  processedNames.add(programName);
                  
                  programs.push(programName);
                  
                  console.log('프로그램 추가:', programName, '카테고리:', currentCategory);
                }
              }
            }
          }
          
          console.log('\\n최종 파싱 결과:');
          console.log('프로그램 수:', programs.length);
          for (let p of programs) {
            console.log('-', p);
          }
          
          return programs;
        } catch (error) {
          console.error('파싱 중 오류:', error);
          return [];
        }
      })()
    `);
    
    // 임시 BrowserView 정리
    tempView.webContents.destroy();
    
    console.log('프로그램 파싱 완료:', programs.length, '개');
    
    return {
      success: true,
      programs: programs
    };
  } catch (error) {
    console.error('프로그램 목록 가져오기 실패:', error);
    return { success: false, message: error.message, programs: [] };
  }
});

export { ensureLoggedIn, parsePrograms, checkAvailability };