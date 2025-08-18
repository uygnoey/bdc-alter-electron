/**
 * BMW Driving Center Site Analyzer
 * 사이트 구조 정밀 분석 스크립트
 */

import { chromium } from 'playwright';

export class BMWSiteAnalyzer {
  private browser: any;
  private page: any;
  private baseUrl = 'https://driving-center.bmw.co.kr';
  
  async initialize() {
    this.browser = await chromium.launch({
      headless: false, // 분석 시 화면 표시
      devtools: true,  // 개발자 도구 열기
    });
    
    this.page = await this.browser.newPage();
    
    // 네트워크 요청 모니터링
    this.page.on('request', (request: any) => {
      const url = request.url();
      if (url.includes('api') || url.includes('ajax') || url.includes('json')) {
        console.log('📡 API 요청:', request.method(), url);
      }
    });
    
    // 응답 모니터링
    this.page.on('response', (response: any) => {
      const url = response.url();
      if (url.includes('api') || url.includes('ajax')) {
        console.log('📥 API 응답:', response.status(), url);
      }
    });
  }
  
  /**
   * 메인 페이지 구조 분석
   */
  async analyzeMainPage() {
    console.log('\n🔍 메인 페이지 분석 시작...\n');
    
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' });
    
    // SPA 프레임워크 감지
    const framework = await this.page.evaluate(() => {
      const checks = {
        react: !!(window as any).React || !!(document.querySelector('[data-reactroot]')),
        vue: !!(window as any).Vue || !!(document.querySelector('#app')),
        angular: !!(window as any).ng || !!(document.querySelector('[ng-app]')),
        next: !!(window as any).__NEXT_DATA__,
      };
      
      return Object.entries(checks)
        .filter(([_, value]) => value)
        .map(([key]) => key);
    });
    
    console.log('🎨 감지된 프레임워크:', framework.length > 0 ? framework : 'Unknown');
    
    // 주요 네비게이션 요소 찾기
    const navigation = await this.page.evaluate(() => {
      const nav: any = {};
      
      // 메뉴 아이템들
      const menuItems = document.querySelectorAll('a[href*="reservation"], a[href*="login"], a[href*="program"], button[onclick*="reservation"]');
      nav.menuItems = Array.from(menuItems).map((item: any) => ({
        text: item.textContent?.trim(),
        href: item.href || item.getAttribute('onclick'),
        selector: item.className || item.id
      }));
      
      // 로그인 관련 요소
      nav.loginButton = document.querySelector('a[href*="login"], button[onclick*="login"]')?.outerHTML;
      nav.userMenu = document.querySelector('[class*="user"], [class*="mypage"], [class*="member"]')?.outerHTML;
      
      return nav;
    });
    
    console.log('\n📍 네비게이션 구조:');
    console.log(JSON.stringify(navigation, null, 2));
    
    return { framework, navigation };
  }
  
  /**
   * 로그인 프로세스 분석
   */
  async analyzeLoginProcess() {
    console.log('\n🔐 로그인 프로세스 분석 시작...\n');
    
    // 로그인 페이지로 이동 시도
    const loginUrls = [
      `${this.baseUrl}/login`,
      `${this.baseUrl}/member/login`,
      `${this.baseUrl}/auth/login`,
      `${this.baseUrl}/#/login`
    ];
    
    let loginPageFound = false;
    let actualLoginUrl = '';
    
    for (const url of loginUrls) {
      try {
        const response = await this.page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        if (response && response.status() === 200) {
          loginPageFound = true;
          actualLoginUrl = url;
          console.log('✅ 로그인 페이지 발견:', url);
          break;
        }
      } catch (e) {
        // 계속 시도
      }
    }
    
    if (!loginPageFound) {
      // 메인 페이지에서 로그인 버튼 클릭 시도
      await this.page.goto(this.baseUrl);
      const loginButton = await this.page.$('a[href*="login"], button:has-text("로그인"), a:has-text("로그인")');
      
      if (loginButton) {
        await loginButton.click();
        await this.page.waitForLoadState('networkidle');
        actualLoginUrl = this.page.url();
        console.log('✅ 로그인 버튼 클릭 후 URL:', actualLoginUrl);
      }
    }
    
    // 로그인 폼 구조 분석
    const loginForm = await this.page.evaluate(() => {
      const form: any = {};
      
      // ID/Email 필드
      const idFields = document.querySelectorAll('input[type="email"], input[type="text"][name*="id"], input[type="text"][name*="email"], input[type="text"][placeholder*="아이디"], input[type="text"][placeholder*="이메일"]');
      form.idField = Array.from(idFields).map((field: any) => ({
        type: field.type,
        name: field.name,
        id: field.id,
        placeholder: field.placeholder,
        selector: field.id ? `#${field.id}` : field.name ? `input[name="${field.name}"]` : null
      }));
      
      // 비밀번호 필드
      const pwFields = document.querySelectorAll('input[type="password"]');
      form.passwordField = Array.from(pwFields).map((field: any) => ({
        name: field.name,
        id: field.id,
        placeholder: field.placeholder,
        selector: field.id ? `#${field.id}` : field.name ? `input[name="${field.name}"]` : null
      }));
      
      // 로그인 버튼
      const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], button:has-text("로그인")');
      form.submitButton = Array.from(submitButtons).map((btn: any) => ({
        type: btn.type,
        text: btn.textContent?.trim(),
        selector: btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : null
      }));
      
      // Form 태그
      const formTag = document.querySelector('form');
      if (formTag) {
        form.formAction = formTag.action;
        form.formMethod = formTag.method;
        form.formId = formTag.id;
      }
      
      return form;
    });
    
    console.log('\n📝 로그인 폼 구조:');
    console.log(JSON.stringify(loginForm, null, 2));
    
    return { actualLoginUrl, loginForm };
  }
  
  /**
   * 예약 시스템 분석
   */
  async analyzeReservationSystem() {
    console.log('\n📅 예약 시스템 분석 시작...\n');
    
    // 예약 페이지 찾기
    const reservationUrls = [
      `${this.baseUrl}/reservation`,
      `${this.baseUrl}/booking`,
      `${this.baseUrl}/program`,
      `${this.baseUrl}/#/reservation`
    ];
    
    let reservationPageFound = false;
    let actualReservationUrl = '';
    
    for (const url of reservationUrls) {
      try {
        const response = await this.page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        if (response && response.status() === 200) {
          reservationPageFound = true;
          actualReservationUrl = url;
          console.log('✅ 예약 페이지 발견:', url);
          break;
        }
      } catch (e) {
        // 계속 시도
      }
    }
    
    // 예약 시스템 구조 분석
    const reservationStructure = await this.page.evaluate(() => {
      const structure: any = {};
      
      // 캘린더 요소
      structure.calendar = {
        found: !!document.querySelector('[class*="calendar"], [id*="calendar"], .datepicker'),
        selectors: [
          document.querySelector('[class*="calendar"]')?.className,
          document.querySelector('[id*="calendar"]')?.id,
        ].filter(Boolean)
      };
      
      // 프로그램 선택
      structure.programs = Array.from(document.querySelectorAll('[class*="program"], [data-program]')).map((el: any) => ({
        text: el.textContent?.trim(),
        value: el.getAttribute('data-program') || el.value,
        selector: el.className || el.id
      }));
      
      // 시간 슬롯
      structure.timeSlots = Array.from(document.querySelectorAll('[class*="time"], [class*="slot"]')).map((el: any) => ({
        text: el.textContent?.trim(),
        available: !el.classList.contains('disabled') && !el.classList.contains('sold-out'),
        selector: el.className
      }));
      
      // 예약 버튼
      structure.reserveButton = document.querySelector('button[onclick*="reserve"], button:has-text("예약"), button:has-text("신청")')?.outerHTML;
      
      return structure;
    });
    
    console.log('\n🗓️ 예약 시스템 구조:');
    console.log(JSON.stringify(reservationStructure, null, 2));
    
    return { actualReservationUrl, reservationStructure };
  }
  
  /**
   * API 엔드포인트 수집
   */
  async collectAPIEndpoints() {
    console.log('\n🌐 API 엔드포인트 수집 중...\n');
    
    const endpoints: Set<string> = new Set();
    
    // API 요청 인터셉트
    this.page.on('request', (request: any) => {
      const url = request.url();
      if (url.includes('/api/') || url.includes('.json') || request.method() === 'POST') {
        endpoints.add(`${request.method()} ${url}`);
      }
    });
    
    // 주요 페이지 방문하여 API 호출 수집
    const pagesToVisit = [
      this.baseUrl,
      `${this.baseUrl}/login`,
      `${this.baseUrl}/reservation`,
      `${this.baseUrl}/program`
    ];
    
    for (const url of pagesToVisit) {
      try {
        await this.page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        await this.page.waitForTimeout(2000);
      } catch (e) {
        // 무시
      }
    }
    
    console.log('📡 발견된 API 엔드포인트:');
    endpoints.forEach(endpoint => console.log('  -', endpoint));
    
    return Array.from(endpoints);
  }
  
  /**
   * 전체 분석 실행
   */
  async runFullAnalysis() {
    await this.initialize();
    
    console.log('=' .repeat(50));
    console.log('🚗 BMW Driving Center 사이트 정밀 분석');
    console.log('=' .repeat(50));
    
    const mainPage = await this.analyzeMainPage();
    const loginProcess = await this.analyzeLoginProcess();
    const reservationSystem = await this.analyzeReservationSystem();
    const apiEndpoints = await this.collectAPIEndpoints();
    
    const analysis = {
      url: this.baseUrl,
      timestamp: new Date().toISOString(),
      mainPage,
      loginProcess,
      reservationSystem,
      apiEndpoints
    };
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 분석 완료!');
    console.log('=' .repeat(50));
    
    // await this.browser.close();
    
    return analysis;
  }
}

// 실행 함수
export async function analyzeBMWSite() {
  const analyzer = new BMWSiteAnalyzer();
  const result = await analyzer.runFullAnalysis();
  
  // 결과를 파일로 저장
  const fs = require('fs');
  fs.writeFileSync(
    'bmw-site-analysis.json',
    JSON.stringify(result, null, 2)
  );
  
  console.log('\n💾 분석 결과가 bmw-site-analysis.json 파일로 저장되었습니다.');
  
  return result;
}