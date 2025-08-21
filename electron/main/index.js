import { app, BrowserWindow, BrowserView, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import SolveCaptcha from './solvecaptcha-wrapper.js';
import dotenv from 'dotenv';
import { fetchBMWPrograms } from './bmw-programs-parser.js';
import './browser-automation.js'; // 새로운 자동화 모듈 import

// .env 파일 로드
dotenv.config();

// SolveCaptcha 초기화
const solver = process.env.SOLVECAPTCHA_API_KEY ? new SolveCaptcha.Solver(process.env.SOLVECAPTCHA_API_KEY) : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let browserViews = new Map();
let activeBrowserViewId = null;

// global 변수 설정 (browser-automation.js에서 사용)
global.browserViews = browserViews;
global.activeBrowserViewId = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
  
  // 초기에는 아무것도 띄우지 않음 - 모니터링 시작할 때 띄움

  mainWindow.on('closed', () => {
    browserViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.destroy();
      }
    });
    browserViews.clear();
    mainWindow = null;
  });
  
  mainWindow.on('resize', () => {
    const view = browserViews.get(activeBrowserViewId);
    if (view && mainWindow) {
      const bounds = mainWindow.getContentBounds();
      view.setBounds({ 
        x: bounds.width / 2, 
        y: 100,
        width: bounds.width / 2, 
        height: bounds.height - 100
      });
    }
  });
}

ipcMain.handle('browser:create-tab', async (event, url) => {
  const id = Date.now().toString();
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:browsing'
    }
  });

  mainWindow.addBrowserView(view);
  
  const bounds = mainWindow.getContentBounds();
  view.setBounds({ 
    x: bounds.width / 2, 
    y: 40,  // 탭 바 높이만 고려
    width: bounds.width / 2, 
    height: bounds.height - 40  // 전체 높이에서 탭 바 높이만 뺌
  });
  
  view.setAutoResize({ width: true, height: true });
  view.webContents.loadURL(url);
  
  browserViews.set(id, view);
  activeBrowserViewId = id;
  
  // global 변수 업데이트
  global.browserViews = browserViews;
  global.activeBrowserViewId = id;
  global.activeBrowserView = view;

  view.webContents.on('did-navigate', (event, url) => {
    mainWindow.webContents.send('browser:url-changed', { id, url });
  });

  view.webContents.on('page-title-updated', (event, title) => {
    mainWindow.webContents.send('browser:title-changed', { id, title });
  });

  view.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('browser:loading-state', { id, loading: true });
  });

  view.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('browser:loading-state', { id, loading: false });
  });

  return { id, url };
});

ipcMain.handle('browser:switch-tab', async (event, id) => {
  if (!browserViews.has(id)) return false;

  browserViews.forEach((view, viewId) => {
    if (viewId === id) {
      mainWindow.setBrowserView(view);
      const bounds = mainWindow.getContentBounds();
      view.setBounds({ 
        x: bounds.width / 2, 
        y: 100,
        width: bounds.width / 2, 
        height: bounds.height - 100
      });
    }
  });

  activeBrowserViewId = id;
  
  // global 변수 업데이트
  global.activeBrowserViewId = id;
  global.activeBrowserView = browserViews.get(id);
  
  return true;
});

ipcMain.handle('browser:close-tab', async (event, id) => {
  const view = browserViews.get(id);
  if (!view) return false;

  mainWindow.removeBrowserView(view);
  if (view.webContents && !view.webContents.isDestroyed()) {
    view.webContents.destroy();
  }
  browserViews.delete(id);

  if (activeBrowserViewId === id) {
    const remainingIds = Array.from(browserViews.keys());
    if (remainingIds.length > 0) {
      const newActiveId = remainingIds[remainingIds.length - 1];
      const newView = browserViews.get(newActiveId);
      if (newView) {
        mainWindow.setBrowserView(newView);
        const bounds = mainWindow.getContentBounds();
        newView.setBounds({ 
          x: bounds.width / 2, 
          y: 100,
          width: bounds.width / 2, 
          height: bounds.height - 100
        });
        activeBrowserViewId = newActiveId;
      }
    } else {
      // 모든 탭이 닫히면 빈 화면 표시
      activeBrowserViewId = null;
      
      // 빈 뷰 생성하여 기본 메시지 숨기기
      const emptyView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      
      mainWindow.setBrowserView(emptyView);
      const bounds = mainWindow.getContentBounds();
      emptyView.setBounds({ 
        x: Math.floor(bounds.width / 2), 
        y: 40,
        width: Math.floor(bounds.width / 2), 
        height: bounds.height - 40
      });
      
      // BMW 스타일의 빈 페이지
      emptyView.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 0;
              height: 100vh;
              background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .container {
              text-align: center;
              color: #333;
            }
            .logo {
              width: 80px;
              height: 80px;
              margin: 0 auto 20px;
              background: linear-gradient(45deg, #0066b2, #003d6b);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 36px;
              font-weight: bold;
            }
            h2 {
              margin: 10px 0;
              font-size: 24px;
              font-weight: 600;
            }
            p {
              color: #666;
              font-size: 14px;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">BMW</div>
            <h2>BMW 드라이빙 센터</h2>
            <p>좌측 패널에서 로그인 후<br>프로그램을 선택하세요</p>
          </div>
        </body>
        </html>
      `));
    }
  }

  return true;
});

ipcMain.handle('browser:navigate', async (event, { id, url }) => {
  const view = browserViews.get(id || activeBrowserViewId);
  if (!view) return false;

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  view.webContents.loadURL(url);
  return true;
});

ipcMain.handle('browser:go-back', async (event, id) => {
  const view = browserViews.get(id || activeBrowserViewId);
  if (view && view.webContents.canGoBack()) {
    view.webContents.goBack();
    return true;
  }
  return false;
});

ipcMain.handle('browser:go-forward', async (event, id) => {
  const view = browserViews.get(id || activeBrowserViewId);
  if (view && view.webContents.canGoForward()) {
    view.webContents.goForward();
    return true;
  }
  return false;
});

ipcMain.handle('browser:reload', async (event, id) => {
  const view = browserViews.get(id || activeBrowserViewId);
  if (view) {
    view.webContents.reload();
    return true;
  }
  return false;
});


app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// BMW 드라이빙 센터 자동화 기능
ipcMain.handle('bmw:analyze-site', async (event) => {
  const view = browserViews.get(activeBrowserViewId);
  if (!view) return { error: 'No active browser view' };

  try {
    // 분석 시작 알림
    mainWindow.webContents.send('bmw:analysis-progress', {
      step: 'start',
      message: 'BMW 드라이빙 센터 사이트로 이동 중...'
    });
    
    // BMW 드라이빙 센터로 이동
    await view.webContents.loadURL('https://driving-center.bmw.co.kr');
    
    // 페이지 로드 완료 대기
    mainWindow.webContents.send('bmw:analysis-progress', {
      step: 'loading',
      message: '페이지 로딩 대기 중...'
    });
    
    await new Promise(resolve => {
      view.webContents.once('did-finish-load', resolve);
    });
    
    // OAuth 리다이렉션 감지
    const currentUrl = view.webContents.getURL();
    if (currentUrl.includes('customer.bmwgroup.com')) {
      mainWindow.webContents.send('bmw:analysis-progress', {
        step: 'oauth',
        message: 'BMW OAuth 로그인 페이지 감지됨'
      });
    }
    
    // Vue.js SPA 완전 로딩 대기 (특히 OAuth 페이지)
    mainWindow.webContents.send('bmw:analysis-progress', {
      step: 'waiting',
      message: 'Vue.js 앱 로딩 대기 중...'
    });
    
    // 초기 대기 (리다이렉션 처리)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let retryCount = 0;
    let pageReady = false;
    
    while (!pageReady && retryCount < 15) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Vue.js 앱이 완전히 마운트되었는지 확인
      const loadStatus = await view.webContents.executeJavaScript(`
        (function() {
          // Vue 앱 체크
          const vueApp = document.querySelector('#app') || document.querySelector('[data-v-]');
          const hasVueComponents = document.querySelectorAll('[data-v-]').length > 0;
          
          // 실제 렌더링된 요소 확인
          const visibleInputs = Array.from(document.querySelectorAll('input')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          
          const visibleButtons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          
          const hasForm = document.querySelector('form') !== null;
          const hasContent = document.body.innerText.trim().length > 100;
          
          // OAuth 페이지 특별 체크
          const isOAuth = window.location.href.includes('customer.bmwgroup.com');
          const hasLoginElements = visibleInputs.length > 0 || visibleButtons.length > 0;
          
          return {
            ready: (isOAuth && hasLoginElements) || (!isOAuth && hasContent),
            details: {
              url: window.location.href,
              vueDetected: hasVueComponents,
              visibleInputs: visibleInputs.length,
              visibleButtons: visibleButtons.length,
              totalInputs: document.querySelectorAll('input').length,
              totalButtons: document.querySelectorAll('button').length,
              forms: document.querySelectorAll('form').length,
              contentLength: document.body.innerText.trim().length,
              title: document.title
            }
          };
        })()
      `);
      
      if (loadStatus.ready) {
        pageReady = true;
        mainWindow.webContents.send('bmw:analysis-progress', {
          step: 'loaded',
          message: `페이지 로드 완료! (입력필드: ${loadStatus.details.inputs}개, 버튼: ${loadStatus.details.buttons}개)`
        });
      } else {
        retryCount++;
        mainWindow.webContents.send('bmw:analysis-progress', {
          step: 'waiting',
          message: `페이지 로딩 대기 중... (${retryCount}/10)`
        });
      }
    }
    
    if (!pageReady) {
      return { 
        error: '페이지가 제대로 로드되지 않았습니다. 다시 시도해주세요.',
        success: false 
      };
    }
    
    // 최종 안정화 대기
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 페이지 구조 분석 시작
    mainWindow.webContents.send('bmw:analysis-progress', {
      step: 'analyzing',
      message: '페이지 구조 분석 중...'
    });
    
    const analysis = await view.webContents.executeJavaScript(`
      (function() {
        try {
          const result = {
            title: document.title || 'Unknown',
            url: window.location.href,
            framework: null,
            navigation: {
              links: []
            },
            loginElements: {},
            reservationElements: {}
          };

          // SPA 프레임워크 감지
          result.analysisDetails = {
            steps: [],
            findings: {}
          };
          
          result.analysisDetails.steps.push('프레임워크 감지 시작...');
          if (typeof React !== 'undefined' || document.querySelector('[data-reactroot]')) {
            result.framework = 'React';
            result.analysisDetails.findings.framework = 'React 프레임워크 감지됨';
          } else if (typeof Vue !== 'undefined' || document.querySelector('#app')) {
            result.framework = 'Vue';
            result.analysisDetails.findings.framework = 'Vue 프레임워크 감지됨';
          } else if (typeof angular !== 'undefined' || document.querySelector('[ng-app]')) {
            result.framework = 'Angular';
            result.analysisDetails.findings.framework = 'Angular 프레임워크 감지됨';
          } else {
            result.analysisDetails.findings.framework = '표준 HTML/JavaScript';
          }

          // 네비게이션 메뉴 찾기 - 다양한 선택자 시도
          result.analysisDetails.steps.push('네비게이션 메뉴 검색 중...');
          const navSelectors = [
            'a[href*="reservation"]',
            'a[href*="login"]',
            'a[href*="program"]',
            'nav a',
            '.nav a',
            '.menu a',
            'header a'
          ];
          
          let navCount = 0;
          navSelectors.forEach(selector => {
            try {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => {
                if (el.textContent && el.textContent.trim()) {
                  result.navigation.links.push({
                    text: el.textContent.trim(),
                    href: el.href || el.getAttribute('onclick') || '',
                    className: el.className || ''
                  });
                  navCount++;
                }
              });
            } catch (e) {
              // 선택자 오류 무시
            }
          });
          result.analysisDetails.findings.navigation = navCount + '개의 네비게이션 링크 발견';

          // 로그인 관련 요소 - OAuth 페이지 특별 처리
          result.analysisDetails.steps.push('로그인 요소 검색 중...');
          
          // OAuth 로그인 페이지인지 확인
          const isOAuthPage = window.location.href.includes('customer.bmwgroup.com');
          
          if (isOAuthPage) {
            result.analysisDetails.steps.push('🔍 BMW OAuth 로그인 페이지 정밀 분석 시작...');
            result.loginElements.isOAuth = true;
            
            // 디버깅을 위한 상세 정보 수집
            console.log('=== BMW OAuth 페이지 분석 시작 ===');
            
            // 1. 모든 input 요소 찾기 (보이는 것만)
            const allInputs = Array.from(document.querySelectorAll('input')).filter(input => {
              const style = window.getComputedStyle(input);
              return style.display !== 'none' && style.visibility !== 'hidden' && input.offsetParent !== null;
            });
            
            console.log('발견된 input 개수:', allInputs.length);
            
            let emailField = null;
            let passwordField = null;
            
            // 각 input 상세 분석
            allInputs.forEach((input, index) => {
              const info = {
                index: index,
                type: input.type,
                name: input.name,
                id: input.id,
                placeholder: input.placeholder,
                className: input.className,
                value: input.value ? '[값있음]' : '[비어있음]',
                autocomplete: input.autocomplete,
                required: input.required,
                readOnly: input.readOnly,
                disabled: input.disabled
              };
              
              console.log('Input #' + index + ':', JSON.stringify(info, null, 2));
              
              // 이메일 필드 찾기 (더 유연하게)
              if (!passwordField && (input.type === 'email' || input.type === 'text')) {
                if (!input.readOnly && !input.disabled) {
                  emailField = input;
                  result.loginElements.emailField = true;
                  result.loginElements.emailFieldDetails = info;
                  result.analysisDetails.findings.emailField = '📧 입력 필드 발견 (타입: ' + input.type + ')';
                }
              }
              
              // 비밀번호 필드 찾기
              if (input.type === 'password' && !input.readOnly && !input.disabled) {
                passwordField = input;
                result.loginElements.passwordField = true;
                result.loginElements.passwordFieldDetails = info;
                result.analysisDetails.findings.passwordField = '🔐 비밀번호 필드 발견';
              }
            });
            
            // 2. 모든 버튼 찾기 (보이는 것만)
            const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"]')).filter(btn => {
              const style = window.getComputedStyle(btn);
              return style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetParent !== null;
            });
            
            console.log('발견된 버튼 개수:', allButtons.length);
            
            let submitButton = null;
            const buttonTexts = [];
            
            allButtons.forEach((btn, index) => {
              const text = btn.textContent?.trim() || btn.value || '';
              const ariaLabel = btn.getAttribute('aria-label') || '';
              
              if (text || ariaLabel) {
                buttonTexts.push(text || ariaLabel);
                
                // 제출 버튼 찾기
                if (!btn.disabled && (
                  text.toLowerCase().includes('next') ||
                  text.toLowerCase().includes('continue') ||
                  text.toLowerCase().includes('sign') ||
                  text.toLowerCase().includes('login') ||
                  text.includes('다음') ||
                  text.includes('계속') ||
                  text.includes('로그인')
                )) {
                  submitButton = btn;
                  result.loginElements.submitButton = true;
                  result.loginElements.submitButtonText = text;
                }
              }
              
              console.log('Button #' + index + ':', text || ariaLabel || '[텍스트 없음]');
            });
            
            if (buttonTexts.length > 0) {
              result.analysisDetails.findings.buttons = '🔘 ' + buttonTexts.length + '개 버튼: ' + buttonTexts.join(', ');
            }
            
            // 3. 현재 로그인 단계 파악
            if (passwordField) {
              result.analysisDetails.findings.loginStage = '🔐 2단계: 비밀번호 입력 화면';
              result.loginElements.currentStage = 'password';
            } else if (emailField) {
              result.analysisDetails.findings.loginStage = '📧 1단계: 이메일/ID 입력 화면';
              result.loginElements.currentStage = 'email';
            } else {
              result.analysisDetails.findings.loginStage = '❓ 로그인 필드를 찾을 수 없음';
              
              // 숨겨진 요소나 Shadow DOM 확인
              const shadowRoots = Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot);
              if (shadowRoots.length > 0) {
                result.analysisDetails.findings.shadowDOM = '⚠️ Shadow DOM 감지 (' + shadowRoots.length + '개)';
              }
            }
            
            // 4. hCaptcha 감지
            const hcaptcha = document.querySelector('.h-captcha, [data-hcaptcha-widget-id], iframe[src*="hcaptcha"]');
            if (hcaptcha) {
              result.loginElements.hCaptcha = true;
              result.analysisDetails.findings.captcha = '🤖 hCaptcha 보안 인증 필요';
            }
            
            // 5. 폼 구조 분석
            const forms = document.querySelectorAll('form');
            if (forms.length > 0) {
              result.analysisDetails.findings.forms = '📝 ' + forms.length + '개 폼 발견';
            }
            
            result.analysisDetails.findings.login = '✅ BMW OAuth 페이지 분석 완료';
            console.log('=== 분석 완료 ===');
            
          } else {
            // 일반 로그인 버튼 검색
            const allElements = document.querySelectorAll('a, button');
            let loginFound = false;
            let userMenuFound = false;
            
            allElements.forEach(el => {
              const text = el.textContent || '';
              if (text.includes('로그인') || text.includes('Login') || text.includes('Sign')) {
                result.loginElements.loginButton = true;
                loginFound = true;
                result.loginElements.loginButtonText = text.trim();
              }
              if (text.includes('마이페이지') || text.includes('My') || text.includes('프로필')) {
                result.loginElements.userMenu = true;
                userMenuFound = true;
              }
            });
            
            result.analysisDetails.findings.login = loginFound ? '로그인 버튼 발견: ' + (result.loginElements.loginButtonText || '있음') : '로그인 버튼 미발견';
            if (userMenuFound) {
              result.analysisDetails.findings.userMenu = '사용자 메뉴 발견';
            }
          }

          // 예약 관련 요소
          result.analysisDetails.steps.push('예약 시스템 요소 검색 중...');
          const calendarSelectors = [
            '[class*="calendar"]',
            '[id*="calendar"]',
            '[class*="date"]',
            '[class*="picker"]',
            '.calendar',
            '#calendar'
          ];
          
          let calendarFound = false;
          calendarSelectors.forEach(selector => {
            if (document.querySelector(selector)) {
              result.reservationElements.calendar = true;
              calendarFound = true;
              result.reservationElements.calendarSelector = selector;
            }
          });
          
          if (calendarFound) {
            result.analysisDetails.findings.calendar = '캘린더 요소 발견: ' + result.reservationElements.calendarSelector;
          }

          // 프로그램 리스트 찾기
          result.analysisDetails.steps.push('프로그램 리스트 검색 중...');
          const programSelectors = [
            '[class*="program"]',
            '[class*="course"]',
            '[class*="lesson"]'
          ];
          
          let programFound = false;
          programSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              result.reservationElements.programList = true;
              programFound = true;
              result.reservationElements.programCount = elements.length;
            }
          });
          
          if (programFound) {
            result.analysisDetails.findings.programs = result.reservationElements.programCount + '개의 프로그램 요소 발견';
          }
          
          // 페이지 내 주요 텍스트 수집
          result.analysisDetails.steps.push('페이지 주요 콘텐츠 분석 중...');
          const headings = document.querySelectorAll('h1, h2, h3');
          result.analysisDetails.findings.mainContent = [];
          headings.forEach((h, i) => {
            if (i < 5 && h.textContent) {
              result.analysisDetails.findings.mainContent.push(h.textContent.trim());
            }
          });

          return result;
        } catch (err) {
          return {
            error: 'Analysis error: ' + err.toString(),
            title: document.title,
            url: window.location.href
          };
        }
      })()
    `);

    // 분석 완료 알림
    mainWindow.webContents.send('bmw:analysis-progress', {
      step: 'complete',
      message: '분석 완료!',
      details: analysis.analysisDetails
    });
    
    return { success: true, analysis };
  } catch (error) {
    console.error('BMW analyze error:', error);
    return { error: error.message };
  }
});

// BMW 로그인 자동화 - 2단계 OAuth 프로세스
ipcMain.handle('bmw:auto-login', async (event, { username, password }) => {
  const view = browserViews.get(activeBrowserViewId);
  if (!view) return { error: 'No active browser view' };

  try {
    const currentUrl = view.webContents.getURL();
    console.log('Current URL:', currentUrl);
    
    // BMW OAuth 페이지가 아니면 먼저 로그인 페이지로 이동
    if (!currentUrl.includes('customer.bmwgroup.com')) {
      console.log('OAuth 페이지가 아니므로 로그인 버튼 찾기 시도...');
      
      // Vue.js 렌더링 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const loginButtonClicked = await view.webContents.executeJavaScript(`
        (function() {
          // 페이지 구조 디버깅
          console.log('=== BMW 페이지 분석 ===');
          console.log('URL:', window.location.href);
          console.log('Title:', document.title);
          
          // 모든 버튼과 링크 출력
          const allButtons = document.querySelectorAll('button');
          const allLinks = document.querySelectorAll('a');
          
          console.log('버튼 개수:', allButtons.length);
          console.log('링크 개수:', allLinks.length);
          
          // 텍스트가 있는 모든 버튼 확인
          for (let btn of allButtons) {
            const text = btn.textContent?.trim();
            if (text) {
              console.log('버튼 텍스트:', text);
            }
          }
          
          // 텍스트가 있는 모든 링크 확인
          for (let link of allLinks) {
            const text = link.textContent?.trim();
            if (text && text.length < 20) { // 짧은 텍스트만
              console.log('링크 텍스트:', text, 'href:', link.href);
            }
          }
          
          // 실제 로그인 버튼 찾기
          for (let elem of [...allButtons, ...allLinks]) {
            const text = (elem.textContent || '').trim();
            // BMW 사이트는 '로그인' 텍스트 사용
            if (text === '로그인' || text === 'Login' || text === 'MY BMW') {
              console.log('>>> 로그인 버튼 클릭:', text);
              elem.click();
              return true;
            }
          }
          
          console.log('로그인 버튼을 찾을 수 없음');
          return false;
        })()
      `);
      
      if (loginButtonClicked) {
        console.log('로그인 버튼 클릭됨, OAuth 페이지 이동 대기...');
        // OAuth 페이지로 리다이렉션 대기
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // URL 확인
        const newUrl = view.webContents.getURL();
        if (!newUrl.includes('customer.bmwgroup.com')) {
          console.log('OAuth 페이지로 이동 실패, 직접 이동 시도...');
          // 직접 OAuth URL로 이동
          await view.webContents.loadURL('https://customer.bmwgroup.com/oneid/en-KR/login?client=bdc_2024&brand=bmw&country=KR&language=en&redirect_uri=https%3A%2F%2Fdriving-center.bmw.co.kr%2Fsso%2Flogin&response_type=code&scope=authenticate_user&state=bdc');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } else {
        console.log('로그인 버튼을 찾을 수 없어 OAuth 페이지로 직접 이동...');
        // 로그인 버튼을 못 찾으면 직접 OAuth URL로 이동
        await view.webContents.loadURL('https://customer.bmwgroup.com/oneid/en-KR/login?client=bdc_2024&brand=bmw&country=KR&language=en&redirect_uri=https%3A%2F%2Fdriving-center.bmw.co.kr%2Fsso%2Flogin&response_type=code&scope=authenticate_user&state=bdc');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 현재 페이지 상태 확인
    const pageState = await view.webContents.executeJavaScript(`
      (function() {
        const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          placeholder: input.placeholder,
          name: input.name,
          id: input.id,
          visible: input.offsetParent !== null
        }));
        
        const buttons = Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent?.trim(),
          type: btn.type,
          disabled: btn.disabled
        }));
        
        return {
          url: window.location.href,
          title: document.title,
          inputs: inputs,
          buttons: buttons
        };
      })()
    `);
    
    console.log('현재 페이지 상태:', JSON.stringify(pageState, null, 2));
    
    // 1단계: 이메일 입력
    mainWindow.webContents.send('bmw:analysis-progress', {
      step: 'login-email',
      message: '이메일 입력 필드 찾는 중...'
    });
    
    // 이메일 입력 후 다음 버튼 클릭
    const emailResult = await view.webContents.executeJavaScript(`
      (async function() {
        // 타이핑 시뮬레이션 (더 자연스럽게)
        function simulateTyping(element, text) {
          return new Promise((resolve) => {
            element.focus();
            element.click();
            element.value = '';
            let index = 0;
            
            const typeChar = () => {
              if (index < text.length) {
                element.value += text[index];
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                index++;
                setTimeout(typeChar, 100 + Math.random() * 100);
              } else {
                element.dispatchEvent(new Event('change', { bubbles: true }));
                element.blur();
                resolve();
              }
            };
            typeChar();
          });
        }

        try {
          // 모든 보이는 input 찾기
          const visibleInputs = Array.from(document.querySelectorAll('input')).filter(input => {
            return input.offsetParent !== null && 
                   input.type !== 'hidden' && 
                   input.type !== 'submit' &&
                   !input.readOnly &&
                   !input.disabled;
          });
          
          console.log('보이는 input 개수:', visibleInputs.length);
          
          // 비밀번호 필드가 있는지 먼저 확인
          const passwordField = visibleInputs.find(input => input.type === 'password');
          if (passwordField) {
            console.log('이미 비밀번호 페이지입니다');
            return { success: true, step: 'already_at_password' };
          }
          
          // 이메일/텍스트 필드 찾기
          let emailField = visibleInputs.find(input => 
            input.type === 'email' || 
            input.type === 'text' ||
            input.name?.toLowerCase().includes('email') ||
            input.name?.toLowerCase().includes('user') ||
            input.placeholder?.toLowerCase().includes('email')
          );
          
          // 첫 번째 텍스트 필드를 이메일 필드로 간주
          if (!emailField && visibleInputs.length > 0) {
            emailField = visibleInputs[0];
          }
          
          if (emailField) {
            console.log('이메일 필드 발견:', {
              type: emailField.type,
              name: emailField.name,
              placeholder: emailField.placeholder
            });
            
            await simulateTyping(emailField, '${username}');
            await new Promise(r => setTimeout(r, 1500));
            
            // Enter 키 시뮬레이션
            emailField.dispatchEvent(new KeyboardEvent('keydown', { 
              key: 'Enter', 
              keyCode: 13, 
              bubbles: true 
            }));
            
            // 또는 다음 버튼 찾기
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            let nextBtn = buttons.find(btn => {
              const text = (btn.textContent || btn.value || '').toLowerCase();
              return !btn.disabled && (
                text.includes('next') ||
                text.includes('continue') ||
                text.includes('다음') ||
                text.includes('계속') ||
                text.includes('sign') ||
                text.includes('로그인')
              );
            });
            
            if (nextBtn) {
              console.log('다음 버튼 발견:', nextBtn.textContent || nextBtn.value);
              nextBtn.click();
              return { success: true, step: 'email_submitted' };
            }
            
            // 버튼이 없으면 Enter만 의존
            return { success: true, step: 'email_submitted_enter' };
          }
          
          return { error: '입력 필드를 찾을 수 없습니다. 페이지가 완전히 로드되지 않았을 수 있습니다.' };
        } catch (err) {
          return { error: err.message };
        }
      })()
    `);

    if (emailResult.error) {
      return emailResult;
    }

    // 2단계: 비밀번호 입력 (이메일 제출 후 페이지 전환 대기)
    if (emailResult.step === 'email_submitted' || emailResult.step === 'email_submitted_enter') {
      mainWindow.webContents.send('bmw:analysis-progress', {
        step: 'waiting',
        message: '페이지 전환 대기 중...'
      });
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
    
    // 비밀번호 페이지 상태 확인
    const passwordPageCheck = await view.webContents.executeJavaScript(`
      ({
        url: window.location.href,
        hasPasswordField: document.querySelector('input[type="password"]') !== null,
        passwordFieldCount: document.querySelectorAll('input[type="password"]').length,
        visibleInputs: Array.from(document.querySelectorAll('input')).filter(i => i.offsetParent !== null).length
      })
    `);
    
    console.log('비밀번호 페이지 상태:', passwordPageCheck);
    
    if (!passwordPageCheck.hasPasswordField) {
      // 비밀번호 필드가 없으면 조금 더 기다리기
      console.log('비밀번호 필드가 아직 없음. 추가 대기...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    mainWindow.webContents.send('bmw:analysis-progress', {
      step: 'login-password',
      message: '비밀번호 입력 중...'
    });

    const passwordResult = await view.webContents.executeJavaScript(`
      (async function() {
        function simulateTyping(element, text) {
          return new Promise((resolve) => {
            element.focus();
            element.click();
            element.value = '';
            let index = 0;
            
            const typeChar = () => {
              if (index < text.length) {
                element.value += text[index];
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                index++;
                setTimeout(typeChar, 100 + Math.random() * 100);
              } else {
                element.dispatchEvent(new Event('change', { bubbles: true }));
                resolve();
              }
            };
            typeChar();
          });
        }

        try {
          // 현재 페이지 상태 확인
          console.log('비밀번호 페이지 URL:', window.location.href);
          
          // 모든 보이는 input 찾기
          const visibleInputs = Array.from(document.querySelectorAll('input')).filter(input => {
            return input.offsetParent !== null && 
                   input.type !== 'hidden' && 
                   !input.readOnly &&
                   !input.disabled;
          });
          
          console.log('비밀번호 페이지의 input 개수:', visibleInputs.length);
          
          // 비밀번호 필드 찾기
          const pwField = visibleInputs.find(input => input.type === 'password');
          
          if (pwField) {
            console.log('비밀번호 필드 발견:', {
              type: pwField.type,
              name: pwField.name,
              placeholder: pwField.placeholder
            });
            
            // 비밀번호 입력 전에는 hCaptcha 체크하지 않음!
            // hCaptcha는 로그인 버튼 클릭 후에 나타남
            
            await simulateTyping(pwField, '${password}');
            await new Promise(r => setTimeout(r, 1500));
            
            // Enter 키 시뮬레이션
            pwField.dispatchEvent(new KeyboardEvent('keydown', { 
              key: 'Enter', 
              keyCode: 13, 
              bubbles: true 
            }));
            
            // 로그인 버튼 찾기
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            let loginBtn = buttons.find(btn => {
              const text = (btn.textContent || btn.value || '').toLowerCase();
              return !btn.disabled && (
                text.includes('login') ||
                text.includes('sign') ||
                text.includes('로그인') ||
                text.includes('인증') ||
                text.includes('확인')
              );
            });
            
            if (loginBtn) {
              console.log('로그인 버튼 발견:', loginBtn.textContent || loginBtn.value);
              loginBtn.click();
              
              // 로그인 버튼 클릭 후 처리 중 상태 반환
              console.log('로그인 버튼 클릭 완료');
              return { success: false, step: 'login_processing' };
            }
            
            // 버튼이 없으면 Enter 키에 의존
            return { success: true, step: 'login_complete_enter' };
          }
          
          // 비밀번호 필드가 없는 경우 - 디버깅 정보 포함
          console.log('비밀번호 필드를 찾을 수 없음. 현재 페이지 정보:');
          console.log('- URL:', window.location.href);
          console.log('- 보이는 input 개수:', visibleInputs.length);
          console.log('- input 타입들:', visibleInputs.map(i => i.type));
          
          // 이메일 필드가 여전히 있으면 아직 1단계
          const stillHasEmailField = visibleInputs.find(input => 
            input.type === 'email' || input.type === 'text'
          );
          
          if (stillHasEmailField) {
            return { 
              error: '아직 이메일 입력 단계입니다. 이메일을 먼저 입력해주세요.',
              step: 'still_at_email'
            };
          }
          
          return { 
            error: '비밀번호 필드를 찾을 수 없습니다. 페이지가 완전히 로드되지 않았을 수 있습니다.',
            foundInputs: visibleInputs.length,
            needsRetry: true
          };
        } catch (err) {
          return { error: '스크립트 오류: ' + err.message };
        }
      })()
    `);

    // 로그인 처리 중인 경우 URL 모니터링으로 성공 판단
    if (passwordResult.step === 'login_processing') {
      console.log('로그인 처리 중... URL 변경 모니터링');
      
      // 최대 10초간 URL 확인
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const currentUrl = view.webContents.getURL();
        console.log(`[${i+1}초] 현재 URL:`, currentUrl);
        
        // driving-center.bmw.co.kr로 돌아왔으면 로그인 성공
        if (currentUrl.includes('driving-center.bmw.co.kr') && 
            !currentUrl.includes('customer.bmwgroup.com') &&
            !currentUrl.includes('oneid.bmw.co.kr')) {
          console.log('✅ 로그인 성공!');
          return { success: true, message: '로그인 성공', url: currentUrl };
        }
        
        // 3초 이후부터 오류 체크
        if (i >= 2) {
          if (currentUrl.includes('customer.bmwgroup.com') || currentUrl.includes('oneid.bmw.co.kr')) {
            const pageCheck = await view.webContents.executeJavaScript(`
              ({
                hasPasswordField: document.querySelector('input[type="password"]') !== null,
                hasCaptcha: document.querySelector('iframe[src*="hcaptcha"], .h-captcha') !== null
              })
            `);
            
            if (pageCheck.hasCaptcha) {
              console.log('🤖 hCaptcha 인증 필요');
              return { success: false, error: 'hCaptcha 인증이 필요합니다', captcha: true, url: currentUrl };
            }
            
            if (pageCheck.hasPasswordField) {
              // 비밀번호 필드가 있고 3초 이상 지났으면 로그인 실패 가능성
              if (i >= 4) {
                console.log('❌ 로그인 실패 - 비밀번호 오류');
                return { success: false, error: '비밀번호를 확인해주세요', url: currentUrl };
              }
            }
          }
        }
      }
      
      // 10초 후에도 완료 안됨
      const finalUrl = view.webContents.getURL();
      console.log('⏱️ 로그인 시간 초과, 최종 URL:', finalUrl);
      return { success: false, error: '로그인 시간 초과', url: finalUrl };
    }
    
    // 비밀번호 필드를 못 찾았으면 재시도
    if (passwordResult.needsRetry) {
      console.log('비밀번호 필드 찾기 재시도...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 재시도
      const retryResult = await view.webContents.executeJavaScript(`
        (async function() {
          const pwField = document.querySelector('input[type="password"]');
          if (pwField && pwField.offsetParent !== null) {
            // 비밀번호 필드 찾음
            console.log('재시도: 비밀번호 필드 발견!');
            
            // 타이핑 시뮬레이션
            function simulateTyping(element, text) {
              return new Promise((resolve) => {
                element.focus();
                element.click();
                element.value = '';
                let index = 0;
                
                const typeChar = () => {
                  if (index < text.length) {
                    element.value += text[index];
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                    index++;
                    setTimeout(typeChar, 100 + Math.random() * 100);
                  } else {
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    resolve();
                  }
                };
                typeChar();
              });
            }
            
            await simulateTyping(pwField, '${password}');
            await new Promise(r => setTimeout(r, 1500));
            
            // 로그인 버튼 찾기
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            const loginBtn = buttons.find(btn => {
              const text = (btn.textContent || btn.value || '').toLowerCase();
              return !btn.disabled && (
                text.includes('login') ||
                text.includes('sign') ||
                text.includes('로그인') ||
                text.includes('인증')
              );
            });
            
            if (loginBtn) {
              loginBtn.click();
              await new Promise(r => setTimeout(r, 3000));
              
              // hCaptcha 확인
              const hcaptcha = document.querySelector('iframe[src*="hcaptcha"], .h-captcha');
              if (hcaptcha) {
                return { error: '🤖 hCaptcha 인증이 필요합니다!', captcha: true };
              }
              
              return { success: true, step: 'login_complete' };
            }
            
            return { error: '로그인 버튼을 찾을 수 없습니다' };
          }
          
          return { error: '여전히 비밀번호 필드를 찾을 수 없습니다' };
        })()
      `);
      
      return retryResult;
    }
    
    // hCaptcha가 필요한 경우 자동 해결 시도
    if (passwordResult.captcha && passwordResult.sitekey && solver) {
      mainWindow.webContents.send('bmw:analysis-progress', {
        step: 'captcha',
        message: '🤖 hCaptcha 자동 해결 시도 중...'
      });
      
      try {
        // SolveCaptcha로 hCaptcha 해결
        const hcaptchaResult = await solver.hcaptcha({
          sitekey: passwordResult.sitekey,
          pageurl: passwordResult.pageUrl
        });
        
        if (hcaptchaResult && hcaptchaResult.token) {
          // 해결된 토큰을 페이지에 주입
          const tokenInjected = await view.webContents.executeJavaScript(`
            (function() {
              try {
                // h-captcha-response 필드에 토큰 주입
                const responseField = document.querySelector('[name="h-captcha-response"]');
                if (responseField) {
                  responseField.value = '${hcaptchaResult.token}';
                  responseField.innerHTML = '${hcaptchaResult.token}';
                }
                
                // g-recaptcha-response 필드도 체크 (호환성)
                const gResponseField = document.querySelector('[name="g-recaptcha-response"]');
                if (gResponseField) {
                  gResponseField.value = '${hcaptchaResult.token}';
                  gResponseField.innerHTML = '${hcaptchaResult.token}';
                }
                
                // hCaptcha 콜백 함수 호출
                if (typeof hcaptcha !== 'undefined' && hcaptcha.execute) {
                  hcaptcha.execute();
                }
                
                // 폼 제출 시도
                const form = document.querySelector('form');
                if (form) {
                  form.submit();
                  return { success: true, formSubmitted: true };
                }
                
                // 로그인 버튼 다시 클릭
                const loginBtn = Array.from(document.querySelectorAll('button')).find(btn => {
                  const text = (btn.textContent || '').toLowerCase();
                  return text.includes('login') || text.includes('로그인');
                });
                
                if (loginBtn) {
                  loginBtn.click();
                  return { success: true, buttonClicked: true };
                }
                
                return { success: true, tokenInjected: true };
              } catch (err) {
                return { error: err.message };
              }
            })()
          `);
          
          mainWindow.webContents.send('bmw:analysis-progress', {
            step: 'captcha-solved',
            message: '✅ hCaptcha 자동 해결 성공!'
          });
          
          // 로그인 성공 확인을 위해 대기
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 로그인 성공 여부 확인
          const loginCheck = await view.webContents.executeJavaScript(`
            ({
              url: window.location.href,
              hasLoginForm: document.querySelector('input[type="password"]') !== null,
              loggedIn: !window.location.href.includes('login') && !window.location.href.includes('oneid')
            })
          `);
          
          if (loginCheck.loggedIn) {
            return { success: true, step: 'login_complete', captchaSolved: true };
          } else {
            return { success: false, error: 'hCaptcha 해결 후에도 로그인이 완료되지 않음' };
          }
        }
      } catch (captchaError) {
        console.error('hCaptcha 자동 해결 실패:', captchaError);
        mainWindow.webContents.send('bmw:analysis-progress', {
          step: 'captcha-failed',
          message: '⚠️ hCaptcha 자동 해결 실패. 수동으로 해결해주세요.'
        });
        
        // 수동 해결을 위한 메시지 반환
        return { 
          error: '🤖 hCaptcha 인증이 필요합니다. 브라우저에서 직접 체크해주세요!', 
          captcha: true,
          step: 'captcha_required',
          autoSolveFailed: true
        };
      }
    }
    
    return passwordResult;
  } catch (error) {
    return { error: error.message };
  }
});

// BMW 프로그램 리스트 파싱
ipcMain.handle('bmw:fetch-programs', async (event) => {
  try {
    const result = await fetchBMWPrograms(mainWindow, browserViews, activeBrowserViewId);
    
    // 결과 저장 (로컬 스토리지 또는 파일)
    if (result.success && result.programs.length > 0) {
      // 날짜와 함께 저장
      const storageData = {
        programs: result.programs,
        lastUpdated: result.timestamp,
        nextUpdateDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 1주일 후
      };
      
      // 메인 프로세스에 전달
      mainWindow.webContents.send('bmw:programs-updated', storageData);
    }
    
    return result;
  } catch (error) {
    console.error('BMW 프로그램 파싱 오류:', error);
    return { 
      success: false, 
      error: error.message,
      programs: [] 
    };
  }
});

// 기존 코드 삭제 - fetchBMWPrograms 함수로 대체됨
ipcMain.handle('bmw:fetch-programs-old', async (event) => {
  // 활성 뷰가 없으면 새로 생성
  let view = browserViews.get(activeBrowserViewId);
  
  if (!view) {
    // 새 BrowserView 생성
    const newViewId = Date.now().toString();
    view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        partition: 'persist:bmw'
      }
    });
    
    browserViews.set(newViewId, view);
    activeBrowserViewId = newViewId;
    
    // 메인 윈도우에 붙이기
    mainWindow.setBrowserView(view);
    
    // 크기 설정 (오른쪽 절반)
    const bounds = mainWindow.getContentBounds();
    view.setBounds({ 
      x: Math.floor(bounds.width / 2), 
      y: 40, 
      width: Math.floor(bounds.width / 2), 
      height: bounds.height - 40 
    });
  }

  try {
    console.log('BMW 프로그램 리스트 파싱 시작...');
    
    // 프로그램 페이지로 이동
    await view.webContents.loadURL('https://driving-center.bmw.co.kr/useAmount/view');
    
    // 페이지 완전히 로드될 때까지 대기
    await new Promise((resolve) => {
      const checkLoad = () => {
        if (view.webContents.getURL().includes('driving-center.bmw.co.kr')) {
          setTimeout(resolve, 2000); // 추가 2초 대기
        } else {
          setTimeout(checkLoad, 500);
        }
      };
      checkLoad();
    });
    
    // 간단한 테스트 먼저 실행
    let pageTest;
    try {
      pageTest = await view.webContents.executeJavaScript(`
        JSON.stringify({
          url: window.location.href,
          title: document.title,
          ready: document.readyState
        })
      `);
      console.log('페이지 테스트:', JSON.parse(pageTest));
    } catch (testError) {
      console.error('페이지 테스트 오류:', testError);
    }
    
    // 프로그램 리스트 파싱 (간단한 버전)
    const programs = await view.webContents.executeJavaScript(`
      (function() {
        const programList = [];
        
        try {
          // 페이지가 제대로 로드되었는지 확인
          if (!document.body) {
            return {
              success: false,
              error: 'Page not loaded',
              programs: []
            };
          }
          
          // 페이지 전체 텍스트 가져오기
          const pageText = document.body.innerText || '';
          
          // BMW 프로그램 키워드 패턴
          const programPatterns = [
            /M\s*Town.*?(?:\((?:KOR|ENG)\))?/gi,
            /Driving\s*Experience.*?(?:\((?:KOR|ENG)\))?/gi,
            /Track\s*Day.*?(?:\((?:KOR|ENG)\))?/gi,
            /Advanced\s*Course.*?(?:\((?:KOR|ENG)\))?/gi,
            /Taxi\s*Program.*?(?:\((?:KOR|ENG)\))?/gi,
            /[한글가-힣]+.*?(?:\((?:KOR|ENG)\))/g,
            /[A-Z][\w\s]+(?:\s+Course|\s+Program|\s+Experience).*?(?:\((?:KOR|ENG)\))?/g
          ];
          
          // 패턴 매칭
          const foundPrograms = new Set();
          programPatterns.forEach(pattern => {
            const matches = pageText.match(pattern);
            if (matches) {
              matches.forEach(match => {
                const cleaned = match.trim();
                if (cleaned.length > 3 && cleaned.length < 100) {
                  foundPrograms.add(cleaned);
                }
              });
            }
          });
          
          // Set을 배열로 변환
          foundPrograms.forEach(program => {
            programList.push({
              name: program,
              language: program.includes('(KOR)') ? 'KOR' : 
                       program.includes('(ENG)') ? 'ENG' : null
            });
          });
          
          // 테이블에서 더 정확한 정보 찾기
          const tables = document.querySelectorAll('table');
          tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 1) {
                const text = cells[0].innerText || cells[0].textContent || '';
                if (text && text.trim().length > 3) {
                  // 프로그램 이름 패턴 체크
                  const isProgram = programPatterns.some(pattern => 
                    text.match(pattern)
                  );
                  
                  if (isProgram || text.includes('(KOR)') || text.includes('(ENG)')) {
                    const isDuplicate = programList.some(p => p.name === text.trim());
                    if (!isDuplicate) {
                      programList.push({
                        name: text.trim(),
                        language: text.includes('(KOR)') ? 'KOR' : 
                                 text.includes('(ENG)') ? 'ENG' : null,
                        fromTable: true
                      });
                    }
                  }
                }
              }
            });
          });
          
          textElements.forEach(element => {
            const text = element.textContent?.trim();
            if (text && text.length > 3 && text.length < 100) {
              // 프로그램 패턴: 영문 또는 한글 + (KOR) 또는 (ENG)
              const programPattern = /^[^\n\r]*(?:\((?:KOR|ENG)\))?$/;
              
              // BMW 프로그램 키워드
              const keywords = [
                'M Town', 'Driving', 'Experience', 'Track', 'Advanced',
                'Taxi', 'Course', 'Day', 'Program', 'BMW',
                '인제', '용인', '트랙', '드라이빙', '체험',
                '택시', '코스', '프로그램', '어드밴스드'
              ];
              
              // 키워드가 포함되거나 (KOR)/(ENG) 패턴이 있는 경우
              if (keywords.some(keyword => text.includes(keyword)) || 
                  text.includes('(KOR)') || text.includes('(ENG)')) {
                
                // 가격 정보가 있는지 확인 (숫자와 콤마 포함)
                const priceElement = element.parentElement?.querySelector('[class*="price"], [class*="amount"]') ||
                                   element.nextElementSibling;
                
                let price = null;
                if (priceElement) {
                  const priceText = priceElement.textContent || '';
                  const priceMatch = priceText.match(/[\d,]+/);
                  if (priceMatch) {
                    price = priceMatch[0];
                  }
                }
                
                // 중복 체크
                const isDuplicate = programList.some(p => 
                  p.name === text || 
                  (p.name.replace('(KOR)', '').replace('(ENG)', '').trim() === 
                   text.replace('(KOR)', '').replace('(ENG)', '').trim())
                );
                
                if (!isDuplicate && text.length > 5) {
                  programList.push({
                    name: text,
                    language: text.includes('(KOR)') ? 'KOR' : text.includes('(ENG)') ? 'ENG' : null,
                    price: price,
                    element: element.tagName,
                    className: element.className
                  });
                }
              }
            }
          });
          
          // 테이블 구조에서 더 정확한 파싱 시도
          const tables = document.querySelectorAll('table');
          tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 2) {
                const programCell = cells[0];
                const priceCell = cells[1] || cells[2];
                
                const programName = programCell?.textContent?.trim();
                const price = priceCell?.textContent?.trim();
                
                if (programName && programName.length > 5) {
                  const isDuplicate = programList.some(p => p.name === programName);
                  if (!isDuplicate) {
                    programList.push({
                      name: programName,
                      language: programName.includes('(KOR)') ? 'KOR' : 
                               programName.includes('(ENG)') ? 'ENG' : null,
                      price: price?.match(/[\d,]+/)?.[0] || null,
                      fromTable: true
                    });
                  }
                }
              }
            });
          });
          
          // 디버깅 정보 추가
          console.log('최종 프로그램 리스트:', programList);
          
          return {
            success: true,
            programs: programList,
            totalFound: programList.length,
            pageUrl: window.location.href,
            timestamp: new Date().toISOString()
          };
        } catch (err) {
          console.error('파싱 오류:', err);
          return {
            success: false,
            error: err.toString(),
            programs: [],
            stack: err.stack
          };
        }
      })()
    `);
    
    console.log(`파싱 완료: ${programs.totalFound}개 프로그램 발견`);
    
    // 결과 저장 (로컬 스토리지 또는 파일)
    if (programs.success && programs.programs.length > 0) {
      // 날짜와 함께 저장
      const storageData = {
        programs: programs.programs,
        lastUpdated: new Date().toISOString(),
        nextUpdateDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 1주일 후
      };
      
      // 메인 프로세스에 전달
      mainWindow.webContents.send('bmw:programs-updated', storageData);
    }
    
    return programs;
  } catch (error) {
    console.error('BMW 프로그램 파싱 오류:', error);
    return { 
      success: false, 
      error: error.message,
      programs: [] 
    };
  }
});

// BMW 예약 가능 여부 확인
ipcMain.handle('bmw:check-reservation', async (event, selectedPrograms) => {
  const view = browserViews.get(activeBrowserViewId);
  if (!view) return { error: 'No active browser view' };
  
  // 선택된 프로그램들
  console.log('예약 확인할 프로그램들:', selectedPrograms);

  try {
    const currentUrl = view.webContents.getURL();
    
    // 예약 페이지가 아니면 예약 메뉴 찾아서 클릭
    if (!currentUrl.includes('reservation') && !currentUrl.includes('booking')) {
      // 먼저 메인 페이지로 이동
      if (!currentUrl.includes('driving-center.bmw.co.kr')) {
        await view.webContents.loadURL('https://driving-center.bmw.co.kr');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // 예약 메뉴 클릭
      const reservationClicked = await view.webContents.executeJavaScript(`
        (function() {
          const links = Array.from(document.querySelectorAll('a, button'));
          let reserveBtn = null;
          
          for (let link of links) {
            const text = (link.textContent || '').toLowerCase();
            const href = link.href || '';
            
            if (text.includes('예약') || text.includes('reservation') || 
                text.includes('booking') || href.includes('reservation')) {
              reserveBtn = link;
              break;
            }
          }
          
          if (reserveBtn) {
            reserveBtn.click();
            return true;
          }
          
          return false;
        })()
      `);
      
      if (reservationClicked) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 예약 가능한 슬롯 확인
    const availability = await view.webContents.executeJavaScript(`
      (function() {
        const result = {
          available: false,
          slots: [],
          currentUrl: window.location.href
        };

        // 캘린더에서 예약 가능한 날짜 찾기
        const availableDates = document.querySelectorAll('.calendar-day:not(.disabled):not(.past):not(.full)');
        
        availableDates.forEach(date => {
          const dateText = date.textContent || date.getAttribute('data-date');
          if (dateText) {
            result.slots.push({
              date: dateText,
              available: true
            });
          }
        });

        result.available = result.slots.length > 0;
        return result;
      })()
    `);

    return availability;
  } catch (error) {
    return { error: error.message };
  }
});