---
title: Getting Started
sidebar_position: 1
---

# v-platform-template 시작 가이드

v-platform의 모든 공통 기능을 포함한 앱 템플릿입니다.

## 새 앱 만들기

1. 템플릿 복사
```bash
cp -r apps/v-platform-template apps/v-my-new-app
```

2. 앱 이름 수정
- `backend/app/main.py` → `app_name` 변경
- `frontend/package.json` → `name` 변경
- `docker-compose.yml` → 새 서비스 추가

3. 앱 전용 기능 추가
- Backend: `backend/app/api/`, `backend/app/models/`
- Frontend: `frontend/src/pages/`, `frontend/src/components/`

4. Docker 실행
```bash
docker compose --profile my-new-app up -d
```

## 포함된 페이지 (18개)

| 카테고리 | 페이지 |
|----------|--------|
| 인증 | Login, Register, ForgotPassword, ResetPassword, SSOCallback |
| 프로필 | Profile, PasswordChange |
| 관리자 | UserManagement, AuditLogs, Settings, Help |
| RBAC | MenuManagement, PermissionMatrix, PermissionGroups |
| 조직도 | Organizations |
| 시스템 | Dashboard, CustomIframe, Forbidden |
