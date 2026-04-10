---
slug: password-reset-feature
title: 비밀번호 재설정 기능 설계 및 구현 계획
sidebar_position: 99
draft: true
---

# 비밀번호 재설정 기능 설계 및 구현 계획

> **작성일**: 2026-03-24
> **작성자**: VMS Chat Ops Development Team
> **상태**: 제안
> **우선순위**: 높음 (보안 중요)

---

## 📋 목차

1. [개요](#1-개요)
2. [현재 시스템 분석](#2-현재-시스템-분석)
3. [기능 요구사항](#3-기능-요구사항)
4. [시스템 설계](#4-시스템-설계)
5. [보안 설계](#5-보안-설계)
6. [API 명세](#6-api-명세)
7. [데이터베이스 설계](#7-데이터베이스-설계)
8. [이메일 시스템 구현](#8-이메일-시스템-구현)
9. [프론트엔드 UI/UX](#9-프론트엔드-uiux)
10. [구현 계획](#10-구현-계획)
11. [테스트 계획](#11-테스트-계획)
12. [배포 및 운영](#12-배포-및-운영)

---

## 1. 개요

### 1.1 배경

현재 VMS Chat Ops 시스템은 다음과 같은 비밀번호 관리 기능만 제공합니다:
- ✅ 인증된 사용자의 비밀번호 변경 (현재 비밀번호 필요)
- ✅ 관리자의 회원가입 승인
- ❌ **비밀번호를 잊어버린 사용자의 비밀번호 재설정 기능 없음**

사용자가 비밀번호를 분실한 경우, 현재는 관리자에게 직접 연락하여 해결해야 하는 불편함이 있습니다.

### 1.2 목표

**사용자가 비밀번호를 분실했을 때 스스로 재설정할 수 있는 기능 제공**

- 이메일 인증을 통한 본인 확인
- 보안을 고려한 토큰 기반 재설정 프로세스
- 사용자 친화적인 UI/UX
- 감사 로그 및 알림 통합

### 1.3 범위

#### Phase 1: 일반 사용자 비밀번호 재설정 (필수)
- 이메일 기반 비밀번호 재설정
- 토큰 검증 및 보안 처리
- 이메일 발송 시스템 구축

#### Phase 2: 관리자 기능 확장 (선택)
- 관리자의 사용자 비밀번호 강제 재설정
- 임시 비밀번호 발급
- 비밀번호 만료 정책

---

## 2. 현재 시스템 분석

### 2.1 User 모델 구조

**파일**: `backend/app/models/user.py`

```python
class User(Base):
    __tablename__ = "users"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # 인증 정보
    email = Column(String(255), unique=True, nullable=False, index=True)  # ✅ 존재
    username = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # 권한 및 상태
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)
```

**주요 특징**:
- ✅ `email` 필드 존재 (unique, indexed)
- ✅ bcrypt 해싱 사용
- ✅ `is_active` 플래그로 계정 활성화 상태 관리

### 2.2 현재 비밀번호 관련 기능

| 기능 | 엔드포인트 | 권한 | 구현 상태 |
|------|-----------|------|----------|
| 비밀번호 변경 | `PUT /api/users/me/password` | 인증 필요 | ✅ 구현됨 |
| 회원가입 | `POST /api/auth/register` | 없음 | ✅ 구현됨 |
| 로그인 | `POST /api/auth/login` | 없음 | ✅ 구현됨 |
| **비밀번호 재설정** | - | - | **❌ 미구현** |

### 2.3 현재 보안 기능

**잘 구현된 보안 기능**:
- ✅ bcrypt 비밀번호 해싱
- ✅ Rate Limiting (slowapi)
  - 로그인: 5회/분
  - 회원가입: 3회/분
- ✅ JWT 토큰 (Access + Refresh)
- ✅ Token Rotation
- ✅ 감사 로그 (비밀번호 변경 기록)

**추가 필요한 보안 기능**:
- ❌ 이메일 발송 시스템
- ❌ 비밀번호 재설정 토큰 관리
- ❌ 이메일 Rate Limiting

### 2.4 이메일 시스템 현황

**❌ 이메일 발송 기능 없음**

**근거**:
- SMTP 관련 라이브러리 미설치
- 이메일 서비스 코드 없음
- 환경 변수 미정의

---

## 3. 기능 요구사항

### 3.1 사용자 스토리

#### US-1: 비밀번호 찾기 요청
```
As a 사용자
I want to 이메일을 입력하여 비밀번호 재설정 링크를 받고
So that 비밀번호를 잊어버렸을 때 스스로 재설정할 수 있다
```

**수용 기준**:
- [ ] 로그인 페이지에 "비밀번호 찾기" 링크가 있다
- [ ] 이메일 입력 폼이 제공된다
- [ ] 등록된 이메일이면 재설정 링크가 발송된다
- [ ] 등록되지 않은 이메일도 동일한 메시지를 표시한다 (사용자 열거 방지)

#### US-2: 재설정 링크 검증
```
As a 사용자
I want to 이메일로 받은 링크를 클릭하고
So that 비밀번호 재설정 페이지로 이동한다
```

**수용 기준**:
- [ ] 링크는 30분 동안 유효하다
- [ ] 유효한 토큰이면 비밀번호 재설정 폼이 표시된다
- [ ] 만료/사용된 토큰이면 오류 메시지가 표시된다

#### US-3: 새 비밀번호 설정
```
As a 사용자
I want to 새 비밀번호를 입력하고 확인하고
So that 계정에 다시 접근할 수 있다
```

**수용 기준**:
- [ ] 비밀번호 복잡도 검증 (최소 8자)
- [ ] 비밀번호 확인 일치 검증
- [ ] 재설정 성공 시 토큰 무효화
- [ ] 재설정 성공 시 이메일 알림 발송
- [ ] 재설정 성공 시 감사 로그 기록

#### US-4: 관리자의 사용자 비밀번호 재설정 (Phase 2)
```
As a 관리자
I want to 사용자의 비밀번호를 강제로 재설정하고
So that 계정 문제를 신속하게 해결할 수 있다
```

**수용 기준**:
- [ ] 사용자 관리 페이지에서 "비밀번호 재설정" 버튼이 있다
- [ ] 임시 비밀번호 자동 생성
- [ ] 사용자에게 임시 비밀번호 이메일 발송
- [ ] 다음 로그인 시 비밀번호 변경 강제 (선택)

### 3.2 비기능 요구사항

#### 보안
- **토큰 무작위성**: UUID v4 사용 (128-bit 엔트로피)
- **토큰 만료**: 15-30분
- **토큰 1회용**: 사용 후 즉시 무효화
- **Rate Limiting**:
  - 재설정 요청: 3회/시간 (IP당), 3회/시간 (이메일당)
  - 토큰 검증: 5회/분 (토큰당)
- **사용자 열거 방지**: 존재하지 않는 이메일도 동일한 응답

#### 성능
- **이메일 발송**: 비동기 처리 (5초 이내 응답)
- **토큰 검증**: 100ms 이내
- **데이터베이스 쿼리**: 인덱스 활용

#### 사용성
- **반응형 UI**: 모바일/데스크톱 모두 지원
- **명확한 안내**: 각 단계별 사용자 안내
- **에러 메시지**: 친화적이고 구체적인 메시지

#### 감사 및 모니터링
- **감사 로그**: 모든 재설정 요청/성공/실패 기록
- **알림**: 비밀번호 변경 시 사용자에게 알림
- **모니터링**: 비정상적인 재설정 요청 탐지

---

## 4. 시스템 설계

### 4.1 전체 플로우

```
┌─────────────┐
│   사용자     │
└──────┬──────┘
       │
       │ 1. "비밀번호 찾기" 클릭
       ▼
┌─────────────────────┐
│ ForgotPassword 페이지 │
│ (이메일 입력)         │
└──────┬──────────────┘
       │
       │ 2. POST /api/auth/password-reset/request
       │    { email: "user@example.com" }
       ▼
┌─────────────────────────┐
│  Backend API             │
│  - 사용자 존재 확인        │
│  - 재설정 토큰 생성        │
│  - 토큰 DB 저장           │
│  - 이메일 발송 (백그라운드)│
└──────┬──────────────────┘
       │
       │ 3. "이메일을 확인하세요" 메시지 (항상)
       ▼
┌─────────────────────┐
│   사용자 이메일함     │
│ "비밀번호 재설정"     │
│  링크 포함            │
└──────┬──────────────┘
       │
       │ 4. 링크 클릭
       │    https://app.com/reset-password/{token}
       ▼
┌─────────────────────┐
│ ResetPassword 페이지 │
│ (토큰 자동 검증)       │
└──────┬──────────────┘
       │
       │ 5. GET /api/auth/password-reset/verify
       │    { token: "uuid-token" }
       ▼
┌─────────────────────────┐
│  Backend API             │
│  - 토큰 유효성 검사       │
│  - 만료/사용 여부 확인    │
└──────┬──────────────────┘
       │
       │ 6a. 유효한 토큰 → 비밀번호 입력 폼 표시
       ▼
┌─────────────────────┐
│ 새 비밀번호 입력      │
│ (확인 입력 포함)      │
└──────┬──────────────┘
       │
       │ 7. POST /api/auth/password-reset/confirm
       │    { token: "uuid", new_password: "..." }
       ▼
┌─────────────────────────┐
│  Backend API             │
│  - 토큰 재검증            │
│  - 비밀번호 해싱 및 저장  │
│  - 토큰 무효화            │
│  - 감사 로그 생성         │
│  - 성공 이메일 발송       │
└──────┬──────────────────┘
       │
       │ 8. "비밀번호가 재설정되었습니다" 메시지
       ▼
┌─────────────────────┐
│  로그인 페이지로 이동 │
└─────────────────────┘
```

### 4.2 컴포넌트 아키텍처

```
┌───────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
├───────────────────────────────────────────────────────┤
│  Pages:                                               │
│  - ForgotPassword.tsx  (이메일 입력)                   │
│  - ResetPassword.tsx   (새 비밀번호 입력)              │
│                                                       │
│  API Client:                                          │
│  - auth.ts (확장)                                     │
│    - requestPasswordReset(email)                      │
│    - verifyResetToken(token)                          │
│    - resetPassword(token, password)                   │
└───────────────────────────────────────────────────────┘
                             │
                             │ HTTP/JSON
                             ▼
┌───────────────────────────────────────────────────────┐
│                  Backend (FastAPI)                    │
├───────────────────────────────────────────────────────┤
│  API Endpoints (auth.py):                             │
│  - POST /password-reset/request                       │
│  - GET  /password-reset/verify                        │
│  - POST /password-reset/confirm                       │
│                                                       │
│  Services:                                            │
│  - EmailService (신규)                                │
│    - send_password_reset_email()                      │
│    - send_password_changed_email()                    │
│  - PasswordResetService (신규)                        │
│    - create_reset_token()                             │
│    - verify_token()                                   │
│    - reset_password()                                 │
│                                                       │
│  Models:                                              │
│  - PasswordResetToken (신규)                          │
│                                                       │
│  Repositories:                                        │
│  - PasswordResetTokenRepository (신규)                │
└───────────────────────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────┐
│                  Database (SQLite)                    │
├───────────────────────────────────────────────────────┤
│  Tables:                                              │
│  - users                    (기존)                    │
│  - password_reset_tokens    (신규)                    │
│  - audit_logs               (기존, 확장)              │
└───────────────────────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────┐
│               External Services                       │
├───────────────────────────────────────────────────────┤
│  - SMTP Server (Gmail, SendGrid, Mailgun 등)          │
└───────────────────────────────────────────────────────┘
```

### 4.3 시퀀스 다이어그램

#### 비밀번호 재설정 요청

```
사용자     Frontend    Backend API    PasswordResetService    EmailService    Database
  │           │              │                  │                   │            │
  │  클릭     │              │                  │                   │            │
  ├──────────>│              │                  │                   │            │
  │           │              │                  │                   │            │
  │       이메일 입력         │                  │                   │            │
  │           │              │                  │                   │            │
  │  제출     │              │                  │                   │            │
  ├──────────>│              │                  │                   │            │
  │           │  POST /...   │                  │                   │            │
  │           ├─────────────>│                  │                   │            │
  │           │              │ create_token()   │                   │            │
  │           │              ├─────────────────>│                   │            │
  │           │              │                  │  사용자 조회       │            │
  │           │              │                  ├───────────────────────────────>│
  │           │              │                  │<───────────────────────────────┤
  │           │              │                  │                   │            │
  │           │              │                  │  토큰 생성(UUID)   │            │
  │           │              │                  │                   │            │
  │           │              │                  │  토큰 저장         │            │
  │           │              │                  ├───────────────────────────────>│
  │           │              │                  │<───────────────────────────────┤
  │           │              │<─────────────────┤                   │            │
  │           │              │                  │                   │            │
  │           │              │  send_email()    │                   │            │
  │           │              ├──────────────────────────────────────>│            │
  │           │              │                  │     (백그라운드)   │            │
  │           │              │                  │                   │  SMTP      │
  │           │              │                  │                   ├───────────>│
  │           │  200 OK      │                  │                   │            │
  │           │<─────────────┤                  │                   │            │
  │  메시지   │              │                  │                   │            │
  │<──────────┤              │                  │                   │            │
  │"이메일확인"│              │                  │                   │            │
```

#### 비밀번호 재설정 확인

```
사용자     Frontend    Backend API    PasswordResetService    Database
  │           │              │                  │                │
  │ 링크 클릭  │              │                  │                │
  ├──────────>│              │                  │                │
  │           │  GET /verify │                  │                │
  │           ├─────────────>│                  │                │
  │           │              │  verify_token()  │                │
  │           │              ├─────────────────>│                │
  │           │              │                  │  토큰 조회      │
  │           │              │                  ├───────────────>│
  │           │              │                  │<───────────────┤
  │           │              │                  │                │
  │           │              │                  │  만료 체크      │
  │           │              │                  │  사용 여부 체크 │
  │           │              │<─────────────────┤                │
  │           │  200 OK      │                  │                │
  │           │<─────────────┤                  │                │
  │  폼 표시  │              │                  │                │
  │<──────────┤              │                  │                │
  │           │              │                  │                │
  │ 비밀번호입력│             │                  │                │
  │  제출     │              │                  │                │
  ├──────────>│              │                  │                │
  │           │ POST /confirm│                  │                │
  │           ├─────────────>│                  │                │
  │           │              │ reset_password() │                │
  │           │              ├─────────────────>│                │
  │           │              │                  │  토큰 재검증    │
  │           │              │                  ├───────────────>│
  │           │              │                  │<───────────────┤
  │           │              │                  │                │
  │           │              │                  │  비밀번호 해싱  │
  │           │              │                  │                │
  │           │              │                  │  비밀번호 업데이트│
  │           │              │                  ├───────────────>│
  │           │              │                  │<───────────────┤
  │           │              │                  │                │
  │           │              │                  │  토큰 무효화    │
  │           │              │                  ├───────────────>│
  │           │              │                  │<───────────────┤
  │           │              │                  │                │
  │           │              │                  │  감사로그 생성  │
  │           │              │                  ├───────────────>│
  │           │              │<─────────────────┤                │
  │           │  200 OK      │                  │                │
  │           │<─────────────┤                  │                │
  │  성공메시지│              │                  │                │
  │<──────────┤              │                  │                │
  │           │              │                  │                │
  │  로그인이동│              │                  │                │
```

---

## 5. 보안 설계

### 5.1 토큰 보안

#### A. 토큰 생성
```python
import uuid
import secrets

def generate_reset_token() -> str:
    """
    암호학적으로 안전한 랜덤 토큰 생성
    - UUID v4 사용 (122-bit 무작위성)
    - URL-safe
    """
    return str(uuid.uuid4())
```

#### B. 토큰 속성
- **길이**: 36자 (UUID 형식: `550e8400-e29b-41d4-a716-446655440000`)
- **엔트로피**: 122 bits
- **예측 가능성**: 사실상 불가능 (2^122 경우의 수)
- **만료 시간**: 30분 (환경 변수로 설정 가능)
- **1회용**: 사용 후 `is_used=True` 플래그

#### C. 토큰 저장
```python
# 해싱 없이 원본 저장 (이미 충분히 무작위)
# 대신 인덱스로 빠른 조회 보장
token = Column(String(36), unique=True, nullable=False, index=True)
```

### 5.2 Rate Limiting

#### A. 재설정 요청 제한
```python
# slowapi 사용
@limiter.limit("3/hour")  # IP당
@router.post("/password-reset/request")
async def request_password_reset(
    request: Request,
    email_data: PasswordResetRequest,
):
    # 추가: 이메일당 쿨다운 체크
    last_request = await get_last_reset_request(email_data.email)
    if last_request and (datetime.utcnow() - last_request.created_at) < timedelta(minutes=1):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait before requesting another reset",
        )
```

#### B. 토큰 검증 제한
```python
@limiter.limit("5/minute")  # 토큰당 (또는 IP당)
@router.get("/password-reset/verify")
async def verify_reset_token(token: str):
    ...
```

### 5.3 사용자 열거 방지

#### A. 동일한 응답 시간
```python
import asyncio

@router.post("/password-reset/request")
async def request_password_reset(email_data: PasswordResetRequest):
    user = await user_repository.get_by_email(email_data.email)

    if user:
        # 실제 토큰 생성 및 이메일 발송
        await password_reset_service.create_reset_token(user)
    else:
        # 존재하지 않는 사용자도 동일한 시간 소요
        await asyncio.sleep(0.1)  # 이메일 발송 시간 시뮬레이션

    # 항상 동일한 메시지 반환
    return {
        "message": "비밀번호 재설정 링크를 이메일로 전송했습니다. 이메일을 확인해주세요.",
    }
```

#### B. 동일한 HTTP 응답
- 존재하는 이메일: `200 OK`
- 존재하지 않는 이메일: `200 OK` (동일)
- ❌ `404 Not Found` 반환하지 않음

### 5.4 토큰 무효화 정책

#### A. 자동 무효화 조건
1. **만료 시간 경과**: `expires_at < now()`
2. **사용 완료**: `is_used = True`
3. **비밀번호 변경 성공**: 즉시 무효화
4. **사용자 계정 비활성화**: `user.is_active = False`

#### B. 수동 무효화
- 사용자가 "다른 재설정 요청" 시 기존 토큰 자동 무효화 (선택)
- 관리자가 "모든 재설정 토큰 취소" 기능 (선택)

#### C. 정리 작업 (Cleanup Job)
```python
# 매일 자정 실행 (Celery 또는 APScheduler)
async def cleanup_expired_tokens():
    """만료된 토큰 삭제 (7일 이상 경과)"""
    cutoff_date = datetime.utcnow() - timedelta(days=7)
    await password_reset_token_repository.delete_expired(cutoff_date)
```

### 5.5 감사 로그

#### 기록 대상
1. **재설정 요청**:
   - 이벤트: `password_reset_requested`
   - 데이터: `email`, `ip_address`, `user_agent`
2. **토큰 검증 성공**:
   - 이벤트: `password_reset_token_verified`
   - 데이터: `token_id`, `ip_address`
3. **토큰 검증 실패**:
   - 이벤트: `password_reset_token_verification_failed`
   - 데이터: `token`, `reason` (expired/used/invalid)
4. **비밀번호 재설정 성공**:
   - 이벤트: `password_reset_completed`
   - 데이터: `user_id`, `ip_address`
5. **비밀번호 재설정 실패**:
   - 이벤트: `password_reset_failed`
   - 데이터: `user_id`, `reason`

---

## 6. API 명세

### 6.1 POST /api/auth/password-reset/request

비밀번호 재설정 요청 (이메일 발송)

#### Request

```http
POST /api/auth/password-reset/request
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Request Body Schema**:
```typescript
interface PasswordResetRequest {
  email: string;  // 이메일 형식 검증
}
```

#### Response

**성공 (200 OK)**:
```json
{
  "message": "비밀번호 재설정 링크를 이메일로 전송했습니다. 이메일을 확인해주세요."
}
```

**Rate Limit 초과 (429 Too Many Requests)**:
```json
{
  "detail": "요청 횟수가 너무 많습니다. 1시간 후에 다시 시도해주세요."
}
```

**유효성 검증 실패 (422 Unprocessable Entity)**:
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "유효한 이메일 주소를 입력해주세요.",
      "type": "value_error.email"
    }
  ]
}
```

#### Pydantic Schema

```python
# backend/app/schemas/user.py
from pydantic import BaseModel, EmailStr

class PasswordResetRequest(BaseModel):
    email: EmailStr
```

#### Implementation

```python
# backend/app/api/auth.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post(
    "/password-reset/request",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
)
@limiter.limit("3/hour")
async def request_password_reset(
    request: Request,
    email_data: PasswordResetRequest,
    password_reset_service: PasswordResetService = Depends(get_password_reset_service),
):
    """
    비밀번호 재설정 요청

    - 등록된 이메일로 재설정 링크 발송
    - Rate Limiting: 3회/시간 (IP당)
    - 사용자 열거 방지: 존재하지 않는 이메일도 동일한 응답
    """
    await password_reset_service.request_reset(email_data.email)

    return MessageResponse(
        message="비밀번호 재설정 링크를 이메일로 전송했습니다. 이메일을 확인해주세요."
    )
```

---

### 6.2 GET /api/auth/password-reset/verify

재설정 토큰 검증

#### Request

```http
GET /api/auth/password-reset/verify?token=550e8400-e29b-41d4-a716-446655440000
```

**Query Parameters**:
- `token` (required): 재설정 토큰 (UUID 형식)

#### Response

**성공 (200 OK)**:
```json
{
  "valid": true,
  "email": "user@example.com"
}
```

**토큰 만료 (400 Bad Request)**:
```json
{
  "detail": "재설정 링크가 만료되었습니다. 새로운 링크를 요청해주세요."
}
```

**토큰 사용됨 (400 Bad Request)**:
```json
{
  "detail": "이미 사용된 재설정 링크입니다."
}
```

**토큰 없음 (404 Not Found)**:
```json
{
  "detail": "유효하지 않은 재설정 링크입니다."
}
```

#### Pydantic Schema

```python
class PasswordResetVerifyResponse(BaseModel):
    valid: bool
    email: str
```

#### Implementation

```python
@router.get(
    "/password-reset/verify",
    status_code=status.HTTP_200_OK,
    response_model=PasswordResetVerifyResponse,
)
@limiter.limit("5/minute")
async def verify_reset_token(
    request: Request,
    token: str,
    password_reset_service: PasswordResetService = Depends(get_password_reset_service),
):
    """
    재설정 토큰 검증

    - 토큰 유효성 확인 (만료/사용 여부)
    - Rate Limiting: 5회/분
    """
    reset_token = await password_reset_service.verify_token(token)

    return PasswordResetVerifyResponse(
        valid=True,
        email=reset_token.user.email,
    )
```

---

### 6.3 POST /api/auth/password-reset/confirm

비밀번호 재설정 확인

#### Request

```http
POST /api/auth/password-reset/confirm
Content-Type: application/json

{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "new_password": "NewSecurePassword123!"
}
```

**Request Body Schema**:
```typescript
interface PasswordResetConfirm {
  token: string;
  new_password: string;  // 최소 8자
}
```

#### Response

**성공 (200 OK)**:
```json
{
  "message": "비밀번호가 성공적으로 재설정되었습니다. 새 비밀번호로 로그인해주세요."
}
```

**비밀번호 유효성 실패 (422 Unprocessable Entity)**:
```json
{
  "detail": [
    {
      "loc": ["body", "new_password"],
      "msg": "비밀번호는 최소 8자 이상이어야 합니다.",
      "type": "value_error.any_str.min_length"
    }
  ]
}
```

**토큰 만료/사용됨 (400 Bad Request)**:
```json
{
  "detail": "유효하지 않거나 만료된 재설정 링크입니다."
}
```

#### Pydantic Schema

```python
from pydantic import BaseModel, constr, validator

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: constr(min_length=8)

    @validator("new_password")
    def validate_password(cls, v):
        # 추가 비밀번호 복잡도 검증 (선택)
        if not any(char.isdigit() for char in v):
            raise ValueError("비밀번호는 최소 1개 이상의 숫자를 포함해야 합니다.")
        if not any(char.isupper() for char in v):
            raise ValueError("비밀번호는 최소 1개 이상의 대문자를 포함해야 합니다.")
        return v
```

#### Implementation

```python
@router.post(
    "/password-reset/confirm",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
)
async def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    password_reset_service: PasswordResetService = Depends(get_password_reset_service),
    audit_log_service: AuditLogService = Depends(get_audit_log_service),
    notification_service: NotificationService = Depends(get_notification_service),
):
    """
    비밀번호 재설정 확인

    - 토큰 검증 및 비밀번호 업데이트
    - 감사 로그 생성
    - 성공 이메일 발송
    """
    user = await password_reset_service.reset_password(
        token=reset_data.token,
        new_password=reset_data.new_password,
    )

    # 감사 로그
    await audit_log_service.log(
        user_id=user.id,
        action="password_reset_completed",
        resource="user",
        details={"method": "email"},
    )

    # 이메일 알림
    await notification_service.send_password_changed_email(user.email)

    return MessageResponse(
        message="비밀번호가 성공적으로 재설정되었습니다. 새 비밀번호로 로그인해주세요."
    )
```

---

### 6.4 POST /api/users/{user_id}/reset-password (Phase 2 - 관리자 전용)

관리자가 사용자 비밀번호 강제 재설정

#### Request

```http
POST /api/users/123/reset-password
Authorization: Bearer {admin_access_token}
Content-Type: application/json

{
  "send_email": true
}
```

#### Response

**성공 (200 OK)**:
```json
{
  "message": "임시 비밀번호가 사용자에게 전송되었습니다.",
  "temporary_password": "TempPass123!"  // 이메일 발송 실패 시에만 반환
}
```

---

## 7. 데이터베이스 설계

### 7.1 PasswordResetToken 모델

**파일**: `backend/app/models/password_reset_token.py`

```python
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from app.db.database import Base

class PasswordResetToken(Base):
    """비밀번호 재설정 토큰"""

    __tablename__ = "password_reset_tokens"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # 토큰 정보
    token = Column(String(36), unique=True, nullable=False, index=True)  # UUID

    # 연관 사용자
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # 상태
    is_used = Column(Boolean, default=False, nullable=False, index=True)

    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)

    # 추적 정보
    ip_address = Column(String(45), nullable=True)  # IPv6 지원
    user_agent = Column(String(255), nullable=True)

    # 관계
    user = relationship("User", back_populates="password_reset_tokens")

    # 복합 인덱스
    __table_args__ = (
        Index("idx_user_created", "user_id", "created_at"),
        Index("idx_expires_used", "expires_at", "is_used"),
    )

    def is_valid(self) -> bool:
        """토큰 유효성 검사"""
        return (
            not self.is_used
            and self.expires_at > datetime.utcnow()
        )

    @staticmethod
    def create_expiration(minutes: int = 30) -> datetime:
        """만료 시간 계산"""
        return datetime.utcnow() + timedelta(minutes=minutes)
```

### 7.2 User 모델 확장

**파일**: `backend/app/models/user.py` (확장)

```python
class User(Base):
    # ... 기존 필드 ...

    # 관계 추가
    password_reset_tokens = relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",  # 쿼리 최적화
    )
```

### 7.3 마이그레이션 스크립트

**파일**: `backend/alembic/versions/xxxx_add_password_reset_tokens.py`

```python
"""Add password_reset_tokens table

Revision ID: xxxx
Revises: yyyy
Create Date: 2026-03-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'xxxx'
down_revision = 'yyyy'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('token', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_token', 'password_reset_tokens', ['token'], unique=True)
    op.create_index('idx_user_id', 'password_reset_tokens', ['user_id'])
    op.create_index('idx_is_used', 'password_reset_tokens', ['is_used'])
    op.create_index('idx_user_created', 'password_reset_tokens', ['user_id', 'created_at'])
    op.create_index('idx_expires_used', 'password_reset_tokens', ['expires_at', 'is_used'])

def downgrade():
    op.drop_index('idx_expires_used', table_name='password_reset_tokens')
    op.drop_index('idx_user_created', table_name='password_reset_tokens')
    op.drop_index('idx_is_used', table_name='password_reset_tokens')
    op.drop_index('idx_user_id', table_name='password_reset_tokens')
    op.drop_index('idx_token', table_name='password_reset_tokens')
    op.drop_table('password_reset_tokens')
```

### 7.4 Repository

**파일**: `backend/app/repositories/password_reset_token_repository.py`

```python
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.password_reset_token import PasswordResetToken

class PasswordResetTokenRepository:
    def __init__(self, db: Session):
        self.db = db

    async def create(
        self,
        user_id: int,
        token: str,
        expires_at: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> PasswordResetToken:
        """토큰 생성"""
        reset_token = PasswordResetToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(reset_token)
        await self.db.commit()
        await self.db.refresh(reset_token)
        return reset_token

    async def get_by_token(self, token: str) -> Optional[PasswordResetToken]:
        """토큰으로 조회"""
        return await self.db.query(PasswordResetToken).filter(
            PasswordResetToken.token == token
        ).first()

    async def mark_as_used(self, token: str) -> None:
        """토큰 사용 처리"""
        reset_token = await self.get_by_token(token)
        if reset_token:
            reset_token.is_used = True
            reset_token.used_at = datetime.utcnow()
            await self.db.commit()

    async def delete_expired(self, cutoff_date: datetime) -> int:
        """만료된 토큰 삭제"""
        result = await self.db.query(PasswordResetToken).filter(
            PasswordResetToken.expires_at < cutoff_date
        ).delete()
        await self.db.commit()
        return result

    async def invalidate_user_tokens(self, user_id: int) -> None:
        """사용자의 모든 활성 토큰 무효화"""
        await self.db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.is_used == False,
        ).update({"is_used": True, "used_at": datetime.utcnow()})
        await self.db.commit()
```

---

## 8. 이메일 시스템 구현

### 8.1 환경 변수 추가

**파일**: `.env.example`

```env
# 기존 변수...

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USERNAME=your-email@example.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@vms-chat-ops.com
SMTP_FROM_NAME=VMS Chat Ops

# Password Reset Configuration
PASSWORD_RESET_EXPIRE_MINUTES=30
FRONTEND_URL=http://localhost:5173
```

### 8.2 설정 모델

**파일**: `backend/app/core/config.py` (신규)

```python
from pydantic import BaseSettings, EmailStr

class Settings(BaseSettings):
    # 기존 설정...

    # SMTP 설정
    smtp_host: str
    smtp_port: int = 587
    smtp_use_tls: bool = True
    smtp_username: str
    smtp_password: str
    smtp_from_email: EmailStr
    smtp_from_name: str = "VMS Chat Ops"

    # 비밀번호 재설정 설정
    password_reset_expire_minutes: int = 30
    frontend_url: str

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

### 8.3 의존성 추가

**파일**: `backend/requirements.txt`

```
# 기존 라이브러리...

# Email
aiosmtplib==3.0.0      # 비동기 SMTP 클라이언트
jinja2==3.1.2          # 이메일 템플릿
email-validator==2.1.0 # 이메일 유효성 검증 (pydantic 의존)
```

### 8.4 이메일 서비스

**파일**: `backend/app/services/email_service.py`

```python
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from app.core.config import settings
import structlog

logger = structlog.get_logger()

class EmailService:
    def __init__(self):
        # Jinja2 템플릿 환경 설정
        template_dir = Path(__file__).parent.parent / "templates" / "emails"
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml']),
        )

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str,
    ) -> bool:
        """
        이메일 발송

        Args:
            to_email: 수신자 이메일
            subject: 제목
            html_body: HTML 본문
            text_body: 텍스트 본문

        Returns:
            성공 여부
        """
        try:
            # MIME 메시지 생성
            message = MIMEMultipart("alternative")
            message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
            message["To"] = to_email
            message["Subject"] = subject

            # 텍스트 및 HTML 파트 추가
            part1 = MIMEText(text_body, "plain")
            part2 = MIMEText(html_body, "html")
            message.attach(part1)
            message.attach(part2)

            # SMTP 연결 및 발송
            async with aiosmtplib.SMTP(
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                use_tls=settings.smtp_use_tls,
            ) as smtp:
                await smtp.login(settings.smtp_username, settings.smtp_password)
                await smtp.send_message(message)

            logger.info("email_sent", to=to_email, subject=subject)
            return True

        except Exception as e:
            logger.error("email_send_failed", to=to_email, error=str(e))
            return False

    async def send_password_reset_email(
        self,
        to_email: str,
        reset_link: str,
        username: str,
    ) -> bool:
        """
        비밀번호 재설정 이메일 발송

        Args:
            to_email: 수신자 이메일
            reset_link: 재설정 링크
            username: 사용자 이름
        """
        # 템플릿 렌더링
        html_template = self.jinja_env.get_template("password_reset.html")
        text_template = self.jinja_env.get_template("password_reset.txt")

        context = {
            "username": username,
            "reset_link": reset_link,
            "expire_minutes": settings.password_reset_expire_minutes,
        }

        html_body = html_template.render(**context)
        text_body = text_template.render(**context)

        return await self.send_email(
            to_email=to_email,
            subject="[VMS Chat Ops] 비밀번호 재설정 요청",
            html_body=html_body,
            text_body=text_body,
        )

    async def send_password_changed_email(
        self,
        to_email: str,
        username: str,
    ) -> bool:
        """
        비밀번호 변경 완료 알림 이메일
        """
        html_template = self.jinja_env.get_template("password_changed.html")
        text_template = self.jinja_env.get_template("password_changed.txt")

        context = {
            "username": username,
        }

        html_body = html_template.render(**context)
        text_body = text_template.render(**context)

        return await self.send_email(
            to_email=to_email,
            subject="[VMS Chat Ops] 비밀번호가 변경되었습니다",
            html_body=html_body,
            text_body=text_body,
        )
```

### 8.5 이메일 템플릿

#### HTML 템플릿

**파일**: `backend/app/templates/emails/password_reset.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>비밀번호 재설정</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 30px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1e40af;
            margin: 0;
        }
        .content {
            background-color: white;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #3b82f6;
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
        }
        .button:hover {
            background-color: #2563eb;
        }
        .footer {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 VMS Chat Ops</h1>
        </div>

        <div class="content">
            <h2>비밀번호 재설정</h2>
            <p>안녕하세요, <strong>{{ username }}</strong>님!</p>
            <p>계정의 비밀번호 재설정 요청을 받았습니다. 아래 버튼을 클릭하여 새 비밀번호를 설정하세요.</p>

            <p style="text-align: center; margin: 30px 0;">
                <a href="{{ reset_link }}" class="button">비밀번호 재설정</a>
            </p>

            <p>또는 다음 링크를 브라우저에 복사하여 붙여넣으세요:</p>
            <p style="word-break: break-all; color: #3b82f6;">{{ reset_link }}</p>

            <div class="warning">
                <p style="margin: 0;"><strong>⚠️ 중요:</strong></p>
                <ul style="margin: 10px 0 0 0;">
                    <li>이 링크는 <strong>{{ expire_minutes }}분</strong> 동안만 유효합니다.</li>
                    <li>비밀번호 재설정을 요청하지 않았다면 이 이메일을 무시하세요.</li>
                    <li>이 링크를 다른 사람과 공유하지 마세요.</li>
                </ul>
            </div>
        </div>

        <div class="footer">
            <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
            <p>&copy; 2026 VMS Chat Ops. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
```

#### 텍스트 템플릿

**파일**: `backend/app/templates/emails/password_reset.txt`

```
VMS Chat Ops - 비밀번호 재설정

안녕하세요, {{ username }}님!

계정의 비밀번호 재설정 요청을 받았습니다. 아래 링크를 클릭하여 새 비밀번호를 설정하세요.

{{ reset_link }}

중요:
- 이 링크는 {{ expire_minutes }}분 동안만 유효합니다.
- 비밀번호 재설정을 요청하지 않았다면 이 이메일을 무시하세요.
- 이 링크를 다른 사람과 공유하지 마세요.

이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.

© 2026 VMS Chat Ops. All rights reserved.
```

#### 비밀번호 변경 완료 템플릿

**파일**: `backend/app/templates/emails/password_changed.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>비밀번호 변경 완료</title>
    <style>
        /* 위와 동일한 스타일 */
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 VMS Chat Ops</h1>
        </div>

        <div class="content">
            <h2>비밀번호가 변경되었습니다</h2>
            <p>안녕하세요, <strong>{{ username }}</strong>님!</p>
            <p>계정의 비밀번호가 성공적으로 변경되었습니다.</p>

            <div class="warning">
                <p style="margin: 0;"><strong>⚠️ 본인이 변경하지 않았다면:</strong></p>
                <p style="margin: 10px 0 0 0;">즉시 관리자에게 문의하여 계정을 보호하세요.</p>
            </div>
        </div>

        <div class="footer">
            <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
            <p>&copy; 2026 VMS Chat Ops. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
```

---

## 9. 프론트엔드 UI/UX

### 9.1 라우팅 추가

**파일**: `frontend/src/App.tsx`

```typescript
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';

function App() {
  return (
    <Routes>
      {/* 기존 라우트... */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 비밀번호 재설정 라우트 (신규) */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* ... */}
    </Routes>
  );
}
```

### 9.2 ForgotPassword 페이지

**파일**: `frontend/src/pages/ForgotPassword.tsx`

```typescript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useNotificationStore } from '../store/notification';
import { apiClient } from '../lib/api/client';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { addNotification } = useNotificationStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await apiClient.requestPasswordReset(email);
      setIsSuccess(true);
    } catch (err) {
      addNotification({
        id: `forgot-password-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'auth',
        title: '오류 발생',
        message: '비밀번호 재설정 요청 중 오류가 발생했습니다. 다시 시도해주세요.',
        source: 'forgot_password_page',
        dismissible: true,
        persistent: false,
        read: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-state-success-subtle p-6">
                <CheckCircle2 className="h-16 w-16 text-state-success-emphasis" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-content-primary mb-4">
              이메일을 확인하세요
            </h1>

            <div className="bg-surface-card rounded-lg p-6 space-y-4 border border-border-subtle">
              <p className="text-content-secondary">
                <strong>{email}</strong>로 비밀번호 재설정 링크를 전송했습니다.
              </p>
              <p className="text-sm text-content-tertiary">
                이메일을 받지 못했다면 스팸 폴더를 확인해주세요.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <Link to="/login">
                <Button variant="primary" fullWidth>
                  로그인 페이지로 이동
                </Button>
              </Link>
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  setIsSuccess(false);
                  setEmail('');
                }}
              >
                다른 이메일로 재시도
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-content-primary">
            비밀번호 찾기
          </h1>
          <p className="mt-2 text-content-secondary">
            등록된 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-content-primary mb-2">
              이메일 주소
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              leftIcon={<Mail className="h-5 w-5" />}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isSubmitting}
          >
            {isSubmitting ? '전송 중...' : '재설정 링크 전송'}
          </Button>
        </form>

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-brand-primary hover:text-brand-primary-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### 9.3 ResetPassword 페이지

**파일**: `frontend/src/pages/ResetPassword.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useNotificationStore } from '../store/notification';
import { apiClient } from '../lib/api/client';

export function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    if (!token) {
      setIsVerifying(false);
      setErrorMessage('유효하지 않은 재설정 링크입니다.');
      return;
    }

    try {
      const response = await apiClient.verifyResetToken(token);
      setIsTokenValid(true);
      setEmail(response.email);
    } catch (err) {
      setIsTokenValid(false);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : '재설정 링크가 만료되었거나 유효하지 않습니다.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      addNotification({
        id: `password-mismatch-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'auth',
        title: '비밀번호 불일치',
        message: '비밀번호와 비밀번호 확인이 일치하지 않습니다.',
        source: 'reset_password_page',
        dismissible: true,
        persistent: false,
        read: false,
      });
      return;
    }

    if (newPassword.length < 8) {
      addNotification({
        id: `password-length-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'auth',
        title: '비밀번호 형식 오류',
        message: '비밀번호는 최소 8자 이상이어야 합니다.',
        source: 'reset_password_page',
        dismissible: true,
        persistent: false,
        read: false,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.resetPassword(token!, newPassword);

      addNotification({
        id: `password-reset-success-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'success',
        category: 'auth',
        title: '비밀번호 재설정 완료',
        message: '비밀번호가 성공적으로 재설정되었습니다. 새 비밀번호로 로그인해주세요.',
        source: 'reset_password_page',
        dismissible: true,
        persistent: false,
        read: false,
      });

      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      addNotification({
        id: `reset-password-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'auth',
        title: '오류 발생',
        message:
          err instanceof Error
            ? err.message
            : '비밀번호 재설정 중 오류가 발생했습니다.',
        source: 'reset_password_page',
        dismissible: true,
        persistent: false,
        read: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-content-secondary">링크 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-state-error-subtle p-6">
              <XCircle className="h-16 w-16 text-state-error-emphasis" />
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-content-primary">
              유효하지 않은 링크
            </h1>
            <p className="mt-4 text-content-secondary">{errorMessage}</p>
          </div>

          <div className="space-y-3">
            <Link to="/forgot-password">
              <Button variant="primary" fullWidth>
                새로운 재설정 링크 요청
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" fullWidth>
                로그인 페이지로 이동
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-content-primary">
            새 비밀번호 설정
          </h1>
          <p className="mt-2 text-content-secondary">
            <strong>{email}</strong> 계정의 새 비밀번호를 입력하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-content-primary mb-2"
            >
              새 비밀번호
            </label>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="최소 8자 이상"
              leftIcon={<Lock className="h-5 w-5" />}
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-content-primary mb-2"
            >
              비밀번호 확인
            </label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 재입력"
              leftIcon={<Lock className="h-5 w-5" />}
            />
          </div>

          <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
            {isSubmitting ? '재설정 중...' : '비밀번호 재설정'}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

### 9.4 Login 페이지 수정

**파일**: `frontend/src/pages/Login.tsx` (수정)

```typescript
// 기존 코드...

return (
  <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
    <div className="max-w-md w-full space-y-8">
      {/* ... 로그인 폼 ... */}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* ... */}

        <Button type="submit" variant="primary" fullWidth>
          로그인
        </Button>
      </form>

      {/* 비밀번호 찾기 링크 추가 */}
      <div className="text-center space-y-3">
        <Link
          to="/forgot-password"
          className="block text-sm text-brand-primary hover:text-brand-primary-hover"
        >
          비밀번호를 잊으셨나요?
        </Link>

        <p className="text-sm text-content-tertiary">
          계정이 없으신가요?{' '}
          <Link to="/register" className="text-brand-primary hover:text-brand-primary-hover">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  </div>
);
```

### 9.5 API 클라이언트 확장

**파일**: `frontend/src/lib/api/auth.ts` (확장)

```typescript
// 기존 auth API 함수들...

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetVerifyResponse {
  valid: boolean;
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

/**
 * 비밀번호 재설정 요청
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.request('/api/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * 재설정 토큰 검증
 */
export async function verifyResetToken(token: string): Promise<PasswordResetVerifyResponse> {
  return await apiClient.request(`/api/auth/password-reset/verify?token=${token}`, {
    method: 'GET',
  });
}

/**
 * 비밀번호 재설정 확인
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiClient.request('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({
      token,
      new_password: newPassword,
    }),
  });
}
```

---

## 10. 구현 계획

### 10.1 Phase 1: 백엔드 기반 구축 (Week 1)

| 작업 | 담당 | 예상 시간 | 우선순위 |
|------|------|----------|---------|
| 1.1. 환경 변수 및 설정 추가 | Backend | 1시간 | P0 |
| 1.2. 의존성 설치 (aiosmtplib, jinja2) | Backend | 0.5시간 | P0 |
| 1.3. PasswordResetToken 모델 생성 | Backend | 2시간 | P0 |
| 1.4. Alembic 마이그레이션 스크립트 | Backend | 1시간 | P0 |
| 1.5. PasswordResetTokenRepository 구현 | Backend | 3시간 | P0 |
| 1.6. EmailService 구현 | Backend | 4시간 | P0 |
| 1.7. 이메일 템플릿 작성 (HTML/Text) | Backend | 3시간 | P0 |
| 1.8. 단위 테스트 (EmailService) | Backend | 2시간 | P1 |

**완료 기준**:
- ✅ 데이터베이스 마이그레이션 성공
- ✅ 이메일 발송 테스트 성공
- ✅ 템플릿 렌더링 정상 작동

---

### 10.2 Phase 2: 비밀번호 재설정 API 구현 (Week 2)

| 작업 | 담당 | 예상 시간 | 우선순위 |
|------|------|----------|---------|
| 2.1. Pydantic 스키마 정의 | Backend | 2시간 | P0 |
| 2.2. PasswordResetService 구현 | Backend | 6시간 | P0 |
| 2.3. API 엔드포인트 구현 (/request) | Backend | 3시간 | P0 |
| 2.4. API 엔드포인트 구현 (/verify) | Backend | 2시간 | P0 |
| 2.5. API 엔드포인트 구현 (/confirm) | Backend | 3시간 | P0 |
| 2.6. Rate Limiting 추가 | Backend | 2시간 | P0 |
| 2.7. 감사 로그 통합 | Backend | 2시간 | P0 |
| 2.8. 단위 테스트 (PasswordResetService) | Backend | 4시간 | P1 |
| 2.9. 통합 테스트 (API 엔드포인트) | Backend | 4시간 | P1 |

**완료 기준**:
- ✅ 모든 API 엔드포인트 정상 작동
- ✅ 토큰 생성/검증/무효화 로직 테스트 통과
- ✅ 이메일 발송 백그라운드 작업 성공

---

### 10.3 Phase 3: 프론트엔드 UI 구현 (Week 3)

| 작업 | 담당 | 예상 시간 | 우선순위 |
|------|------|----------|---------|
| 3.1. API 클라이언트 확장 (auth.ts) | Frontend | 2시간 | P0 |
| 3.2. ForgotPassword 페이지 구현 | Frontend | 4시간 | P0 |
| 3.3. ResetPassword 페이지 구현 | Frontend | 5시간 | P0 |
| 3.4. Login 페이지 수정 (링크 추가) | Frontend | 1시간 | P0 |
| 3.5. 라우팅 추가 (App.tsx) | Frontend | 1시간 | P0 |
| 3.6. 에러 처리 및 Toast 통합 | Frontend | 2시간 | P0 |
| 3.7. 반응형 디자인 테스트 | Frontend | 2시간 | P1 |
| 3.8. 컴포넌트 테스트 (Vitest) | Frontend | 4시간 | P1 |

**완료 기준**:
- ✅ 모든 페이지 정상 렌더링
- ✅ 비밀번호 재설정 플로우 E2E 성공
- ✅ 반응형 디자인 모바일/데스크톱 지원

---

### 10.4 Phase 4: 테스트 및 문서화 (Week 4)

| 작업 | 담당 | 예상 시간 | 우선순위 |
|------|------|----------|---------|
| 4.1. E2E 테스트 (Playwright) | QA | 6시간 | P0 |
| 4.2. 보안 테스트 (Rate Limiting, 토큰) | Security | 4시간 | P0 |
| 4.3. 부하 테스트 (이메일 발송) | QA | 3시간 | P1 |
| 4.4. API 문서 업데이트 | Tech Writer | 3시간 | P1 |
| 4.5. 사용자 가이드 작성 | Tech Writer | 3시간 | P1 |
| 4.6. 관리자 가이드 작성 | Tech Writer | 2시간 | P2 |
| 4.7. CLAUDE.md 업데이트 | Tech Writer | 1시간 | P2 |

**완료 기준**:
- ✅ 모든 테스트 통과
- ✅ 문서 작성 완료
- ✅ 배포 준비 완료

---

### 10.5 Phase 5: 관리자 기능 확장 (선택, Week 5)

| 작업 | 담당 | 예상 시간 | 우선순위 |
|------|------|----------|---------|
| 5.1. 관리자 비밀번호 재설정 API | Backend | 3시간 | P2 |
| 5.2. 임시 비밀번호 생성 로직 | Backend | 2시간 | P2 |
| 5.3. UserManagement 페이지 수정 | Frontend | 3시간 | P2 |
| 5.4. 비밀번호 만료 정책 (선택) | Backend | 4시간 | P3 |

---

### 10.6 타임라인

```
Week 1: 백엔드 기반 구축
├─ Day 1-2: 모델, 마이그레이션, Repository
├─ Day 3-4: EmailService, 템플릿
└─ Day 5: 단위 테스트

Week 2: 비밀번호 재설정 API
├─ Day 1-2: PasswordResetService
├─ Day 3-4: API 엔드포인트, Rate Limiting
└─ Day 5: 통합 테스트

Week 3: 프론트엔드 UI
├─ Day 1-2: ForgotPassword, ResetPassword 페이지
├─ Day 3-4: API 클라이언트, 에러 처리
└─ Day 5: 컴포넌트 테스트

Week 4: 테스트 및 문서화
├─ Day 1-2: E2E 테스트, 보안 테스트
├─ Day 3-4: 문서 작성
└─ Day 5: 배포 준비

Week 5 (선택): 관리자 기능 확장
└─ 전체 기간: 관리자 비밀번호 재설정 기능
```

---

## 11. 테스트 계획

### 11.1 단위 테스트

#### Backend

**파일**: `backend/tests/services/test_password_reset_service.py`

```python
import pytest
from datetime import datetime, timedelta
from app.services.password_reset_service import PasswordResetService
from app.models.password_reset_token import PasswordResetToken

@pytest.mark.asyncio
async def test_create_reset_token(db_session, test_user):
    """재설정 토큰 생성 테스트"""
    service = PasswordResetService(db_session)

    token = await service.create_reset_token(test_user)

    assert token is not None
    assert len(token.token) == 36  # UUID 길이
    assert token.user_id == test_user.id
    assert not token.is_used
    assert token.expires_at > datetime.utcnow()

@pytest.mark.asyncio
async def test_verify_valid_token(db_session, test_user):
    """유효한 토큰 검증 테스트"""
    service = PasswordResetService(db_session)

    token = await service.create_reset_token(test_user)
    verified = await service.verify_token(token.token)

    assert verified.id == token.id
    assert verified.user.id == test_user.id

@pytest.mark.asyncio
async def test_verify_expired_token(db_session, test_user):
    """만료된 토큰 검증 테스트"""
    service = PasswordResetService(db_session)

    # 만료된 토큰 생성
    expired_token = PasswordResetToken(
        user_id=test_user.id,
        token="test-token",
        expires_at=datetime.utcnow() - timedelta(minutes=1),
    )
    db_session.add(expired_token)
    await db_session.commit()

    with pytest.raises(ValueError, match="만료"):
        await service.verify_token("test-token")

@pytest.mark.asyncio
async def test_reset_password(db_session, test_user):
    """비밀번호 재설정 테스트"""
    service = PasswordResetService(db_session)

    token = await service.create_reset_token(test_user)
    new_password = "NewPassword123!"

    user = await service.reset_password(token.token, new_password)

    assert user.id == test_user.id
    # 비밀번호가 변경되었는지 확인 (해시 비교)
    from app.utils.auth import verify_password
    assert verify_password(new_password, user.hashed_password)

    # 토큰이 무효화되었는지 확인
    db_session.refresh(token)
    assert token.is_used
    assert token.used_at is not None
```

#### Frontend

**파일**: `frontend/src/pages/__tests__/ForgotPassword.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ForgotPassword } from '../ForgotPassword';
import { apiClient } from '../../lib/api/client';

jest.mock('../../lib/api/client');

describe('ForgotPassword', () => {
  it('이메일 입력 폼이 표시된다', () => {
    render(
      <BrowserRouter>
        <ForgotPassword />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/이메일 주소/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /재설정 링크 전송/i })).toBeInTheDocument();
  });

  it('이메일 제출 시 성공 메시지가 표시된다', async () => {
    (apiClient.requestPasswordReset as jest.Mock).mockResolvedValue({});

    render(
      <BrowserRouter>
        <ForgotPassword />
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/이메일 주소/i);
    const submitButton = screen.getByRole('button', { name: /재설정 링크 전송/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/이메일을 확인하세요/i)).toBeInTheDocument();
    });
  });
});
```

### 11.2 통합 테스트

**파일**: `backend/tests/api/test_password_reset_api.py`

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_request_password_reset_flow(client: AsyncClient, test_user):
    """비밀번호 재설정 전체 플로우 테스트"""

    # 1. 재설정 요청
    response = await client.post(
        "/api/auth/password-reset/request",
        json={"email": test_user.email},
    )
    assert response.status_code == 200
    assert "이메일" in response.json()["message"]

    # 2. 토큰 조회 (DB에서)
    # ... (토큰 가져오기 로직)

    # 3. 토큰 검증
    response = await client.get(
        f"/api/auth/password-reset/verify?token={token.token}",
    )
    assert response.status_code == 200
    assert response.json()["valid"] is True

    # 4. 비밀번호 재설정
    response = await client.post(
        "/api/auth/password-reset/confirm",
        json={
            "token": token.token,
            "new_password": "NewPassword123!",
        },
    )
    assert response.status_code == 200

    # 5. 새 비밀번호로 로그인
    response = await client.post(
        "/api/auth/login",
        json={
            "email": test_user.email,
            "password": "NewPassword123!",
        },
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

@pytest.mark.asyncio
async def test_rate_limiting(client: AsyncClient):
    """Rate Limiting 테스트"""

    # 3회 요청 성공
    for _ in range(3):
        response = await client.post(
            "/api/auth/password-reset/request",
            json={"email": "test@example.com"},
        )
        assert response.status_code == 200

    # 4회째 요청 실패 (Rate Limit 초과)
    response = await client.post(
        "/api/auth/password-reset/request",
        json={"email": "test@example.com"},
    )
    assert response.status_code == 429
```

### 11.3 E2E 테스트

**파일**: `e2e/password-reset.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('비밀번호 재설정', () => {
  test('전체 플로우 성공', async ({ page, context }) => {
    // 1. 로그인 페이지에서 "비밀번호 찾기" 클릭
    await page.goto('http://localhost:5173/login');
    await page.click('text=비밀번호를 잊으셨나요?');

    // 2. 이메일 입력 및 제출
    await expect(page).toHaveURL(/forgot-password/);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button:has-text("재설정 링크 전송")');

    // 3. 성공 메시지 확인
    await expect(page.locator('text=이메일을 확인하세요')).toBeVisible();

    // 4. 이메일에서 토큰 추출 (테스트 환경에서는 DB에서 직접 조회)
    const token = await getLatestResetToken('test@example.com');

    // 5. 재설정 링크 접근
    await page.goto(`http://localhost:5173/reset-password/${token}`);

    // 6. 새 비밀번호 입력
    await expect(page.locator('text=새 비밀번호 설정')).toBeVisible();
    await page.fill('input[name="newPassword"]', 'NewPassword123!');
    await page.fill('input[name="confirmPassword"]', 'NewPassword123!');
    await page.click('button:has-text("비밀번호 재설정")');

    // 7. 성공 후 로그인 페이지로 리다이렉트
    await expect(page).toHaveURL(/login/, { timeout: 5000 });

    // 8. 새 비밀번호로 로그인
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'NewPassword123!');
    await page.click('button[type="submit"]');

    // 9. 대시보드 접근 확인
    await expect(page).toHaveURL(/\/$/);
  });

  test('만료된 토큰 오류 처리', async ({ page }) => {
    const expiredToken = 'expired-token-uuid';
    await page.goto(`http://localhost:5173/reset-password/${expiredToken}`);

    await expect(page.locator('text=유효하지 않은 링크')).toBeVisible();
    await expect(page.locator('text=새로운 재설정 링크 요청')).toBeVisible();
  });
});
```

---

## 12. 배포 및 운영

### 12.1 환경 변수 설정

**프로덕션 환경**:
```env
# SMTP 설정 (Gmail 예시)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USERNAME=noreply@yourdomain.com
SMTP_PASSWORD=your-app-password  # Gmail 앱 비밀번호
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=VMS Chat Ops

# 비밀번호 재설정 설정
PASSWORD_RESET_EXPIRE_MINUTES=30
FRONTEND_URL=https://yourdomain.com
```

**Gmail 앱 비밀번호 생성**:
1. Google 계정 → 보안
2. 2단계 인증 활성화
3. 앱 비밀번호 생성
4. `.env` 파일에 입력

**대안 SMTP 서비스**:
- SendGrid (권장)
- Mailgun
- Amazon SES
- Postmark

### 12.2 데이터베이스 마이그레이션

```bash
# 개발 환경
cd backend
alembic upgrade head

# 프로덕션 환경 (Docker)
docker exec -it vms-backend alembic upgrade head
```

### 12.3 모니터링

#### A. 이메일 발송 실패 모니터링

```python
# backend/app/services/email_service.py에 추가
import structlog

logger = structlog.get_logger()

async def send_email(...):
    try:
        # 이메일 발송 로직...
        logger.info("email_sent_success", to=to_email, subject=subject)
        return True
    except Exception as e:
        logger.error(
            "email_sent_failed",
            to=to_email,
            subject=subject,
            error=str(e),
            exc_info=True,
        )
        # 관리자에게 알림 (Slack, Email 등)
        await notify_admin_email_failure(to_email, str(e))
        return False
```

#### B. 재설정 요청 추이 모니터링

```sql
-- 일별 재설정 요청 통계
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS total_requests,
    SUM(CASE WHEN is_used THEN 1 ELSE 0 END) AS completed_resets,
    SUM(CASE WHEN expires_at < NOW() AND NOT is_used THEN 1 ELSE 0 END) AS expired_tokens
FROM password_reset_tokens
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 12.4 보안 체크리스트

- [ ] HTTPS 강제 (프로덕션)
- [ ] SMTP TLS 활성화
- [ ] JWT Secret 강력한 랜덤 값 사용
- [ ] Rate Limiting 활성화
- [ ] 감사 로그 모니터링
- [ ] CORS 설정 검토
- [ ] 이메일 템플릿 XSS 방지
- [ ] 토큰 만료 시간 검증
- [ ] 비밀번호 복잡도 정책 적용 (선택)

### 12.5 정리 작업 (Cron Job)

**파일**: `backend/app/tasks/cleanup.py` (신규)

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
from app.db.database import get_db
from app.repositories.password_reset_token_repository import PasswordResetTokenRepository
import structlog

logger = structlog.get_logger()

async def cleanup_expired_tokens():
    """만료된 토큰 정리 (7일 이상 경과)"""
    try:
        db = next(get_db())
        repo = PasswordResetTokenRepository(db)

        cutoff_date = datetime.utcnow() - timedelta(days=7)
        deleted_count = await repo.delete_expired(cutoff_date)

        logger.info("token_cleanup_completed", deleted_count=deleted_count)
    except Exception as e:
        logger.error("token_cleanup_failed", error=str(e))

def setup_scheduled_tasks():
    """스케줄 작업 설정"""
    scheduler = AsyncIOScheduler()

    # 매일 자정에 토큰 정리
    scheduler.add_job(
        cleanup_expired_tokens,
        'cron',
        hour=0,
        minute=0,
    )

    scheduler.start()
    logger.info("scheduled_tasks_started")
```

**main.py에 추가**:
```python
from app.tasks.cleanup import setup_scheduled_tasks

@app.on_event("startup")
async def startup_event():
    setup_scheduled_tasks()
```

---

## 13. 참고 자료

### 13.1 관련 문서

- [VMS Chat Ops 아키텍처 문서](../developer-guide/ARCHITECTURE)
- [API 문서](../api/API_DOCUMENTATION)
- [보안 가이드](../admin-guide/SECURITY_GUIDE)

### 13.2 외부 참고

- [OWASP - Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [FastAPI - Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [aiosmtplib Documentation](https://aiosmtplib.readthedocs.io/)
- [Jinja2 Template Designer Documentation](https://jinja.palletsprojects.com/)

---

## 14. 승인 및 리뷰

### 리뷰어

- [ ] Backend Lead:
- [ ] Frontend Lead:
- [ ] Security Team:
- [ ] Product Owner:

### 승인 상태

- 상태: **제안**
- 승인일:
- 다음 단계: Phase 1 구현 시작

---

**문서 버전**: 1.0
**최종 수정일**: 2026-03-24
**작성자**: VMS Chat Ops Development Team
