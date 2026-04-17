---
name: backup-config
description: 설정 백업 - .env, docker-compose.yml, DB 덤프, Redis 데이터 백업
---

# 설정 백업 스킬

시스템 설정, 데이터베이스, Redis 데이터를 백업합니다. 마이그레이션, 배포, 주요 변경 작업 전에 사용합니다.

## 백업 항목

1. **환경 변수** - `.env` 파일
2. **Docker 설정** - `docker-compose*.yml` 파일
3. **데이터베이스** - PostgreSQL 덤프
4. **Redis 데이터** - 라우팅 룰 및 캐시
5. **Provider 설정** - Slack/Teams 자격증명

## 백업 디렉토리 구조

```
backups/
├── {timestamp}/
│   ├── env/
│   │   └── .env
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.dev.yml
│   │   ├── docker-compose.prod.yml
│   │   └── docker-compose.debug.yml
│   ├── database/
│   │   ├── full_backup.sql
│   │   └── schema_only.sql
│   ├── redis/
│   │   ├── dump.rdb
│   │   └── routes.json
└── latest -> {timestamp}/  # 심볼릭 링크
```

## 전체 백업 스크립트

```bash
#!/bin/bash
# backend/scripts/backup_all.sh

set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 백업 타임스탬프
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="backups"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

echo -e "${GREEN}=== 시스템 백업 시작 ===${NC}"
echo "백업 디렉토리: ${BACKUP_DIR}"
echo ""

# 백업 디렉토리 생성
mkdir -p "${BACKUP_DIR}"/{env,docker,database,redis}

# 1. 환경 변수 백업
echo "📁 환경 변수 백업 중..."
if [ -f ".env" ]; then
    cp .env "${BACKUP_DIR}/env/.env"
    echo "   ✅ .env 백업 완료"
else
    echo "   ⚠️  .env 파일이 없습니다"
fi

# 2. Docker 설정 백업
echo "🐳 Docker 설정 백업 중..."
for compose_file in docker-compose*.yml; do
    if [ -f "$compose_file" ]; then
        cp "$compose_file" "${BACKUP_DIR}/docker/"
        echo "   ✅ $compose_file 백업 완료"
    fi
done

# 3. 데이터베이스 백업
echo "💾 데이터베이스 백업 중..."
DB_CONTAINER=$(docker compose -f docker-compose.dev.yml ps -q postgres)

if [ -n "$DB_CONTAINER" ]; then
    # 전체 백업 (데이터 포함)
    docker compose -f docker-compose.dev.yml exec -T postgres \
        pg_dump -U vmsuser v_project > "${BACKUP_DIR}/database/full_backup.sql"
    echo "   ✅ 전체 백업 완료 (데이터 포함)"

    # 스키마만 백업
    docker compose -f docker-compose.dev.yml exec -T postgres \
        pg_dump -U vmsuser v_project --schema-only > "${BACKUP_DIR}/database/schema_only.sql"
    echo "   ✅ 스키마 백업 완료"

    # 백업 파일 압축
    gzip "${BACKUP_DIR}/database/full_backup.sql"
    echo "   ✅ 백업 파일 압축 완료"
else
    echo "   ⚠️  PostgreSQL 컨테이너가 실행 중이지 않습니다"
fi

# 4. Redis 데이터 백업
echo "⚡ Redis 데이터 백업 중..."
REDIS_CONTAINER=$(docker compose -f docker-compose.dev.yml ps -q redis)

if [ -n "$REDIS_CONTAINER" ]; then
    # Redis 덤프 파일 백업
    docker compose -f docker-compose.dev.yml exec redis redis-cli SAVE
    docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "${BACKUP_DIR}/redis/dump.rdb"
    echo "   ✅ Redis dump.rdb 백업 완료"

    # 라우팅 룰 JSON 형식으로 백업
    echo "{" > "${BACKUP_DIR}/redis/routes.json"
    routes=$(docker compose -f docker-compose.dev.yml exec -T redis \
        redis-cli --scan --pattern "route:*")

    first=true
    while IFS= read -r key; do
        if [ -n "$key" ]; then
            if [ "$first" = false ]; then
                echo "," >> "${BACKUP_DIR}/redis/routes.json"
            fi
            first=false

            members=$(docker compose -f docker-compose.dev.yml exec -T redis \
                redis-cli SMEMBERS "$key" | tr '\n' ',' | sed 's/,$//')

            echo "  \"$key\": [\"$members\"]" >> "${BACKUP_DIR}/redis/routes.json"
        fi
    done <<< "$routes"

    echo "}" >> "${BACKUP_DIR}/redis/routes.json"
    echo "   ✅ 라우팅 룰 JSON 백업 완료"
else
    echo "   ⚠️  Redis 컨테이너가 실행 중이지 않습니다"
fi


# 6. 백업 메타데이터 생성
echo "📝 백업 메타데이터 생성 중..."
cat > "${BACKUP_DIR}/backup_info.txt" <<EOF
Backup Information
==================
Timestamp: ${TIMESTAMP}
Date: $(date)
Git Branch: $(git branch --show-current 2>/dev/null || echo "N/A")
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo "N/A")

Environment:
- BRIDGE_TYPE: $(grep BRIDGE_TYPE .env 2>/dev/null | cut -d'=' -f2 || echo "N/A")
- DATABASE_URL: $(grep DATABASE_URL .env 2>/dev/null | cut -d'=' -f2 | sed 's/:.*@/:***@/' || echo "N/A")
- REDIS_URL: $(grep REDIS_URL .env 2>/dev/null | cut -d'=' -f2 | sed 's/:.*@/:***@/' || echo "N/A")

Containers:
$(docker compose -f docker-compose.dev.yml ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || echo "N/A")

Backup Contents:
$(find "${BACKUP_DIR}" -type f -exec ls -lh {} \; | awk '{print $9, "-", $5}')
EOF

echo "   ✅ 메타데이터 생성 완료"

# 7. 최신 백업 심볼릭 링크 업데이트
echo "🔗 최신 백업 링크 업데이트 중..."
rm -f "${BACKUP_ROOT}/latest"
ln -s "${TIMESTAMP}" "${BACKUP_ROOT}/latest"
echo "   ✅ latest 링크 업데이트 완료"

# 8. 백업 완료 요약
echo ""
echo -e "${GREEN}=== 백업 완료 ===${NC}"
echo "백업 위치: ${BACKUP_DIR}"
echo ""
echo "백업 내용:"
du -sh "${BACKUP_DIR}"/* | awk '{print "  -", $2, ":", $1}'
echo ""
echo "총 백업 크기: $(du -sh ${BACKUP_DIR} | awk '{print $1}')"
echo ""
echo -e "${YELLOW}복구 방법:${NC}"
echo "  전체 복구: ./backend/scripts/restore_backup.sh ${TIMESTAMP}"
echo "  부분 복구: 백업 디렉토리에서 필요한 파일 수동 복사"
```

## 선택적 백업 스크립트

### 환경 변수만 백업

```bash
#!/bin/bash
# backend/scripts/backup_env.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/${TIMESTAMP}/env"

mkdir -p "$BACKUP_DIR"
cp .env "$BACKUP_DIR/.env"

echo "✅ 환경 변수 백업 완료: $BACKUP_DIR/.env"
```

### 데이터베이스만 백업

```bash
#!/bin/bash
# backend/scripts/backup_db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/${TIMESTAMP}/database"

mkdir -p "$BACKUP_DIR"

echo "💾 데이터베이스 백업 중..."
docker compose -f docker-compose.dev.yml exec -T postgres \
    pg_dump -U vmsuser v_project | gzip > "${BACKUP_DIR}/backup.sql.gz"

echo "✅ 데이터베이스 백업 완료: $BACKUP_DIR/backup.sql.gz"
echo "   크기: $(du -h ${BACKUP_DIR}/backup.sql.gz | awk '{print $1}')"
```

### Redis만 백업

```bash
#!/bin/bash
# backend/scripts/backup_redis.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/${TIMESTAMP}/redis"

mkdir -p "$BACKUP_DIR"

echo "⚡ Redis 백업 중..."

# Redis 저장 트리거
docker compose -f docker-compose.dev.yml exec redis redis-cli SAVE

# dump.rdb 복사
REDIS_CONTAINER=$(docker compose -f docker-compose.dev.yml ps -q redis)
docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "${BACKUP_DIR}/dump.rdb"

echo "✅ Redis 백업 완료: $BACKUP_DIR/dump.rdb"
echo "   크기: $(du -h ${BACKUP_DIR}/dump.rdb | awk '{print $1}')"
```

## 복구 스크립트

```bash
#!/bin/bash
# backend/scripts/restore_backup.sh

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_timestamp>"
    echo ""
    echo "사용 가능한 백업:"
    ls -1 backups/ | grep -v "latest"
    exit 1
fi

TIMESTAMP=$1
BACKUP_DIR="backups/${TIMESTAMP}"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ 백업을 찾을 수 없습니다: $BACKUP_DIR"
    exit 1
fi

echo "⚠️  경고: 현재 설정이 백업으로 덮어씌워집니다."
echo "백업 타임스탬프: $TIMESTAMP"
read -p "계속하시겠습니까? (y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "복구 취소됨"
    exit 0
fi

echo ""
echo "=== 백업 복구 시작 ==="

# 1. 환경 변수 복구
if [ -f "${BACKUP_DIR}/env/.env" ]; then
    echo "📁 환경 변수 복구 중..."
    cp "${BACKUP_DIR}/env/.env" .env
    echo "   ✅ .env 복구 완료"
fi

# 2. Docker 설정 복구
echo "🐳 Docker 설정 복구 중..."
for compose_file in ${BACKUP_DIR}/docker/docker-compose*.yml; do
    if [ -f "$compose_file" ]; then
        filename=$(basename "$compose_file")
        cp "$compose_file" "./$filename"
        echo "   ✅ $filename 복구 완료"
    fi
done

# 3. 데이터베이스 복구
if [ -f "${BACKUP_DIR}/database/full_backup.sql.gz" ]; then
    echo "💾 데이터베이스 복구 중..."

    # 압축 해제
    gunzip -c "${BACKUP_DIR}/database/full_backup.sql.gz" > /tmp/restore.sql

    # DB 복구
    docker compose -f docker-compose.dev.yml exec -T postgres \
        psql -U vmsuser v_project < /tmp/restore.sql

    rm /tmp/restore.sql
    echo "   ✅ 데이터베이스 복구 완료"
fi

# 4. Redis 복구
if [ -f "${BACKUP_DIR}/redis/dump.rdb" ]; then
    echo "⚡ Redis 복구 중..."

    # Redis 중지
    docker compose -f docker-compose.dev.yml stop redis

    # dump.rdb 복사
    REDIS_CONTAINER=$(docker compose -f docker-compose.dev.yml ps -q redis)
    docker cp "${BACKUP_DIR}/redis/dump.rdb" "${REDIS_CONTAINER}:/data/dump.rdb"

    # Redis 재시작
    docker compose -f docker-compose.dev.yml start redis

    echo "   ✅ Redis 복구 완료"
fi


echo ""
echo "=== 복구 완료 ==="
echo "다음 단계:"
echo "  1. 서비스 재시작: docker compose -f docker-compose.dev.yml restart"
echo "  2. 헬스체크 확인: /provider-health"
```

## 자동 백업 (Cron)

```bash
#!/bin/bash
# backend/scripts/setup_auto_backup.sh

# 매일 새벽 2시 자동 백업
CRON_JOB="0 2 * * * cd $(pwd) && ./backend/scripts/backup_all.sh >> logs/backup.log 2>&1"

# Cron에 추가
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ 자동 백업 설정 완료 (매일 새벽 2시)"
echo "   로그 위치: logs/backup.log"
```

## 백업 정리 (오래된 백업 삭제)

```bash
#!/bin/bash
# backend/scripts/cleanup_old_backups.sh

BACKUP_ROOT="backups"
KEEP_DAYS=30  # 30일 이상 오래된 백업 삭제

echo "🗑️  오래된 백업 정리 중..."

find "$BACKUP_ROOT" -maxdepth 1 -type d -mtime +$KEEP_DAYS | while read dir; do
    if [ "$dir" != "$BACKUP_ROOT" ] && [ "$dir" != "${BACKUP_ROOT}/latest" ]; then
        echo "   삭제: $dir"
        rm -rf "$dir"
    fi
done

echo "✅ 백업 정리 완료 (${KEEP_DAYS}일 이상 유지)"
```

## 트러블슈팅

### 문제 1: 백업 디렉토리 권한 오류

**증상:**
```
mkdir: cannot create directory 'backups': Permission denied
```

**해결:**
```bash
sudo mkdir -p backups
sudo chown $USER:$USER backups
chmod 755 backups
```

### 문제 2: PostgreSQL 백업 실패

**증상:**
```
pg_dump: error: connection to server failed
```

**해결:**
```bash
# PostgreSQL 컨테이너 확인
docker compose -f docker-compose.dev.yml ps postgres

# 컨테이너가 없으면 시작
docker compose -f docker-compose.dev.yml up -d postgres
```

## 관련 스킬
- `add-route-rule` - Redis 백업 후 라우팅 룰 추가

## 사용 시점

- 마이그레이션 작업 전 (Week 1 시작 전)
- 주요 설정 변경 전
- 배포 전
- 정기 백업 (매일 자동)
