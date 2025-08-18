#!/usr/bin/env bun

/**
 * BMW 드라이빙 센터 사이트 분석 실행 스크립트
 */

import { analyzeBMWSite } from './src/automation/bmw-site-analyzer';

console.log('🚀 BMW 드라이빙 센터 사이트 분석을 시작합니다...\n');

analyzeBMWSite()
  .then(result => {
    console.log('\n✅ 분석이 완료되었습니다!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 분석 중 오류 발생:', error);
    process.exit(1);
  });