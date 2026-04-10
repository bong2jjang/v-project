# v-platform 공통화 확장 설계 및 작업 계획

> **문서 버전**: 2.0  
> **작성일**: 2026-04-11  
> **상태**: 설계 검토 대기  
> **목적**: v-platform에 멀티앱 데이터 분리, 모니터링, 공통 훅/컴포넌트, 백엔드 패턴, 문서 구조를 추가하여 앱 개발 부담을 최소화  
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

### 1.2 해결이 필요한 문제

| 문제 | 현상 | 영향 |
|------|------|------|
| **멀티앱 데이터 혼재** | 모든 앱이 같은 메뉴/설정 데이터를 공유 | template에 v-channel-bridge 메뉴가 노출 |
| **모니터링 앱별 반복** | 메트릭/로그/헬스 설정을 앱마다 구현 | 표준화 안 됨 |
| **공통 훅 미분리** | 에러 처리, WebSocket, 알림이 앱에 존재 | 앱마다 재구현 |
| **설정 UI 복사** | template에 v-channel-bridge 컴포넌트를 복사 | 동기화 안 됨 |
| **문서 구조 혼재** | 플랫폼/앱 문서가 같은 폴더에 존재 | 앱 추가 시 혼란 |

---

## 2. Phase C0: 멀티앱 데이터 분리 (최우선)

> **목표**: 같은 DB를 공유하되, 앱별 데이터(메뉴, 설정)가 격리되어 각 앱에 해당 메뉴만 표시

### 2.1 데이터 분류

| 테이블 | 공유 범위 | 분리 방식 |
|--------|----------|----------|
| `users` | **플랫폼 공유** | 전 앱 동일 계정 사용 |
| `user_permissions` | **플랫폼 공유** | 메뉴 권한은 메뉴와 연동되므로 앱별 자동 분리 |
| `permission_groups` | **플랫폼 공유** | 역할 그룹은 전 앱 공통 |
| `companies`, `departments` | **플랫폼 공유** | 조직도는 전 앱 공통 |
| `refresh_tokens` | **플랫폼 공유** | 인증 토큰 |
| `audit_logs` | **플랫폼 공유** | `app_id` 컬럼 추가하여 출처 구분 |
| `menu_items` | **앱별 분리** | `app_id` 컬럼 추가, 앱별 필터 |
| `system_settings` | **혼합** | `app_id` 컬럼 추가 (NULL=전역, 값=앱별) |
| `accounts` (Slack/Teams) | **앱 전용** | v-channel-bridge만 사용 |
| `messages`, `message_stats` | **앱 전용** | v-channel-bridge만 사용 |

### 2.2 스키마 변경

#### 2.2.1 `menu_items` 테이블

```sql
-- 마이그레이션: p015_add_app_id_to_menus.py
ALTER TABLE menu_items ADD COLUMN app_id VARCHAR(50) DEFAULT NULL;

-- 기존 built_in 메뉴 분류:
-- 플랫폼 공통 메뉴 (모든 앱에 표시)
UPDATE menu_items SET app_id = NULL
WHERE menu_key IN ('dashboard', 'settings', 'help', 'users', 'audit_logs',
                   'menu_management', 'permission_management', 'permission_groups',
                   'organizations');

-- v-channel-bridge 전용 메뉴
UPDATE menu_items SET app_id = 'v-channel-bridge'
WHERE menu_key IN ('channels', 'messages', 'statistics', 'integrations', 'monitoring');

-- 인덱스
CREATE INDEX idx_menu_items_app_id ON menu_items(app_id);
```

#### 2.2.2 `audit_logs` 테이블

```sql
-- 마이그레이션: p016_add_app_id_to_audit_logs.py
ALTER TABLE audit_logs ADD COLUMN app_id VARCHAR(50) DEFAULT NULL;
CREATE INDEX idx_audit_logs_app_id ON audit_logs(app_id);
```

#### 2.2.3 `system_settings` 테이블

```sql
-- 마이그레이션: p017_add_app_id_to_system_settings.py
ALTER TABLE system_settings ADD COLUMN app_id VARCHAR(50) DEFAULT NULL;
-- NULL = 전역 설정 (모든 앱 공유)
-- 'v-channel-bridge' = 앱별 설정
CREATE UNIQUE INDEX uq_system_settings_key_app
  ON system_settings(key, COALESCE(app_id, ''));
```

### 2.3 API 변경

#### 2.3.1 PlatformApp에 app_id 주입

```python
# v_platform/app.py
class PlatformApp:
    def __init__(self, app_name: str, ...):
        self.app_name = app_name  # 이미 존재
        # app_name을 모든 요청 context에 주입
        self.fastapi.state.app_id = app_name
```

#### 2.3.2 메뉴 조회 API 필터

```python
# v_platform/api/menus.py
@router.get("/api/menus")
async def get_menus(request: Request, ...):
    app_id = request.app.state.app_id
    # 플랫폼 공통 메뉴 (app_id IS NULL) + 해당 앱 메뉴
    menus = db.query(MenuItem).filter(
        or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id)
    ).all()
```

#### 2.3.3 감사 로그 기록 시 app_id 자동 주입

```python
# v_platform/utils/audit_logger.py
def log_action(action, user, detail, request=None):
    app_id = getattr(request.app.state, 'app_id', None) if request else None
    audit_log = AuditLog(action=action, user_id=user.id, app_id=app_id, ...)
```

### 2.4 앱 부팅 시 메뉴 시드

```python
# PlatformApp.init_platform() 확장
def init_platform(self):
    init_db()
    init_sso_providers()
    self._seed_platform_menus()  # 플랫폼 공통 메뉴 보장

# 앱에서 앱 전용 메뉴 시드
# v-channel-bridge main.py
def seed_app_menus():
    """v-channel-bridge 전용 메뉴 시드"""
    app_menus = [
        {"menu_key": "channels", "title": "채널 관리", "app_id": "v-channel-bridge"},
        {"menu_key": "messages", "title": "메시지", "app_id": "v-channel-bridge"},
        ...
    ]
```

### 2.5 작업 목록

| 일차 | 작업 | 파일 |
|------|------|------|
| 1 | `menu_items` 에 `app_id` 컬럼 추가 마이그레이션 | `p015_add_app_id_to_menus.py` |
| 1 | `audit_logs` 에 `app_id` 컬럼 추가 마이그레이션 | `p016_add_app_id_to_audit_logs.py` |
| 1 | `system_settings` 에 `app_id` 컬럼 추가 마이그레이션 | `p017_add_app_id_to_system_settings.py` |
| 2 | MenuItem 모델에 `app_id` 필드 추가 | `v_platform/models/menu_item.py` |
| 2 | AuditLog 모델에 `app_id` 필드 추가 | `v_platform/models/audit_log.py` |
| 2 | SystemSettings 모델에 `app_id` 필드 추가 | `v_platform/models/system_settings.py` |
| 3 | 메뉴 API에 app_id 필터 적용 | `v_platform/api/menus.py` |
| 3 | 감사 로그에 app_id 자동 주입 | `v_platform/utils/audit_logger.py` |
| 3 | 시스템 설정 API에 app_id 필터 적용 | `v_platform/api/system_settings.py` |
| 4 | PlatformApp에 app_id state 주입 | `v_platform/app.py` |
| 4 | v-channel-bridge 앱 전용 메뉴 시드 | `apps/v-channel-bridge/backend/` |
| 5 | v-platform-template 동작 확인 (앱 전용 메뉴 미노출) | Docker 테스트 |

#### 검증 기준

- [ ] v-channel-bridge: 플랫폼 공통 메뉴 + 브리지 전용 메뉴 표시
- [ ] v-platform-template: 플랫폼 공통 메뉴만 표시 (channels 등 미노출)
- [ ] 감사 로그에 app_id 기록
- [ ] 같은 사용자가 양쪽 앱에 동일 계정으로 로그인 가능

---

## 3. Phase C1: 핵심 인프라 (1~2주)

> **목표**: 모니터링 + 에러 처리 + 실시간 기반 통합

### Backend (4일)

| 일차 | 작업 | 파일 |
|------|------|------|
| 1 | MetricsMiddleware에 app 라벨 추가 + 인증 메트릭 | `middleware/metrics.py` |
| 1 | `core/logging.py` 구현 (JSON + app 라벨) | 신규 |
| 2 | HealthRegistry 구현 + health.py 리팩토링 | `api/health.py` |
| 2 | PlatformApp에서 로그/메트릭 자동 초기화 | `app.py` |
| 3 | Event Broadcaster를 v_platform으로 이동 | `services/event_broadcaster.py` |
| 3 | Log Buffer를 v_platform으로 이동 | `services/log_buffer.py` |
| 4 | v-channel-bridge에서 이동된 모듈 참조 업데이트 | app shims |

### Frontend (3일)

| 일차 | 작업 | 파일 |
|------|------|------|
| 5 | useApiErrorHandler를 @v-platform/core로 이동 | `hooks/useApiErrorHandler.ts` |
| 5 | useWebSocket을 @v-platform/core로 이동 | `hooks/useWebSocket.ts` |
| 6 | useNotifications를 @v-platform/core로 이동 | `hooks/useNotifications.ts` |
| 6 | useBrowserNotification을 @v-platform/core로 이동 | `hooks/useBrowserNotification.ts` |
| 7 | index.ts에 신규 export 추가 + 동작 확인 | Docker 테스트 |

---

## 4. Phase C2: 설정/관리 UI (1~2주)

> **목표**: 프로필/보안/테마/OAuth 설정 컴포넌트를 플랫폼으로 이동

| 일차 | 작업 | 파일 |
|------|------|------|
| 1 | profile/ 컴포넌트 이동 (PasswordChangeForm, SessionDeviceList) | `components/profile/` |
| 2 | settings/ 컴포넌트 이동 (Security, Session, Notification, Theme) | `components/settings/` |
| 3 | oauth/ 컴포넌트 이동 (UserOAuthList, UserOAuthCard) | `components/oauth/` |
| 3 | user-oauth store 이동 | `stores/user-oauth.ts` |
| 4 | Tour 시스템 이동 | `lib/tour/` |
| 5 | v-platform-template에서 복사본 → shim으로 교체 | 앱 정리 |

---

## 5. Phase C3: 백엔드 패턴 표준화 (1주)

> **목표**: 데이터 내보내기/집계/필터 패턴을 재사용 가능한 서비스로 추출

| 일차 | 작업 | 파일 |
|------|------|------|
| 1 | Export Service 구현 (CSV/JSON 범용) | `services/export_service.py` |
| 2 | Stats Aggregation 헬퍼 구현 | `services/stats_service.py` |
| 2 | Filter Options 생성 유틸 구현 | `utils/filters.py` |
| 3 | Feature Checker를 v_platform으로 이동 | `services/feature_checker.py` |
| 3 | v-channel-bridge의 messages API를 새 서비스로 리팩토링 | 앱 정리 |

---

## 6. Phase C4: 모니터링 인프라 (1주)

> **목표**: Prometheus/Grafana/Promtail을 멀티앱 지원으로 전환

| 일차 | 작업 | 파일 |
|------|------|------|
| 1 | Prometheus 설정 멀티앱 target | `monitoring/prometheus/` |
| 1 | Promtail 설정 멀티앱 라벨 | `monitoring/promtail/` |
| 2 | platform-overview.json 대시보드 생성 | `monitoring/grafana/` |
| 2 | platform-auth.json 대시보드 생성 | `monitoring/grafana/` |
| 3 | 기존 대시보드를 app-specific/ 하위로 이동 | 정리 |

---

## 7. Phase C5: 문서 구조 개편

> **목표**: 플랫폼 문서와 앱별 문서를 분리하여, 앱 추가 시 문서 혼란 방지

### 7.1 현재 문서 구조 (문제)

```
docusaurus/docs/
├── design/                    ← 플랫폼 + v-channel-bridge 설계 혼재
│   ├── PLATFORM_*.md          ← 플랫폼 설계
│   ├── PHASE1_PROVIDER_*.md   ← v-channel-bridge 전용
│   ├── MESSAGE_*.md           ← v-channel-bridge 전용
│   └── ...
├── developer-guide/           ← 플랫폼 + v-channel-bridge 혼재
├── admin-guide/               ← 대부분 v-channel-bridge 전용
├── tech-portfolio/            ← 혼재
└── user-guide/
```

### 7.2 목표 문서 구조

```
docusaurus/docs/
├── platform/                       ← v-platform 문서 (공통)
│   ├── design/
│   │   ├── PLATFORM_APP_SEPARATION_ARCHITECTURE.md
│   │   ├── PLATFORM_CONSOLIDATION_PLAN.md
│   │   ├── MODULE_BOUNDARY_MAP.md
│   │   ├── RBAC_AND_CUSTOM_MENU_PLAN.md
│   │   └── HYBRID_SSO_LOGIN_PLAN.md
│   ├── developer-guide/
│   │   ├── ARCHITECTURE.md
│   │   ├── DESIGN_SYSTEM.md
│   │   ├── PAGE_LAYOUT_GUIDE.md
│   │   └── SSO_USAGE_AND_TESTING.md
│   ├── admin-guide/
│   │   ├── DEPLOYMENT.md
│   │   ├── EMAIL_SETUP.md
│   │   └── SSL_TLS_SETUP.md
│   └── api/
│       └── platform-api.md
│
├── apps/                           ← 앱별 문서
│   ├── v-channel-bridge/
│   │   ├── design/
│   │   │   ├── ADVANCED_MESSAGE_FEATURES.md
│   │   │   ├── CHAT_EXPERIENCE_IMPROVEMENT_PLAN.md
│   │   │   ├── MESSAGE_LATENCY_OPTIMIZATION.md
│   │   │   ├── PHASE1_PROVIDER_UI_PLAN.md
│   │   │   └── ENV_VS_DATABASE_PROVIDERS.md
│   │   ├── admin-guide/
│   │   │   ├── SLACK_SETUP.md
│   │   │   ├── TEAMS_SETUP.md
│   │   │   └── TROUBLESHOOTING.md
│   │   └── developer-guide/
│   │       ├── TESTING_GUIDE.md
│   │       └── MIGRATION_PLAN.md
│   │
│   └── v-platform-template/
│       └── getting-started.md
│
├── tech-portfolio/                 ← 공통 (프로젝트 수준)
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── MODULE_DESIGN.md
│   └── PLATFORM_VALUE_ROADMAP.md
│
└── intro.md
```

### 7.3 문서 분류 기준

| 분류 | 기준 | 예시 |
|------|------|------|
| `platform/` | 모든 앱에 적용되는 문서 | 인증 설계, RBAC, 디자인 시스템, 배포, SSL |
| `apps/{app-name}/` | 특정 앱에만 해당하는 문서 | Slack 설정, 메시지 기능, Provider UI |
| `tech-portfolio/` | 프로젝트 전체 수준 | 기술 아키텍처, 모듈 설계, 로드맵 |

### 7.4 기존 문서 이동 매핑

#### platform/design/ 으로 이동

| 현재 위치 | 이유 |
|-----------|------|
| `PLATFORM_APP_SEPARATION_ARCHITECTURE.md` | 플랫폼 설계 |
| `PLATFORM_CONSOLIDATION_PLAN.md` | 플랫폼 설계 |
| `PLATFORM_MONITORING_CENTRALIZATION.md` | 플랫폼 설계 |
| `PLATFORM_FEATURE_PERMISSIONS_PLAN.md` | 플랫폼 RBAC |
| `MODULE_BOUNDARY_MAP.md` | 플랫폼/앱 경계 |
| `V_PROJECT_MIGRATION_PLAN.md` | 플랫폼 마이그레이션 |
| `RBAC_AND_CUSTOM_MENU_PLAN.md` | 플랫폼 RBAC |
| `HYBRID_SSO_LOGIN_PLAN.md` | 플랫폼 SSO |
| `MENU_GROUP_AND_TAB_LAYOUT.md` | 플랫폼 메뉴 |
| `AUDIT_LOG_UX_IMPROVEMENT.md` | 플랫폼 감사 |
| `SELF_CORRECTION_LOOP_REVIEW.md` | 플랫폼 개발 프로세스 |
| `CLAUDE_CODE_TOKEN_OPTIMIZATION.md` | 플랫폼 개발 도구 |

#### apps/v-channel-bridge/design/ 으로 이동

| 현재 위치 | 이유 |
|-----------|------|
| `ADVANCED_MESSAGE_FEATURES.md` | 메시지 브리지 전용 |
| `CHAT_EXPERIENCE_IMPROVEMENT_PLAN.md` | 채팅 경험 (브리지) |
| `CHAT_SUPPORT.md` | 채팅 지원 (브리지) |
| `ENV_VS_DATABASE_PROVIDERS.md` | Provider 설정 (브리지) |
| `MESSAGE_HISTORY_IMPROVEMENT.md` | 메시지 이력 (브리지) |
| `MESSAGE_LATENCY_OPTIMIZATION.md` | 메시지 지연 (브리지) |
| `MONITORING_IMPROVEMENT.md` | 모니터링 개선 (브리지) |
| `PHASE1_PROVIDER_UI_PLAN.md` | Provider UI (브리지) |
| `REMAINING_TASKS_ROADMAP.md` | 브리지 로드맵 |

### 7.5 Docusaurus 사이드바 설정

```js
// docusaurus.config.ts — sidebars 구조
const sidebars = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'v-platform (공통)',
      items: [
        { type: 'autogenerated', dirName: 'platform' },
      ],
    },
    {
      type: 'category',
      label: 'v-channel-bridge',
      items: [
        { type: 'autogenerated', dirName: 'apps/v-channel-bridge' },
      ],
    },
    {
      type: 'category',
      label: '기술 포트폴리오',
      items: [
        { type: 'autogenerated', dirName: 'tech-portfolio' },
      ],
    },
  ],
};
```

### 7.6 작업 목록

| 일차 | 작업 |
|------|------|
| 1 | `docs/platform/`, `docs/apps/v-channel-bridge/`, `docs/apps/v-platform-template/` 디렉토리 생성 |
| 1 | 플랫폼 문서 12개 → `docs/platform/design/` 으로 이동 |
| 2 | 앱 문서 9개 → `docs/apps/v-channel-bridge/design/` 으로 이동 |
| 2 | developer-guide 분류 (플랫폼 vs 앱) 및 이동 |
| 3 | admin-guide 분류 (플랫폼 vs 앱) 및 이동 |
| 3 | Docusaurus sidebar 설정 업데이트 |
| 4 | v-platform-template 문서 작성 (getting-started.md) |
| 4 | 링크 검증 + 빌드 테스트 |

---

## 8. 전체 로드맵 요약

| Phase | 내용 | 기간 | 우선순위 |
|-------|------|------|---------|
| **C0** | 멀티앱 데이터 분리 (메뉴, 감사, 설정에 app_id) | **1주** | **최우선** |
| **C1** | 핵심 인프라 (모니터링, 에러처리, WebSocket, 알림) | 1~2주 | 높음 |
| **C2** | 설정/관리 UI (프로필, 보안, 테마, OAuth) | 1~2주 | 중간 |
| **C3** | 백엔드 패턴 (Export, Stats, Filter, Feature) | 1주 | 중간 |
| **C4** | 모니터링 인프라 (Grafana, Prometheus, Promtail) | 1주 | 낮음 |
| **C5** | 문서 구조 개편 (platform/ + apps/ 분리) | 1주 | 낮음 |
| **합계** | | **5~8주** | |

### Phase별 의존성

```
C0 (데이터 분리)          ← 최우선, 다른 Phase와 독립
   ↓
C1 (핵심 인프라)          ← C0 이후 (app_id 활용)
   ↓
C2 (설정 UI)             ← C1 이후 (훅 이동 완료 필요)
   ↓
C3 (백엔드 패턴)          ← C0 이후, C1과 병렬 가능
C4 (모니터링 인프라)       ← C1 이후 (메트릭 라벨 필요)
C5 (문서 구조)            ← 독립, 언제든 가능
```

---

## 9. 수량 요약

### 공통화 전후 비교

| 항목 | 현재 | C0~C5 완료 후 |
|------|------|-------------|
| **v-platform Backend 서비스** | 7개 | 12개 (+5) |
| **v-platform Frontend 훅** | 7개 | 11개 (+4) |
| **v-platform Frontend 컴포넌트** | ~50개 | ~60개 (+10) |
| **v-platform Frontend 스토어** | 5개 | 6개 (+1) |
| **멀티앱 메뉴 격리** | ❌ 불가 | ✅ app_id 기반 |
| **멀티앱 감사 로그** | ❌ 출처 불명 | ✅ app_id 기록 |
| **문서 구조** | 혼재 | platform/ + apps/ 분리 |
| **새 앱 보일러플레이트** | ~3,400 LOC | ~200 LOC |

---

## 10. 앱 개발자 체험 (최종 목표)

### 새 앱 생성 흐름

```bash
# 1. 템플릿 복사
cp -r apps/v-platform-template apps/v-my-new-app

# 2. 앱 이름/포트 수정
# 3. 앱 전용 API/모델/페이지 추가
# 4. 앱 전용 메뉴 시드 작성
# 5. docker compose --profile my-new-app up -d
```

### 자동으로 얻는 것

| 카테고리 | 항목 |
|----------|------|
| **인증** | 로그인, 회원가입, SSO, 비밀번호 재설정 |
| **RBAC** | 메뉴 권한 (앱별 자동 격리), 권한 그룹 |
| **사용자** | CRUD, 역할, 조직도 (전 앱 공유) |
| **감사** | 감사 로그 (app_id 자동 기록) |
| **설정** | 테마, 보안, 세션, 알림 (앱별 설정 분리) |
| **모니터링** | 메트릭, 로그, 헬스체크 (app 라벨 자동) |
| **UI Kit** | 24개 컴포넌트 + 다크모드 |
| **실시간** | WebSocket + 알림 + 데스크톱 알림 |
| **문서** | `docs/apps/{app-name}/` 전용 공간 |

### 앱이 작성하는 것 (비즈니스 로직만)

```python
# 1. 앱 전용 모델 + API
class Ticket(Base): ...

# 2. 앱 전용 메뉴 시드
seed_app_menus([
    {"menu_key": "tickets", "title": "티켓", "app_id": "v-ticket-system"},
])

# 3. 커스텀 헬스/메트릭 (선택)
HealthRegistry.register("ticket_queue", check_fn)
```

---

**다음 액션**: Phase C0 (멀티앱 데이터 분리) 착수
