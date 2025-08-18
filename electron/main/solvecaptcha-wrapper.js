import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// CommonJS 모듈을 require로 로드
const SolveCaptcha = require('solvecaptcha-javascript');

export default SolveCaptcha;