/**
 * Electron-Selenium Bridge
 * Selenium이 Electron의 BrowserView를 조작하도록 연결
 * 
 * 이 방식의 장점:
 * 1. 실제 사용자의 Electron 앱처럼 보임 (로봇 감지 우회)
 * 2. BrowserView는 일반 Chrome과 동일한 엔진
 * 3. WebDriver 속성이 노출되지 않음
 */

import { Builder, By, until, WebDriver } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome'
import { Options } from 'selenium-webdriver/chrome'

export class ElectronSeleniumBridge {
  private driver: WebDriver | null = null
  
  /**
   * Selenium을 통해 실행 중인 Electron 앱에 연결
   * Electron 앱의 디버깅 포트를 통해 접속
   */
  async connectToElectron(debugPort: number = 9222) {
    const options = new Options()
    
    // 실행 중인 Electron 앱의 Chrome DevTools Protocol에 연결
    options.addArguments(`--remote-debugging-port=${debugPort}`)
    options.debuggerAddress = `127.0.0.1:${debugPort}`
    
    // Electron 앱의 실행 파일 경로 지정
    // Mac의 경우
    options.setChromeBinaryPath('/Applications/BDC Alter Browser.app/Contents/MacOS/BDC Alter Browser')
    // 또는 개발 중인 Electron 경로
    // options.setChromeBinaryPath(process.execPath)
    
    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build()
    
    return this.driver
  }

  /**
   * Electron BrowserView 내에서 JavaScript 실행
   * BrowserView의 webContents를 통해 실행
   */
  async executeInBrowserView(script: string) {
    if (!this.driver) throw new Error('Driver not connected')
    
    // Electron의 BrowserView 컨텍스트에서 실행
    return await this.driver.executeScript(`
      // Electron의 IPC를 통해 BrowserView 조작
      return new Promise((resolve) => {
        if (window.electronAPI && window.electronAPI.browser) {
          window.electronAPI.browser.executeInView('${script}')
            .then(result => resolve(result))
            .catch(err => resolve({ error: err.message }));
        } else {
          // 직접 실행 (BrowserView 내부에서)
          try {
            const result = eval(\`${script}\`);
            resolve(result);
          } catch (err) {
            resolve({ error: err.message });
          }
        }
      });
    `)
  }

  /**
   * BMW 드라이빙 센터 로그인 (Electron BrowserView 내에서)
   */
  async loginToBMW(username: string, password: string) {
    // 먼저 Electron 앱에서 BMW 사이트로 이동
    await this.executeInBrowserView(`
      window.location.href = 'https://www.bmw-driving-center.co.kr/login';
    `)
    
    // 페이지 로드 대기
    await this.driver!.sleep(3000)
    
    // 로그인 폼 작성 - 실제 사용자처럼
    const loginScript = `
      (async function() {
        // 타이핑 시뮬레이션 함수
        function simulateTyping(element, text) {
          return new Promise((resolve) => {
            element.focus();
            element.value = '';
            let index = 0;
            
            const typeChar = () => {
              if (index < text.length) {
                element.value += text[index];
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                index++;
                setTimeout(typeChar, 50 + Math.random() * 100);
              } else {
                resolve();
              }
            };
            
            typeChar();
          });
        }
        
        // 사용자명 입력
        const usernameField = document.querySelector('input[type="email"], input[name="username"], #username');
        if (usernameField) {
          await simulateTyping(usernameField, '${username}');
          await new Promise(r => setTimeout(r, 500));
        }
        
        // 비밀번호 입력
        const passwordField = document.querySelector('input[type="password"], #password');
        if (passwordField) {
          await simulateTyping(passwordField, '${password}');
          await new Promise(r => setTimeout(r, 500));
        }
        
        // 로그인 버튼 클릭
        const loginBtn = document.querySelector('button[type="submit"], input[type="submit"]');
        if (loginBtn) {
          loginBtn.click();
        }
        
        return { success: true };
      })()
    `
    
    const result = await this.executeInBrowserView(loginScript)
    console.log('Login result:', result)
    
    // 로그인 성공 확인
    await this.driver!.sleep(3000)
    
    const currentUrl = await this.executeInBrowserView('window.location.href')
    return currentUrl.includes('mypage') || currentUrl.includes('reservation')
  }

  /**
   * 예약 가능 여부 확인
   */
  async checkAvailability() {
    // 예약 페이지로 이동
    await this.executeInBrowserView(`
      window.location.href = 'https://www.bmw-driving-center.co.kr/reservation';
    `)
    
    await this.driver!.sleep(3000)
    
    // 예약 가능한 슬롯 확인
    const checkScript = `
      (function() {
        const availableSlots = [];
        
        // 실제 BMW 사이트의 선택자에 맞게 수정 필요
        const slots = document.querySelectorAll('.calendar-day:not(.disabled):not(.past)');
        
        slots.forEach(slot => {
          const date = slot.getAttribute('data-date') || slot.textContent;
          const available = !slot.classList.contains('full');
          
          if (available) {
            availableSlots.push({
              date: date,
              available: true
            });
          }
        });
        
        return {
          found: availableSlots.length > 0,
          count: availableSlots.length,
          slots: availableSlots
        };
      })()
    `
    
    return await this.executeInBrowserView(checkScript)
  }

  /**
   * 연결 종료
   */
  async disconnect() {
    if (this.driver) {
      await this.driver.quit()
      this.driver = null
    }
  }
}