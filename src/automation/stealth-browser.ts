/**
 * Stealth Browser Automation
 * 로봇 감지 우회를 위한 고급 브라우저 자동화
 */

// 설치 필요: bun add puppeteer puppeteer-extra puppeteer-extra-plugin-stealth

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Stealth 플러그인 사용 - 로봇 감지 우회
puppeteer.use(StealthPlugin());

export class StealthBrowserAutomation {
  private browser: any = null;
  private page: any = null;

  /**
   * 스텔스 브라우저 초기화
   */
  async initialize() {
    this.browser = await puppeteer.launch({
      headless: false, // 실제 브라우저 창 표시
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // 자동화 감지 비활성화
        '--disable-features=site-per-process',
        '--window-size=1920,1080',
      ],
      defaultViewport: null,
    });

    this.page = await this.browser.newPage();

    // User-Agent 설정 (실제 Chrome과 동일하게)
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // WebDriver 속성 제거
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Chrome 속성 추가
      window.chrome = {
        runtime: {},
      };

      // Permissions 속성 추가
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' 
          ? Promise.resolve({ state: Notification.permission } as any)
          : originalQuery(parameters)
      );
    });

    // 플러그인 숨기기
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    // 언어 설정
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en'],
      });
    });
  }

  /**
   * 사람처럼 타이핑하기
   */
  async humanType(selector: string, text: string) {
    await this.page.click(selector);
    
    for (const char of text) {
      await this.page.keyboard.type(char);
      // 랜덤 지연 (50-150ms)
      await this.delay(50 + Math.random() * 100);
    }
  }

  /**
   * 사람처럼 클릭하기
   */
  async humanClick(selector: string) {
    const element = await this.page.$(selector);
    if (!element) return;

    const box = await element.boundingBox();
    if (!box) return;

    // 요소의 랜덤 위치 클릭
    const x = box.x + box.width * (0.3 + Math.random() * 0.4);
    const y = box.y + box.height * (0.3 + Math.random() * 0.4);

    // 마우스 이동
    await this.page.mouse.move(x, y, {
      steps: 10 + Math.floor(Math.random() * 10),
    });

    await this.delay(100 + Math.random() * 200);
    await this.page.mouse.click(x, y);
  }

  /**
   * 랜덤 지연
   */
  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * BMW 드라이빙 센터 로그인
   */
  async loginBMW(username: string, password: string) {
    try {
      await this.page.goto('https://www.bmw-driving-center.co.kr/login', {
        waitUntil: 'networkidle2',
      });

      // 쿠키 동의 처리 (있을 경우)
      try {
        await this.page.click('.cookie-accept', { timeout: 3000 });
      } catch {}

      // 로그인 폼 대기
      await this.page.waitForSelector('input[type="email"], input[name="username"]', {
        timeout: 10000,
      });

      // 사람처럼 로그인
      await this.humanType('input[type="email"], input[name="username"]', username);
      await this.delay(500 + Math.random() * 1000);
      
      await this.humanType('input[type="password"]', password);
      await this.delay(500 + Math.random() * 1000);

      // 로그인 버튼 클릭
      await this.humanClick('button[type="submit"], input[type="submit"]');

      // 로그인 성공 확인
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
      
      const url = this.page.url();
      return url.includes('mypage') || url.includes('reservation');

    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }

  /**
   * 예약 가능 여부 확인
   */
  async checkReservation() {
    try {
      await this.page.goto('https://www.bmw-driving-center.co.kr/reservation', {
        waitUntil: 'networkidle2',
      });

      // 캘린더 로드 대기
      await this.page.waitForSelector('.calendar-container', { timeout: 10000 });

      // 예약 가능한 날짜 확인
      const availableDates = await this.page.evaluate(() => {
        const available = [];
        const slots = document.querySelectorAll('.calendar-day.available:not(.disabled)');
        
        slots.forEach((slot: any) => {
          const date = slot.getAttribute('data-date');
          const hasSlots = !slot.classList.contains('full');
          
          if (date && hasSlots) {
            available.push({
              date,
              element: slot.outerHTML,
            });
          }
        });
        
        return available;
      });

      return {
        available: availableDates.length > 0,
        dates: availableDates,
      };

    } catch (error) {
      console.error('Check reservation error:', error);
      return { available: false, error };
    }
  }

  /**
   * 브라우저 종료
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// 사용 예시
export async function runStealthAutomation() {
  const automation = new StealthBrowserAutomation();
  await automation.initialize();
  
  const loginSuccess = await automation.loginBMW('your-email', 'your-password');
  if (loginSuccess) {
    console.log('✅ 로그인 성공!');
    
    const result = await automation.checkReservation();
    console.log('예약 가능 여부:', result);
  }
  
  // await automation.close();
}