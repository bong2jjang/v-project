---
sidebar_position: 12
title: "Provider UI 구현 이후 작업 로드맵"
description: Phase 1 완료 후 필요한 작업 및 우선순위
---

# Provider UI 구현 이후 작업 로드맵

## 📋 개요

**현재 상태**: Phase 1 Provider 설정 UI 구현 진행 중
**작성일**: 2026-04-02
**목적**: Phase 1 이후 필요한 작업들을 정리하고 우선순위 설정

---

## ✅ Phase 1: Provider 설정 UI (진행 중)

### Backend ✅ 완료
- [x] `main.py` 수정: DB 우선 전략 구현
- [x] `migrate_env_to_db()`: .env → DB 자동 마이그레이션
- [x] `accounts_test.py`: 연결 테스트 API 추가
- [x] 코드 포맷팅 및 검증

### Frontend 🚧 진행 중
- [ ] `lib/api/providers.ts`: API 클라이언트
- [ ] `store/providers.ts`: Zustand Store
- [ ] `components/settings/ProviderCard.tsx`
- [ ] `components/settings/ProviderList.tsx`
- [ ] `components/settings/ProviderModal.tsx`
- [ ] `pages/Settings.tsx`: Providers 탭 통합

### 테스트 ⏳ 대기 중
- [ ] Docker 재시작
- [ ] .env → DB 자동 마이그레이션 확인
- [ ] Provider 추가/수정/삭제 테스트
- [ ] 연결 테스트 기능 확인

**예상 완료**: 2026-04-02 ~ 2026-04-03

---

## 🎯 Phase 2: Light-Zowe Route 관리 UI

### 목표
Channels 페이지에 Light-Zowe Route 관리 기능 추가

### 필요한 작업

#### 1. Backend API (이미 준비됨)
- [x] `GET /api/bridge/routes`: 라우팅 룰 조회
- [x] `POST /api/bridge/routes`: 라우팅 룰 추가
- [x] `DELETE /api/bridge/routes`: 라우팅 룰 제거
- [ ] `GET /api/bridge/channels/{platform}`: 채널 목록 조회 (신규)

#### 2. Frontend - API & Store
- [ ] `lib/api/routes.ts`: Route API 클라이언트
- [ ] `store/routes.ts`: Route Store (또는 bridge store 확장)

#### 3. Frontend - Components
- [ ] `components/channels/RouteList.tsx`: Route 목록 표시
- [ ] `components/channels/RouteModal.tsx`: Route 추가/수정
- [ ] `components/channels/ChannelSelector.tsx`: 채널 선택 드롭다운

#### 4. Frontend - Integration
- [ ] `pages/Channels.tsx`에 "Routes" 탭 추가
- [ ] Gateway(Legacy)와 Routes(New) 병렬 표시

#### 5. 채널 자동 완성 개선
- [ ] Backend: Provider의 `get_channels()` 호출 엔드포인트
- [ ] Frontend: 채널 ID 대신 이름으로 선택 가능

**예상 작업 시간**: 3-4시간
**우선순위**: 🟡 중
**예상 완료**: 2026-04-05

---

## 🔧 Phase 3: 동적 Provider 재로드 (Hot Reload)

### 목표
UI에서 Provider 추가 시 재시작 없이 즉시 반영

### 현재 문제
- Provider는 `init_bridge()` 시 한 번만 로드됨
- UI에서 Provider 추가/수정 → DB 저장됨
- **하지만 브리지 재시작 전까지 새 Provider 미반영**

### 해결 방안

#### Option A: 브리지 재시작 API (간단)
```python
# backend/app/api/bridge.py

@router.post("/reload-providers")
async def reload_providers():
    """Provider 재로드 (브리지 재시작)"""
    bridge = get_bridge()

    # 기존 Provider 제거
    for platform in list(bridge.providers.keys()):
        await bridge.remove_provider(platform)

    # DB에서 다시 로드
    db = next(get_db_session())
    accounts = db.query(Account).filter(
        Account.enabled.is_(True),
        Account.is_valid.is_(True)
    ).all()

    for account in accounts:
        # Provider 재등록
        ...

    return {"message": "Providers reloaded"}
```

**장점**: 구현 간단 (1시간)
**단점**: 짧은 다운타임 발생

#### Option B: Hot Reload (복잡)
- Provider를 동적으로 추가/제거하는 API
- 메시지 손실 방지 로직 필요

**장점**: 무중단 운영
**단점**: 구현 복잡 (4-6시간)

**권장**: Option A (간단한 재시작 API)

**예상 작업 시간**: 1-2시간
**우선순위**: 🟢 낮음 (Phase 1 완료 후)
**예상 완료**: 2026-04-06

---

## 🔒 Phase 4: 보안 강화 (Token 암호화)

### 목표
DB에 저장된 Token/Password 암호화

### 현재 상태
- Token은 **평문으로 DB 저장**
- API 응답 시에만 마스킹 처리

### 개선 방안

#### 1. 암호화 라이브러리 추가
```bash
# requirements.txt
cryptography==42.0.0
```

#### 2. 암호화 유틸리티 작성
```python
# backend/app/utils/encryption.py

from cryptography.fernet import Fernet
import os

def get_encryption_key():
    """환경 변수에서 암호화 키 가져오기"""
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        # 개발 환경: 기본 키 사용 (프로덕션에서는 필수!)
        key = Fernet.generate_key()
    return key

fernet = Fernet(get_encryption_key())

def encrypt(value: str) -> str:
    """문자열 암호화"""
    return fernet.encrypt(value.encode()).decode()

def decrypt(encrypted: str) -> str:
    """문자열 복호화"""
    return fernet.decrypt(encrypted.encode()).decode()
```

#### 3. Account 모델 수정
```python
# backend/app/models/account.py

@property
def token_decrypted(self) -> str:
    """복호화된 Token 반환"""
    if self.token:
        return decrypt(self.token)
    return None

@token_decrypted.setter
def token_decrypted(self, value: str):
    """Token 암호화하여 저장"""
    if value:
        self.token = encrypt(value)
```

#### 4. API 수정
- 입력: 평문 Token 받음 → 암호화하여 DB 저장
- 출력: DB에서 복호화 → 마스킹 처리하여 반환
- Provider 등록 시: 복호화하여 사용

**예상 작업 시간**: 3-4시간
**우선순위**: 🟡 중 (프로덕션 배포 전 필수)
**예상 완료**: 2026-04-08

---

## 📱 Phase 5: 초기 설정 마법사 (Setup Wizard)

### 목표
첫 실행 시 단계별 설정 가이드 제공

### UI 구조
```
Step 1/4: Welcome
┌─────────────────────────────────┐
│ 🚀 Welcome to VMS Channel Bridge!    │
│                                 │
│ This wizard will help you:     │
│ • Configure Slack Provider     │
│ • Configure Teams Provider     │
│ • Create your first Route      │
│                                 │
│ [Skip Setup] [Let's Start →]   │
└─────────────────────────────────┘

Step 2/4: Slack Provider
┌─────────────────────────────────┐
│ 🟣 Configure Slack             │
│                                 │
│ Bot Token: [xoxb-__________]   │
│ App Token: [xapp-__________]   │
│                                 │
│ [Test Connection]              │
│                                 │
│ [← Back] [Skip] [Next →]       │
└─────────────────────────────────┘

Step 3/4: Teams Provider (Optional)
...

Step 4/4: Create First Route
┌─────────────────────────────────┐
│ 🔗 Create Your First Route     │
│                                 │
│ Source: [Slack #general ▼]     │
│ Target: [Slack #dev ▼]         │
│                                 │
│ [← Back] [Skip] [Finish]       │
└─────────────────────────────────┘
```

### 필요한 작업
- [ ] `components/setup/SetupWizard.tsx`
- [ ] `components/setup/WizardStep1Welcome.tsx`
- [ ] `components/setup/WizardStep2Slack.tsx`
- [ ] `components/setup/WizardStep3Teams.tsx`
- [ ] `components/setup/WizardStep4Route.tsx`
- [ ] 설정 완료 플래그 (localStorage 또는 DB)
- [ ] 첫 로그인 시 자동 표시

**예상 작업 시간**: 4-6시간
**우선순위**: 🟢 낮음 (UX 개선, 필수 아님)
**예상 완료**: 2026-04-12

---

## 🧪 Phase 6: 테스트 자동화

### 목표
Provider UI 및 Route 관리 기능 테스트 자동화

### Backend 테스트
```python
# tests/api/test_accounts.py

def test_create_slack_account(client, admin_token):
    """Slack Account 생성 테스트"""
    response = client.post(
        "/api/accounts-db",
        json={
            "name": "slack-test",
            "platform": "slack",
            "token": "xoxb-test-token",
            "app_token": "xapp-test-token",
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "slack-test"
    assert data["token_masked"]  # 마스킹 확인

def test_connection_test(client, admin_token, slack_account_id):
    """연결 테스트 API"""
    response = client.post(
        f"/api/accounts-db/{slack_account_id}/test",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    # success는 실제 Token에 따라 다름
    assert "success" in data
    assert "message" in data
```

### Frontend 테스트 (Vitest)
```typescript
// tests/components/ProviderList.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { ProviderList } from '@/components/settings/ProviderList';

test('renders provider list', () => {
  render(<ProviderList />);
  expect(screen.getByText('Slack Provider')).toBeInTheDocument();
});

test('opens modal when clicking Add Provider', () => {
  render(<ProviderList />);
  fireEvent.click(screen.getByText('+ Add Provider'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
```

### 필요한 작업
- [ ] Backend 단위 테스트 작성
- [ ] Backend 통합 테스트 작성
- [ ] Frontend 컴포넌트 테스트 작성
- [ ] E2E 테스트 (Playwright)

**예상 작업 시간**: 6-8시간
**우선순위**: 🟡 중 (프로덕션 배포 전 권장)
**예상 완료**: 2026-04-15

---

## 📚 Phase 7: 문서화

### 사용자 문서
- [ ] **설정 가이드**: Provider 추가 방법
- [ ] **Route 관리 가이드**: 채널 연결 방법
- [ ] **문제 해결 가이드**: 연결 실패 시 대처법
- [ ] **FAQ**: 자주 묻는 질문

### 개발자 문서
- [ ] **API 문서**: Swagger/OpenAPI 업데이트
- [ ] **아키텍처 문서**: Light-Zowe 구조 설명
- [ ] **기여 가이드**: Pull Request 규칙

### 위치
```
docusaurus/docs/
├── user-guide/
│   ├── provider-setup.md       # Provider 설정
│   ├── route-management.md     # Route 관리
│   └── troubleshooting.md      # 문제 해결
├── developer-guide/
│   ├── api-reference.md        # API 레퍼런스
│   ├── architecture.md         # 아키텍처
│   └── contributing.md         # 기여 가이드
```

**예상 작업 시간**: 4-6시간
**우선순위**: 🟡 중
**예상 완료**: 2026-04-16

---

## 🚀 Phase 8: 프로덕션 준비

### 1. 성능 최적화
- [ ] DB 인덱스 최적화
- [ ] API 응답 캐싱 (Redis)
- [ ] Frontend 번들 최적화

### 2. 모니터링
- [ ] Prometheus Metrics 추가
- [ ] Grafana 대시보드 작성
- [ ] 에러 로깅 (Sentry)

### 3. 배포 자동화
- [ ] GitHub Actions CI/CD
- [ ] Docker Image 최적화
- [ ] Health Check 강화

### 4. 보안 점검
- [ ] OWASP Top 10 검토
- [ ] Dependency 취약점 스캔
- [ ] HTTPS 강제
- [ ] CORS 설정 검토

**예상 작업 시간**: 8-10시간
**우선순위**: 🔴 높음 (프로덕션 배포 전 필수)
**예상 완료**: 2026-04-20

---

## 📅 전체 로드맵 타임라인

```
Week 1 (04/01 - 04/07)
├─ [Mon-Tue] Phase 1: Provider UI (완료)
├─ [Wed-Thu] Phase 2: Route 관리 UI
└─ [Fri] Phase 3: Hot Reload API

Week 2 (04/08 - 04/14)
├─ [Mon-Tue] Phase 4: Token 암호화
├─ [Wed-Thu] Phase 5: Setup Wizard
└─ [Fri] Phase 6: 테스트 자동화 (시작)

Week 3 (04/15 - 04/21)
├─ [Mon-Tue] Phase 6: 테스트 자동화 (완료)
├─ [Wed] Phase 7: 문서화
└─ [Thu-Fri] Phase 8: 프로덕션 준비 (시작)

Week 4 (04/22 - 04/28)
├─ [Mon-Wed] Phase 8: 프로덕션 준비 (완료)
├─ [Thu] 최종 테스트
└─ [Fri] 🚀 프로덕션 배포
```

---

## 🎯 우선순위 매트릭스

| Phase | 기능 | 우선순위 | 중요도 | 긴급도 |
|-------|------|----------|--------|--------|
| Phase 1 | Provider UI | 🔴 최고 | 높음 | 높음 |
| Phase 2 | Route UI | 🟡 중 | 높음 | 중 |
| Phase 3 | Hot Reload | 🟢 낮음 | 중 | 낮음 |
| Phase 4 | Token 암호화 | 🟡 중 | 높음 | 중 |
| Phase 5 | Setup Wizard | 🟢 낮음 | 중 | 낮음 |
| Phase 6 | 테스트 자동화 | 🟡 중 | 높음 | 중 |
| Phase 7 | 문서화 | 🟡 중 | 중 | 중 |
| Phase 8 | 프로덕션 준비 | 🔴 높음 | 높음 | 높음 |

---

## 💡 권장 진행 순서

### 최소 기능 (MVP)
```
Phase 1 → Phase 2 → 배포 가능
```

### 안정적 운영
```
Phase 1 → Phase 2 → Phase 4 → Phase 8 → 배포
```

### 완전한 시스템
```
Phase 1 → Phase 2 → Phase 3 → Phase 4 →
Phase 6 → Phase 7 → Phase 8 → 배포
```

---

## 🔄 다음 즉시 작업

**현재**: Phase 1 Provider UI 구현 중

**다음 단계**:
1. Frontend API 클라이언트 작성
2. Frontend Store 작성
3. Frontend 컴포넌트 작성
4. Settings 페이지 통합
5. Docker 재시작 및 테스트

**예상 완료 시간**: 3-4시간

---

**문서 버전**: 1.0
**최종 업데이트**: 2026-04-02
**작성자**: VMS Channel Bridge Team
**상태**: 📋 계획 수립 완료
