# Build Instructions / 빌드 안내

## Prerequisites / 사전 요구사항

1. **GitHub Personal Access Token**
   - GitHub에서 Personal Access Token을 생성해야 합니다
   - Settings → Developer settings → Personal access tokens → Generate new token
   - 필요한 권한: `repo` (전체 저장소 접근)
   
2. **환경 변수 설정**
   ```bash
   export GH_TOKEN=your_github_token_here
   ```
   또는 `.env` 파일에 추가:
   ```
   GH_TOKEN=your_github_token_here
   ```

## Build Commands / 빌드 명령어

### 개발 모드 실행
```bash
bun run dev
```

### 프로덕션 빌드 (로컬)

#### macOS
```bash
bun run dist:mac
```

#### Windows
```bash
bun run dist:win
```

#### Linux
```bash
bun run dist:linux
```

#### 모든 플랫폼
```bash
bun run dist
```

### GitHub Release 배포
```bash
bun run release
```
이 명령은 빌드 후 자동으로 GitHub Releases에 업로드합니다.

## 빌드 결과물 위치
- `release/` 디렉토리에 생성됩니다
- macOS: `.dmg`, `.zip` 파일
- Windows: `.exe` 설치 파일
- Linux: `.AppImage`, `.deb` 파일

## 자동 업데이트 설정

앱은 다음과 같이 자동 업데이트를 확인합니다:
- 앱 시작 시
- 이후 30분마다
- 새 버전이 발견되면 자동으로 다운로드 및 설치

## 버전 관리

1. `package.json`의 `version` 필드를 업데이트
2. 변경사항 커밋
3. Git 태그 생성:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
4. GitHub Release 생성:
   ```bash
   bun run release
   ```

## 아이콘 재생성

아이콘을 변경하려면:
```bash
node scripts/generate-icons.js
```

## 문제 해결

### macOS 코드 서명 오류
- Apple Developer 계정이 없어도 빌드는 가능합니다
- 배포 시에는 코드 서명이 필요할 수 있습니다

### Windows 빌드 오류
- Windows에서 빌드하거나 Wine을 설치해야 합니다

### GitHub Release 업로드 실패
- GH_TOKEN이 올바르게 설정되었는지 확인
- 토큰에 `repo` 권한이 있는지 확인
- 인터넷 연결 상태 확인