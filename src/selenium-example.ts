import { Builder, By, Key, until, WebDriver } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome'

/**
 * Selenium WebDriver Example / Selenium WebDriver 예제
 * 
 * This example demonstrates how to use Selenium WebDriver to automate browser interactions
 * 이 예제는 Selenium WebDriver를 사용하여 브라우저 상호작용을 자동화하는 방법을 보여줍니다
 */
async function runSeleniumExample() {
  // Configure Chrome options / Chrome 옵션 설정
  const options = new chrome.Options()
  // Uncomment to run in headless mode / 헤드리스 모드로 실행하려면 주석 해제
  // options.addArguments('--headless')
  
  // Create a new WebDriver instance / 새로운 WebDriver 인스턴스 생성
  const driver: WebDriver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build()
  
  try {
    // Navigate to Google / Google로 이동
    await driver.get('https://www.google.com')
    
    // Find the search box / 검색 박스 찾기
    const searchBox = await driver.findElement(By.name('q'))
    
    // Type a search query / 검색어 입력
    await searchBox.sendKeys('Selenium WebDriver TypeScript')
    
    // Press Enter to search / Enter 키를 눌러 검색
    await searchBox.sendKeys(Key.RETURN)
    
    // Wait for results to load / 결과 로딩 대기
    await driver.wait(until.titleContains('Selenium WebDriver TypeScript'), 5000)
    
    // Get the page title / 페이지 제목 가져오기
    const title = await driver.getTitle()
    console.log('Page title:', title)
    
    // Take a screenshot (optional) / 스크린샷 찍기 (선택사항)
    // const screenshot = await driver.takeScreenshot()
    // require('fs').writeFileSync('screenshot.png', screenshot, 'base64')
    
  } catch (error) {
    console.error('Error occurred:', error)
  } finally {
    // Always quit the driver / 항상 드라이버 종료
    await driver.quit()
  }
}

// Run the example / 예제 실행
if (require.main === module) {
  runSeleniumExample()
    .then(() => console.log('Selenium example completed successfully'))
    .catch(error => console.error('Failed to run Selenium example:', error))
}

export { runSeleniumExample }