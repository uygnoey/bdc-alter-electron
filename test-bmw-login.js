#!/usr/bin/env node

/**
 * BMW 로그인 프로세스 디버깅 스크립트
 * 실제 DOM 구조를 파악하기 위한 테스트
 */

import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import fs from 'fs';

// .env 파일 로드
dotenv.config();

async function testBMWLogin() {
  const browser = await puppeteer.launch({
    headless: false, // 브라우저 보이게
    devtools: true,  // 개발자 도구 열기
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  
  // User Agent 설정
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log('1. BMW 드라이빙 센터 접속...');
  await page.goto('https://driving-center.bmw.co.kr', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  // 메인 페이지 스크린샷
  await page.screenshot({ path: 'bmw-main.png' });
  
  // 로그인 버튼 찾기
  console.log('2. 로그인 버튼 찾기...');
  const loginButton = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('a, button'));
    const loginBtn = buttons.find(btn => {
      const text = btn.textContent || '';
      return text.includes('로그인') || text.includes('Login');
    });
    return loginBtn ? {
      found: true,
      text: loginBtn.textContent,
      tagName: loginBtn.tagName,
      href: loginBtn.href
    } : { found: false };
  });
  
  console.log('로그인 버튼:', loginButton);
  
  if (loginButton.found) {
    // 로그인 클릭
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('a, button'));
      const loginBtn = buttons.find(btn => {
        const text = btn.textContent || '';
        return text.includes('로그인') || text.includes('Login');
      });
      if (loginBtn) loginBtn.click();
    });
    
    console.log('3. OAuth 페이지 로딩 대기...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    
    // OAuth 페이지 정보
    const oauthInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        inputs: Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          visible: input.offsetParent !== null,
          className: input.className
        })),
        buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent?.trim(),
          type: btn.type,
          disabled: btn.disabled,
          className: btn.className
        })),
        forms: document.querySelectorAll('form').length
      };
    });
    
    console.log('\n=== OAuth 페이지 분석 ===');
    console.log('URL:', oauthInfo.url);
    console.log('Title:', oauthInfo.title);
    console.log('\nInputs:', JSON.stringify(oauthInfo.inputs, null, 2));
    console.log('\nButtons:', JSON.stringify(oauthInfo.buttons, null, 2));
    
    // 스크린샷
    await page.screenshot({ path: 'bmw-oauth-1.png' });
    
    // 이메일 입력
    if (process.env.BMW_EMAIL) {
      console.log('\n4. 이메일 입력...');
      
      // 이메일 필드 찾기
      const emailField = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const field = inputs.find(input => 
          input.type === 'email' || 
          input.type === 'text' && !input.type.includes('password')
        );
        return field ? {
          found: true,
          selector: field.id ? `#${field.id}` : `input[type="${field.type}"]`
        } : { found: false };
      });
      
      if (emailField.found) {
        await page.type(emailField.selector, process.env.BMW_EMAIL, { delay: 100 });
        await new Promise(r => setTimeout(r, 1000));
        
        // 다음 버튼 찾기
        console.log('5. 다음 버튼 찾기...');
        const nextButton = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          const btn = buttons.find(b => {
            const text = (b.textContent || b.value || '').toLowerCase();
            return text.includes('next') || text.includes('continue') || 
                   text.includes('다음') || text.includes('계속');
          });
          return btn ? { found: true, text: btn.textContent || btn.value } : { found: false };
        });
        
        console.log('다음 버튼:', nextButton);
        
        if (nextButton.found) {
          // Enter 키 또는 버튼 클릭
          await page.keyboard.press('Enter');
          
          console.log('6. 비밀번호 페이지 대기...');
          await new Promise(r => setTimeout(r, 5000));
          
          // 비밀번호 페이지 분석
          const passwordPageInfo = await page.evaluate(() => {
            return {
              url: window.location.href,
              hasPasswordField: document.querySelector('input[type="password"]') !== null,
              inputs: Array.from(document.querySelectorAll('input')).map(input => ({
                type: input.type,
                visible: input.offsetParent !== null
              })),
              hcaptcha: document.querySelector('iframe[src*="hcaptcha"], .h-captcha') !== null
            };
          });
          
          console.log('\n=== 비밀번호 페이지 분석 ===');
          console.log('URL:', passwordPageInfo.url);
          console.log('비밀번호 필드:', passwordPageInfo.hasPasswordField);
          console.log('hCaptcha:', passwordPageInfo.hcaptcha);
          console.log('Inputs:', passwordPageInfo.inputs);
          
          await page.screenshot({ path: 'bmw-oauth-2.png' });
          
          if (passwordPageInfo.hasPasswordField && process.env.BMW_PASSWORD) {
            console.log('\n7. 비밀번호 입력...');
            await page.type('input[type="password"]', process.env.BMW_PASSWORD, { delay: 100 });
            await new Promise(r => setTimeout(r, 1000));
            
            // 로그인 버튼 찾기
            const loginButton = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
              const btn = buttons.find(b => {
                const text = (b.textContent || b.value || '').toLowerCase();
                return text.includes('login') || text.includes('sign') || 
                       text.includes('로그인') || text.includes('인증');
              });
              return btn ? { found: true, text: btn.textContent || btn.value } : { found: false };
            });
            
            console.log('로그인 버튼:', loginButton);
            
            if (loginButton.found) {
              console.log('8. 로그인 버튼 클릭...');
              await page.keyboard.press('Enter');
              
              console.log('9. hCaptcha 확인 대기...');
              await new Promise(r => setTimeout(r, 3000));
              
              // hCaptcha 확인
              const hasHcaptcha = await page.evaluate(() => {
                return document.querySelector('iframe[src*="hcaptcha"], .h-captcha, [data-hcaptcha-widget-id]') !== null;
              });
              
              console.log('\n=== 로그인 후 상태 ===');
              console.log('hCaptcha 나타남:', hasHcaptcha);
              
              if (hasHcaptcha) {
                console.log('⚠️  hCaptcha가 나타났습니다! 수동으로 해결해야 합니다.');
                await page.screenshot({ path: 'bmw-hcaptcha.png' });
              }
            }
          }
        }
      }
    }
    
    // 분석 결과 저장
    fs.writeFileSync('bmw-analysis.json', JSON.stringify({
      oauthInfo,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log('\n분석 완료! bmw-analysis.json 파일을 확인하세요.');
  }
  
  // 10초 대기 (수동 테스트용)
  console.log('\n10초 후 브라우저가 닫힙니다...');
  await new Promise(r => setTimeout(r, 10000));
  
  await browser.close();
}

// 실행
testBMWLogin().catch(console.error);