import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// CommonJS 모듈을 require로 로드
const SolveCaptcha = require('solvecaptcha-javascript');

// SolveCaptcha API 호출 함수
export async function solveCaptcha(pageUrl, sitekey) {
  const apiKey = process.env.SOLVECAPTCHA_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: 'SolveCaptcha API key not configured' };
  }
  
  if (!sitekey) {
    console.error('No sitekey provided');
    return { success: false, error: 'Sitekey is required' };
  }
  
  try {
    const solver = new SolveCaptcha.Solver(apiKey);
    
    console.log('Solving hCaptcha with:', { sitekey, pageUrl });
    
    const result = await solver.hcaptcha({
      sitekey: sitekey,
      pageurl: pageUrl
    });
    
    return { 
      success: true, 
      token: result.token || result.solution || result
    };
  } catch (error) {
    console.error('SolveCaptcha error:', error);
    return { success: false, error: error.message };
  }
}

export default SolveCaptcha;