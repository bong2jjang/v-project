---
id: production-deployment
title: 프로덕션 배포 가이드
sidebar_position: 1
tags: [operations, production, deployment, docker, migration, seed, monitoring]
---

# 프로덕션 배포 가이드

v-project(v-platform + 5개 앱)를 **새 서버에 콜드 부트** 할 때 필요한 전 과정을 정리한 문서입니다.
기본 개념·포트 맵·환경변수 참조 테이블은 `docusaurus/docs/platform/admin-guide/DEPLOYMENT.md`에 유지되어 있으며,
이 문서는 **2026-04 기준 프로덕션 레디니스 작업 이후의 운영 절차**(마이그레이션 자동 러너, 데모 시드 토글,
통합 모니터링 스택)를 중심으로 합니다.

:::info 전제
- 서버는 **Linux + Docker 24+ / Docker Compose v2+**가 설치되어 있어야 합니다.
- 로컬 `npm install` / `python` 은 금지. 모든 빌드/실행은 Docker 컨테이너 안에서.
- 모든 외부 URL은 **127.0.0.1** 기반(로컬 테스트) 또는 운영 도메인을 사용. `localhost` 는 WSL/IPv6 이슈가 있으므로 지양.
:::

## 1. 콜드 부트 절차 요약

새 서버에 v-project를 처음 올릴 때:

```bash
# 1) 코드 클론 + env 준비
git clone <repo-url> v-project && cd v-project
cp .env.example .env
for app in v-channel-bridge v-platform-portal v-platform-template v-ui-builder v-itsm; do
  cp "apps/$app/.env.example" "apps/$app/.env"
done
# 2) .env (루트·앱별) 시크릿 채우기
#    특히 POSTGRES_PASSWORD / REDIS_PASSWORD / SECRET_KEY / ENCRYPTION_KEY
#    (ENCRYPTION_KEY 는 base64 Fernet 키 — 기존 값이 있으면 절대 재생성 금지)

# 3) 원하는 앱 프로필로 기동 (아래 §2 참조)
docker compose --profile portal --profile itsm --profile ui-builder up -d --build

# 4) 부팅 검증
docker compose ps
curl -fsS http://127.0.0.1:8080/api/health  # portal
curl -fsS http://127.0.0.1:8005/api/health  # itsm
curl -fsS http://127.0.0.1:8004/api/health  # ui-builder
```

자동으로 진행되는 것:
- 모든 백엔드 컨테이너가 시작되면 `_run_migrations()` 가 `p[0-9]*.py` (플랫폼)와 `a[0-9]*.py` (앱)를 순서대로 발견·실행합니다.
- `SEED_DEMO_DATA` 미설정 → **빈 DB** 그대로. 프로덕션 기본값.
- `SEED_DEMO_DATA=1` → 스냅샷 기반 데모 데이터(2026-04 기준 실운영 스냅샷)가 idempotent 하게 적재.

---

## 2. Docker Compose 프로필 매트릭스

앱 서비스는 전부 프로필로 분리되어 있어 **필요한 앱만** 올릴 수 있습니다. 공용 서비스(postgres / redis / mailhog / v-channel-bridge)는 프로필 없이 항상 기동.

| 프로필 | 포함 서비스 | 호스트 포트 |
|---|---|---|
| *(기본)* | postgres / redis / mailhog / v-channel-bridge-{backend,frontend} | 5432 · 6379 · 8025 · 8000 · 5173 |
| `portal` | v-platform-portal-{backend,frontend} | 8080 · 5180 |
| `template` | v-platform-template-{backend,frontend} | 8002 · 5174 |
| `ui-builder` | v-ui-builder-{backend,frontend} | 8004 · 5181 |
| `itsm` | v-itsm-{backend,frontend} | 8005 · 5182 |
| `docs` | docusaurus | 3000 |
| `monitoring` | prometheus / grafana / loki / promtail / cadvisor / node-exporter | 9090 · 3001 · 3100 · 9080 · 8081 · 9100 |

**프로덕션 권장 조합**:

```bash
# 전체 앱 + 모니터링
docker compose \
  --profile portal --profile template --profile ui-builder --profile itsm \
  --profile monitoring \
  up -d --build
```

`--profile docs` 는 **외부 공개하지 않는 경우에만** 켜세요. 내부 문서이므로 인증 없는 퍼블릭 노출은 피합니다.

---

## 3. 환경변수 스코프 규칙

`.env` 파일은 **루트 공용 + 앱별 전용** 으로 엄격히 분리되어 있습니다 (루트 `CLAUDE.md` §환경 변수 표 참조).

| 파일 | 담는 내용 |
|---|---|
| `/.env` | DB/Redis URL, SECRET_KEY, ENCRYPTION_KEY, SMTP, CORS, PUBLIC_HOST, SSO 공용 (`TEAMS_TENANT_ID/APP_ID/APP_PASSWORD`), **compose 치환용 변수** |
| `/apps/v-channel-bridge/.env` | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `TEAMS_TEAM_ID`, `MS_OAUTH_REDIRECT_URI`, `TEAMS_NOTIFICATION_URL` |
| `/apps/v-platform-portal/.env` | `PORTAL_APPS` |
| `/apps/v-ui-builder/.env` | `LLM_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL` |
| `/apps/v-itsm/.env` | `SLA_BUSINESS_HOURS_MODE`, `SLA_UNASSIGNED_WARNING_MINUTES`, `ITSM_DEFAULT_NOTIFY_CHANNELS`, (선택) `LLM_*`, **`SEED_DEMO_DATA`** |

**주의**:
- compose 의 `${VAR}` 치환은 **루트 `.env` 만** 소스로 사용합니다. 앱별 `.env` 는 `env_file:` 로 컨테이너에 주입될 뿐.
- 따라서 `DATABASE_URL`, `REDIS_URL` 같은 치환 값은 루트 `.env` 에 반드시 존재해야 하며, 앱별 `.env` 에 중복 두지 마세요.
- `.env` 들은 `.gitignore` 에 포함되어 있습니다. 절대 커밋하지 마세요.

**시크릿 회전**:
- `ENCRYPTION_KEY` 를 바꾸면 DB 에 저장된 암호화 컬럼(`integration_settings.token`, Slack/Teams 토큰 등)을 전부 재암호화해야 합니다. **키 분실 = 데이터 복구 불가**.
- `SECRET_KEY` 는 JWT 서명 키. 바꾸면 전 사용자 강제 로그아웃. 영향도 이해 후 교체.
- `POSTGRES_PASSWORD` / `REDIS_PASSWORD` 는 바꾸면 DB URL 포함 컨테이너 재기동 필요.

---

## 4. 마이그레이션 시스템

### 4.1 자동 러너

앱 백엔드가 시작되면 `platform/backend/v_platform/core/database.py::_run_migrations()` 이 실행됩니다:

1. `platform/backend/v_platform/migrations/` 에서 `p[0-9]*.py` 를 파일명 오름차순으로 순회
2. 해당 앱의 `migrations/` 디렉터리(컨테이너 안 `/app/migrations/`) 에서 `a[0-9]*.py` 순회
3. 각 모듈의 `migrate(engine)` 함수를 호출

모든 마이그레이션은 **멱등**(idempotent)으로 작성되어 있어 재시작해도 안전합니다.

### 4.2 베이스라인 재구성 (2026-04)

과거 마이그레이션 이력(p001~p034, a001~a00N)을 **압축**하여 현재 DB 상태를 반영한 베이스라인으로 재구성했습니다:

| 파일 | 역할 |
|---|---|
| `platform/backend/v_platform/migrations/p001_baseline.py` | 플랫폼 스키마 + 기준 데이터 (companies, roles, permissions, menu_items, admin 계정 등) |
| `platform/backend/v_platform/migrations/p002_demo.py` | 플랫폼 데모 데이터 (env-gated) |
| `apps/{app}/backend/migrations/a001_baseline.py` | 앱별 스키마 + 앱 메뉴 등록 |
| `apps/{app}/backend/migrations/a002_demo.py` | 앱별 데모 데이터 (env-gated) |

모든 `*_baseline.py` 는 `platform/backend/v_platform/migrations/_baseline.py::run_sql_file()` 을 호출하여 옆 `baseline/*.sql` 파일을 실행합니다. SQL 은 전부 `CREATE TABLE IF NOT EXISTS` / `INSERT ... ON CONFLICT DO NOTHING` / `setval(seq, MAX(id)+1, false)` 패턴으로 작성되어 있어 여러 번 돌려도 안전합니다.

### 4.3 새 마이그레이션 추가

베이스라인 이후 변경은 **증분 마이그레이션** 으로 추가합니다:

- 플랫폼 변경 → `platform/backend/v_platform/migrations/p{035,036,...}_{desc}.py`
- 앱 변경 → `apps/{app}/backend/migrations/a{003,004,...}_{desc}.py`

파일명 숫자는 반드시 기존 최대값 + 1. 함수 시그니처는 `def migrate(engine: Engine) -> None`. 멱등 필수.

### 4.4 초기화 (프로덕션에서는 금지)

DB 를 완전히 비우고 처음부터 돌리고 싶은 경우(개발 환경에 한함):

```bash
docker compose down -v          # 볼륨까지 삭제 — 프로덕션에서 절대 사용 금지
docker compose up -d --build
```

프로덕션에서는 §7 의 백업/복구 절차를 따르세요.

---

## 5. 데모 데이터 토글 (`SEED_DEMO_DATA`)

### 5.1 설계

프로덕션 기본값은 **데모 데이터 없음**. 베이스라인만 실행되고 DB 는 최소 부트스트랩 상태로 시작합니다.

데모 데이터가 필요한 시연/스테이징 환경에서는 **앱별 `.env` 에** `SEED_DEMO_DATA=1` 을 추가하면, p002/a002 로더가 `baseline/*_demo.sql` 을 실행합니다.

| 값 | 동작 |
|---|---|
| *(미설정 또는 빈 문자열)* | 데모 단계 **완전 스킵** (로그만 남김) |
| `1` / `true` / `yes` / `on` (대소문자 무관) | 스냅샷 SQL 적재 |
| 그 외 | 미설정과 동일(스킵) |

데모 로더는 멱등이므로 재기동해도 중복 INSERT 는 발생하지 않습니다.

### 5.2 스냅샷 재생성

현재 운영 DB 상태를 새로운 데모 스냅샷으로 갱신하고 싶을 때:

```bash
# DB 가 실행 중인 상태에서
python monitoring/scripts/dump_demo_data.py
# → 아래 4개 파일이 새로 작성됨:
#   platform/backend/v_platform/migrations/baseline/platform_demo.sql
#   apps/v-itsm/backend/migrations/baseline/app_demo.sql
#   apps/v-ui-builder/backend/migrations/baseline/app_demo.sql
#   apps/v-channel-bridge/backend/migrations/baseline/app_demo.sql
```

덤퍼는 `pg_dump --data-only --column-inserts --no-owner` 을 기반으로, 메시지 본문처럼 인용부호·세미콜론이 포함된 컬럼도 안전하게 처리하는 quote-aware 스캐너가 적용되어 있습니다.

### 5.3 레거시 수작업 시드

`platform/backend/v_platform/seeds/demo.py` / `seeds/runner.py` / `seeds/__main__.py` 는 **CLI 전용 레거시 경로** 입니다. 자동 실행되지 않으며, 필요시 개발자가 직접 실행:

```bash
docker compose exec v-channel-bridge-backend python -m v_platform.seeds --level demo
```

신규 환경·프로덕션 데모는 **위 스냅샷 방식**을 사용하세요.

---

## 6. 모니터링 스택

### 6.1 기동

```bash
docker compose --profile monitoring up -d
```

| 서비스 | URL | 기본 계정 |
|---|---|---|
| Prometheus | `http://127.0.0.1:9090` | - |
| Grafana | `http://127.0.0.1:3001` | admin / admin (초회 변경) |
| Loki | `http://127.0.0.1:3100` | (Grafana 에서 소스 연동) |
| cAdvisor | `http://127.0.0.1:8081` | - |
| Node Exporter | `http://127.0.0.1:9100/metrics` | - |

### 6.2 대시보드 자동 재생성

앱별 Overview + Logs 대시보드는 `monitoring/scripts/generate_dashboards.py` 가 생성합니다:

```bash
python monitoring/scripts/generate_dashboards.py
# → monitoring/grafana/dashboards/{app}-overview.json
# → monitoring/grafana/dashboards/{app}-logs.json
# → monitoring/grafana/dashboards/all-apps-overview.json (통합)
```

모든 패널에는 한국어 description 이 포함되어 처음 보는 운영자도 지표 의미를 이해할 수 있게 되어 있습니다. Grafana 는 dashboards 디렉터리를 provisioning 으로 마운트하므로 재시작 없이 바로 반영.

### 6.3 수집 대상

`monitoring/prometheus/prometheus.yml` 에서 `v-platform-apps` 단일 job 아래 모든 앱 백엔드(`/metrics` 엔드포인트)를 `app` 라벨로 구분하여 스크랩합니다. **새 앱 추가 시**:

1. `prometheus.yml` `static_configs` 에 `targets + app 라벨` 한 줄 추가
2. `monitoring/prometheus/alerts.yml` 의 앱 화이트리스트에 추가
3. `generate_dashboards.py` 의 `APPS` 목록에 메타 추가 후 스크립트 실행

---

## 7. 백업 / 복구

### 7.1 DB 백업 (정기 스케줄 권장)

```bash
# 전체 DB 덤프 (개별 INSERT 형식 — 복구 유연성 ↑)
docker compose exec -T postgres pg_dump -U vmsuser -d v_project \
  --data-only --column-inserts --no-owner \
  > "backup/v_project-$(date +%Y%m%d-%H%M%S).sql"

# 스키마+데이터 전체(가장 보수적)
docker compose exec -T postgres pg_dump -U vmsuser -d v_project \
  > "backup/v_project-full-$(date +%Y%m%d-%H%M%S).sql"
```

### 7.2 DB 복구

```bash
# 새 컨테이너에서 시작된 빈 DB 에 복구
docker compose exec -T postgres psql -U vmsuser -d v_project \
  < backup/v_project-full-YYYYMMDD-HHMMSS.sql
```

복구 순서: (1) 볼륨/컨테이너 초기화 → (2) compose up 으로 마이그레이션 자동 실행하여 스키마 생성 → (3) `--data-only` 덤프라면 복구 스크립트 주입 → (4) `setval(seq, MAX(id)+1, false)` 로 시퀀스 재설정.

### 7.3 업로드 파일

업로드 파일은 `uploaded_files` 테이블에 BLOB 으로 저장되므로 **DB 백업에 포함**됩니다. 별도 파일 시스템 백업 불필요.

### 7.4 Redis

Redis 는 캐시/라우팅 테이블/SLA 타이머 용도로만 사용하며 **비상 복구 시 재생성 가능** 하므로 정기 백업 대상이 아닙니다. 단, 서비스 중단 없는 교체를 원하면 `redis-cli --rdb` 로 스냅샷 덤프 가능.

---

## 8. 업그레이드 / 롤백 플레이북

### 8.1 일반 업그레이드

```bash
# 1) 백업 먼저
bash scripts/backup.sh  # (팀 배포 스크립트가 있다면)

# 2) 새 이미지로 재빌드
git pull
docker compose build
docker compose --profile portal --profile itsm --profile ui-builder up -d

# 3) 자동으로 새 p*/a* 마이그레이션 실행됨 → 로그 확인
docker compose logs --tail=100 v-channel-bridge-backend
```

마이그레이션이 실패하면 컨테이너는 crash loop 에 빠집니다. 로그 확인 후 문제 SQL 을 별도로 해결하고 재시작.

### 8.2 롤백

```bash
# 이전 커밋으로 코드 되돌리기
git checkout <prev-sha>
docker compose build
docker compose up -d --force-recreate

# DB 롤백이 필요한 경우 — 백업 복구 (§7.2) + 새 마이그레이션을 수동으로 되돌리는 SQL 실행
```

**원칙**: 마이그레이션은 forward-only 로 작성되어 있으므로 스키마 롤백용 down 스크립트는 없음. 중요한 변경은 항상 **백업 → 적용** 순서.

### 8.3 무중단 배포 팁

- 프론트엔드만 변경 시 `docker compose up -d --build {app}-frontend` 로 백엔드 살려두고 프론트만 교체 가능
- 백엔드 변경 시 짧은 다운타임(수십 초) 발생. 요청량 적은 시간대에 수행
- WebSocket 연결은 재기동 시 재연결 대상 — 프론트엔드의 재연결 로직 확인

---

## 9. 프로덕션 체크리스트

배포 직전에 반드시 확인:

- [ ] `/.env` 의 `ENVIRONMENT=production`, `DEBUG=false`
- [ ] `SECRET_KEY` 가 개발 기본값이 아닌 32+ 바이트 랜덤 문자열
- [ ] `ENCRYPTION_KEY` 가 **불변**으로 관리되는 Fernet base64 키
- [ ] `POSTGRES_PASSWORD` / `REDIS_PASSWORD` 가 기본값(`vmspassword`/`redispassword`) 이 **아님**
- [ ] `CORS_ORIGINS` 가 실제 운영 프론트 URL 만 허용
- [ ] `SMTP_*` 가 운영 SMTP 로 설정 (MailHog 는 개발 전용)
- [ ] 각 앱 `.env` 에 `SEED_DEMO_DATA` **미설정** (시연 환경이 아닌 한)
- [ ] TLS/Reverse proxy (nginx, Traefik, Caddy) 앞단 배치 — v-project 자체는 TLS 종단 하지 않음
- [ ] 방화벽: PostgreSQL 5432 / Redis 6379 는 **외부 비노출**
- [ ] MailHog 8025 는 **외부 비노출**
- [ ] 모니터링 스택의 Grafana admin 비밀번호 초회 변경 완료
- [ ] 백업 스케줄(pg_dump → 오프사이트 보관) 등록
- [ ] 로그 수집: Loki 가 정상 스크랩 중인지 Grafana 대시보드로 확인

---

## 10. 트러블슈팅

| 증상 | 확인할 것 |
|---|---|
| 백엔드 컨테이너 crash loop | `docker compose logs {app}-backend --tail=100` → 마이그레이션 실패 SQL 확인 |
| 마이그레이션 "unterminated quoted string" | `_baseline.py` quote-aware 스캐너 최신 여부 확인(2026-04 기준 반영됨) |
| 데모 데이터가 안 보임 | 앱 `.env` 의 `SEED_DEMO_DATA` 값 + 컨테이너 재기동 여부 |
| Prometheus 타겟 DOWN | 앱 백엔드 컨테이너가 해당 DNS 이름으로 실제 존재하는지(`docker compose ps`) |
| Grafana 대시보드 빈 패널 | Prometheus 에서 `up{job="v-platform-apps"}` 쿼리로 1 이 나오는지 확인 |
| Slack/Teams 알림 미전송 | v-itsm 은 bridge 독립 — `apps/v-itsm/.env` 의 토큰 + provider 로그 |

---

## 11. 참고 문서

- 기존 배포 문서(포트 맵·환경변수 레퍼런스): `docusaurus/docs/platform/admin-guide/DEPLOYMENT.md`
- 앱 분리 아키텍처: `docusaurus/docs/platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE.md`
- 다중 앱 격리 원칙: `docusaurus/docs/platform/design/MULTI_APP_DATA_ISOLATION.md`
- 모니터링 세부: `monitoring/grafana/dashboards/*.json`, `monitoring/prometheus/prometheus.yml`
- 마이그레이션 러너 구현: `platform/backend/v_platform/core/database.py::_run_migrations`
- 베이스라인 실행기: `platform/backend/v_platform/migrations/_baseline.py`
- 데모 덤퍼: `monitoring/scripts/dump_demo_data.py`

---

**문서 버전**: 1.0 (2026-04-24 프로덕션 레디니스 작업 완료 시점)
