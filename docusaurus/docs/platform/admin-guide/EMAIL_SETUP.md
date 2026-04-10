---
id: email-setup
title: 이메일 설정 가이드
sidebar_position: 6
tags: [guide, admin]
---

# 이메일 설정 가이드

## 개요

VMS Chat Ops의 비밀번호 재설정 기능을 위한 이메일 설정 가이드입니다.

## 환경별 설정

### 개발 환경 (MailHog 사용)

개발 환경에서는 MailHog를 사용하여 실제 이메일을 발송하지 않고 로컬에서 테스트할 수 있습니다.

#### docker-compose.yml 설정

MailHog 서비스가 이미 설정되어 있으며, 다음 설정이 자동으로 적용됩니다:

```yaml
mailhog:
  image: mailhog/mailhog:latest
  ports:
    - "1025:1025"  # SMTP 포트
    - "8025:8025"  # Web UI 포트
```

Backend 서비스의 기본 환경 변수:
```yaml
- SMTP_HOST=mailhog
- SMTP_PORT=1025
- SMTP_USERNAME=mailhog
- SMTP_PASSWORD=mailhog
- SMTP_FROM_EMAIL=noreply@vms-chat-ops.com
- SMTP_FROM_NAME=VMS Chat Ops
- FRONTEND_URL=http://localhost:5173
```

#### MailHog Web UI 사용

1. 브라우저에서 http://localhost:8025 접속
2. 발송된 이메일 확인
3. 비밀번호 재설정 링크 복사

#### 테스트 방법

```bash
# 비밀번호 재설정 요청
curl -X POST http://localhost:8000/api/auth/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# MailHog에서 이메일 확인
curl http://localhost:8025/api/v2/messages
```

### 프로덕션 환경 (Gmail 사용)

프로덕션 환경에서는 실제 SMTP 서버를 사용합니다.

#### .env 파일 설정

```env
# SMTP 설정 (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=VMS Chat Ops
FRONTEND_URL=https://yourdomain.com
```

#### Gmail 앱 비밀번호 생성

1. Google 계정 설정(https://myaccount.google.com) 접속
2. **보안** 탭 선택
3. **2단계 인증** 활성화 (필수)
4. **앱 비밀번호** 생성:
   - 앱 선택: 메일
   - 기기 선택: 기타 (사용자 지정 이름)
   - 이름 입력: "VMS Chat Ops"
5. 생성된 16자리 비밀번호를 `SMTP_PASSWORD`에 입력

#### 보안 주의사항

⚠️ **중요**: `.env` 파일은 절대 Git에 커밋하지 마세요!

```bash
# .gitignore에 이미 포함되어 있음
.env
```

### 기타 SMTP 서버 사용

#### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=VMS Chat Ops
```

#### AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=VMS Chat Ops
```

#### Outlook/Office 365

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=VMS Chat Ops
```

## 환경 변수 설명

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `SMTP_HOST` | SMTP 서버 호스트 | `mailhog` | ✅ |
| `SMTP_PORT` | SMTP 포트 (587: TLS, 1025: MailHog) | `1025` | ✅ |
| `SMTP_USERNAME` | SMTP 사용자명 | `mailhog` | ✅ |
| `SMTP_PASSWORD` | SMTP 비밀번호 | `mailhog` | ✅ |
| `SMTP_FROM_EMAIL` | 발신 이메일 주소 | `noreply@vms-chat-ops.com` | ✅ |
| `SMTP_FROM_NAME` | 발신자 이름 | `VMS Chat Ops` | ❌ |
| `FRONTEND_URL` | 프론트엔드 URL (재설정 링크용) | `http://localhost:5173` | ✅ |

## 트러블슈팅

### 이메일이 발송되지 않음

1. **SMTP 자격증명 확인**
   ```bash
   docker compose exec backend printenv | grep SMTP
   ```

2. **백엔드 로그 확인**
   ```bash
   docker compose logs backend --tail=50 | grep -i email
   ```

3. **MailHog 메시지 확인** (개발 환경)
   ```bash
   curl http://localhost:8025/api/v2/messages
   ```

### Gmail "Less secure app" 오류

Gmail은 더 이상 "보안 수준이 낮은 앱 액세스"를 지원하지 않습니다.
반드시 **앱 비밀번호**를 사용해야 합니다.

### TLS 연결 오류

포트 설정을 확인하세요:
- **포트 587**: STARTTLS 사용 (대부분의 SMTP 서버)
- **포트 465**: SSL/TLS 사용 (일부 서버)
- **포트 1025**: TLS 없음 (MailHog 등 개발용)

코드에서 포트 1025 또는 1026은 자동으로 TLS를 비활성화합니다.

## 이메일 템플릿

비밀번호 재설정 이메일은 HTML 템플릿으로 구성되어 있습니다:

- **템플릿 위치**: `backend/app/services/email_service.py`
- **스타일**: 그라디언트 배경, 반응형 디자인
- **내용**: 재설정 링크, 유효 시간 (30분), 보안 안내

### 템플릿 커스터마이징

`email_service.py`의 `send_password_reset_email` 함수에서 HTML 템플릿을 수정할 수 있습니다.

## 감사 로그

비밀번호 재설정 요청은 자동으로 감사 로그에 기록됩니다:

- `user.password_reset_request`: 재설정 요청
- `user.password_reset`: 재설정 완료

관리자는 `/audit-logs` 페이지에서 확인할 수 있습니다.

## 참고 문서

- [MailHog 공식 문서](https://github.com/mailhog/MailHog)
- [Gmail 앱 비밀번호 가이드](https://support.google.com/accounts/answer/185833)
- [SendGrid SMTP 문서](https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api)
- [AWS SES SMTP 문서](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)
