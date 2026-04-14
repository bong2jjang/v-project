---
id: ssl-tls-setup
title: SSL/TLS 설정 가이드
sidebar_position: 7
tags: [guide, admin, ssl, tls, nginx, caddy, security]
---

# SSL/TLS 설정 가이드

## 개요

프로덕션 환경에서는 HTTPS를 통한 암호화 통신이 필수입니다. v-project의 각 서비스는 내부적으로 HTTP를 사용하므로, 리버스 프록시(nginx 또는 Caddy)가 SSL/TLS 종료를 담당합니다. 이 문서에서는 리버스 프록시 설정, Let's Encrypt 인증서 발급, WebSocket 프록시, 보안 헤더, 인증서 갱신까지 다룹니다.

### 아키텍처

```
인터넷 (HTTPS)
    │
    ▼
┌────────────────────────┐
│  리버스 프록시          │
│  (nginx 또는 Caddy)    │
│  :443 (HTTPS)          │
│  :80 (HTTP → 리다이렉트) │
└────────────────────────┘
    │  HTTP (내부 네트워크)
    ├──→ Backend       :8000
    ├──→ Frontend      :5173
    ├──→ Portal BE     :8080
    ├──→ Portal FE     :5180
    ├──→ Template BE   :8002
    └──→ Template FE   :5174
```

:::note 내부 통신
리버스 프록시와 백엔드 서비스 간의 통신은 Docker 네트워크 내부에서 이루어지므로 HTTP를 사용해도 안전합니다. SSL/TLS 종료는 리버스 프록시에서만 처리합니다.
:::

---

## nginx 설정

### nginx 기본 설정

하나의 도메인에서 경로 기반으로 프론트엔드와 백엔드를 분리하는 설정입니다.

```nginx
# /etc/nginx/sites-available/v-project.conf

# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

# HTTPS 서버
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # ─────────────────────────────────
    # SSL 인증서
    # ─────────────────────────────────
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # ─────────────────────────────────
    # SSL 프로토콜 및 암호화
    # ─────────────────────────────────
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;

    # ─────────────────────────────────
    # 보안 헤더
    # ─────────────────────────────────
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ─────────────────────────────────
    # API 프록시 (Backend)
    # ─────────────────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 타임아웃 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # ─────────────────────────────────
    # WebSocket 프록시 (/ws)
    # ─────────────────────────────────
    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 타임아웃 (긴 연결 유지)
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # ─────────────────────────────────
    # 프론트엔드 프록시
    # ─────────────────────────────────
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ─────────────────────────────────
    # 정적 파일 캐싱
    # ─────────────────────────────────
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:5173;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
}
```

### 멀티앱 서브도메인 설정

각 앱에 서브도메인을 할당하는 경우의 설정입니다.

```nginx
# v-channel-bridge (메인 앱)
server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 보안 헤더 (위와 동일하므로 include로 분리 가능)
    include /etc/nginx/snippets/security-headers.conf;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        include /etc/nginx/snippets/proxy-headers.conf;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8000;
        include /etc/nginx/snippets/websocket-proxy.conf;
    }

    location / {
        proxy_pass http://127.0.0.1:5173;
        include /etc/nginx/snippets/proxy-headers.conf;
    }
}

# v-platform-portal (포털)
server {
    listen 443 ssl http2;
    server_name portal.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    include /etc/nginx/snippets/security-headers.conf;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        include /etc/nginx/snippets/proxy-headers.conf;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8080;
        include /etc/nginx/snippets/websocket-proxy.conf;
    }

    location / {
        proxy_pass http://127.0.0.1:5180;
        include /etc/nginx/snippets/proxy-headers.conf;
    }
}

# v-platform-template (템플릿)
server {
    listen 443 ssl http2;
    server_name template.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    include /etc/nginx/snippets/security-headers.conf;

    location /api/ {
        proxy_pass http://127.0.0.1:8002;
        include /etc/nginx/snippets/proxy-headers.conf;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8002;
        include /etc/nginx/snippets/websocket-proxy.conf;
    }

    location / {
        proxy_pass http://127.0.0.1:5174;
        include /etc/nginx/snippets/proxy-headers.conf;
    }
}
```

### nginx 스니펫 파일

중복을 줄이기 위해 공통 설정을 스니펫으로 분리합니다.

```nginx
# /etc/nginx/snippets/proxy-headers.conf
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
```

```nginx
# /etc/nginx/snippets/websocket-proxy.conf
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
```

```nginx
# /etc/nginx/snippets/security-headers.conf
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### nginx 설정 적용

```bash
# 설정 파일 문법 검사
sudo nginx -t

# 설정 적용 (무중단)
sudo nginx -s reload
```

---

## Caddy 설정

Caddy는 자동으로 Let's Encrypt 인증서를 발급하고 갱신합니다. 별도의 인증서 설정이 필요 없어서 설정이 훨씬 간단합니다.

### 단일 도메인 설정

```caddyfile
# /etc/caddy/Caddyfile

yourdomain.com {
    # API 프록시
    handle /api/* {
        reverse_proxy 127.0.0.1:8000
    }

    # WebSocket 프록시
    handle /ws {
        reverse_proxy 127.0.0.1:8000
    }

    # 프론트엔드 프록시
    handle {
        reverse_proxy 127.0.0.1:5173
    }

    # 보안 헤더
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

### 멀티앱 서브도메인 설정

```caddyfile
# v-channel-bridge
app.yourdomain.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:8000
    }
    handle /ws {
        reverse_proxy 127.0.0.1:8000
    }
    handle {
        reverse_proxy 127.0.0.1:5173
    }
    import security-headers
}

# 포털
portal.yourdomain.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:8080
    }
    handle /ws {
        reverse_proxy 127.0.0.1:8080
    }
    handle {
        reverse_proxy 127.0.0.1:5180
    }
    import security-headers
}

# 템플릿
template.yourdomain.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:8002
    }
    handle /ws {
        reverse_proxy 127.0.0.1:8002
    }
    handle {
        reverse_proxy 127.0.0.1:5174
    }
    import security-headers
}

# 공통 보안 헤더 스니펫
(security-headers) {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

:::tip Caddy vs nginx
Caddy는 Let's Encrypt 인증서를 자동으로 발급하고 갱신하므로 별도의 certbot 설정이 필요 없습니다. 설정도 훨씬 간결합니다. 인증서 관리의 복잡함을 줄이고 싶다면 Caddy를 권장합니다.
:::

### Caddy 설정 적용

```bash
# 설정 파일 문법 검사
caddy validate --config /etc/caddy/Caddyfile

# 설정 적용 (무중단)
caddy reload --config /etc/caddy/Caddyfile
```

---

## Let's Encrypt 인증서 (nginx 사용 시)

nginx를 사용하는 경우 certbot으로 Let's Encrypt 인증서를 발급받습니다.

### certbot 설치

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo dnf install certbot python3-certbot-nginx
```

### 인증서 발급

```bash
# 단일 도메인
sudo certbot --nginx -d yourdomain.com

# 와일드카드 (서브도메인 포함)
sudo certbot certonly --manual --preferred-challenges=dns \
  -d yourdomain.com -d '*.yourdomain.com'

# 여러 도메인
sudo certbot --nginx \
  -d app.yourdomain.com \
  -d portal.yourdomain.com \
  -d template.yourdomain.com
```

### 인증서 자동 갱신

certbot은 설치 시 자동 갱신 타이머를 등록합니다. 수동으로 확인하려면:

```bash
# 갱신 테스트 (실제 갱신하지 않음)
sudo certbot renew --dry-run

# 타이머 상태 확인
sudo systemctl status certbot.timer
```

인증서는 만료 30일 전에 자동 갱신됩니다.

### 갱신 후 nginx 재로드

certbot 갱신 후 nginx가 새 인증서를 로드하도록 설정합니다.

```bash
# /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
#!/bin/bash
systemctl reload nginx
```

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## WebSocket 프록시 설정

v-project는 실시간 알림, 상태 업데이트 등에 WebSocket(`/ws` 경로)을 사용합니다. 리버스 프록시에서 WebSocket을 올바르게 프록시하지 않으면 실시간 기능이 작동하지 않습니다.

### WebSocket 프록시 핵심 설정

```nginx
# nginx
location /ws {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;                    # HTTP/1.1 필수
    proxy_set_header Upgrade $http_upgrade;     # 프로토콜 업그레이드
    proxy_set_header Connection "upgrade";      # 연결 유지
    proxy_read_timeout 86400s;                  # 24시간 타임아웃
    proxy_send_timeout 86400s;
}
```

핵심 포인트:

| 설정 | 값 | 이유 |
|------|-----|------|
| `proxy_http_version` | `1.1` | WebSocket은 HTTP/1.1 업그레이드 필수 |
| `Upgrade` 헤더 | `$http_upgrade` | 클라이언트의 업그레이드 요청 전달 |
| `Connection` 헤더 | `"upgrade"` | 연결을 WebSocket으로 업그레이드 |
| `proxy_read_timeout` | `86400s` | 유휴 연결이 끊기지 않도록 긴 타임아웃 |

:::warning WebSocket 타임아웃
기본 `proxy_read_timeout`은 60초입니다. WebSocket 연결에 이 값을 사용하면 유휴 상태에서 60초 후 연결이 끊깁니다. 반드시 긴 값(86400s = 24시간)을 설정하세요. 클라이언트 측에서 ping/pong으로 연결을 유지합니다.
:::

---

## 보안 헤더

프로덕션 환경에서 설정해야 할 HTTP 보안 헤더입니다.

| 헤더 | 값 | 설명 |
|------|-----|------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS 강제 (1년) |
| `X-Content-Type-Options` | `nosniff` | MIME 타입 스니핑 방지 |
| `X-Frame-Options` | `SAMEORIGIN` | 클릭재킹 방지 (같은 오리진에서만 iframe 허용) |
| `X-XSS-Protection` | `1; mode=block` | XSS 필터 활성화 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 리퍼러 정보 제한 |

### HSTS (HTTP Strict Transport Security)

HSTS를 활성화하면 브라우저가 해당 도메인을 항상 HTTPS로만 접근합니다.

:::warning HSTS 주의사항
`max-age=31536000`은 1년간 유효합니다. HSTS를 활성화한 후에는 HTTP로 돌아갈 수 없으므로, SSL 인증서가 항상 유효한 상태를 유지해야 합니다. 처음에는 `max-age=3600`(1시간)으로 테스트한 후, 문제가 없으면 `max-age=31536000`으로 변경하세요.
:::

### Content Security Policy (선택)

더 강력한 보안이 필요하면 CSP 헤더를 추가할 수 있습니다.

```nginx
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' wss://yourdomain.com;
    font-src 'self';
" always;
```

:::note CSP와 WebSocket
`connect-src`에 `wss://yourdomain.com`을 추가하지 않으면 WebSocket 연결이 차단됩니다. 반드시 WebSocket 도메인을 포함하세요.
:::

---

## Docker Compose에 nginx 추가

리버스 프록시를 Docker Compose에 포함시킬 수도 있습니다.

```yaml
# docker-compose.yml에 추가
services:
  nginx:
    image: nginx:alpine
    container_name: v-project-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/snippets:/etc/nginx/snippets
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - backend
      - frontend
    networks:
      - v-project-network
```

Docker Compose 내부에서는 서비스 이름으로 프록시합니다:

```nginx
# Docker 네트워크 내부에서는 서비스 이름 사용
location /api/ {
    proxy_pass http://backend:8000;   # 127.0.0.1 대신 서비스 이름
}

location / {
    proxy_pass http://frontend:5173;
}
```

---

## 환경 변수 업데이트

SSL/TLS를 설정한 후 관련 환경 변수를 HTTPS URL로 업데이트해야 합니다.

```bash
# .env 파일에서 HTTP → HTTPS로 변경
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com
PORTAL_BACKEND_URL=https://portal.yourdomain.com
TEMPLATE_BACKEND_URL=https://template.yourdomain.com

# CORS 오리진도 HTTPS로 변경
CORS_ORIGINS=https://app.yourdomain.com,https://portal.yourdomain.com,https://template.yourdomain.com

# SSO 콜백 URL도 HTTPS로 변경
MS_OAUTH_REDIRECT_URI=https://yourdomain.com/api/auth/microsoft/callback
```

변경 후 서비스를 재시작합니다:

```bash
docker compose up -d --build
```

---

## 인증서 상태 확인

### 인증서 만료일 확인

```bash
# certbot으로 확인
sudo certbot certificates

# openssl로 직접 확인
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null \
  | openssl x509 -noout -dates
```

### SSL 등급 테스트

배포 후 [SSL Labs](https://www.ssllabs.com/ssltest/)에서 SSL 설정 등급을 확인하세요. A+ 등급을 목표로 합니다.

---

## 트러블슈팅

### ERR_SSL_PROTOCOL_ERROR

인증서 파일 경로가 올바른지 확인하세요.

```bash
# 인증서 파일 존재 여부 확인
ls -la /etc/letsencrypt/live/yourdomain.com/

# nginx 에러 로그 확인
sudo tail -20 /var/log/nginx/error.log
```

### WebSocket 연결 실패 (wss://)

1. `proxy_http_version 1.1` 설정 확인
2. `Upgrade` 및 `Connection` 헤더 설정 확인
3. 방화벽에서 443 포트가 열려 있는지 확인
4. CSP 헤더의 `connect-src`에 `wss://` URL이 포함되어 있는지 확인

### "too many redirects" 오류

HTTP → HTTPS 리다이렉트가 무한 루프에 빠진 경우입니다. 백엔드가 `X-Forwarded-Proto` 헤더를 올바르게 처리하는지 확인하세요.

```nginx
# proxy_set_header가 설정되어 있는지 확인
proxy_set_header X-Forwarded-Proto $scheme;
```

### Let's Encrypt 인증서 발급 실패

1. **DNS 확인**: 도메인이 서버 IP를 가리키는지 확인
2. **80 포트 확인**: certbot HTTP 챌린지는 80 포트를 사용
3. **속도 제한**: Let's Encrypt는 도메인당 주당 5회 인증서 발급 제한

```bash
# DNS 확인
dig yourdomain.com +short

# 80 포트 접근 확인
curl -I http://yourdomain.com
```

### Mixed Content 경고

HTTPS 페이지에서 HTTP 리소스를 로드하면 브라우저가 차단합니다. `.env`의 URL 설정이 모두 HTTPS인지 확인하세요.

```bash
# 환경 변수에 http:// 가 남아있는지 확인
docker exec v-channel-bridge-backend printenv | grep -i url
```

---

## 참고 문서

- [배포 가이드](./DEPLOYMENT.md) -- Docker Compose 실행 및 환경 변수 설정
- [nginx 공식 문서](https://nginx.org/en/docs/)
- [Caddy 공식 문서](https://caddyserver.com/docs/)
- [Let's Encrypt 공식 문서](https://letsencrypt.org/docs/)
- [SSL Labs 테스트](https://www.ssllabs.com/ssltest/)
- [Mozilla SSL 설정 생성기](https://ssl-config.mozilla.org/)
