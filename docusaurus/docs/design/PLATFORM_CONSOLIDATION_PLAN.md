# v-platform 공통화 확장 설계 및 작업 계획

> **문서 버전**: 1.0  
> **작성일**: 2026-04-11  
> **상태**: 설계 검토 대기  
> **목적**: v-platform에 모니터링, 공통 훅/컴포넌트, 백엔드 패턴을 추가하여 앱 개발 부담을 최소화  
> **선행 문서**: `PLATFORM_MONITORING_CENTRALIZATION.md` (이 문서로 통합)

---

## 1. 현재 상태 요약

### 1.1 v-platform이 이미 제공하는 것

| 영역 | 제공 항목 |
|------|----------|
| **인증** | JWT 로그인/갱신, SSO (Microsoft/OIDC), 비밀번호 재설정 |
| **RBAC** | 메뉴 기반 권한, 권한 그룹, 개인 권한 |
| **사용자** | CRUD, 역할 관리, 프로필 |
| **조직도** | 회사/부서 계층 구조 |
| **감사** | 감사 로그 기록/조회/내보내기 |
| **시스템 설정** | 키-값 전역 설정 |
| **UI Kit** | 24개 컴포넌트, 10개 레이아웃, 디자인 토큰 |
| **미들웨어** | CSRF, Prometheus 메트릭, Rate Limiting |
| **Frontend** | 스토어 5개, 훅 7개, API 클라이언트 |

### 1.2 아직 앱에 남아있는 공통 코드

| 영역 | 앱에 남아있는 항목 | 문제 |
|------|-------------------|------|
| **모니터링** | 메트릭/로그/헬스체크 설정이 앱별 반복 | 표준화 안 됨 |
| **에러 처리** | useApiErrorHandler가 앱에 존재 | 앱마다 재구현 필요 |
| **WebSocket** | useWebSocket이 앱에 존재 | 실시간 기능의 공통 기반 |
| **알림** | useNotifications, useBrowserNotification이 앱에 존재 | 앱마다 재구현 |
| **설정 UI** | SecurityTab, SessionSettings, ThemeSettings 등 | 템플릿에 복사됨 (공유 아님) |
| **OAuth UI** | UserOAuthList/Card가 앱에 존재 | 앱마다 재구현 |
| **데이터 내보내기** | CSV/JSON Export 패턴이 앱에 하드코딩 | 표준 패턴 없음 |
| **이벤트 시스템** | Event Broadcaster가 앱에 존재 | WebSocket 이벤트 공통 기반 |
| **로그 뷰어** | Log Buffer가 앱에 존재 (44줄) | 재사용 불가 |
| **투어** | Tour 시스템이 앱에 존재 | 앱마다 재구현 |

---

## 2. 공통화 대상 분류

### P1: 핵심 인프라 — 모든 앱에 필수

| # | 항목 | BE/FE | 현재 위치 | LOC | 설명 |
|---|------|-------|----------|-----|------|
| 1 | **Monitoring: 메트릭 라벨링** | BE | `middleware/metrics.py` | ~50 | app 라벨 자동 주입, 인증 메트릭 추가 |
| 2 | **Monitoring: 로그 중앙화** | BE | (신규) | ~80 | `configure_platform_logging()` — JSON + app 라벨 |
| 3 | **Monitoring: HealthRegistry** | BE | `api/health.py` | ~60 | 플러그형 헬스체크, get_bridge() 제거 |
| 4 | **Event Broadcaster** | BE | `app/services/event_broadcaster.py` | ~100 | WebSocket 이벤트 분배 (범용) |
| 5 | **Log Buffer** | BE | `app/services/log_buffer.py` | ~44 | 인메모리 로그 뷰어용 |
| 6 | **useApiErrorHandler** | FE | `hooks/useApiErrorHandler.ts` | ~80 | 통합 API 에러 처리 + 토스트 |
| 7 | **useWebSocket** | FE | `hooks/useWebSocket.ts` | ~120 | 자동 재연결 WebSocket 클라이언트 |
| 8 | **useNotifications** | FE | `hooks/useNotifications.ts` | ~80 | 실시간 알림 WebSocket 리스너 |
| 9 | **useBrowserNotification** | FE | `hooks/useBrowserNotification.ts` | ~50 | 데스크톱 알림 (Notification API) |

**예상 합계**: ~660 LOC

### P2: 설정/관리 UI — 대부분의 앱에 필요

| # | 항목 | BE/FE | 현재 위치 | LOC | 설명 |
|---|------|-------|----------|-----|------|
| 10 | **PasswordChangeForm** | FE | `components/profile/` | ~100 | 비밀번호 변경 폼 |
| 11 | **SessionDeviceList** | FE | `components/profile/` | ~100 | 활성 디바이스 관리 |
| 12 | **SecurityTab** | FE | `components/settings/` | ~120 | 보안 설정 탭 |
| 13 | **SessionSettings** | FE | `components/settings/` | ~150 | 세션 타임아웃 설정 |
| 14 | **NotificationSettings** | FE | `components/settings/` | ~80 | 알림 권한 관리 |
| 15 | **ThemeSettings** | FE | `components/settings/` | ~120 | 테마/색상 프리셋 |
| 16 | **UserOAuthList/Card** | FE | `components/oauth/` | ~150 | OAuth 계정 연결 관리 |
| 17 | **User OAuth Store** | FE | `store/user-oauth.ts` | ~100 | OAuth 상태 관리 |
| 18 | **Tour System** | FE | `lib/tour/` | ~80 | 제품 투어 프레임워크 |

**예상 합계**: ~1,000 LOC

### P3: 백엔드 패턴 표준화 — 데이터 중심 앱에 유용

| # | 항목 | BE/FE | 현재 위치 | LOC | 설명 |
|---|------|-------|----------|-----|------|
| 19 | **Export Service (CSV/JSON)** | BE | `api/messages.py` | ~150 | 범용 데이터 내보내기 서비스 |
| 20 | **Stats Aggregation** | BE | `api/messages.py` | ~80 | 날짜/카테고리별 집계 패턴 |
| 21 | **Filter Options 생성** | BE | `api/messages.py` | ~50 | 동적 필터 파라미터 API |
| 22 | **Feature Checker** | BE | `services/feature_checker.py` | ~80 | OAuth 권한/기능 검증 |

**예상 합계**: ~360 LOC

### P4: 모니터링 인프라 — Grafana/Prometheus/Promtail

| # | 항목 | 유형 | 설명 |
|---|------|------|------|
| 23 | **Prometheus 멀티앱 설정** | Config | 앱 자동 발견, app 라벨 기반 |
| 24 | **Grafana platform-overview** | Dashboard | 전 앱 통합 대시보드 |
| 25 | **Grafana platform-auth** | Dashboard | 인증/세션 메트릭 대시보드 |
| 26 | **Promtail 멀티앱 설정** | Config | 앱별 라벨 자동 파싱 |
| 27 | **앱별 대시보드 분리** | Refactor | `app-specific/` 하위로 이동 |

---

## 3. 아키텍처 설계

### 3.1 공통화 후 v-platform 구조

```
platform/backend/v_platform/
├── core/
│   ├── database.py          # DB 엔진, 세션 (기존)
│   ├── exceptions.py        # 공통 예외 (기존)
│   └── logging.py           # ★ 신규: 표준 로그 설정
├── models/                  # 플랫폼 모델 11개 (기존)
├── schemas/                 # 플랫폼 스키마 (기존)
├── api/
│   ├── health.py            # ★ 개선: HealthRegistry 플러그형
│   └── ...                  # 15개 라우터 (기존)
├── services/
│   ├── event_broadcaster.py # ★ P1: 앱에서 이동
│   ├── log_buffer.py        # ★ P1: 앱에서 이동
│   ├── export_service.py    # ★ P3: CSV/JSON 내보내기 서비스
│   └── ...                  # 7개 서비스 (기존)
├── middleware/
│   └── metrics.py           # ★ 개선: app 라벨 + 인증 메트릭
├── monitoring/
│   └── registry.py          # ★ P1: 앱 커스텀 메트릭 등록
└── app.py                   # ★ 개선: 로그/모니터링 자동 초기화

platform/frontend/v-platform-core/src/
├── hooks/
│   ├── useApiErrorHandler.ts  # ★ P1: 앱에서 이동
│   ├── useWebSocket.ts        # ★ P1: 앱에서 이동
│   ├── useNotifications.ts    # ★ P1: 앱에서 이동
│   ├── useBrowserNotification.ts # ★ P1: 앱에서 이동
│   └── ...                    # 7개 훅 (기존)
├── components/
│   ├── profile/               # ★ P2: 앱에서 이동
│   │   ├── PasswordChangeForm.tsx
│   │   └── SessionDeviceList.tsx
│   ├── settings/              # ★ P2: 앱에서 이동
│   │   ├── SecurityTab.tsx
│   │   ├── SessionSettings.tsx
│   │   ├── NotificationSettings.tsx
│   │   └── ThemeSettings.tsx
│   ├── oauth/                 # ★ P2: 앱에서 이동
│   │   ├── UserOAuthList.tsx
│   │   └── UserOAuthCard.tsx
│   └── ...                    # UI/layout/auth (기존)
├── stores/
│   ├── user-oauth.ts          # ★ P2: 앱에서 이동
│   └── ...                    # 5개 스토어 (기존)
├── lib/
│   └── tour/                  # ★ P2: 앱에서 이동
└── index.ts                   # 모든 export
```

### 3.2 PlatformApp 자동 초기화 (목표)

```python
# 앱 main.py — 이것만 하면 모든 인프라 자동 설정
platform = PlatformApp(
    app_name="v-my-app",
    version="1.0.0",
)

# 자동으로 제공되는 것:
# ✅ 인증/RBAC/감사 (기존)
# ✅ 메트릭 수집 (/metrics + app 라벨)     ← P1
# ✅ 로그 포맷 (JSON + app 라벨)           ← P1
# ✅ 헬스체크 (/api/health — DB, Redis)    ← P1
# ✅ WebSocket 이벤트 시스템               ← P1
# ✅ 인메모리 로그 뷰어                     ← P1

# 앱이 추가하는 것 (선택):
HealthRegistry.register("my_service", check_fn)  # 커스텀 헬스
register_app_metrics(MY_COUNTER)                  # 커스텀 메트릭
platform.register_app_routers(my_router)          # 앱 API
```

### 3.3 Frontend 사용 패턴 (목표)

```tsx
// 앱 App.tsx — 플랫폼 훅 바로 사용
import {
  useApiErrorHandler,   // ← P1
  useWebSocket,          // ← P1
  useNotifications,      // ← P1
  PasswordChangeForm,    // ← P2
  SecurityTab,           // ← P2
  ThemeSettings,         // ← P2
} from '@v-platform/core';

// 앱 전용 컴포넌트만 직접 구현
import { MyFeatureWidget } from './components/MyFeature';
```

---

## 4. 구현 로드맵

### Phase C1: 핵심 인프라 (1~2주)

> **목표**: 모든 앱에 필수적인 모니터링 + 에러 처리 + 실시간 기반 통합

#### Backend (4일)

| 일차 | 작업 | 파일 |
|------|------|------|
| 1 | MetricsMiddleware에 app 라벨 추가 + 인증 메트릭 | `middleware/metrics.py` |
| 1 | `core/logging.py` 구현 (JSON + app 라벨) | 신규 |
| 2 | HealthRegistry 구현 + health.py 리팩토링 | `api/health.py` |
| 2 | PlatformApp에서 로그/메트릭 자동 초기화 | `app.py` |
| 3 | Event Broadcaster를 v_platform으로 이동 | `services/event_broadcaster.py` |
| 3 | Log Buffer를 v_platform으로 이동 | `services/log_buffer.py` |
| 4 | v-channel-bridge에서 이동된 모듈 참조 업데이트 | app shims |
| 4 | v-platform-template에서 동작 확인 | Docker 테스트 |

#### Frontend (3일)

| 일차 | 작업 | 파일 |
|------|------|------|
| 5 | useApiErrorHandler를 @v-platform/core로 이동 | `hooks/useApiErrorHandler.ts` |
| 5 | useWebSocket을 @v-platform/core로 이동 | `hooks/useWebSocket.ts` |
| 6 | useNotifications를 @v-platform/core로 이동 | `hooks/useNotifications.ts` |
| 6 | useBrowserNotification을 @v-platform/core로 이동 | `hooks/useBrowserNotification.ts` |
| 7 | index.ts에 신규 export 추가 | `index.ts` |
| 7 | v-channel-bridge + v-platform-template 동작 확인 | Docker 테스트 |

#### 검증 기준

- [ ] v-platform-test가 모니터링 기능 포함하여 독립 부팅
- [ ] v-channel-bridge가 기존과 동일하게 동작
- [ ] `/metrics`에 app 라벨 포함
- [ ] 로그에 JSON + app 필드 포함
- [ ] HealthRegistry에 앱 커스텀 체크 등록 가능

### Phase C2: 설정/관리 UI (1~2주)

> **목표**: 프로필/보안/테마/OAuth 설정 컴포넌트를 플랫폼으로 이동

#### Frontend (5일)

| 일차 | 작업 | 파일 |
|------|------|------|
| 1 | profile/ 컴포넌트 이동 (PasswordChangeForm, SessionDeviceList) | `components/profile/` |
| 2 | settings/ 컴포넌트 이동 (Security, Session, Notification, Theme) | `components/settings/` |
| 3 | oauth/ 컴포넌트 이동 (UserOAuthList, UserOAuthCard) | `components/oauth/` |
| 3 | user-oauth store 이동 | `stores/user-oauth.ts` |
| 4 | Tour 시스템 이동 | `lib/tour/` |
| 5 | v-platform-template에서 복사본 → shim으로 교체 | 앱 정리 |

#### 검증 기준

- [ ] v-platform-template의 Settings 페이지가 플랫폼 컴포넌트로 렌더링
- [ ] v-channel-bridge의 Settings 페이지가 동일하게 동작
- [ ] Profile, PasswordChange 페이지 동작 확인

### Phase C3: 백엔드 패턴 표준화 (1주)

> **목표**: 데이터 내보내기/집계/필터 패턴을 재사용 가능한 서비스로 추출

| 일차 | 작업 | 파일 |
|------|------|------|
| 1 | Export Service 구현 (CSV/JSON 범용) | `services/export_service.py` |
| 2 | Stats Aggregation 헬퍼 구현 | `services/stats_service.py` |
| 2 | Filter Options 생성 유틸 구현 | `utils/filters.py` |
| 3 | Feature Checker를 v_platform으로 이동 | `services/feature_checker.py` |
| 3 | v-channel-bridge의 messages API를 새 서비스로 리팩토링 | 앱 정리 |

#### 검증 기준

- [ ] ExportService.to_csv(queryset, columns) 동작
- [ ] ExportService.to_json(queryset, columns) 동작
- [ ] v-channel-bridge의 메시지 내보내기가 ExportService 사용

### Phase C4: 모니터링 인프라 (1주)

> **목표**: Prometheus/Grafana/Promtail을 멀티앱 지원으로 전환

| 일차 | 작업 | 파일 |
|------|------|------|
| 1 | Prometheus 설정 멀티앱 target | `monitoring/prometheus/` |
| 1 | Promtail 설정 멀티앱 라벨 | `monitoring/promtail/` |
| 2 | platform-overview.json 대시보드 생성 | `monitoring/grafana/` |
| 2 | platform-auth.json 대시보드 생성 | `monitoring/grafana/` |
| 3 | 기존 대시보드를 app-specific/ 하위로 이동 | 정리 |
| 3 | HealthDashboardWidget 프론트엔드 구현 | `components/monitoring/` |

---

## 5. 수량 요약

### 공통화 전후 비교

| 항목 | 공통화 전 (현재) | 공통화 후 (목표) |
|------|----------------|-----------------|
| **v-platform Backend 서비스** | 7개 | 12개 (+5) |
| **v-platform Frontend 훅** | 7개 | 11개 (+4) |
| **v-platform Frontend 컴포넌트** | ~50개 | ~60개 (+10) |
| **v-platform Frontend 스토어** | 5개 | 6개 (+1) |
| **새 앱 작성 시 보일러플레이트** | ~3,400 LOC 복사 | ~200 LOC (main.py + App.tsx) |

### Phase별 작업량

| Phase | 기간 | 이동 LOC | 신규 LOC | 난이도 |
|-------|------|---------|---------|--------|
| **C1** 핵심 인프라 | 1~2주 | ~660 | ~190 | 중 |
| **C2** 설정/관리 UI | 1~2주 | ~1,000 | ~50 | 낮음 |
| **C3** 백엔드 패턴 | 1주 | ~360 | ~200 | 중 |
| **C4** 모니터링 인프라 | 1주 | - | ~400 | 낮음 |
| **합계** | **4~6주** | **~2,020** | **~840** | |

---

## 6. 앱 개발자 체험 (최종 목표)

### 새 앱 생성 흐름

```bash
# 1. 템플릿 복사
cp -r apps/v-platform-template apps/v-my-new-app

# 2. 앱 이름/포트 수정 (main.py, package.json, docker-compose)
# 3. 앱 전용 API/모델/페이지 추가
# 4. docker compose --profile my-new-app up -d
```

### 앱이 자동으로 얻는 것 (코드 작성 0줄)

| 카테고리 | 자동 제공 항목 |
|----------|-------------|
| **인증** | 로그인, 회원가입, SSO, 비밀번호 재설정 |
| **RBAC** | 메뉴 권한, 권한 그룹, 개인 권한 |
| **사용자** | 사용자 CRUD, 역할 관리 |
| **조직도** | 회사/부서 관리 |
| **감사** | 감사 로그 자동 기록 |
| **설정** | 테마, 보안, 세션, 알림 설정 UI |
| **프로필** | 비밀번호 변경, 디바이스 관리 |
| **OAuth** | 외부 계정 연결 관리 UI |
| **모니터링** | 메트릭, 로그, 헬스체크 자동 |
| **UI Kit** | 24개 컴포넌트 + 다크모드 + 색상 프리셋 |
| **에러 처리** | API 에러 → 토스트 자동 |
| **실시간** | WebSocket + 알림 + 데스크톱 알림 |
| **데이터** | CSV/JSON 내보내기 패턴 |
| **대시보드** | Grafana 통합 뷰 자동 표시 |

### 앱이 작성하는 것 (비즈니스 로직만)

```python
# backend: 앱 전용 모델 + API + 서비스
class Ticket(Base):
    ...

@router.get("/api/tickets")
async def list_tickets():
    ...
```

```tsx
// frontend: 앱 전용 페이지 + 컴포넌트
function TicketList() {
  return <Card><Table>...</Table></Card>;
}
```

---

## 7. 우선순위 결정 기준

| 기준 | 설명 |
|------|------|
| **재사용 빈도** | 모든 앱에 필요한가? 대부분? 일부? |
| **구현 복잡도** | 이동만 하면 되는가? 리팩토링 필요? |
| **앱 영향도** | 기존 앱이 깨질 위험이 있는가? |
| **독립성** | 앱 전용 코드와 의존성이 있는가? |

### 결론

**C1 (핵심 인프라)을 먼저 진행** — 모든 앱에 즉시 효과가 있고, 모니터링은 프로덕션 운영의 기본.

**C2 (설정 UI)는 C1 직후** — v-platform-template에 이미 복사본이 있어서, 복사본 → 플랫폼 공유로 전환하면 됨.

**C3, C4는 순서 무관** — 필요한 시점에 진행.

---

**다음 액션**: Phase C1 착수 또는 본 설계 검토
