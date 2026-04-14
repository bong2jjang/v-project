---
title: SSO Token Relay
sidebar_position: 2
---

# SSO Token Relay

이 문서를 읽고 나면 포털의 Token Relay SSO가 어떤 원리로 동작하는지 이해하고, 앱 측에서 필요한 설정을 확인할 수 있습니다. 또한 SSO 관련 문제가 발생했을 때 원인을 진단하고 해결할 수 있습니다.

## Token Relay란

Token Relay는 포털에서 발급받은 JWT 토큰을 다른 앱으로 자동 전달하는 SSO(Single Sign-On) 방식입니다. 사용자는 포털에서 한 번만 로그인하면, 앱 카드를 클릭할 때 별도 로그인 없이 해당 앱에 자동으로 인증됩니다.

이 방식은 별도의 SSO 서버(Keycloak, Auth0 등)나 복잡한 OIDC 플로우 없이, 동일한 `SECRET_KEY`를 공유하는 앱 간에 JWT를 직접 전달하는 경량 구현입니다.

## 동작 원리

### 전체 흐름

```
사용자 → 포털 로그인 → JWT 발급 → localStorage 저장
                                        |
사용자 → 앱 카드 클릭 → 새 탭: {앱URL}?auth_token={JWT}
                                        |
앱 프론트엔드 → URL에서 auth_token 추출 → localStorage 저장 → URL 정리
                                        |
앱 → JWT 검증 (동일 SECRET_KEY) → 인증 완료
```

### 단계별 설명

1. **포털 로그인**: 사용자가 포털(`http://127.0.0.1:5180`)에서 아이디/비밀번호 또는 SSO로 로그인합니다. 포털 백엔드가 JWT를 발급하고, 프론트엔드가 이를 `localStorage`의 `access_token` 키에 저장합니다.

2. **앱 카드 클릭**: 사용자가 앱 런처에서 앱 카드를 클릭합니다. 포털은 해당 앱의 `frontend_url`에 현재 JWT를 `auth_token` 쿼리 파라미터로 붙여 새 탭을 엽니다.

   ```
   http://127.0.0.1:5173?auth_token=eyJhbGciOiJIUzI1NiIs...
   ```

3. **앱 측 토큰 수신**: 앱의 프론트엔드가 로드되면 `loadUserFromStorage()` 함수가 URL에서 `auth_token` 파라미터를 감지합니다. 토큰이 있으면 `localStorage`에 저장하고, 보안을 위해 URL에서 파라미터를 즉시 제거합니다.

4. **JWT 검증**: 앱의 백엔드 API 호출 시 전달된 JWT가 동일한 `SECRET_KEY`로 서명 검증됩니다. 검증에 성공하면 사용자는 별도 로그인 없이 인증된 상태가 됩니다.

## 실제 사용자 시나리오

### 정상 플로우

1. 브라우저에서 `http://127.0.0.1:5180`을 엽니다.
2. 로그인 화면에서 자격 증명을 입력하고 로그인합니다.
3. 앱 포탈 메인 화면에서 원하는 앱(예: Channel Bridge) 카드를 클릭합니다.
4. 새 탭이 열리면서 Channel Bridge가 로딩됩니다. 로그인 화면이 나타나지 않고 바로 대시보드가 표시됩니다.
5. 포털 탭으로 돌아와 다른 앱 카드를 클릭해도 마찬가지로 자동 로그인됩니다.

### 토큰 만료 시

1. 포털에 오랜 시간 로그인한 채로 두면 JWT가 만료됩니다.
2. 이 상태에서 앱 카드를 클릭하면, 전달된 토큰이 만료 상태이므로 앱에서 로그인 화면이 나타날 수 있습니다.
3. 포털에서 로그아웃 후 다시 로그인하면 새 JWT가 발급되어 정상적으로 Token Relay가 동작합니다.

## 앱 측 필수 설정

Token Relay가 동작하려면 포털과 각 앱이 아래 조건을 충족해야 합니다.

### 1. 공유 SECRET_KEY

포털과 앱 모두 동일한 `SECRET_KEY`를 사용해야 합니다. JWT 서명과 검증에 이 키가 사용되므로, 키가 다르면 검증이 실패합니다.

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

### 2. SSO 콜백 라우트

각 앱의 프론트엔드에 `/sso/callback` 라우트가 등록되어 있어야 합니다. 이 라우트는 `@v-platform/core`의 `SSOCallbackPage`를 사용합니다.

```tsx
// 앱의 App.tsx
import { SSOCallbackPage } from "@v-platform/core/pages";

<Route path="/sso/callback" element={<SSOCallbackPage />} />
```

### 3. loadUserFromStorage의 Token Relay 로직

`@v-platform/core`의 auth 스토어에 Token Relay 로직이 내장되어 있습니다. `PlatformApp` 프레임워크를 사용하는 앱이라면 별도 설정 없이 자동으로 동작합니다.

## 문제 해결

### 앱에서 로그인 화면이 나타남

**증상**: 포털에서 앱 카드를 클릭했는데 앱의 로그인 화면이 표시됩니다.

**원인과 해결**:

| 원인 | 확인 방법 | 해결 |
|------|-----------|------|
| JWT 만료 | 포털에서 로그아웃 후 재로그인 | 새 토큰 발급 후 다시 시도 |
| SECRET_KEY 불일치 | 포털과 앱의 환경변수 비교 | 동일한 `SECRET_KEY`로 통일 |
| 앱 프론트엔드에 Token Relay 로직 미포함 | 앱이 `@v-platform/core` auth 스토어를 사용하는지 확인 | `loadUserFromStorage()` 호출 여부 점검 |

### JWT 서명 검증 실패

**증상**: 앱 백엔드 로그에 `401 Unauthorized` 또는 JWT 서명 관련 오류가 기록됩니다.

**원인과 해결**:

1. **SECRET_KEY 불일치**: 포털과 앱의 `SECRET_KEY` 환경변수를 비교합니다. `docker-compose.yml`에서 기본값이 다르게 설정되어 있지 않은지 확인합니다.
2. **토큰 변조**: 브라우저 개발자 도구의 Application 탭에서 `localStorage`의 `access_token` 값이 올바른 JWT 형식인지 확인합니다.

### 시계 불일치

**증상**: 토큰이 방금 발급되었는데도 만료로 처리됩니다.

**원인과 해결**:

JWT의 `exp`(만료) 및 `iat`(발급) 클레임은 UTC 기준 Unix 타임스탬프입니다. 포털 서버와 앱 서버의 시스템 시계가 크게 차이나면 토큰 검증이 실패할 수 있습니다.

1. Docker 환경에서는 호스트 시계가 공유되므로 보통 문제가 되지 않습니다.
2. 호스트 시스템의 시계가 정확한지 확인합니다.
   ```bash
   date -u
   ```
3. 시계가 맞지 않으면 NTP 동기화를 설정합니다.
