---
slug: auth-improvement-plan
title: 로그인/로그아웃 보안 및 UX 개선 계획안
sidebar_position: 99
draft: true
---

# 로그인/로그아웃 보안 및 UX 개선 계획안

**작성일**: 2026-03-22
**상태**: 제안
**우선순위**: 높음

---

## 📋 목차

1. [현재 문제점](#현재-문제점)
2. [개선 목표](#개선-목표)
3. [기술 아키텍처](#기술-아키텍처)
4. [보안 강화 방안](#보안-강화-방안)
5. [구현 계획](#구현-계획)
6. [마이그레이션 전략](#마이그레이션-전략)
7. [테스트 계획](#테스트-계획)

---

## 현재 문제점

### 1. 토큰 관리 문제
- **단일 Access Token 사용**: Refresh Token 없이 Access Token만 사용
- **짧은 만료 시간**: 현재 JWT 만료 시간이 짧아 자주 재로그인 필요
- **갑작스러운 로그아웃**: 토큰 만료 시 경고 없이 즉시 로그인 페이지로 리다이렉트
- **새로고침 시 불안정**: 여러 API 요청이 동시에 401을 받으면 중복 리다이렉트 시도

### 2. UX 문제
- **로그인 상태 유지 불가**: 브라우저 종료 후 재접속 시 재로그인 필요
- **Remember Me 기능 없음**: 장기간 로그인 유지 옵션 부재
- **로그아웃 기능 부재**: 명시적인 로그아웃 버튼/기능 없음
- **세션 활동 감지 없음**: 사용자 활동 여부와 관계없이 고정 시간 후 만료

### 3. 보안 취약점
- **localStorage에 토큰 저장**: XSS 공격에 취약
- **CSRF 방지 미흡**: Cross-Site Request Forgery 대응 부족
- **토큰 갱신 메커니즘 없음**: 만료 전 자동 갱신 불가
- **디바이스 추적 없음**: 동일 계정의 다중 디바이스 로그인 관리 부재

---

## 개선 목표

### 1. 보안 강화
- ✅ **Refresh Token 도입**: Access Token과 분리하여 보안 강화
- ✅ **HttpOnly Cookie 사용**: XSS 공격 방지
- ✅ **CSRF 토큰 구현**: Cross-Site 공격 차단
- ✅ **토큰 로테이션**: Refresh Token 재사용 공격 방지
- ✅ **디바이스 관리**: 로그인 디바이스 추적 및 관리

### 2. UX 개선
- ✅ **자동 로그인 유지**: 3~7일간 재로그인 불필요
- ✅ **Remember Me 옵션**: 사용자 선택 가능한 로그인 유지 기간
- ✅ **Sliding Session**: 활동 시 자동 세션 연장
- ✅ **토큰 만료 경고**: 만료 5분 전 알림 및 갱신 옵션 제공
- ✅ **명시적 로그아웃**: UI에서 언제든 로그아웃 가능

### 3. 안정성 향상
- ✅ **자동 토큰 갱신**: 만료 전 백그라운드에서 자동 갱신
- ✅ **에러 핸들링 개선**: 401/403 응답 시 우아한 처리
- ✅ **중복 요청 방지**: 토큰 갱신 중 여러 요청 대기
- ✅ **오프라인 대응**: 네트워크 재연결 시 자동 복구

---

## 기술 아키텍처

### 1. Dual Token 시스템

```
┌─────────────────────────────────────────────────────────────┐
│                     Dual Token Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  Access Token    │         │  Refresh Token   │          │
│  ├──────────────────┤         ├──────────────────┤          │
│  │ 수명: 15분       │         │ 수명: 7일        │          │
│  │ 저장: Memory     │         │ 저장: HttpOnly   │          │
│  │ 용도: API 인증   │         │      Cookie      │          │
│  │ 갱신: 자동       │         │ 용도: Token 갱신 │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

#### Access Token
- **수명**: 15분 (짧은 수명으로 보안 강화)
- **저장 위치**: React 상태 (메모리)
- **용도**: API 요청 인증
- **갱신**: Refresh Token을 통해 자동 갱신
- **페이로드**:
  ```json
  {
    "user_id": 1,
    "email": "user@example.com",
    "role": "admin",
    "exp": 1234567890,
    "iat": 1234567000,
    "jti": "unique-token-id"
  }
  ```

#### Refresh Token
- **수명**: 7일 (Remember Me 시 30일)
- **저장 위치**: HttpOnly, Secure, SameSite Cookie
- **용도**: Access Token 갱신 전용
- **갱신**: 사용 시마다 새 토큰으로 로테이션
- **DB 저장**: 유효한 토큰만 허용 (토큰 탈취 방지)
- **페이로드**:
  ```json
  {
    "user_id": 1,
    "device_id": "browser-fingerprint-hash",
    "exp": 1234567890,
    "iat": 1234567000,
    "jti": "unique-refresh-token-id"
  }
  ```

### 2. 토큰 갱신 흐름

```
┌──────────┐                 ┌──────────┐                 ┌──────────┐
│ Frontend │                 │ Backend  │                 │ Database │
└────┬─────┘                 └────┬─────┘                 └────┬─────┘
     │                            │                            │
     │ 1. API 요청 (Access Token) │                            │
     ├───────────────────────────>│                            │
     │                            │ 2. 토큰 검증               │
     │                            ├───────────────────────────>│
     │                            │ 3. 만료 확인               │
     │                            │<───────────────────────────┤
     │ 4. 401 Unauthorized        │                            │
     │<───────────────────────────┤                            │
     │                            │                            │
     │ 5. Refresh Token으로 갱신  │                            │
     ├───────────────────────────>│                            │
     │    (HttpOnly Cookie)       │ 6. Refresh Token 검증      │
     │                            ├───────────────────────────>│
     │                            │ 7. 유효성 확인             │
     │                            │<───────────────────────────┤
     │                            │ 8. 새 토큰 생성            │
     │                            ├───────────────────────────>│
     │                            │ 9. 기존 토큰 무효화        │
     │                            │<───────────────────────────┤
     │ 10. 새 Access Token 반환   │                            │
     │     + 새 Refresh Token     │                            │
     │<───────────────────────────┤                            │
     │                            │                            │
     │ 11. 원래 API 재시도        │                            │
     ├───────────────────────────>│                            │
     │ 12. 성공 응답              │                            │
     │<───────────────────────────┤                            │
     │                            │                            │
```

### 3. 데이터베이스 스키마

```sql
-- Refresh Token 관리 테이블
CREATE TABLE refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 해시
    device_fingerprint TEXT,          -- 디바이스 식별
    device_name TEXT,                 -- 브라우저/OS 정보
    ip_address TEXT,                  -- 로그인 IP
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT 0,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- 로그인 히스토리 (감사 목적)
CREATE TABLE login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    logout_at DATETIME,
    session_duration INTEGER,  -- 초 단위

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 보안 강화 방안

### 1. XSS (Cross-Site Scripting) 방지

#### HttpOnly Cookie 사용
```typescript
// Backend: Cookie 설정
response.set_cookie(
    key="refresh_token",
    value=refresh_token,
    httponly=True,      // JavaScript 접근 차단
    secure=True,        // HTTPS만 허용
    samesite="strict",  // CSRF 방지
    max_age=7*24*60*60  // 7일
)
```

#### Content Security Policy (CSP)
```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
               style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;">
```

#### Input Sanitization
```typescript
// Frontend: 사용자 입력 검증
import DOMPurify from 'dompurify';

function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}
```

### 2. CSRF (Cross-Site Request Forgery) 방지

#### Double Submit Cookie Pattern
```typescript
// Backend: CSRF 토큰 생성
@app.post("/auth/login")
async def login(response: Response):
    csrf_token = secrets.token_urlsafe(32)

    # HttpOnly Cookie (검증용)
    response.set_cookie("csrf_token", csrf_token, httponly=True, samesite="strict")

    # Response Body (전송용)
    return {
        "access_token": access_token,
        "csrf_token": csrf_token  // Frontend가 사용
    }

// Frontend: API 요청 시 CSRF 토큰 전송
axios.interceptors.request.use((config) => {
    const csrfToken = localStorage.getItem('csrf_token');
    if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
});
```

### 3. Token Theft 방지

#### Token Rotation (재사용 공격 차단)
```python
# Backend: Refresh Token 갱신 시 기존 토큰 무효화
async def refresh_access_token(old_refresh_token: str):
    # 1. 기존 토큰 검증
    token_data = verify_refresh_token(old_refresh_token)

    # 2. DB에서 토큰 확인 (재사용 감지)
    db_token = db.query(RefreshToken).filter_by(
        token_hash=hash_token(old_refresh_token)
    ).first()

    if db_token.is_revoked:
        # 재사용 시도 감지! 모든 토큰 무효화
        db.query(RefreshToken).filter_by(user_id=token_data.user_id).update({
            "is_revoked": True
        })
        raise SecurityException("Token reuse detected")

    # 3. 기존 토큰 무효화
    db_token.is_revoked = True
    db.commit()

    # 4. 새 토큰 발급
    new_access_token = create_access_token(token_data.user_id)
    new_refresh_token = create_refresh_token(token_data.user_id)

    return new_access_token, new_refresh_token
```

#### Device Fingerprinting
```typescript
// Frontend: 디바이스 핑거프린트 생성
import FingerprintJS from '@fingerprintjs/fingerprintjs';

async function getDeviceFingerprint(): Promise<string> {
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId;
}

// 로그인 시 전송
await authApi.login({
  email,
  password,
  device_fingerprint: await getDeviceFingerprint(),
  device_name: navigator.userAgent
});
```

### 4. Rate Limiting (무차별 대입 공격 방지)

```python
# Backend: 로그인 시도 제한
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/auth/login")
@limiter.limit("5/minute")  # 분당 5회 제한
async def login(request: Request, credentials: LoginRequest):
    # ...
    pass
```

### 5. Password Security

```python
# Backend: 비밀번호 해싱 (bcrypt)
from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # 보안 강도
)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

---

## 구현 계획

### Phase 1: Backend 인프라 구축 (1주)

#### 1.1 데이터베이스 마이그레이션
```python
# backend/alembic/versions/xxx_add_refresh_tokens.py
def upgrade():
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('device_fingerprint', sa.String(128)),
        sa.Column('device_name', sa.String(256)),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('last_used_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('is_revoked', sa.Boolean(), default=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )
```

#### 1.2 Token Service 구현
```python
# backend/app/services/token_service.py
from datetime import datetime, timedelta
import secrets
import hashlib

class TokenService:
    ACCESS_TOKEN_EXPIRE_MINUTES = 15
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    REFRESH_TOKEN_REMEMBER_DAYS = 30

    @staticmethod
    def create_access_token(user_id: int, email: str, role: str) -> str:
        payload = {
            "user_id": user_id,
            "email": email,
            "role": role,
            "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            "iat": datetime.utcnow(),
            "jti": secrets.token_urlsafe(16)
        }
        return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    @staticmethod
    def create_refresh_token(
        db: Session,
        user_id: int,
        device_fingerprint: str,
        device_name: str,
        ip_address: str,
        remember_me: bool = False
    ) -> str:
        # 토큰 생성
        token = secrets.token_urlsafe(64)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        # 만료 시간 계산
        expire_days = REFRESH_TOKEN_REMEMBER_DAYS if remember_me else REFRESH_TOKEN_EXPIRE_DAYS
        expires_at = datetime.utcnow() + timedelta(days=expire_days)

        # DB 저장
        refresh_token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            device_fingerprint=device_fingerprint,
            device_name=device_name,
            ip_address=ip_address,
            expires_at=expires_at
        )
        db.add(refresh_token)
        db.commit()

        return token

    @staticmethod
    def revoke_all_tokens(db: Session, user_id: int):
        """사용자의 모든 토큰 무효화 (로그아웃 전체)"""
        db.query(RefreshToken).filter_by(user_id=user_id).update({
            "is_revoked": True
        })
        db.commit()
```

#### 1.3 Auth API 엔드포인트
```python
# backend/app/api/auth.py
@router.post("/auth/login")
async def login(
    request: Request,
    response: Response,
    credentials: LoginRequest,
    db: Session = Depends(get_db)
):
    # 1. 사용자 인증
    user = authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(401, "Invalid credentials")

    # 2. Access Token 생성
    access_token = TokenService.create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role
    )

    # 3. Refresh Token 생성
    refresh_token = TokenService.create_refresh_token(
        db=db,
        user_id=user.id,
        device_fingerprint=credentials.device_fingerprint,
        device_name=credentials.device_name,
        ip_address=request.client.host,
        remember_me=credentials.remember_me
    )

    # 4. CSRF 토큰 생성
    csrf_token = secrets.token_urlsafe(32)

    # 5. HttpOnly Cookie 설정
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,  # HTTPS only
        samesite="strict",
        max_age=7*24*60*60 if not credentials.remember_me else 30*24*60*60
    )

    response.set_cookie(
        key="csrf_token_http",
        value=csrf_token,
        httponly=True,
        secure=True,
        samesite="strict"
    )

    # 6. 로그인 히스토리 기록
    login_history = LoginHistory(
        user_id=user.id,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        device_fingerprint=credentials.device_fingerprint
    )
    db.add(login_history)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 900,  # 15분
        "csrf_token": csrf_token,
        "user": UserSchema.from_orm(user)
    }

@router.post("/auth/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    # 1. Cookie에서 Refresh Token 추출
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(401, "Refresh token not found")

    # 2. 토큰 검증 및 갱신
    try:
        new_access_token, new_refresh_token = TokenService.refresh_tokens(
            db=db,
            old_refresh_token=refresh_token,
            ip_address=request.client.host
        )
    except Exception as e:
        raise HTTPException(401, str(e))

    # 3. 새 Refresh Token을 Cookie에 저장
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7*24*60*60
    )

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": 900
    }

@router.post("/auth/logout")
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. 현재 디바이스의 Refresh Token만 무효화
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        TokenService.revoke_token(db, refresh_token)

    # 2. Cookie 삭제
    response.delete_cookie("refresh_token")
    response.delete_cookie("csrf_token_http")

    # 3. 로그아웃 히스토리 기록
    login_history = db.query(LoginHistory).filter_by(
        user_id=current_user.id,
        logout_at=None
    ).order_by(LoginHistory.login_at.desc()).first()

    if login_history:
        login_history.logout_at = datetime.utcnow()
        login_history.session_duration = (
            datetime.utcnow() - login_history.login_at
        ).total_seconds()
        db.commit()

    return {"message": "Logged out successfully"}

@router.post("/auth/logout-all")
async def logout_all_devices(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """모든 디바이스에서 로그아웃"""
    TokenService.revoke_all_tokens(db, current_user.id)
    response.delete_cookie("refresh_token")
    response.delete_cookie("csrf_token_http")

    return {"message": "Logged out from all devices"}
```

### Phase 2: Frontend 구현 (1주)

#### 2.1 Token 관리 Hook
```typescript
// frontend/src/hooks/useAuth.ts
import { useState, useEffect, useCallback, useRef } from 'react';

interface TokenState {
  accessToken: string | null;
  expiresAt: number | null;
  csrfToken: string | null;
}

export function useAuth() {
  const [tokenState, setTokenState] = useState<TokenState>({
    accessToken: null,
    expiresAt: null,
    csrfToken: null,
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout>();

  // Access Token 자동 갱신 (만료 2분 전)
  const scheduleTokenRefresh = useCallback((expiresAt: number) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    const now = Date.now();
    const timeUntilRefresh = expiresAt - now - 2 * 60 * 1000; // 2분 전

    if (timeUntilRefresh > 0) {
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          await refreshAccessToken();
        } catch (error) {
          console.error('Token refresh failed:', error);
          // 갱신 실패 시 로그아웃
          logout();
        }
      }, timeUntilRefresh);
    }
  }, []);

  // Access Token 갱신
  const refreshAccessToken = useCallback(async () => {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Cookie 전송
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    const expiresAt = Date.now() + data.expires_in * 1000;

    setTokenState({
      accessToken: data.access_token,
      expiresAt,
      csrfToken: data.csrf_token,
    });

    // 다음 갱신 예약
    scheduleTokenRefresh(expiresAt);

    return data.access_token;
  }, [scheduleTokenRefresh]);

  // 로그인
  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await authApi.login(credentials);
    const expiresAt = Date.now() + response.expires_in * 1000;

    setTokenState({
      accessToken: response.access_token,
      expiresAt,
      csrfToken: response.csrf_token,
    });

    // CSRF 토큰 저장 (API 요청 시 사용)
    localStorage.setItem('csrf_token', response.csrf_token);

    // 토큰 자동 갱신 예약
    scheduleTokenRefresh(expiresAt);
  }, [scheduleTokenRefresh]);

  // 로그아웃
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setTokenState({
        accessToken: null,
        expiresAt: null,
        csrfToken: null,
      });
      localStorage.removeItem('csrf_token');
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    }
  }, []);

  return {
    accessToken: tokenState.accessToken,
    csrfToken: tokenState.csrfToken,
    login,
    logout,
    refreshAccessToken,
  };
}
```

#### 2.2 Axios 인터셉터 개선
```typescript
// frontend/src/lib/api/client.ts
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Request 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    const csrfToken = localStorage.getItem('csrf_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response 인터셉터
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // 401 에러 처리
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 로그인/갱신 엔드포인트는 제외
      const isAuthEndpoint =
        originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/refresh');

      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // 이미 갱신 중이면 대기
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        // Access Token 갱신
        const { refreshAccessToken } = useAuthStore.getState();
        const newToken = await refreshAccessToken();

        // 대기 중인 요청들에 새 토큰 전달
        onTokenRefreshed(newToken);

        // 원래 요청 재시도
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // 갱신 실패 시 로그아웃
        const { logout } = useAuthStore.getState();
        logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(new ApiClientError(error));
  }
);
```

#### 2.3 로그인 UI 개선
```tsx
// frontend/src/pages/Login.tsx
export default function Login() {
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      await login({
        email,
        password,
        remember_me: rememberMe,
        device_fingerprint: await getDeviceFingerprint(),
        device_name: navigator.userAgent,
      });

      navigate('/');
    } catch (error) {
      // 에러 처리
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}

      <div className="flex items-center">
        <input
          id="remember-me"
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="h-4 w-4 rounded border-line"
        />
        <label htmlFor="remember-me" className="ml-2 text-sm text-content-secondary">
          로그인 상태 유지 (30일)
        </label>
      </div>

      {/* ... */}
    </form>
  );
}
```

### Phase 3: 추가 기능 (1주)

#### 3.1 디바이스 관리 UI
```tsx
// frontend/src/pages/Settings/SecurityTab.tsx
export function SecurityTab() {
  const [devices, setDevices] = useState<LoginDevice[]>([]);

  useEffect(() => {
    loadActiveDevices();
  }, []);

  const loadActiveDevices = async () => {
    const response = await authApi.getActiveDevices();
    setDevices(response.devices);
  };

  const handleRevokeDevice = async (deviceId: string) => {
    await authApi.revokeDevice(deviceId);
    loadActiveDevices();
  };

  const handleLogoutAll = async () => {
    if (confirm('모든 디바이스에서 로그아웃하시겠습니까?')) {
      await authApi.logoutAll();
      window.location.href = '/login';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-heading-md text-content-primary mb-4">
          활성 디바이스
        </h3>

        <div className="space-y-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className="p-4 bg-surface-card border border-line rounded-card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-body-base font-medium text-content-primary">
                    {device.device_name}
                  </p>
                  <p className="text-body-sm text-content-secondary">
                    IP: {device.ip_address}
                  </p>
                  <p className="text-caption text-content-tertiary">
                    마지막 활동: {formatDate(device.last_used_at)}
                  </p>
                  {device.is_current && (
                    <Badge variant="info" className="mt-2">현재 디바이스</Badge>
                  )}
                </div>

                {!device.is_current && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleRevokeDevice(device.id)}
                  >
                    로그아웃
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="danger"
        onClick={handleLogoutAll}
        className="w-full"
      >
        모든 디바이스에서 로그아웃
      </Button>
    </div>
  );
}
```

#### 3.2 토큰 만료 경고
```tsx
// frontend/src/components/TokenExpiryWarning.tsx
export function TokenExpiryWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const { expiresAt, refreshAccessToken } = useAuthStore();

  useEffect(() => {
    if (!expiresAt) return;

    const checkExpiry = () => {
      const now = Date.now();
      const remaining = expiresAt - now;

      // 5분 전에 경고 표시
      if (remaining > 0 && remaining <= 5 * 60 * 1000) {
        setShowWarning(true);
        setTimeLeft(Math.floor(remaining / 1000));
      } else {
        setShowWarning(false);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleExtendSession = async () => {
    await refreshAccessToken();
    setShowWarning(false);
  };

  if (!showWarning) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-md bg-surface-card border border-line rounded-card shadow-modal p-4 z-toast">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-status-warning" /* ... */ />

        <div className="flex-1">
          <p className="text-body-base font-medium text-content-primary">
            세션 만료 예정
          </p>
          <p className="text-body-sm text-content-secondary mt-1">
            {Math.floor(timeLeft / 60)}분 {timeLeft % 60}초 후 자동 로그아웃됩니다.
          </p>

          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleExtendSession}>
              세션 연장
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowWarning(false)}>
              닫기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 마이그레이션 전략

### 1. 단계적 배포
1. **Week 1**: Backend 인프라 구축 및 테스트
2. **Week 2**: Frontend 구현 및 통합 테스트
3. **Week 3**: 베타 테스트 및 피드백 수집
4. **Week 4**: 프로덕션 배포

### 2. 하위 호환성
```python
# Backend: 기존 토큰 지원 (일정 기간)
@app.middleware("http")
async def legacy_token_support(request: Request, call_next):
    # 기존 localStorage 토큰 지원 (3개월 유예)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        old_token = auth_header.split(" ")[1]
        # 기존 토큰 검증 로직
        # ...

    return await call_next(request)
```

### 3. 사용자 통지
```tsx
// Frontend: 업데이트 안내 모달
export function AuthUpdateNotice() {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    const hasSeenNotice = localStorage.getItem('auth_update_notice_seen');
    if (!hasSeenNotice) {
      setShowNotice(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('auth_update_notice_seen', 'true');
    setShowNotice(false);
  };

  if (!showNotice) return null;

  return (
    <Modal isOpen={showNotice} onClose={handleDismiss} title="보안 업데이트 안내">
      <div className="space-y-4">
        <p>보안 및 사용자 경험 개선을 위해 로그인 시스템이 업데이트되었습니다.</p>

        <ul className="list-disc list-inside space-y-2 text-body-sm">
          <li>자동 로그인 유지 (7일, Remember Me 시 30일)</li>
          <li>보안 강화 (이중 토큰 인증)</li>
          <li>디바이스 관리 기능 추가</li>
          <li>세션 자동 연장</li>
        </ul>

        <p className="text-body-sm text-content-secondary">
          * 한 번만 재로그인하시면 새로운 기능을 사용하실 수 있습니다.
        </p>

        <Button onClick={handleDismiss} className="w-full">
          확인
        </Button>
      </div>
    </Modal>
  );
}
```

---

## 테스트 계획

### 1. Unit Tests

```python
# tests/test_token_service.py
def test_create_refresh_token():
    token = TokenService.create_refresh_token(
        db=db,
        user_id=1,
        device_fingerprint="test-fp",
        device_name="Chrome",
        ip_address="127.0.0.1"
    )

    assert token is not None
    assert len(token) > 0

def test_token_rotation():
    """토큰 재사용 공격 감지 테스트"""
    old_token = create_token()

    # 첫 번째 갱신 - 성공
    new_token1 = TokenService.refresh_tokens(db, old_token)
    assert new_token1 is not None

    # 두 번째 갱신 시도 (재사용) - 실패
    with pytest.raises(SecurityException):
        TokenService.refresh_tokens(db, old_token)
```

### 2. Integration Tests

```typescript
// tests/integration/auth.test.ts
describe('Authentication Flow', () => {
  it('should login with remember me', async () => {
    const response = await authApi.login({
      email: 'test@example.com',
      password: 'password',
      remember_me: true,
    });

    expect(response.access_token).toBeDefined();
    expect(document.cookie).toContain('refresh_token');
  });

  it('should auto-refresh token before expiry', async () => {
    // 토큰 만료 2분 전으로 시계 조작
    jest.useFakeTimers();
    jest.advanceTimersByTime(13 * 60 * 1000); // 13분

    // 자동 갱신 확인
    await waitFor(() => {
      expect(refreshAccessToken).toHaveBeenCalled();
    });
  });

  it('should handle concurrent API requests during refresh', async () => {
    // 여러 API 요청 동시 발생
    const requests = [
      apiClient.get('/api/data1'),
      apiClient.get('/api/data2'),
      apiClient.get('/api/data3'),
    ];

    // 모두 성공해야 함 (중복 갱신 방지)
    const results = await Promise.all(requests);
    results.forEach(r => expect(r.status).toBe(200));
  });
});
```

### 3. Security Tests

```python
# tests/security/test_csrf.py
def test_csrf_protection():
    """CSRF 공격 시뮬레이션"""
    # CSRF 토큰 없이 요청
    response = client.post(
        "/api/auth/logout",
        cookies={"refresh_token": valid_token}
    )
    assert response.status_code == 403

    # 잘못된 CSRF 토큰
    response = client.post(
        "/api/auth/logout",
        headers={"X-CSRF-Token": "invalid"},
        cookies={"refresh_token": valid_token}
    )
    assert response.status_code == 403

# tests/security/test_rate_limit.py
def test_login_rate_limit():
    """무차별 대입 공격 방지"""
    for i in range(6):
        response = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": f"wrong{i}"
        })

        if i < 5:
            assert response.status_code == 401
        else:
            assert response.status_code == 429  # Too Many Requests
```

---

## 결론

본 계획안은 **보안**, **UX**, **안정성**을 모두 고려한 현대적인 인증 시스템을 구현합니다.

### 핵심 개선사항
1. ✅ **이중 토큰 시스템**: Access Token (15분) + Refresh Token (7일)
2. ✅ **HttpOnly Cookie**: XSS 공격 방지
3. ✅ **CSRF 보호**: Double Submit Cookie 패턴
4. ✅ **토큰 로테이션**: 재사용 공격 차단
5. ✅ **자동 세션 연장**: 사용자 활동 감지
6. ✅ **디바이스 관리**: 다중 디바이스 로그인 추적
7. ✅ **Remember Me**: 30일 장기 로그인

### 보안 수준
- OWASP Top 10 대응
- JWT Best Practices 준수
- Defense in Depth (다층 방어)

### 예상 소요 시간
- **개발**: 3주
- **테스트**: 1주
- **총**: 4주

이 계획안을 검토하시고 추가 요구사항이나 수정사항이 있으면 알려주세요!
