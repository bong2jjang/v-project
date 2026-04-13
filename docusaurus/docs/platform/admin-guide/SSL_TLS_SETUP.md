---
id: ssl-tls-setup
title: SSL/TLS 설정 가이드
sidebar_position: 7
tags: [guide, admin]
---

# SSL/TLS 설정 가이드

## 개요

프로덕션 환경에서 VMS Channel Bridge를 안전하게 운영하기 위한 SSL/TLS 인증서 설정 가이드입니다.

이 문서는 다음 내용을 다룹니다:
- Let's Encrypt를 사용한 무료 SSL 인증서 발급
- Certbot을 통한 자동 인증서 갱신
- Nginx HTTPS 설정
- 보안 강화 설정 (TLS 1.2+, HSTS, 암호화 스위트)
- 인증서 검증 및 테스트

## 전제 조건

- 도메인 네임이 서버 IP를 가리키고 있어야 함
- 포트 80, 443이 방화벽에서 열려 있어야 함
- Docker 및 Docker Compose 설치 완료
- root 또는 sudo 권한

## 1. Certbot 설치

### Ubuntu/Debian

```bash
# 시스템 업데이트
sudo apt update

# Certbot 및 Nginx 플러그인 설치
sudo apt install certbot python3-certbot-nginx -y
```

### CentOS/RHEL

```bash
# EPEL 저장소 추가
sudo yum install epel-release -y

# Certbot 설치
sudo yum install certbot python3-certbot-nginx -y
```

### Docker 기반 Certbot (선택사항)

Docker로 Certbot을 실행하는 방법:

```bash
# Certbot 이미지 풀
docker pull certbot/certbot:latest
```

## 2. Nginx 설정

### 2.1 Nginx 컨테이너 추가

`docker-compose.prod.yml`에 Nginx 서비스 추가 (이미 있다면 건너뛰기):

```yaml
services:
  nginx:
    image: nginx:alpine
    container_name: vms-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot_webroot:/var/www/certbot:ro
      - certbot_certs:/etc/letsencrypt:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
    networks:
      - vms-network

volumes:
  certbot_webroot:
  certbot_certs:
```

### 2.2 초기 Nginx 설정 (HTTP Only)

인증서 발급 전에 먼저 HTTP로 설정:

**`nginx/conf.d/vms.conf`**:

```nginx
# HTTP 서버 (Let's Encrypt 검증용)
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Let's Encrypt ACME Challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 나머지 트래픽은 HTTPS로 리다이렉트 (인증서 발급 후 활성화)
    # location / {
    #     return 301 https://$server_name$request_uri;
    # }

    # 임시로 백엔드로 프록시 (테스트용)
    location / {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**도메인 이름 변경**: `your-domain.com`을 실제 도메인으로 변경하세요.

### 2.3 Nginx 시작

```bash
# Nginx 서비스 시작
docker compose -f docker-compose.prod.yml up -d nginx

# 로그 확인
docker compose -f docker-compose.prod.yml logs nginx

# HTTP 접근 테스트
curl http://your-domain.com
```

## 3. Let's Encrypt 인증서 발급

### 3.1 Standalone 모드 (Nginx 중지 필요)

```bash
# Nginx 중지
docker compose -f docker-compose.prod.yml stop nginx

# 인증서 발급
sudo certbot certonly --standalone \
  -d your-domain.com \
  -d www.your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# Nginx 재시작
docker compose -f docker-compose.prod.yml start nginx
```

### 3.2 Webroot 모드 (권장 - Nginx 중지 불필요)

```bash
# 인증서 발급 (Nginx 실행 중)
sudo certbot certonly --webroot \
  -w /var/lib/docker/volumes/vms-channel-bridge_certbot_webroot/_data \
  -d your-domain.com \
  -d www.your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive
```

### 3.3 Docker 기반 Certbot (선택사항)

```bash
# Docker로 인증서 발급
docker run --rm \
  -v certbot_certs:/etc/letsencrypt \
  -v certbot_webroot:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d your-domain.com \
  -d www.your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive
```

### 3.4 인증서 확인

```bash
# 인증서 파일 확인
sudo ls -la /etc/letsencrypt/live/your-domain.com/

# 예상 출력:
# cert.pem         - 인증서
# chain.pem        - 인증서 체인
# fullchain.pem    - 인증서 + 체인 (Nginx에서 사용)
# privkey.pem      - 개인 키
```

## 4. HTTPS Nginx 설정

### 4.1 SSL 설정 파일 생성

**`nginx/conf.d/ssl-params.conf`**:

```nginx
# SSL 프로토콜 및 암호화 스위트
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';

# SSL 세션 캐시
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# 보안 헤더
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

### 4.2 HTTPS 서버 블록 추가

**`nginx/conf.d/vms.conf`** 업데이트:

```nginx
# HTTP 서버 (HTTPS로 리다이렉트)
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Let's Encrypt ACME Challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 모든 트래픽을 HTTPS로 리다이렉트
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 서버
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL 인증서
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/your-domain.com/chain.pem;

    # SSL 파라미터 포함
    include /etc/nginx/conf.d/ssl-params.conf;

    # 프론트엔드 (React App)
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 백엔드 API
    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 지원
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # WebSocket 엔드포인트
    location /ws {
        proxy_pass http://backend:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 타임아웃
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # API 문서 (프로덕션에서는 비활성화 권장)
    # location /docs {
    #     proxy_pass http://backend:8000/docs;
    #     proxy_set_header Host $host;
    # }
}
```

### 4.3 Nginx 설정 테스트 및 재시작

```bash
# 설정 파일 문법 검사
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# Nginx 리로드 (설정 적용)
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# 또는 재시작
docker compose -f docker-compose.prod.yml restart nginx
```

## 5. 인증서 자동 갱신 설정

Let's Encrypt 인증서는 **90일**마다 만료됩니다. 자동 갱신을 설정해야 합니다.

### 5.1 갱신 테스트

```bash
# 갱신 드라이런 (실제 갱신 X)
sudo certbot renew --dry-run

# 예상 출력:
# Congratulations, all simulated renewals succeeded
```

### 5.2 Cron 설정 (자동 갱신)

```bash
# Crontab 편집
sudo crontab -e

# 다음 라인 추가 (매일 오전 3시 갱신 체크)
0 3 * * * certbot renew --quiet --post-hook "docker compose -f /path/to/vms-channel-bridge/docker-compose.prod.yml exec nginx nginx -s reload"
```

**경로 변경**: `/path/to/vms-channel-bridge`를 실제 프로젝트 경로로 변경하세요.

### 5.3 Systemd Timer (Ubuntu 18.04+)

Certbot이 systemd 타이머를 자동으로 설정한 경우:

```bash
# Certbot 타이머 상태 확인
sudo systemctl status certbot.timer

# 타이머 활성화
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 갱신 서비스 확인
sudo systemctl list-timers | grep certbot
```

### 5.4 Docker 기반 자동 갱신 (선택사항)

**`scripts/renew-certs.sh`** 생성:

```bash
#!/bin/bash
# SSL 인증서 자동 갱신 스크립트

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "[INFO] Starting certificate renewal..."

# Docker로 갱신
docker run --rm \
  -v certbot_certs:/etc/letsencrypt \
  -v certbot_webroot:/var/www/certbot \
  certbot/certbot renew \
  --quiet

echo "[INFO] Certificate renewal complete"

# Nginx 리로드
cd "${PROJECT_DIR}"
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "[INFO] Nginx reloaded"
```

실행 권한 부여:

```bash
chmod +x scripts/renew-certs.sh
```

Cron 설정:

```bash
# Crontab에 추가
0 3 * * * /path/to/vms-channel-bridge/scripts/renew-certs.sh >> /var/log/certbot-renew.log 2>&1
```

## 6. 보안 강화 설정

### 6.1 DH 파라미터 생성

더 강력한 암호화를 위해 Diffie-Hellman 파라미터 생성:

```bash
# DH 파라미터 생성 (몇 분 소요)
sudo openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
```

`ssl-params.conf`에 추가:

```nginx
# Diffie-Hellman 파라미터
ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
```

### 6.2 HSTS Preload

HSTS Preload 등록 (선택사항):
1. https://hstspreload.org/ 방문
2. 도메인 입력 및 제출
3. 브라우저가 항상 HTTPS로 접속하도록 강제

### 6.3 Content Security Policy (CSP)

`vms.conf`의 HTTPS 서버 블록에 추가:

```nginx
# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: https:;" always;
```

**주의**: CSP 설정은 애플리케이션에 따라 조정이 필요할 수 있습니다.

## 7. 인증서 검증 및 테스트

### 7.1 브라우저 테스트

```
https://your-domain.com
```

- 자물쇠 아이콘 확인
- 인증서 정보 확인 (유효 기간, 발급자)

### 7.2 SSL Labs 테스트

온라인 SSL 검증 도구 사용:

```
https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com
```

**목표 등급**: A 또는 A+

### 7.3 OpenSSL 테스트

```bash
# SSL 연결 테스트
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# TLS 버전 확인
openssl s_client -connect your-domain.com:443 -tls1_2
openssl s_client -connect your-domain.com:443 -tls1_3

# 인증서 체인 확인
openssl s_client -connect your-domain.com:443 -showcerts
```

### 7.4 HSTS 헤더 확인

```bash
curl -I https://your-domain.com | grep -i strict-transport-security

# 예상 출력:
# strict-transport-security: max-age=63072000; includeSubDomains; preload
```

### 7.5 HTTP → HTTPS 리다이렉트 테스트

```bash
curl -I http://your-domain.com

# 예상 출력:
# HTTP/1.1 301 Moved Permanently
# Location: https://your-domain.com/
```

## 8. 문제 해결

### 8.1 인증서 발급 실패

**문제**: "Unable to find a virtual host listening on port 80"

**해결**:
- Nginx가 포트 80에서 실행 중인지 확인
- 방화벽에서 포트 80 열기
- DNS 레코드가 서버 IP를 정확히 가리키는지 확인

```bash
# 포트 80 확인
sudo netstat -tulpn | grep :80

# DNS 확인
nslookup your-domain.com
```

**문제**: "too many failed authorizations recently"

**해결**:
- Let's Encrypt에는 시간당 발급 제한이 있음
- 1시간 후 재시도
- 테스트 시에는 `--dry-run` 사용

### 8.2 인증서 갱신 실패

**문제**: "Certificate renewal failed"

**해결**:
- 로그 확인: `sudo cat /var/log/letsencrypt/letsencrypt.log`
- Webroot 경로 확인
- Nginx 설정에서 `.well-known/acme-challenge/` 경로 확인

```bash
# 수동 갱신 테스트
sudo certbot renew --dry-run --verbose
```

### 8.3 Mixed Content 경고

**문제**: HTTPS 페이지에서 HTTP 리소스 로드

**해결**:
- 모든 리소스(이미지, 스크립트, CSS)를 HTTPS로 변경
- 프론트엔드 코드에서 `http://` 하드코딩 제거
- 상대 경로 사용 또는 `//` 프로토콜 사용

### 8.4 WebSocket SSL 오류

**문제**: WebSocket 연결이 HTTPS에서 실패

**해결**:
- WebSocket URL을 `wss://`로 변경 (프론트엔드)
- Nginx에서 `Upgrade` 헤더 설정 확인

**프론트엔드 수정 예시**:

```typescript
// Before
const ws = new WebSocket('ws://your-domain.com/ws');

// After
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
```

## 9. 인증서 백업

인증서 백업은 중요합니다. 서버 재구축 시 필요합니다.

### 9.1 수동 백업

```bash
# 인증서 디렉토리 백업
sudo tar -czf letsencrypt-backup-$(date +%Y%m%d).tar.gz \
  /etc/letsencrypt

# 안전한 위치로 복사
sudo cp letsencrypt-backup-*.tar.gz /path/to/secure/backup/
```

### 9.2 자동 백업 (backup.sh에 통합)

프로젝트의 `scripts/backup.sh`에 이미 인증서 백업이 포함되어 있습니다.

### 9.3 복원

```bash
# 백업 복원
sudo tar -xzf letsencrypt-backup-20260322.tar.gz -C /

# Nginx 재시작
docker compose -f docker-compose.prod.yml restart nginx
```

## 10. 멀티 도메인 및 와일드카드 인증서

### 10.1 여러 도메인 추가

```bash
# 여러 도메인을 하나의 인증서에 포함
sudo certbot certonly --webroot \
  -w /var/lib/docker/volumes/vms-channel-bridge_certbot_webroot/_data \
  -d domain1.com \
  -d www.domain1.com \
  -d domain2.com \
  -d www.domain2.com \
  --email your-email@example.com \
  --agree-tos
```

### 10.2 와일드카드 인증서 (DNS Challenge)

```bash
# 와일드카드 인증서는 DNS 검증 필요
sudo certbot certonly --manual \
  --preferred-challenges dns \
  -d *.your-domain.com \
  -d your-domain.com \
  --email your-email@example.com \
  --agree-tos

# DNS TXT 레코드 추가 후 계속
```

**주의**: 와일드카드 인증서 자동 갱신을 위해서는 DNS API 플러그인이 필요합니다.

## 11. 체크리스트

프로덕션 배포 전 확인 사항:

- [ ] 도메인이 서버 IP를 가리킴
- [ ] 포트 80, 443 방화벽 허용
- [ ] Let's Encrypt 인증서 발급 완료
- [ ] Nginx HTTPS 설정 적용
- [ ] HTTP → HTTPS 리다이렉트 동작
- [ ] SSL Labs 테스트 통과 (A 등급 이상)
- [ ] HSTS 헤더 적용
- [ ] 인증서 자동 갱신 설정 (Cron/Systemd)
- [ ] WebSocket WSS 연결 테스트
- [ ] 인증서 백업 완료
- [ ] TLS 1.2 이상만 사용
- [ ] 보안 헤더 적용 확인

## 12. 참고 자료

- [Let's Encrypt 공식 문서](https://letsencrypt.org/docs/)
- [Certbot 문서](https://certbot.eff.org/docs/)
- [Nginx SSL 설정](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [SSL Labs 테스트](https://www.ssllabs.com/ssltest/)
- [HSTS Preload](https://hstspreload.org/)

---

**작성일**: 2026-03-22
**버전**: 1.0.0
**상태**: ✅ 완료
