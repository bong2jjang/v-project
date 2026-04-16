---
title: SSO Relay (1회용 코드)
sidebar_position: 2
---

# SSO Relay (1회용 코드 방식)

이 문서를 읽고 나면 포털의 SSO Relay가 어떤 원리로 동작하는지 이해하고, 앱 측에서 필요한 설정을 확인할 수 있습니다. 또한 SSO 관련 문제가 발생했을 때 원인을 진단하고 해결할 수 있습니다.

## SSO Relay란

SSO Relay는 포털에서 로그인한 사용자가 앱 카드를 클릭할 때, **1회용 코드**를 통해 별도 로그인 없이 해당 앱에 자동 인증되는 SSO(Single Sign-On) 방식입니다.

별도의 SSO 서버(Keycloak, Auth0 등)나 복잡한 OIDC 플로우 없이, 동일한 `SECRET_KEY`와 Redis를 공유하는 앱 간에 경량 SSO를 구현합니다.

### 보안 특징

| 특징 | 설명 |
|------|------|
| **1회용 코드** | 코드는 사용 즉시 Redis에서 삭제됩니다. 재사용 불가. |
| **30초 TTL** | 코드는 생성 후 30초 내 사용하지 않으면 자동 만료됩니다. |
| **JWT 비노출** | URL에 JWT가 노출되지 않습니다. 코드만 전달됩니다. |
| **서버 간 교환** | 앱 프론트엔드가 받은 코드를 백엔드 API로 교환하므로, JWT는 항상 서버에서 생성됩니다. |

## 동작 원리

### 전체 흐름

```
사용자 → 포털 로그인 → JWT 발급 → localStorage 저장
                                        │
사용자 → 앱 카드 클릭 → POST /api/auth/sso-relay/create
                        (포털 백엔드에서 1회용 코드 생성 → Redis 저장, TTL 30초)
                                        │
                        새 탭: {앱URL}?sso_code={1회용코드}
                                        │
앱 프론트엔드 → URL에서 sso_code 추출 → URL 즉시 정리
                                        │
앱 프론트엔드 → POST /api/auth/sso-relay/exchange (코드 전달)
                (앱 백엔드에서 Redis 조회 → 코드 삭제 → 새 JWT 발급)
                                        │
앱 프론트엔드 → JWT + 사용자 정보 수신 → localStorage 저장 → 인증 완료
```

### 단계별 설명

1. **포털 로그인**: 사용자가 포털(`http://127.0.0.1:5180`)에서 아이디/비밀번호 또는 SSO로 로그인합니다. 포털 백엔드가 JWT를 발급하고, 프론트엔드가 이를 localStorage에 저장합니다.

2. **앱 카드 클릭 (코드 생성)**: 사용자가 앱 런처에서 앱 카드를 클릭하면, 포털 프론트엔드가 `POST /api/auth/sso-relay/create`를 호출합니다. 포털 백엔드는 사용자 정보(user_id, email, role)를 담은 1회용 코드를 생성하여 Redis에 30초 TTL로 저장하고, 코드를 반환합니다.

3. **새 탭 열기**: 포털은 해당 앱의 `frontend_url`에 코드를 `sso_code` 파라미터로 붙여 새 탭을 엽니다.

   ```
   http://127.0.0.1:5173?sso_code=u-KmtixZE0Ewi9JYOKKJJUB6Vk50P1x2if8cCUXdmuc
   ```

4. **코드 교환**: 앱의 프론트엔드가 로드되면 `loadUserFromStorage()`가 URL에서 `sso_code`를 감지하고, URL에서 즉시 제거한 뒤 `POST /api/auth/sso-relay/exchange`를 호출합니다. 앱 백엔드는 Redis에서 코드를 조회/삭제하고, 해당 사용자에 대한 새 JWT를 발급하여 사용자 정보와 함께 반환합니다.

5. **인증 완료**: 앱 프론트엔드가 수신한 JWT와 사용자 정보를 localStorage에 저장하고, 자동 토큰 갱신을 예약합니다.

### API 엔드포인트

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/auth/sso-relay/create` | 인증 필요 | 1회용 SSO 코드 생성 (Redis 저장, 30초 TTL) |
| POST | `/api/auth/sso-relay/exchange` | 공개 | 코드를 JWT + 사용자 정보로 교환 (1회용, 즉시 삭제) |

## 실제 사용자 시나리오

### 정상 플로우

1. 브라우저에서 `http://127.0.0.1:5180`을 엽니다.
2. 로그인 화면에서 자격 증명을 입력하고 로그인합니다.
3. 앱 포탈 메인 화면에서 원하는 앱(예: Channel Bridge) 카드를 클릭합니다.
4. 새 탭이 열리면서 Channel Bridge가 로딩됩니다. 로그인 화면이 나타나지 않고 바로 대시보드가 표시됩니다.
5. 포털 탭으로 돌아와 다른 앱 카드를 클릭해도 마찬가지로 자동 로그인됩니다.

### 코드 만료 시

1. 앱 카드를 클릭했지만 새 탭 로딩이 30초 이상 지연되면 코드가 만료됩니다.
2. 이 경우 앱에서 로그인 화면이 나타납니다.
3. 포털로 돌아와 다시 앱 카드를 클릭하면 새 코드가 발급되어 정상 동작합니다.

## 앱 측 필수 설정

SSO Relay가 동작하려면 포털과 각 앱이 아래 조건을 충족해야 합니다.

### 1. 공유 SECRET_KEY

포털과 앱 모두 동일한 `SECRET_KEY`를 사용해야 합니다. JWT 서명과 검증에 이 키가 사용되므로, 키가 다르면 교환 후 발급된 JWT가 다른 앱에서 인식되지 않습니다.

`docker-compose.yml`에서 확인합니다.

```yaml
# 포털 백엔드
portal-backend:
  environment:
    - SECRET_KEY=${SECRET_KEY:-v-platform-portal-secret-key-32chars!!}

# 앱 백엔드 (동일한 SECRET_KEY 사용)
v-channel-bridge-backend:
  environment:
    - SECRET_KEY=${SECRET_KEY:-v-platform-portal-secret-key-32chars!!}
```

프로젝트 루트의 `.env` 파일에서 `SECRET_KEY`를 한 곳에 정의하고 모든 서비스가 공유하는 것을 권장합니다.

### 2. 공유 Redis

포털 백엔드와 앱 백엔드가 동일한 Redis 인스턴스를 사용해야 합니다. 코드는 포털에서 Redis에 저장하고, 앱에서 Redis에서 조회하기 때문입니다.

```yaml
# 모든 백엔드가 동일한 REDIS_URL 사용
portal-backend:
  environment:
    - REDIS_URL=redis://:redispassword@redis:6379/0

v-channel-bridge-backend:
  environment:
    - REDIS_URL=redis://:redispassword@redis:6379/0
```

### 3. SSO 콜백 라우트

각 앱의 프론트엔드에 `/sso/callback` 라우트가 등록되어 있어야 합니다. 이 라우트는 `@v-platform/core`의 `SSOCallbackPage`를 사용합니다.

```tsx
// 앱의 App.tsx
import { SSOCallbackPage } from "@v-platform/core/pages";

<Route path="/sso/callback" element={<SSOCallbackPage />} />
```

### 4. loadUserFromStorage의 SSO Relay 로직

`@v-platform/core`의 auth 스토어에 SSO Relay 로직이 내장되어 있습니다. `PlatformApp` 프레임워크를 사용하는 앱이라면 별도 설정 없이 자동으로 동작합니다. auth 스토어가 `sso_code` URL 파라미터를 감지하고 교환 API를 자동 호출합니다.

## 문제 해결

### 앱에서 로그인 화면이 나타남

**증상**: 포털에서 앱 카드를 클릭했는데 앱의 로그인 화면이 표시됩니다.

**원인과 해결**:

| 원인 | 확인 방법 | 해결 |
|------|-----------|------|
| 코드 만료 (30초 초과) | 브라우저 콘솔에서 "Invalid or expired SSO code" 오류 확인 | 포털에서 다시 앱 카드 클릭 |
| Redis 미연결 | 포털 백엔드 로그에서 "Cache service unavailable" 확인 | Redis 컨테이너 상태 점검 |
| Redis 불일치 | 포털과 앱의 `REDIS_URL` 환경변수 비교 | 동일한 Redis로 통일 |
| SECRET_KEY 불일치 | 포털과 앱의 환경변수 비교 | 동일한 `SECRET_KEY`로 통일 |
| 앱이 `@v-platform/core` auth 스토어 미사용 | 앱 코드에서 `loadUserFromStorage()` 호출 확인 | `@v-platform/core` auth 스토어 사용 |

### 코드 교환 실패

**증상**: 앱 백엔드 로그에 `401 Unauthorized` ("Invalid or expired SSO code")가 기록됩니다.

**원인과 해결**:

1. **코드 재사용**: 1회용 코드는 한 번 사용하면 즉시 삭제됩니다. 같은 코드로 두 번 교환하면 실패합니다.
2. **30초 TTL 초과**: 네트워크 지연 등으로 코드 교환이 30초를 넘기면 실패합니다. 포털로 돌아가 다시 시도하세요.
3. **Redis 미연결**: 앱 백엔드가 Redis에 접근할 수 없으면 코드 조회가 불가합니다. `REDIS_URL` 설정과 Redis 컨테이너 상태를 확인하세요.

### 시계 불일치

**증상**: 교환 후 발급된 JWT가 즉시 만료로 처리됩니다.

**원인과 해결**:

JWT의 `exp`(만료) 및 `iat`(발급) 클레임은 UTC 기준 Unix 타임스탬프입니다. 앱 서버의 시스템 시계가 크게 차이나면 토큰 검증이 실패할 수 있습니다.

1. Docker 환경에서는 호스트 시계가 공유되므로 보통 문제가 되지 않습니다.
2. 호스트 시스템의 시계가 정확한지 확인합니다.
   ```bash
   date -u
   ```
3. 시계가 맞지 않으면 NTP 동기화를 설정합니다.
