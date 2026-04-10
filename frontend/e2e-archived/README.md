# E2E 테스트 (Playwright)

VMS Chat Ops의 E2E (End-to-End) 테스트 모음입니다.

## 테스트 파일 구조

```
e2e/
├── fixtures.ts          # 테스트 픽스쳐 (로그인 상태 등)
├── auth.spec.ts         # 인증 플로우 테스트
├── providers.spec.ts    # Provider 관리 테스트
├── routes.spec.ts       # Route 관리 테스트
└── README.md            # 이 파일
```

## 테스트 실행

### 로컬 실행 (Docker 필요)

**중요**: 이 프로젝트는 Docker 기반으로 실행됩니다. 테스트 실행 전 서비스가 실행 중이어야 합니다.

```bash
# 1. Docker Compose로 서비스 시작
cd D:\Github\vms-chat-ops
docker compose up -d

# 2. Frontend 컨테이너에서 Playwright 설치 (최초 1회)
docker exec vms-chatops-frontend npx playwright install --with-deps chromium

# 3. E2E 테스트 실행
docker exec vms-chatops-frontend npm run test:e2e
```

### Headless 모드 (기본)

```bash
docker exec vms-chatops-frontend npm run test:e2e
```

### UI 모드 (브라우저 표시)

```bash
docker exec vms-chatops-frontend npm run test:e2e:headed
```

### Playwright UI 모드

```bash
docker exec vms-chatops-frontend npm run test:e2e:ui
```

## 테스트 시나리오

### 1. 인증 플로우 (auth.spec.ts)

- ✅ 로그인 페이지 표시
- ✅ 잘못된 계정 정보로 로그인 실패
- ✅ 올바른 계정 정보로 로그인 성공
- ✅ 로그아웃
- ✅ 인증 없이 보호된 페이지 접근 시 리다이렉트

**테스트 계정**:
- Email: `admin@example.com`
- Password: `admin123`

### 2. Provider 관리 (providers.spec.ts)

- ✅ Provider 목록 표시
- ✅ Add Provider 모달 열기
- ✅ Slack Provider 추가
- ✅ Provider 연결 테스트
- ✅ Provider 삭제

### 3. Route 관리 (routes.spec.ts)

- ✅ Route 목록 표시
- ✅ Add Route 모달 열기
- ✅ Route 생성
- ✅ Source와 Target이 같을 때 에러 표시
- ✅ Route 삭제

## 설정

### playwright.config.ts

주요 설정:
- **Base URL**: `http://localhost:5173` (로컬) 또는 `PLAYWRIGHT_BASE_URL` 환경 변수
- **Timeout**: 30초 (테스트), 5초 (Expect)
- **Browser**: Chromium (기본)
- **Reporter**: HTML, List
- **트레이스**: 실패 시 수집
- **스크린샷**: 실패 시 수집
- **비디오**: 실패 시 보관

### 환경 변수

```bash
# Base URL 변경
PLAYWRIGHT_BASE_URL=http://localhost:5173

# 개발 서버 자동 시작 비활성화 (Docker 사용 시)
PLAYWRIGHT_SKIP_DEV_SERVER=true
```

## 주의사항

### Docker 사용 원칙

**이 프로젝트는 반드시 Docker 컨테이너 내에서 테스트를 실행해야 합니다.**

❌ **잘못된 방법** (로컬 실행):
```bash
cd frontend
npm run test:e2e  # Docker 없이 실행 금지!
```

✅ **올바른 방법** (Docker 컨테이너 내 실행):
```bash
docker exec vms-chatops-frontend npm run test:e2e
```

### 테스트 데이터

- 테스트는 **실제 데이터베이스에 영향**을 줄 수 있습니다.
- 프로덕션 환경에서는 실행하지 마세요.
- 테스트용 데이터베이스 또는 격리된 환경에서 실행하세요.

### 선택자 (Selectors)

테스트는 텍스트 기반 선택자를 주로 사용합니다:
- `text=/login/i`: 대소문자 무시 텍스트 매칭
- `button:has-text("Add")`: 특정 텍스트를 포함한 버튼
- `input[name="email"]`: name 속성 기반 선택

UI가 변경되면 테스트도 함께 업데이트해야 합니다.

## 디버깅

### 실패한 테스트 분석

테스트 실패 시 다음 정보가 생성됩니다:

```
frontend/
├── test-results/          # 실패한 테스트의 상세 정보
│   └── auth-should-login-chromium/
│       ├── trace.zip      # 플레이백 가능한 트레이스
│       ├── test-failed-1.png  # 실패 시점 스크린샷
│       └── video.webm     # 테스트 실행 비디오
└── playwright-report/     # HTML 리포트
    └── index.html
```

### HTML 리포트 보기

```bash
docker exec vms-chatops-frontend npx playwright show-report
```

### 트레이스 뷰어

```bash
docker exec vms-chatops-frontend npx playwright show-trace test-results/.../trace.zip
```

## CI/CD

GitHub Actions 등 CI 환경에서 실행 시:

```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
    PLAYWRIGHT_BASE_URL: http://localhost:5173
```

CI 환경에서는 자동으로:
- 실패 시 2회 재시도
- 병렬 실행 비활성화 (순차 실행)
- HTML 리포트 생성

## 참고 자료

- [Playwright 공식 문서](https://playwright.dev)
- [Playwright 테스트 베스트 프랙티스](https://playwright.dev/docs/best-practices)
- [VMS Chat Ops 개발 가이드](../../docusaurus/docs/developer-guide/)
