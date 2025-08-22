import { ipcMain, BrowserView, BrowserWindow } from 'electron';
import { solveCaptcha } from './solvecaptcha-wrapper.js';
import dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

/**
 * BMW 드라이빙 센터 자동화 모듈
 * 스케줄 페이지 직접 접근 방식으로 새로 구현
 */


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

// 예약 가능 여부 확인 (BMW 스케줄 페이지용)
async function checkAvailability(view, selectedPrograms) {
  try {
    console.log('📅 예약 가능 여부 확인 시작...');
    console.log('선택된 프로그램:', selectedPrograms);
    
    // 스케줄 페이지에 도착했는지 확인
    const currentURL = view.webContents.getURL();
    if (!currentURL.includes('schedules/view')) {
      console.log('스케줄 페이지가 아닙니다. 이동 중...');
      await view.webContents.loadURL('https://driving-center.bmw.co.kr/orders/programs/schedules/view');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // 1. 캘린더에서 예약 가능한 날짜들 찾기
    const availableDates = await view.webContents.executeJavaScript(`
      (function() {
        const dates = [];
        // disabled가 아닌 날짜 버튼들 찾기
        const buttons = document.querySelectorAll('#calendarBody button.calendarDateBtn:not([disabled])');
        
        console.log('예약 가능한 날짜 버튼 개수:', buttons.length);
        
        buttons.forEach(btn => {
          const date = btn.textContent.trim();
          const dayCode = btn.getAttribute('day-code');
          dates.push({
            date: date,
            dayCode: dayCode
          });
        });
        
        return dates;
      })()
    `);
    
    console.log('예약 가능한 날짜들:', availableDates);
    
    if (availableDates.length === 0) {
      return {
        hasAvailability: false,
        message: '이번 달에 예약 가능한 날짜가 없습니다.',
        count: 0,
        slots: [],
        availableDates: [],
        timestamp: new Date().toISOString()
      };
    }
    
    // 2. 각 날짜를 순회하며 프로그램 정보 수집
    const allProgramsInfo = [];
    
    for (const dateInfo of availableDates) {
      console.log(`\n📆 ${dateInfo.date}일 확인 중...`);
      
      // 날짜 클릭
      await view.webContents.executeJavaScript(`
        (function() {
          const btn = Array.from(document.querySelectorAll('#calendarBody button.calendarDateBtn:not([disabled])')).find(b => 
            b.textContent.trim() === '${dateInfo.date}'
          );
          if (btn) {
            console.log('날짜 버튼 클릭:', '${dateInfo.date}');
            btn.click();
            return true;
          }
          return false;
        })()
      `);
      
      // 데이터 로드 대기
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 해당 날짜의 프로그램 정보 파싱
      const programsForDate = await view.webContents.executeJavaScript(`
        (function() {
          const programs = [];
          const selectedPrograms = ${JSON.stringify(selectedPrograms)};
          
          console.log('선택된 프로그램 목록:', selectedPrograms);
          console.log('페이지 내용 확인 중...');
          
          // 프로그램 정보가 표시되는 영역 찾기
          // 1. 테이블 구조로 시도
          const tables = document.querySelectorAll('table');
          console.log('테이블 개수:', tables.length);
          
          tables.forEach((table, idx) => {
            const rows = table.querySelectorAll('tr');
            console.log('테이블 ' + idx + '의 행 개수:', rows.length);
            
            rows.forEach(row => {
              const text = row.textContent || '';
              
              // 선택된 프로그램 이름이 포함되어 있는지 확인
              selectedPrograms.forEach(programName => {
                if (text.includes(programName)) {
                  // 시간 정보 찾기 (예: 09:00, 14:00 등)
                  const timeMatch = text.match(/\\d{2}:\\d{2}/);
                  const time = timeMatch ? timeMatch[0] : '';
                  
                  // 남은 자리 정보 찾기 (예: 5명, 10석 등)
                  const seatsMatch = text.match(/(\\d+)[명석]/);
                  const seats = seatsMatch ? seatsMatch[1] : '';
                  
                  // 마감 여부 확인
                  const isClosed = text.includes('마감') || text.includes('종료') || text.includes('불가');
                  
                  if (!isClosed) {
                    programs.push({
                      name: programName,
                      date: '${dateInfo.date}',
                      time: time,
                      remainingSeats: seats,
                      available: true,
                      fullText: text.substring(0, 200) // 디버깅용
                    });
                    console.log('프로그램 발견:', programName, '날짜:', '${dateInfo.date}', '시간:', time);
                  }
                }
              });
            });
          });
          
          // 2. 리스트 구조로도 시도
          if (programs.length === 0) {
            const listItems = document.querySelectorAll('li, div[class*="item"], div[class*="program"], div[class*="schedule"]');
            console.log('리스트 아이템 개수:', listItems.length);
            
            listItems.forEach(item => {
              const text = item.textContent || '';
              
              selectedPrograms.forEach(programName => {
                if (text.includes(programName) && !text.includes('마감')) {
                  programs.push({
                    name: programName,
                    date: '${dateInfo.date}',
                    available: true,
                    element: item.tagName.toLowerCase(),
                    fullText: text.substring(0, 200)
                  });
                }
              });
            });
          }
          
          // 중복 제거
          const uniquePrograms = [];
          const seen = new Set();
          programs.forEach(p => {
            const key = p.name + p.date + p.time;
            if (!seen.has(key)) {
              seen.add(key);
              uniquePrograms.push(p);
            }
          });
          
          console.log('${dateInfo.date}일 파싱 결과:', uniquePrograms.length, '개 프로그램');
          return uniquePrograms;
        })()
      `);
      
      // 결과 저장
      if (programsForDate.length > 0) {
        allProgramsInfo.push({
          date: dateInfo.date,
          dayCode: dateInfo.dayCode,
          programs: programsForDate
        });
      }
      
      console.log(`${dateInfo.date}일: ${programsForDate.length}개 프로그램 발견`);
    }
    
    // 3. 전체 결과 정리
    const totalPrograms = allProgramsInfo.reduce((sum, day) => sum + day.programs.length, 0);
    
    return {
      hasAvailability: totalPrograms > 0,
      message: totalPrograms > 0 
        ? `총 ${totalPrograms}개의 예약 가능한 프로그램을 찾았습니다!` 
        : '선택한 프로그램이 예약 가능한 날짜에 없습니다.',
      count: totalPrograms,
      slots: allProgramsInfo,
      availableDates: availableDates,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('예약 확인 중 오류:', error);
    return { 
      hasAvailability: false, 
      count: 0, 
      slots: [],
      error: error.message,
      timestamp: new Date().toISOString()
    };
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
    // 스케줄 페이지로 직접 이동 시도
    console.log('🚀 BMW 드라이빙 센터 초기화 시작...');
    
    // 스케줄 페이지로 바로 이동 (로그인 필요시 자동 리다이렉트됨)
    await view.webContents.loadURL('https://driving-center.bmw.co.kr/orders/programs/schedules/view')
      .catch(err => {
        // ERR_ABORTED 등의 리다이렉트 오류는 무시
        console.log('페이지 이동 중... (리다이렉트 가능)');
      });
    
    // 페이지 로드 대기
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 현재 URL 확인
    let currentUrl = view.webContents.getURL();
    console.log('현재 페이지:', currentUrl);
    
    // 로그인 페이지로 리다이렉트 되었는지 확인
    if (currentUrl.includes('oneid.bmw.co.kr') || currentUrl.includes('customer.bmwgroup.com')) {
      console.log('🔐 로그인이 필요합니다. 자동 로그인 시작...');
      
      // 로그인 처리
      const loginResult = await performLogin(view, username, password);
      if (!loginResult.success) {
        console.error('❌ 로그인 실패:', loginResult.message);
        return loginResult;
      }
      
      console.log('✅ 로그인 성공!');
      
      // 로그인 성공 후 대기 (리다이렉트 처리)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 현재 URL 다시 확인
      currentUrl = view.webContents.getURL();
      console.log('로그인 후 페이지:', currentUrl);
      
      // 메인 페이지나 다른 페이지로 갔다면 스케줄 페이지로 강제 이동
      if (!currentUrl.includes('schedules/view')) {
        console.log('📅 스케줄 페이지로 이동 중...');
        await view.webContents.loadURL('https://driving-center.bmw.co.kr/orders/programs/schedules/view')
          .catch(err => {
            console.log('스케줄 페이지 이동 중...');
          });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } else if (currentUrl.includes('driving-center.bmw.co.kr')) {
      console.log('✅ 이미 로그인되어 있습니다.');
      
      // 스케줄 페이지가 아니면 이동
      if (!currentUrl.includes('schedules/view')) {
        console.log('📅 스케줄 페이지로 이동 중...');
        await view.webContents.loadURL('https://driving-center.bmw.co.kr/orders/programs/schedules/view')
          .catch(err => {
            console.log('스케줄 페이지 이동 중...');
          });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 최종 확인
    currentUrl = view.webContents.getURL();
    if (currentUrl.includes('schedules/view')) {
      console.log('✅ 스케줄 페이지 도착!');
      return {
        success: true,
        message: '초기화 완료'
      };
    } else {
      console.log('⚠️ 스케줄 페이지 이동 실패. 현재:', currentUrl);
      return {
        success: false,
        message: '스케줄 페이지로 이동할 수 없습니다'
      };
    }
    
  } catch (error) {
    console.error('❌ 초기화 중 오류:', error);
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

export { parsePrograms, checkAvailability };