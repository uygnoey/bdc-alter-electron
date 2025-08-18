import { Builder, By, until, WebDriver, WebElement } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome'

/**
 * BMW Driving Center Reservation Checker
 * BMW 드라이빙 센터 예약 가능 여부 확인 스크립트
 */

interface ReservationConfig {
  url: string
  username?: string
  password?: string
  targetDate?: string
  targetProgram?: string
  checkInterval?: number // 확인 주기 (밀리초)
}

interface ReservationResult {
  available: boolean
  date?: string
  program?: string
  slots?: number
  message?: string
}

export class BMWReservationChecker {
  private driver: WebDriver | null = null
  private config: ReservationConfig
  private isRunning: boolean = false

  constructor(config: ReservationConfig) {
    this.config = {
      checkInterval: 60000, // 기본 1분
      ...config
    }
  }

  /**
   * Initialize WebDriver / WebDriver 초기화
   */
  async initDriver(headless: boolean = false): Promise<void> {
    const options = new chrome.Options()
    
    if (headless) {
      options.addArguments('--headless')
    }
    
    options.addArguments('--disable-gpu')
    options.addArguments('--no-sandbox')
    options.addArguments('--disable-dev-shm-usage')
    
    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build()
  }

  /**
   * Login to BMW site / BMW 사이트 로그인
   */
  async login(): Promise<boolean> {
    if (!this.driver || !this.config.username || !this.config.password) {
      return false
    }

    try {
      // Navigate to login page / 로그인 페이지로 이동
      await this.driver.get(this.config.url)
      
      // Wait for login form / 로그인 폼 대기
      await this.driver.wait(until.elementLocated(By.id('username')), 10000)
      
      // Enter credentials / 자격 증명 입력
      const usernameField = await this.driver.findElement(By.id('username'))
      const passwordField = await this.driver.findElement(By.id('password'))
      
      await usernameField.sendKeys(this.config.username)
      await passwordField.sendKeys(this.config.password)
      
      // Submit login / 로그인 제출
      const loginButton = await this.driver.findElement(By.css('button[type="submit"]'))
      await loginButton.click()
      
      // Wait for login success / 로그인 성공 대기
      await this.driver.wait(until.urlContains('reservation'), 10000)
      
      return true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  /**
   * Check reservation availability / 예약 가능 여부 확인
   */
  async checkAvailability(): Promise<ReservationResult> {
    if (!this.driver) {
      return { available: false, message: 'Driver not initialized' }
    }

    try {
      // Navigate to reservation page / 예약 페이지로 이동
      // TODO: 실제 BMW 드라이빙 센터 페이지 구조에 맞게 수정 필요
      
      // Example: Check for available slots / 예시: 가능한 슬롯 확인
      const availableSlots = await this.driver.findElements(
        By.css('.reservation-slot.available')
      )
      
      if (availableSlots.length > 0) {
        // Get details of first available slot / 첫 번째 가능한 슬롯 정보 가져오기
        const firstSlot = availableSlots[0]
        const date = await firstSlot.getAttribute('data-date')
        const program = await firstSlot.getAttribute('data-program')
        
        return {
          available: true,
          date,
          program,
          slots: availableSlots.length,
          message: `${availableSlots.length}개의 예약 가능한 슬롯을 찾았습니다!`
        }
      }
      
      return {
        available: false,
        message: '현재 예약 가능한 슬롯이 없습니다.'
      }
    } catch (error) {
      console.error('Error checking availability:', error)
      return {
        available: false,
        message: `오류 발생: ${error}`
      }
    }
  }

  /**
   * Start monitoring / 모니터링 시작
   */
  async startMonitoring(callback: (result: ReservationResult) => void): Promise<void> {
    this.isRunning = true
    
    // Initialize driver / 드라이버 초기화
    await this.initDriver()
    
    // Login if credentials provided / 자격 증명이 있으면 로그인
    if (this.config.username && this.config.password) {
      const loginSuccess = await this.login()
      if (!loginSuccess) {
        console.error('Failed to login')
        return
      }
    }
    
    // Start checking loop / 확인 루프 시작
    while (this.isRunning) {
      const result = await this.checkAvailability()
      callback(result)
      
      if (result.available) {
        console.log('🎉 예약 가능한 슬롯을 찾았습니다!')
        // Optionally stop after finding / 찾은 후 선택적으로 중지
        // this.stop()
      }
      
      // Wait before next check / 다음 확인 전 대기
      await new Promise(resolve => setTimeout(resolve, this.config.checkInterval))
    }
  }

  /**
   * Stop monitoring / 모니터링 중지
   */
  async stop(): Promise<void> {
    this.isRunning = false
    if (this.driver) {
      await this.driver.quit()
      this.driver = null
    }
  }
}

// Example usage / 사용 예시
export async function runBMWChecker() {
  const checker = new BMWReservationChecker({
    url: 'https://www.bmw-driving-center.co.kr/',
    username: 'your-username', // 실제 사용자명으로 변경
    password: 'your-password', // 실제 비밀번호로 변경
    targetDate: '2024-08-25',
    targetProgram: 'Advanced Course',
    checkInterval: 30000 // 30초마다 확인
  })
  
  await checker.startMonitoring((result) => {
    console.log('Check result:', result)
    
    if (result.available) {
      // Send notification / 알림 전송
      console.log('🚗 BMW 드라이빙 센터 예약 가능!')
      console.log(`날짜: ${result.date}`)
      console.log(`프로그램: ${result.program}`)
      console.log(`가능한 슬롯: ${result.slots}`)
    }
  })
}