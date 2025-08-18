// BMW 프로그램 리스트 파싱 모듈
import { BrowserView } from 'electron';

export async function fetchBMWPrograms(mainWindow, browserViews, activeBrowserViewId) {
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
    mainWindow.setBrowserView(view);
    
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
    console.log('프로그램 페이지로 이동 중...');
    await view.webContents.loadURL('https://driving-center.bmw.co.kr/useAmount/view');
    
    // 페이지 완전 로드 대기
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 로그인 페이지로 리다이렉트 되었는지 확인
    const loadedUrl = view.webContents.getURL();
    console.log('로드된 URL:', loadedUrl);
    
    if (loadedUrl.includes('login') || loadedUrl.includes('oneid')) {
      console.log('로그인이 필요합니다.');
      return {
        success: false,
        error: '로그인이 필요합니다',
        needsLogin: true,
        programs: [],
        totalFound: 0
      };
    }
    
    // 실제 웹사이트에서 프로그램명 파싱
    const programs = await view.webContents.executeJavaScript(`
      (function() {
        const programList = [];
        const foundPrograms = new Set();
        
        try {
          console.log('프로그램명 파싱 시작...');
          console.log('현재 URL:', window.location.href);
          
          // 모든 테이블 찾기
          const tables = document.querySelectorAll('table');
          console.log('테이블 개수:', tables.length);
          
          tables.forEach((table, tableIndex) => {
            // 현재 테이블 위의 h3 찾기 (카테고리) - 부모 요소까지 확인
            let category = '';
            let currentElement = table.parentElement;
            
            // 부모 요소를 거슬러 올라가면서 h3 찾기
            while (currentElement && !category) {
              // 현재 요소의 이전 형제들 확인
              let sibling = currentElement.previousElementSibling;
              while (sibling) {
                if (sibling.tagName === 'H3') {
                  const h3Text = sibling.textContent || '';
                  if (h3Text.includes('Experience')) category = 'Experience';
                  else if (h3Text.includes('Training')) category = 'Training';
                  else if (h3Text.includes('Owner')) category = 'Owner';
                  else if (h3Text.includes('Junior')) {
                    console.log('Junior Campus 테이블 스킵');
                    return; // Junior Campus는 스킵
                  }
                  break;
                }
                sibling = sibling.previousElementSibling;
              }
              
              // 못 찾았으면 부모의 부모로
              if (!category) {
                currentElement = currentElement.parentElement;
              }
            }
            
            // 그래도 못 찾았으면 테이블 바로 위 요소 확인
            if (!category) {
              let prev = table.previousElementSibling;
              while (prev && prev.tagName !== 'H3' && prev.tagName !== 'TABLE') {
                prev = prev.previousElementSibling;
              }
              if (prev && prev.tagName === 'H3') {
                const h3Text = prev.textContent || '';
                if (h3Text.includes('Experience')) category = 'Experience';
                else if (h3Text.includes('Training')) category = 'Training';
                else if (h3Text.includes('Owner')) category = 'Owner';
              }
            }
            
            console.log('테이블', tableIndex + 1, '카테고리:', category || '기타');
            
            // 헤더에서 프로그램명 컬럼 찾기
            let programColumnIndex = 0;
            const headers = table.querySelectorAll('thead th');
            headers.forEach((th, index) => {
              const headerText = th.textContent || '';
              if (headerText.includes('프로그램') || headerText === '프로그램명') {
                programColumnIndex = index;
                console.log('프로그램명 컬럼 인덱스:', index);
              }
            });
            
            // tbody의 각 행에서 프로그램명 추출
            const rows = table.querySelectorAll('tbody tr');
            let skipRows = 0;
            
            rows.forEach((row, rowIndex) => {
              // rowspan으로 인해 스킵해야 하는 행
              if (skipRows > 0) {
                skipRows--;
                return;
              }
              
              const cells = row.querySelectorAll('td');
              if (cells.length > programColumnIndex) {
                const cell = cells[programColumnIndex];
                const text = (cell.textContent || '').trim();
                const rowspan = cell.getAttribute('rowspan');
                
                if (rowspan) {
                  skipRows = parseInt(rowspan) - 1;
                }
                
                // 유효한 프로그램명인지 확인
                if (text && 
                    text.length >= 2 && 
                    !text.match(/^[0-9,]+$/) && // 숫자만 있는 것 제외
                    !text.includes('분') && // 시간 제외
                    !text.includes('원') && // 가격 제외  
                    text.match(/[가-힣A-Za-z]/)) { // 문자가 포함되어야 함
                  
                  if (!foundPrograms.has(text)) {
                    foundPrograms.add(text);
                    programList.push({
                      name: text,
                      category: category || '기타'
                    });
                    console.log('프로그램 발견:', text, '카테고리:', category);
                  }
                }
              }
            });
          });
          
          // 카테고리별로 그룹핑하고 정렬
          const groupedPrograms = {};
          const categoryOrder = ['Experience', 'Training', 'Owner'];
          
          // 카테고리 초기화
          categoryOrder.forEach(cat => {
            groupedPrograms[cat] = [];
          });
          groupedPrograms['기타'] = [];
          
          // 프로그램 분류
          programList.forEach(p => {
            const cat = p.category || '기타';
            if (groupedPrograms[cat]) {
              groupedPrograms[cat].push(p.name);
            } else {
              groupedPrograms['기타'].push(p.name);
            }
          });
          
          // 각 카테고리 내에서 정렬
          Object.keys(groupedPrograms).forEach(cat => {
            groupedPrograms[cat].sort((a, b) => a.localeCompare(b));
          });
          
          console.log('=== 파싱 결과 ===');
          console.log('총 프로그램 수:', programList.length);
          
          // 결과를 평면 배열로 변환 (카테고리 정보 포함)
          const finalPrograms = [];
          [...categoryOrder, '기타'].forEach(cat => {
            if (groupedPrograms[cat] && groupedPrograms[cat].length > 0) {
              console.log('\\n[' + cat + ']');
              groupedPrograms[cat].forEach(name => {
                console.log('  -', name);
                finalPrograms.push({
                  name: name,
                  category: cat
                });
              });
            }
          });
          
          return {
            success: true,
            programs: finalPrograms,
            groupedPrograms: groupedPrograms,
            totalFound: finalPrograms.length,
            pageUrl: window.location.href,
            timestamp: new Date().toISOString()
          };
          
        } catch (err) {
          console.error('파싱 오류:', err);
          return {
            success: false,
            error: err.toString(),
            programs: []
          };
        }
      })()
    `);
    
    console.log('파싱 완료:', programs);
    
    if (programs.success && programs.programs && programs.programs.length > 0) {
      console.log('✅ 성공! 프로그램 목록:');
      programs.programs.forEach(p => {
        console.log(`  - ${p.name} ${p.price ? '(' + p.price + '원)' : ''}`);
      });
      return programs;
    } else {
      console.log('❌ 프로그램을 찾을 수 없습니다.');
      return {
        success: false,
        programs: [],
        totalFound: 0,
        error: '프로그램을 찾을 수 없습니다',
        timestamp: new Date().toISOString()
      };
    }
    
  } catch (error) {
    console.error('BMW 프로그램 파싱 오류:', error);
    return {
      success: false,
      error: error.message,
      programs: [],
      totalFound: 0,
      timestamp: new Date().toISOString()
    };
  }
}