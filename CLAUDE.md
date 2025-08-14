# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Preferences / 언어 설정

- **Responses**: Always respond in Korean (한국어로만 답변)
- **Documentation**: Write all documentation, comments, and code documentation in both English and Korean (문서는 영어와 한국어 모두 작성)

## Project Overview

This is an Electron application project named `bdc-alter` that can display web pages in a desktop window with browser-like features including tabs, navigation controls, and URL input.
일렉트론 기반의 데스크톱 애플리케이션으로 웹 페이지를 표시할 수 있으며, 탭, 네비게이션 컨트롤, URL 입력 등 브라우저 기능을 포함합니다.

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

- `src/` directory contains:
  - `main.js`: Electron main process (메인 프로세스)
  - `preload.js`: Preload script for security context (보안 컨텍스트용 프리로드 스크립트)
  - `index.html`: Renderer process UI with tab management and webview (탭 관리와 웹뷰가 있는 렌더러 프로세스 UI)
  - `index.ts`: TypeScript entry point (TypeScript 진입점)
- `dist/`: Compiled TypeScript output directory
- TypeScript configuration uses strict mode with ES2016 target
- Module system: CommonJS with esModuleInterop enabled

## Development Progress Tracking / 개발 진행 상황 추적

### Completed Tasks / 완료된 작업
1. ✅ Electron and dependencies installed with bun / bun으로 일렉트론 및 의존성 설치 완료
2. ✅ main.js created - Electron main process with window management / main.js 생성 - 윈도우 관리가 포함된 일렉트론 메인 프로세스
3. ✅ preload.js created - Security context bridge / preload.js 생성 - 보안 컨텍스트 브리지
4. ✅ index.html created - Full-featured browser UI with tabs / index.html 생성 - 탭 기능이 있는 브라우저 UI
5. ✅ package.json scripts updated for Electron / 일렉트론용 package.json 스크립트 업데이트
6. ✅ CLAUDE.md updated with project information / 프로젝트 정보로 CLAUDE.md 업데이트

## Key Features / 주요 기능
- Web page display using webview tags / webview 태그를 사용한 웹 페이지 표시
- Tab management (create, switch, close) / 탭 관리 (생성, 전환, 닫기)
- Navigation controls (back, forward, reload, home) / 네비게이션 컨트롤 (뒤로, 앞으로, 새로고침, 홈)
- URL input and navigation / URL 입력 및 이동
- Security: contextIsolation enabled, nodeIntegration disabled / 보안: contextIsolation 활성화, nodeIntegration 비활성화