# BMW Driving Center Monitoring System - Project Memory

## Project Overview
Desktop application for monitoring BMW Driving Center reservations built with Electron + React + Tailwind CSS v4

## Recent Major Implementations (2025-08-22)

### 1. Core Features Completed
- **Multi-category program parsing**: Iterates through all categories (Experience, Training, Owner) in secondDepthBox
- **Continuous monitoring**: Immediate re-parsing after completion without intervals
- **Force-stop functionality**: Immediate cancellation with AbortController
- **Program filtering**: Exact name matching with language variant support (KOR/ENG)
- **Vehicle-specific time slot parsing**: Handles multiple vehicles in swiper carousel
- **Date format improvement**: Full date display as "YYYY년 MM월 DD일"

### 2. Build System Setup
- **Electron Builder configured**: Multi-platform build support (macOS, Windows, Linux)
- **Auto-updater integrated**: GitHub Releases-based automatic updates
- **Icon generation**: SVG to PNG conversion for all platforms
- **Build configuration**: electron-builder.yml with proper settings
- **GitHub publish**: Ready for release deployment

### 3. Technical Architecture

#### File Structure
```
bdc-alter/
├── electron/
│   ├── main/
│   │   ├── index.js (main process with auto-updater)
│   │   ├── browser-automation.js (BMW site automation)
│   │   ├── bmw-programs-parser.js (program parsing)
│   │   └── solvecaptcha-wrapper.js (captcha API)
│   └── preload/
│       └── index.js (IPC bridge)
├── src/
│   └── components/
│       ├── ElectronBrowser.tsx (split view browser)
│       └── BMWReservationPanel.tsx (reservation UI)
├── build/ (icons and resources)
├── scripts/ (build scripts)
├── electron-builder.yml (build config)
└── package.json
```

#### Key Technologies
- **Frontend**: React 19.1.1 + TypeScript + Tailwind CSS v4
- **Backend**: Electron 37.2.6 + Node.js
- **Build**: Vite + Electron Builder
- **Updates**: electron-updater with GitHub integration
- **Package Manager**: Bun (not npm/yarn)

### 4. BMW Site Integration Details

#### Login Flow
1. Direct navigation to schedule page: `https://driving-center.bmw.co.kr/orders/programs/schedules/view`
2. Auto-detection of OAuth redirect to login page
3. Two-step authentication: email → password
4. hCaptcha handling (manual or SolveCaptcha API)
5. Automatic return to schedule page after login

#### Program Parsing Logic
1. Fetches programs from `useAmount/view` without login
2. Filters Junior Campus programs (excludes chargeCont2 DOM)
3. Handles rowspan for multi-row programs (e.g., Taxi)
4. Categories: Experience, Training, Owner, Test Drive, Off-Road
5. No hardcoded program lists - all dynamically parsed

#### Reservation Checking Flow
1. Calendar navigation (multiple months)
2. Available date detection
3. Category iteration (all categories checked)
4. Program swiper navigation
5. Vehicle selection and time slot parsing
6. Selected program filtering (exact name match)

### 5. Important Implementation Details

#### Program Name Matching
```javascript
// Exact matching with language variants only
"Starter Pack" matches: "Starter Pack (KOR)", "Starter Pack (ENG)"
"Starter Pack" does NOT match: "i Starter Pack", "Starter Pack Plus"
```

#### Continuous Monitoring
```javascript
const continuousMonitoring = async () => {
  while (isRunningRef.current) {
    await checkReservation()
    // Immediately continue after completion
  }
}
```

#### Force Stop Implementation
- Uses AbortController for cancellation signals
- Check points throughout checkAvailability function
- Immediate UI feedback when stopped

### 6. Build & Deployment

#### Build Commands
```bash
bun run dev          # Development
bun run dist:mac     # macOS build
bun run dist:win     # Windows build
bun run dist:linux   # Linux build
bun run release      # GitHub release
```

#### Version Info
- Current version: 0.0.1
- App ID: me.yeongyu.bmw.driving.center.monitor
- Product Name: BMW 드라이빙 센터 모니터

#### GitHub Repository
- URL: https://github.com/uygnoey/bdc-alter-electron
- Auto-update: Checks on startup and every 30 minutes

### 7. Environment Variables
```env
BMW_USERNAME=email@example.com
BMW_PASSWORD=password
SOLVECAPTCHA_API_KEY=api_key
GH_TOKEN=github_token (for releases)
```

### 8. Known Issues & TODOs
- hCaptcha requires manual solving (SolveCaptcha integration incomplete)
- Windows and Linux builds need testing
- Code signing for macOS distribution pending
- Notification system could be enhanced

### 9. Recent Bug Fixes
- Fixed: Category iteration now checks all categories, not just first active
- Fixed: Selected programs filtering with exact name matching
- Fixed: Date format now shows full YYYY년 MM월 DD일
- Fixed: Continuous monitoring without intervals
- Fixed: Force stop functionality works immediately

### 10. Testing Notes
- Use `bun` for all package management
- Development server runs on http://localhost:5173
- Electron DevTools auto-open in development mode
- BMW site navigation works in split-screen BrowserView

## Critical Notes
- NEVER use npm or yarn - always use bun
- Program names are now simple string arrays, not objects
- Login only happens when redirected (not proactively)
- All responses should be in Korean (한국어)
- Don't create documentation unless explicitly requested

## Last Update
2025-08-22 - Electron Builder setup with auto-update via GitHub Releases