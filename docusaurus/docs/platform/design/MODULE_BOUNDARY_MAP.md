# v-project 모듈 경계 분류표

> **문서 버전**: 1.0  
> **작성일**: 2026-04-11  
> **목적**: Phase 2~3 물리적 분리 시 각 파일의 이동 대상을 명확히 정의

---

## 범례

- **[P]** = v-platform (플랫폼 → `platform/backend/v_platform/`으로 이동)
- **[A]** = v-channel-bridge (앱 → `apps/v-channel-bridge/backend/app/`에 잔류)
- **[S]** = 공유 (Shared — 양쪽 모두 사용, `models/base.py` 등)

---

## Backend: Models (`apps/v-channel-bridge/backend/app/models/`)

| 파일 | 분류 | 모델 | 비고 |
|------|------|------|------|
| `base.py` | **[S]** | `Base` | 공유 DeclarativeBase |
| `user.py` | **[P]** | `User`, `UserRole` | 인증/사용자 관리 |
| `audit_log.py` | **[P]** | `AuditLog`, `AuditAction` | 감사 로그 |
| `refresh_token.py` | **[P]** | `RefreshToken` | JWT 갱신 토큰 |
| `password_reset_token.py` | **[P]** | `PasswordResetToken` | 비밀번호 재설정 |
| `menu_item.py` | **[P]** | `MenuItem` | 메뉴 기반 RBAC |
| `user_permission.py` | **[P]** | `UserPermission`, `AccessLevel` | 사용자별 메뉴 권한 |
| `permission_group.py` | **[P]** | `PermissionGroup`, `PermissionGroupGrant`, `UserGroupMembership` | 권한 그룹 |
| `company.py` | **[P]** | `Company` | 조직도 — 회사 |
| `department.py` | **[P]** | `Department` | 조직도 — 부서 |
| `system_settings.py` | **[P]** | `SystemSettings` | 시스템 전역 설정 |
| `user_oauth_token.py` | **[P]** | `UserOAuthToken` | 사용자별 OAuth 토큰 |
| `message.py` | **[A]** | `Message`, `MessageStats` | 메시지 이력 |
| `account.py` | **[A]** | `Account` | Slack/Teams 자격증명 |

**요약**: 플랫폼 10개 / 앱 2개 / 공유 1개

---

## Backend: API (`apps/v-channel-bridge/backend/app/api/`)

| 파일 | 분류 | 주요 엔드포인트 | 비고 |
|------|------|---------------|------|
| `auth.py` | **[P]** | `/api/auth/login`, `/register`, `/refresh` | JWT 인증 |
| `auth_sso.py` | **[P]** | `/api/auth/sso/*` | SSO 로그인 |
| `auth_microsoft.py` | **[P]** | `/api/auth/microsoft/*` | Microsoft OAuth |
| `users.py` | **[P]** | `/api/users/*` | 사용자 CRUD |
| `user_oauth.py` | **[P]** | `/api/users/oauth/*` | 사용자 OAuth 토큰 |
| `permissions.py` | **[P]** | `/api/permissions/*` | 개인 권한 관리 |
| `permission_groups.py` | **[P]** | `/api/permission-groups/*` | 권한 그룹 관리 |
| `menus.py` | **[P]** | `/api/menus/*` | 메뉴 관리 |
| `organizations.py` | **[P]** | `/api/organizations/*` | 조직도 관리 |
| `audit_logs.py` | **[P]** | `/api/audit-logs/*` | 감사 로그 조회 |
| `system_settings.py` | **[P]** | `/api/system-settings/*` | 시스템 설정 |
| `health.py` | **[P]** | `/api/health` | 헬스체크 |
| `notifications.py` | **[P]** | `/api/notifications/*` | 알림 |
| `metrics.py` | **[P]** | `/api/metrics` | Prometheus 메트릭 |
| `websocket.py` | **[P]** | `/ws/*` | WebSocket 연결 관리 |
| `bridge.py` | **[A]** | `/api/bridge/*` | 브리지 제어 + Route CRUD |
| `messages.py` | **[A]** | `/api/messages/*` | 메시지 이력/검색 |
| `accounts_crud.py` | **[A]** | `/api/accounts/*` | Slack/Teams 계정 관리 |
| `accounts_test.py` | **[A]** | `/api/accounts/test/*` | 계정 연결 테스트 |
| `teams_webhook.py` | **[A]** | `/api/teams/webhook` | Teams Bot Webhook |
| `teams_notifications.py` | **[A]** | `/api/teams/notifications/*` | Teams 알림 |
| `monitoring.py` | **[A]** | `/api/monitoring/*` | 서비스 모니터링 |

**요약**: 플랫폼 15개 / 앱 7개

---

## Backend: Services (`apps/v-channel-bridge/backend/app/services/`)

| 파일 | 분류 | 클래스/함수 | 비고 |
|------|------|-----------|------|
| `token_service.py` | **[P]** | `TokenService` | JWT 발급/갱신/폐기 |
| `permission_service.py` | **[P]** | `PermissionService` | MAX(그룹, 개인) 권한 계산 |
| `password_reset_service.py` | **[P]** | `PasswordResetService` | 비밀번호 재설정 플로우 |
| `email_service.py` | **[P]** | `EmailService` | SMTP 발송 |
| `cache_service.py` | **[P]** | `CacheService` | Redis 래퍼 |
| `notification_service.py` | **[P]** | `NotificationService` | 범용 알림 디스패처 |
| `websocket_manager.py` | **[P]** | `WebSocketManager` | WebSocket 연결 관리 |
| `websocket_bridge.py` | **[A]** | `WebSocketBridge` | 코어 메시지 라우팅 엔진 |
| `route_manager.py` | **[A]** | `RouteManager` | Redis 동적 채널 라우팅 |
| `message_service.py` | **[A]** | `MessageService` | 메시지 이력/통계 |
| `message_queue.py` | **[A]** | `MessageQueue` | 배치 메시지 큐 |
| `command_processor.py` | **[A]** | `CommandProcessor` | `/vms` 커맨드 파싱 |
| `event_broadcaster.py` | **[A]** | `EventBroadcaster` | 실시간 이벤트 |
| `feature_checker.py` | **[A]** | `FeatureChecker` | Provider 기능 검사 |
| `log_buffer.py` | **[A]** | `LogBuffer` | 로그 버퍼링 |
| `teams_subscription_manager.py` | **[A]** | `TeamsSubscriptionManager` | Teams Graph 구독 |
| `attachment_handler.py` | **[A]** | `AttachmentHandler` | 파일 첨부 처리 |

**요약**: 플랫폼 7개 / 앱 10개

---

## Backend: 기타

| 디렉토리/파일 | 분류 | 비고 |
|-------------|------|------|
| `adapters/base.py` | **[A]** | BasePlatformProvider 인터페이스 |
| `adapters/slack_provider.py` | **[A]** | Slack Socket Mode |
| `adapters/teams_provider.py` | **[A]** | MS Graph API + Bot Framework |
| `db/database.py` | **[P]** | DB 엔진, 세션, 마이그레이션 러너 |
| `db/__init__.py` | **[P]** | DB 패키지 진입점 |
| `middleware/csrf.py` | **[P]** | CSRF 방어 |
| `middleware/metrics.py` | **[P]** | Prometheus 미들웨어 |
| `sso/base.py` | **[P]** | SSO 프로바이더 추상화 |
| `sso/registry.py` | **[P]** | SSO 레지스트리 |
| `sso/microsoft.py` | **[P]** | Microsoft SSO |
| `sso/generic_oidc.py` | **[P]** | Generic OIDC |
| `utils/auth.py` | **[P]** | get_current_user, require_permission |
| `utils/audit_logger.py` | **[P]** | 감사 로그 기록 유틸 |
| `utils/encryption.py` | **[P]** | Fernet 기반 암호화 |
| `utils/message_formatter.py` | **[A]** | 크로스 플랫폼 메시지 변환 |
| `utils/emoji_mapper.py` | **[A]** | 이모지 매핑 |
| `utils/attachment_handler.py` | **[A]** | 파일 첨부 유틸 |
| `schemas/common_message.py` | **[A]** | CommonMessage 스키마 |
| `schemas/account.py` | **[A]** | Account 스키마 |
| `schemas/account_crud.py` | **[A]** | Account CRUD 스키마 |
| `schemas/feature_catalog.py` | **[A]** | Feature 카탈로그 |
| `schemas/audit_log.py` | **[P]** | AuditLog 스키마 |
| `schemas/system_settings.py` | **[P]** | SystemSettings 스키마 |
| `main.py` | **[A]** | 앱 진입점 (분리 후 PlatformApp 사용) |

---

## Backend 의존성 방향 (정상)

```
[models/base.py]  ← 모든 모델이 참조
        ↑
   [models/*]     ← services, api가 참조
        ↑
  [services/*]    ← api가 참조
        ↑
    [api/*]       ← main.py가 라우터 등록

순환 의존성: 없음 (2026-04-11 검증 완료)
```

---

## Frontend 분류 (요약)

### v-platform으로 이동

| 카테고리 | 파일/디렉토리 |
|----------|-------------|
| API 클라이언트 | `lib/api/client.ts`, `auth.ts`, `users.ts`, `permissions.ts`, `organizations.ts`, `permission-groups.ts`, `auditLogs.ts`, `systemSettings.ts` |
| 스토어 | `store/auth.ts`, `permission.ts`, `notification.ts`, `systemSettings.ts`, `sessionSettings.ts` |
| 훅 | `hooks/useTheme.ts`, `useTokenExpiry.ts`, `useActivityDetection.ts`, `useIdleTimeout.ts`, `useTabSync.ts`, `useKeyboardShortcuts.ts`, `useSidebar.tsx` |
| 컴포넌트 | `components/ui/*` (17개), `components/layout/*`, `components/auth/*`, `components/notifications/*`, `ProtectedRoute.tsx` |
| 유틸 | `lib/navigation.tsx`, `lib/resolveStartPage.ts` |

### v-channel-bridge에 잔류

| 카테고리 | 파일/디렉토리 |
|----------|-------------|
| 페이지 | `pages/Channels.tsx`, `Messages.tsx`, `Statistics.tsx`, `Integrations.tsx` |
| 컴포넌트 | `components/channels/*`, `components/dashboard/*`, `components/messages/*`, `components/providers/*`, `components/statistics/*`, `components/monitoring/*` |
| API | `lib/api/messages.ts`, `bridge.ts`, `providers.ts`, `routes.ts`, `config.ts` |
| 스토어 | `store/routes.ts`, `providers.ts`, `bridge.ts`, `config.ts` |

---

## 마이그레이션 SQL 분류

별도 문서: 1-4 단계에서 파일 리네이밍으로 반영
