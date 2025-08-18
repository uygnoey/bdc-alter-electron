/**
 * BMW 드라이빙 센터 자동화 컨트롤러
 * Electron의 BrowserView를 직접 제어하여 완전한 일반 사용자처럼 동작
 */

interface AutomationConfig {
  username: string;
  password: string;
  targetDates?: string[];
  targetProgram?: string;
  autoReserve?: boolean;
  checkInterval?: number;
}

export class BMWAutomationController {
  private config: AutomationConfig;
  private isRunning: boolean = false;
  private checkCount: number = 0;

  constructor(config: AutomationConfig) {
    this.config = {
      checkInterval: 30000, // 30초 기본값
      ...config
    };
  }

  /**
   * Electron IPC를 통해 BrowserView 제어
   */
  private async executeInBrowserView(action: string, data?: any) {
    // @ts-ignore
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    
    // @ts-ignore
    return await window.electronAPI.browser.executeAutomation(action, data);
  }

  /**
   * 로그인 프로세스
   */
  async login(): Promise<boolean> {
    try {
      console.log('🔐 로그인 시작...');
      
      // BMW 드라이빙 센터 로그인 페이지로 이동
      await this.executeInBrowserView('navigate', {
        url: 'https://www.bmw-driving-center.co.kr/login'
      });

      // 페이지 로드 대기
      await this.delay(3000);

      // 로그인 폼 작성 및 제출
      const loginResult = await this.executeInBrowserView('fillAndSubmitLogin', {
        username: this.config.username,
        password: this.config.password
      });

      if (loginResult.success) {
        console.log('✅ 로그인 성공!');
        return true;
      } else {
        console.error('❌ 로그인 실패:', loginResult.error);
        return false;
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      return false;
    }
  }

  /**
   * 예약 가능 여부 확인
   */
  async checkAvailability(): Promise<any> {
    try {
      console.log(`🔍 예약 확인 중... (${++this.checkCount}번째)`);
      
      // 예약 페이지로 이동
      await this.executeInBrowserView('navigate', {
        url: 'https://www.bmw-driving-center.co.kr/reservation'
      });

      await this.delay(2000);

      // 예약 가능한 슬롯 확인
      const availability = await this.executeInBrowserView('checkAvailableSlots', {
        targetDates: this.config.targetDates,
        targetProgram: this.config.targetProgram
      });

      if (availability.found) {
        console.log('🎉 예약 가능한 슬롯 발견!');
        console.log('📅 날짜:', availability.slots);
        
        // 알림 전송
        await this.sendNotification(availability);
        
        // 자동 예약 옵션이 켜져있으면
        if (this.config.autoReserve && availability.slots.length > 0) {
          await this.makeReservation(availability.slots[0]);
        }
      } else {
        console.log('😔 아직 예약 가능한 슬롯이 없습니다.');
      }

      return availability;
    } catch (error) {
      console.error('예약 확인 오류:', error);
      return { found: false, error };
    }
  }

  /**
   * 자동 예약 진행
   */
  async makeReservation(slot: any): Promise<boolean> {
    try {
      console.log('🚗 자동 예약 진행 중...');
      
      const reservationResult = await this.executeInBrowserView('makeReservation', {
        slot: slot,
        userInfo: {
          // 추가 정보가 필요한 경우
        }
      });

      if (reservationResult.success) {
        console.log('✅ 예약 완료!');
        await this.sendNotification({
          title: '예약 완료!',
          message: `BMW 드라이빙 센터 예약이 완료되었습니다.\n날짜: ${slot.date}`
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('예약 진행 오류:', error);
      return false;
    }
  }

  /**
   * 알림 전송
   */
  async sendNotification(data: any) {
    // Electron 네이티브 알림
    // @ts-ignore
    if (window.electronAPI?.notification) {
      // @ts-ignore
      await window.electronAPI.notification.show({
        title: 'BMW 드라이빙 센터',
        body: data.message || '예약 가능한 슬롯이 있습니다!',
        sound: true
      });
    }

    // 브라우저 알림 (백업)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('BMW 드라이빙 센터', {
        body: data.message || '예약 가능한 슬롯이 있습니다!',
        icon: '/bmw-logo.png'
      });
    }
  }

  /**
   * 모니터링 시작
   */
  async startMonitoring() {
    if (this.isRunning) {
      console.log('이미 모니터링 중입니다.');
      return;
    }

    this.isRunning = true;
    console.log('🚀 BMW 드라이빙 센터 모니터링 시작!');
    
    // 먼저 로그인
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.error('로그인 실패로 모니터링을 중단합니다.');
      this.isRunning = false;
      return;
    }

    // 주기적으로 확인
    while (this.isRunning) {
      await this.checkAvailability();
      
      console.log(`⏰ ${this.config.checkInterval! / 1000}초 후 다시 확인합니다...`);
      await this.delay(this.config.checkInterval!);
    }
  }

  /**
   * 모니터링 중지
   */
  stopMonitoring() {
    this.isRunning = false;
    console.log('🛑 모니터링이 중지되었습니다.');
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// React 컴포넌트에서 사용할 수 있는 Hook
export function useBMWAutomation() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [controller, setController] = useState<BMWAutomationController | null>(null);

  const start = (config: AutomationConfig) => {
    const ctrl = new BMWAutomationController(config);
    setController(ctrl);
    setIsRunning(true);
    ctrl.startMonitoring();
  };

  const stop = () => {
    if (controller) {
      controller.stopMonitoring();
      setIsRunning(false);
    }
  };

  return {
    isRunning,
    lastCheck,
    start,
    stop
  };
}