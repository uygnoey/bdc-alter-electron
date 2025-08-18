# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Preferences / 언어 설정

- **Responses**: Always respond in Korean (한국어로만 답변)
- **Documentation**: Write all documentation, comments, and code documentation in both English and Korean (문서는 영어와 한국어 모두 작성)

## Project Overview

BMW 드라이빙 센터 예약 모니터링 시스템 - Electron + React + Tailwind CSS v4 기반 데스크톱 애플리케이션
BMW Driving Center reservation monitoring system - Desktop application based on Electron + React + Tailwind CSS v4

## Commands

### Package Management / 패키지 관리
- **IMPORTANT**: Use `bun` for all package management (not npm or yarn)
- **중요**: 모든 패키지 관리는 `bun`을 사용합니다 (npm이나 yarn 대신)

### Build
```bash
bun run build
```
Compiles TypeScript files from `src/` to JavaScript in `dist/` directory.

### Run Electron App / 일렉트론 앱 실행
```bash
bun run start
# or / 또는
bun run dev
```
Starts the Electron application / 일렉트론 애플리케이션을 시작합니다

## Project Structure

- `electron/` directory:
  - `main/index.js`: Electron main process with BMW automation (BMW 자동화가 포함된 메인 프로세스)
  - `main/bmw-programs-parser.js`: BMW 프로그램 목록 파싱 모듈
  - `main/solvecaptcha-wrapper.js`: SolveCaptcha API wrapper
  - `preload/index.js`: IPC bridge for renderer process (렌더러 프로세스용 IPC 브리지)
- `src/` directory:
  - `components/ElectronBrowser.tsx`: Main browser component with split view
  - `components/BMWReservationPanel.tsx`: BMW reservation settings panel
  - `types/electron.d.ts`: TypeScript type definitions
- Vite + React + TypeScript configuration
- Tailwind CSS v4 with PostCSS

## Development Progress Tracking / 개발 진행 상황 추적

### Completed Tasks / 완료된 작업
1. ✅ Electron + React + Tailwind CSS v4 기반 데스크톱 앱 구현
2. ✅ 50:50 분할 화면 레이아웃 (BMW 예약 설정 패널 / BrowserView)
3. ✅ BMW OAuth 자동 로그인 (이메일 → 비밀번호 → hCaptcha)
4. ✅ SolveCaptcha API 통합 (hCaptcha 자동 해결)
5. ✅ 프로그램 목록 파싱 (Experience, Training, Owner 카테고리 - Junior Campus 제외)
6. ✅ 다중 프로그램 선택 UI (체크박스 형태)
7. ✅ 예약 모니터링 기능
8. ✅ 사용하지 않는 코드 정리 및 최적화

## Key Features / 주요 기능

### BMW 예약 모니터링 / BMW Reservation Monitoring
- BMW OAuth 자동 로그인 (2단계: 이메일 → 비밀번호)
- hCaptcha 자동 감지 및 SolveCaptcha API 연동
- 프로그램 목록 실시간 파싱 (테이블 헤더 기반)
- 다중 프로그램 선택 가능 (체크박스 UI)
- 예약 가능 여부 주기적 확인 (30초/1분/2분/5분)
- 알림 기능 (브라우저 노티피케이션)

### 기술적 특징 / Technical Features
- Electron BrowserView (iframe 대신)
- IPC 통신으로 메인/렌더러 프로세스 분리
- TypeScript + React 19.1.1
- Tailwind CSS v4 + PostCSS
- Vite 번들링

## Important Notes / 중요 사항

### BMW 사이트 구조
- 로그인 URL: https://oneid.bmw.co.kr
- 프로그램 페이지: https://driving-center.bmw.co.kr/useAmount/view
- 프로그램 카테고리: Experience, Training, Owner (Junior Campus는 파싱 제외)
- rowspan 처리 필요 (예: Taxi 프로그램)

### 환경 변수 / Environment Variables
`.env` 파일에 BMW 계정 정보 저장:
```
BMW_USERNAME=your_email@example.com
BMW_PASSWORD=your_password
SOLVECAPTCHA_API_KEY=your_api_key
```

### 주의사항
- hCaptcha는 로그인 버튼 클릭 **후** 나타남
- Vue.js SPA이므로 페이지 로드 대기 필요
- 프로그램명 파싱 시 "분", "원" 등 제외 필요

## GitHub Repository
- URL: https://github.com/uygnoey/bdc-alter-electron
- Main branch: main