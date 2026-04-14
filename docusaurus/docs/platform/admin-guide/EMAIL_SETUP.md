---
id: email-setup
title: 이메일 설정 가이드
sidebar_position: 6
tags: [guide, admin, email, smtp]
---

# 이메일 설정 가이드

## 개요

v-project는 비밀번호 재설정 등의 기능에서 이메일을 발송합니다. 개발 환경에서는 MailHog를 사용하여 실제 이메일 없이 테스트하고, 프로덕션에서는 실제 SMTP 서버(Gmail, SendGrid, AWS SES 등)를 사용합니다.

---

## 환경별 설정 개요

| 구분 | SMTP 서버 | 포트 | TLS | 실제 발송 |
|------|----------|------|-----|----------|
| 개발 환경 | MailHog | 1025 | 없음 | X (Web UI에서 확인) |
| 프로덕션 (Gmail) | smtp.gmail.com | 587 | STARTTLS | O |
| 프로덕션 (SendGrid) | smtp.sendgrid.net | 587 | STARTTLS | O |
| 프로덕션 (AWS SES) | `email-smtp.{region}.amazonaws.com` | 587 | STARTTLS | O |
| 프로덕션 (Office 365) | smtp.office365.com | 587 | STARTTLS | O |

---

## 개발 환경: MailHog

### MailHog란?

MailHog는 개발용 가짜 SMTP 서버입니다. 발송된 이메일을 실제로 전달하지 않고, Web UI를 통해 확인할 수 있습니다. v-project의 `docker-compose.yml`에 이미 포함되어 있어 별도 설치가 필요 없습니다.

### Docker Compose 설정

```yaml
# docker-compose.yml (이미 설정됨)
mailhog:
  image: mailhog/mailhog:latest
  container_name: v-project-mailhog
  restart: unless-stopped
  ports:
    - "1025:1025"  # SMTP 포트
    - "8025:8025"  # Web UI 포트
```

### 기본 환경 변수

개발 환경에서는 `.env` 파일이 없어도 기본값이 자동 적용됩니다.

```bash
SMTP_HOST=mailhog          # Docker Compose 서비스 이름
SMTP_PORT=1025             # MailHog SMTP 포트
SMTP_USERNAME=             # MailHog는 인증 불필요
SMTP_PASSWORD=             # MailHog는 인증 불필요
SMTP_FROM_EMAIL=noreply@v-project.local
SMTP_FROM_NAME=v-channel-bridge
FRONTEND_URL=http://127.0.0.1:5173
```

:::note TLS 자동 감지
코드에서 포트가 1025인 경우 TLS를 자동으로 비활성화합니다. 개발 환경에서 TLS 관련 설정을 별도로 할 필요가 없습니다.
:::

### MailHog Web UI 사용

1. 브라우저에서 `http://127.0.0.1:8025` 접속
2. 발송된 모든 이메일을 목록으로 확인
3. 이메일을 클릭하면 HTML 렌더링, 원본, 헤더를 확인 가능
4. 비밀번호 재설정 이메일의 링크를 복사하여 테스트

### 개발 환경 테스트

```bash
# 1. 비밀번호 재설정 요청
curl -X POST http://127.0.0.1:8000/api/auth/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# 2. MailHog API로 이메일 확인
curl http://127.0.0.1:8025/api/v2/messages

# 3. 또는 브라우저에서 http://127.0.0.1:8025 접속
```

:::tip MailHog API
MailHog는 REST API도 제공합니다. `http://127.0.0.1:8025/api/v2/messages`로 모든 이메일을 JSON으로 조회하고, `http://127.0.0.1:8025/api/v1/messages`로 삭제할 수 있습니다. 자동화 테스트에 유용합니다.
:::

---

## 프로덕션 환경: 실제 SMTP 서버

### Gmail SMTP 설정

Gmail을 SMTP 서버로 사용하려면 **앱 비밀번호**가 필요합니다. 일반 비밀번호로는 접속할 수 없습니다.

#### 1단계: 2단계 인증 활성화

1. [Google 계정 설정](https://myaccount.google.com) 접속
2. **보안** 탭 선택
3. **2단계 인증** 활성화

#### 2단계: 앱 비밀번호 생성

1. 보안 탭에서 **앱 비밀번호** 선택
2. 앱: **메일**, 기기: **기타 (사용자 지정 이름)**
3. 이름 입력: `v-project`
4. **생성** 클릭
5. 16자리 비밀번호가 표시됨 (공백 포함)

#### 3단계: .env 설정

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx    # 앱 비밀번호 (공백 포함 가능)
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=v-project
FRONTEND_URL=https://yourdomain.com
```

:::warning Gmail 제한
Gmail SMTP는 하루 500통(일반 계정) 또는 2,000통(Google Workspace) 제한이 있습니다. 대량 발송이 필요하면 SendGrid나 AWS SES를 사용하세요.
:::

### SendGrid SMTP 설정

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey                  # 항상 "apikey" 고정
SMTP_PASSWORD=SG.xxxxx...            # SendGrid API 키
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=v-project
```

SendGrid API 키 생성:
1. [SendGrid 대시보드](https://app.sendgrid.com) 접속
2. Settings > API Keys > Create API Key
3. **Restricted Access** 선택 후 Mail Send 권한만 부여
4. 생성된 키를 `SMTP_PASSWORD`에 입력

### AWS SES SMTP 설정

```bash
SMTP_HOST=email-smtp.ap-northeast-2.amazonaws.com   # 리전에 맞게 변경
SMTP_PORT=587
SMTP_USERNAME=your-ses-smtp-username     # IAM SMTP 자격증명
SMTP_PASSWORD=your-ses-smtp-password     # IAM SMTP 비밀번호
SMTP_FROM_EMAIL=noreply@yourdomain.com   # SES에서 인증된 이메일/도메인
SMTP_FROM_NAME=v-project
```

:::note AWS SES 샌드박스
새 AWS SES 계정은 샌드박스 모드에서 시작합니다. 인증된 이메일 주소로만 발송 가능하며, 프로덕션 사용을 위해 AWS에 샌드박스 해제를 요청해야 합니다.
:::

### Office 365 / Outlook SMTP 설정

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=your-email@company.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=noreply@company.com
SMTP_FROM_NAME=v-project
```

---

## 환경 변수 상세

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `SMTP_HOST` | SMTP 서버 호스트 | `mailhog` | O |
| `SMTP_PORT` | SMTP 포트 (587: STARTTLS, 1025: MailHog) | `1025` | O |
| `SMTP_USERNAME` | SMTP 인증 사용자명 | (빈 문자열) | 프로덕션에서 O |
| `SMTP_PASSWORD` | SMTP 인증 비밀번호 | (빈 문자열) | 프로덕션에서 O |
| `SMTP_FROM_EMAIL` | 발신 이메일 주소 | `noreply@v-project.local` | O |
| `SMTP_FROM_NAME` | 발신자 표시 이름 | `v-channel-bridge` | - |
| `FRONTEND_URL` | 프론트엔드 URL (비밀번호 재설정 링크에 포함) | `http://127.0.0.1:5173` | O |

:::danger 보안 경고
`.env` 파일에 SMTP 비밀번호를 저장하므로, 이 파일은 절대 Git에 커밋하지 마세요. `.gitignore`에 `.env`가 이미 포함되어 있습니다.
:::

---

## 이메일 기능

### 비밀번호 재설정

v-platform이 발송하는 주요 이메일은 비밀번호 재설정 이메일입니다.

**흐름:**

1. 사용자가 로그인 화면에서 "비밀번호 찾기" 클릭
2. 이메일 주소 입력 후 요청
3. `POST /api/auth/password-reset/request` API 호출
4. 시스템이 재설정 토큰을 생성하고 이메일 발송
5. 이메일에 포함된 링크 클릭 → 새 비밀번호 입력
6. `POST /api/auth/password-reset/confirm` API로 비밀번호 변경

**이메일 내용:**

- HTML 템플릿 (그라디언트 배경, 반응형 디자인)
- 재설정 링크 (`{FRONTEND_URL}/reset-password?token={token}`)
- 유효 시간: 30분
- 보안 안내 문구

### 감사 로그 기록

비밀번호 재설정 관련 이벤트는 감사 로그에 자동 기록됩니다.

| 이벤트 | 설명 |
|--------|------|
| `user.password_reset_request` | 비밀번호 재설정 요청 |
| `user.password_reset` | 비밀번호 재설정 완료 |

관리자는 **관리자 > 감사 로그** 페이지에서 이 이벤트를 확인할 수 있습니다.

---

## 이메일 템플릿 커스터마이징

이메일 템플릿은 백엔드 코드에 HTML 문자열로 포함되어 있습니다.

- **위치**: `backend/app/services/email_service.py` (앱별)
- **함수**: `send_password_reset_email()`
- **스타일**: 인라인 CSS (이메일 클라이언트 호환성)

수정 후 백엔드를 재빌드하면 적용됩니다:

```bash
docker compose up -d --build backend
```

:::tip 이메일 미리보기
수정한 템플릿을 미리보려면 개발 환경에서 비밀번호 재설정을 요청하고, MailHog Web UI(`http://127.0.0.1:8025`)에서 HTML 렌더링을 확인하세요.
:::

---

## 트러블슈팅

### 이메일이 발송되지 않음

**1. 환경 변수 확인**

```bash
# 백엔드 컨테이너의 SMTP 환경 변수 확인
docker exec v-channel-bridge-backend printenv | grep SMTP
```

**2. 백엔드 로그 확인**

```bash
docker compose logs --tail=50 backend | grep -i "email\|smtp\|mail"
```

**3. MailHog 연결 확인 (개발 환경)**

```bash
# MailHog 컨테이너 상태 확인
docker compose ps mailhog

# MailHog에 이메일이 도착했는지 확인
curl http://127.0.0.1:8025/api/v2/messages
```

**4. SMTP 서버 연결 테스트 (프로덕션)**

```bash
# 컨테이너 내부에서 SMTP 서버에 접속 테스트
docker exec -it v-channel-bridge-backend python -c "
import smtplib
try:
    s = smtplib.SMTP('smtp.gmail.com', 587, timeout=10)
    s.starttls()
    print('TLS 연결 성공')
    s.quit()
except Exception as e:
    print(f'연결 실패: {e}')
"
```

### Gmail "보안 수준이 낮은 앱" 오류

Gmail은 더 이상 일반 비밀번호로의 SMTP 접속을 허용하지 않습니다. 반드시 **앱 비밀번호**를 사용해야 합니다. 위의 [Gmail SMTP 설정](#gmail-smtp-설정) 절차를 따라 앱 비밀번호를 생성하세요.

### TLS 연결 오류

포트 설정을 확인하세요.

| 포트 | 프로토콜 | 사용 대상 |
|------|---------|----------|
| 587 | STARTTLS | 대부분의 프로덕션 SMTP 서버 |
| 465 | SSL/TLS (암시적) | 일부 레거시 서버 |
| 1025 | TLS 없음 | MailHog (개발용) |

v-project 코드에서 포트 1025인 경우 TLS를 자동으로 비활성화합니다. 프로덕션에서는 반드시 587 포트를 사용하세요.

### 비밀번호 재설정 링크가 작동하지 않음

**1. FRONTEND_URL 확인**

재설정 링크는 `{FRONTEND_URL}/reset-password?token={token}` 형태로 생성됩니다.

```bash
docker exec v-channel-bridge-backend printenv | grep FRONTEND_URL
```

이 값이 실제 프론트엔드 URL과 일치하는지 확인하세요.

**2. 토큰 만료 확인**

재설정 토큰의 유효 시간은 30분입니다. 만료된 토큰으로 접근하면 에러가 발생합니다.

### 이메일이 스팸함으로 들어감

프로덕션에서 이메일이 스팸으로 분류되는 경우:

1. **SPF 레코드 설정**: DNS에 SPF 레코드를 추가하여 발신 서버를 인증
2. **DKIM 서명**: 이메일에 DKIM 서명 추가 (SendGrid, AWS SES는 자동 지원)
3. **발신 도메인 인증**: SMTP 서비스에서 발신 도메인을 인증
4. **SMTP_FROM_EMAIL 일치**: 발신 이메일 주소가 인증된 도메인과 일치하는지 확인

---

## 앱별 SMTP 설정

v-project의 멀티앱 구조에서는 각 앱이 독립적인 SMTP 설정을 가질 수 있습니다.

| 서비스 | SMTP_FROM_NAME 기본값 | FRONTEND_URL |
|--------|---------------------|--------------|
| v-channel-bridge | `v-channel-bridge` | `http://127.0.0.1:5173` |
| v-platform-template | (환경 변수 미설정 시 기본값) | `http://127.0.0.1:5174` |
| v-platform-portal | (환경 변수 미설정 시 기본값) | `http://127.0.0.1:5180` |

각 앱의 `docker-compose.yml` 환경 변수에서 `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM_EMAIL`, `FRONTEND_URL`을 개별적으로 설정할 수 있습니다. 모든 앱이 같은 MailHog 또는 SMTP 서버를 공유할 수도 있고, 앱별로 다른 발신 주소를 사용할 수도 있습니다.

---

## 참고 문서

- [배포 가이드](./DEPLOYMENT.md) -- 전체 환경 변수 및 Docker Compose 설정
- [MailHog 공식 문서](https://github.com/mailhog/MailHog)
- [Gmail 앱 비밀번호 가이드](https://support.google.com/accounts/answer/185833)
- [SendGrid SMTP 문서](https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api)
- [AWS SES SMTP 문서](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)
