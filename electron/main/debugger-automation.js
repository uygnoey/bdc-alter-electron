/**
 * Chrome DevTools Protocol을 통한 자동화
 * 가장 낮은 수준의 제어 - 감지 거의 불가능
 */

import { BrowserView } from 'electron';

export class DebuggerAutomation {
  constructor(browserView) {
    this.view = browserView;
    this.webContents = browserView.webContents;
  }

  async initialize() {
    try {
      // Chrome DevTools Protocol 활성화
      await this.webContents.debugger.attach('1.3');
      console.log('Debugger attached');
    } catch (err) {
      console.error('Debugger attach failed:', err);
    }
  }

  /**
   * 마우스 이벤트 시뮬레이션 (실제 사용자처럼)
   */
  async mouseClick(x, y) {
    // 마우스 이동
    await this.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: x,
      y: y,
      modifiers: 0,
      timestamp: Date.now()
    });

    // 약간의 지연
    await new Promise(r => setTimeout(r, 100));

    // 마우스 누르기
    await this.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: x,
      y: y,
      button: 'left',
      clickCount: 1,
      modifiers: 0,
      timestamp: Date.now()
    });

    await new Promise(r => setTimeout(r, 50));

    // 마우스 떼기
    await this.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: x,
      y: y,
      button: 'left',
      clickCount: 1,
      modifiers: 0,
      timestamp: Date.now()
    });
  }

  /**
   * 키보드 타이핑 시뮬레이션 (완전히 실제 타이핑처럼)
   */
  async typeText(text, delay = 100) {
    for (const char of text) {
      // keydown
      await this.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyDown',
        text: char,
        unmodifiedText: char,
        key: char,
        code: `Key${char.toUpperCase()}`,
        windowsVirtualKeyCode: char.charCodeAt(0),
        nativeVirtualKeyCode: char.charCodeAt(0),
        autoRepeat: false,
        isKeypad: false,
        isSystemKey: false,
        timestamp: Date.now()
      });

      // char (텍스트 입력)
      await this.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'char',
        text: char,
        unmodifiedText: char,
        key: char,
        code: `Key${char.toUpperCase()}`,
        windowsVirtualKeyCode: char.charCodeAt(0),
        nativeVirtualKeyCode: char.charCodeAt(0),
        autoRepeat: false,
        isKeypad: false,
        isSystemKey: false,
        timestamp: Date.now()
      });

      // keyup
      await this.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: char,
        code: `Key${char.toUpperCase()}`,
        windowsVirtualKeyCode: char.charCodeAt(0),
        nativeVirtualKeyCode: char.charCodeAt(0),
        autoRepeat: false,
        isKeypad: false,
        isSystemKey: false,
        timestamp: Date.now()
      });

      // 랜덤 지연 (사람처럼)
      await new Promise(r => setTimeout(r, delay + Math.random() * 100));
    }
  }

  /**
   * 요소 찾고 클릭하기
   */
  async clickElement(selector) {
    const result = await this.webContents.debugger.sendCommand('Runtime.evaluate', {
      expression: `
        (function() {
          const element = document.querySelector('${selector}');
          if (element) {
            const rect = element.getBoundingClientRect();
            return {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              found: true
            };
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });

    if (result.result.value.found) {
      await this.mouseClick(result.result.value.x, result.result.value.y);
      return true;
    }
    return false;
  }

  /**
   * 입력 필드에 텍스트 입력
   */
  async inputText(selector, text) {
    // 먼저 입력 필드 클릭
    await this.clickElement(selector);
    await new Promise(r => setTimeout(r, 300));

    // 기존 텍스트 선택 (Ctrl+A)
    await this.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'a',
      code: 'KeyA',
      modifiers: 2, // Ctrl
      timestamp: Date.now()
    });

    // 텍스트 입력
    await this.typeText(text);
  }

  /**
   * BMW 로그인 자동화
   */
  async loginBMW(username, password) {
    // 로그인 페이지로 이동
    await this.view.webContents.loadURL('https://www.bmw-driving-center.co.kr/login');
    
    // 페이지 로드 대기
    await new Promise(r => setTimeout(r, 3000));

    // 사용자명 입력
    await this.inputText('input[type="email"], #username', username);
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

    // 비밀번호 입력
    await this.inputText('input[type="password"]', password);
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

    // 로그인 버튼 클릭
    await this.clickElement('button[type="submit"]');

    return true;
  }

  async detach() {
    if (this.webContents.debugger.isAttached()) {
      this.webContents.debugger.detach();
    }
  }
}