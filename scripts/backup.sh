#!/bin/bash
################################################################################
# v-channel-bridge Backup Script
#
# 이 스크립트는 다음 항목들을 백업합니다:
# - PostgreSQL 데이터베이스
# - Redis 데이터
# - Matterbridge 설정 파일
# - 환경 변수 파일 (민감 정보 제외)
# - 업로드된 파일 (있는 경우)
#
# 사용법:
#   ./scripts/backup.sh
#   ./scripts/backup.sh /path/to/backup/dir
#
# Cron 설정 예시 (매일 오전 2시):
#   0 2 * * * /path/to/vms-chat-ops/scripts/backup.sh >> /var/log/vms-backup.log 2>&1
################################################################################

set -e  # 에러 발생 시 즉시 종료
set -u  # 정의되지 않은 변수 사용 시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 기본 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_BASE_DIR="${1:-${PROJECT_DIR}/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"
RETENTION_DAYS=30  # 백업 보관 기간 (일)

# 로그 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 백업 디렉토리 생성
create_backup_dir() {
    log_info "백업 디렉토리 생성: ${BACKUP_DIR}"
    mkdir -p "${BACKUP_DIR}"
}

# PostgreSQL 백업
backup_postgresql() {
    log_info "PostgreSQL 데이터베이스 백업 중..."

    local pg_container="vms-postgres"
    local db_name="v_project"
    local db_user="vmsuser"
    local backup_file="${BACKUP_DIR}/postgres_${TIMESTAMP}.dump"

    if docker ps --format '{{.Names}}' | grep -q "^${pg_container}$"; then
        docker exec ${pg_container} pg_dump \
            -U ${db_user} \
            -d ${db_name} \
            -F c \
            -f /tmp/backup.dump

        docker cp ${pg_container}:/tmp/backup.dump ${backup_file}
        docker exec ${pg_container} rm /tmp/backup.dump

        local size=$(du -h ${backup_file} | cut -f1)
        log_info "PostgreSQL 백업 완료: ${backup_file} (${size})"
    else
        log_warn "PostgreSQL 컨테이너가 실행 중이 아닙니다. 건너뜁니다."
    fi
}

# Redis 백업
backup_redis() {
    log_info "Redis 데이터 백업 중..."

    local redis_container="vms-redis"
    local backup_file="${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"

    if docker ps --format '{{.Names}}' | grep -q "^${redis_container}$"; then
        # Redis BGSAVE 실행
        docker exec ${redis_container} redis-cli BGSAVE

        # BGSAVE 완료 대기 (최대 30초)
        local count=0
        while [ $count -lt 30 ]; do
            local lastsave=$(docker exec ${redis_container} redis-cli LASTSAVE)
            sleep 1
            local newsave=$(docker exec ${redis_container} redis-cli LASTSAVE)
            if [ "$newsave" != "$lastsave" ]; then
                break
            fi
            count=$((count + 1))
        done

        # dump.rdb 파일 복사
        docker cp ${redis_container}:/data/dump.rdb ${backup_file}

        local size=$(du -h ${backup_file} | cut -f1)
        log_info "Redis 백업 완료: ${backup_file} (${size})"
    else
        log_warn "Redis 컨테이너가 실행 중이 아닙니다. 건너뜁니다."
    fi
}

# Matterbridge 설정 백업
backup_matterbridge_config() {
    log_info "Matterbridge 설정 파일 백업 중..."

    local config_file="${PROJECT_DIR}/matterbridge.toml"
    local backup_file="${BACKUP_DIR}/matterbridge_${TIMESTAMP}.toml"

    if [ -f "${config_file}" ]; then
        cp "${config_file}" "${backup_file}"
        log_info "Matterbridge 설정 백업 완료: ${backup_file}"
    else
        log_warn "Matterbridge 설정 파일이 없습니다: ${config_file}"
    fi
}

# 환경 변수 백업 (민감 정보 제외)
backup_env() {
    log_info "환경 변수 파일 백업 중..."

    local env_file="${PROJECT_DIR}/.env"
    local backup_file="${BACKUP_DIR}/env_${TIMESTAMP}.env.example"

    if [ -f "${env_file}" ]; then
        # 민감 정보 마스킹
        cat "${env_file}" | \
            sed 's/\(TOKEN\|PASSWORD\|SECRET\|KEY\)=.*/\1=***MASKED***/g' > "${backup_file}"
        log_info "환경 변수 백업 완료 (민감 정보 마스킹): ${backup_file}"
    else
        log_warn "환경 변수 파일이 없습니다: ${env_file}"
    fi
}

# Docker Compose 파일 백업
backup_docker_compose() {
    log_info "Docker Compose 파일 백업 중..."

    for compose_file in docker-compose*.yml; do
        if [ -f "${PROJECT_DIR}/${compose_file}" ]; then
            cp "${PROJECT_DIR}/${compose_file}" "${BACKUP_DIR}/${compose_file}"
            log_info "백업 완료: ${compose_file}"
        fi
    done
}

# 백업 압축
compress_backup() {
    log_info "백업 파일 압축 중..."

    cd "${BACKUP_BASE_DIR}"
    tar -czf "${TIMESTAMP}.tar.gz" "${TIMESTAMP}"

    local compressed_size=$(du -h "${TIMESTAMP}.tar.gz" | cut -f1)
    log_info "압축 완료: ${TIMESTAMP}.tar.gz (${compressed_size})"

    # 원본 디렉토리 삭제
    rm -rf "${TIMESTAMP}"
    log_info "원본 백업 디렉토리 삭제"
}

# 오래된 백업 삭제
cleanup_old_backups() {
    log_info "오래된 백업 삭제 중 (${RETENTION_DAYS}일 이상)..."

    local deleted_count=0
    find "${BACKUP_BASE_DIR}" -name "*.tar.gz" -type f -mtime +${RETENTION_DAYS} | while read -r old_backup; do
        rm -f "${old_backup}"
        log_info "삭제됨: $(basename ${old_backup})"
        deleted_count=$((deleted_count + 1))
    done

    if [ ${deleted_count} -eq 0 ]; then
        log_info "삭제할 오래된 백업이 없습니다."
    else
        log_info "${deleted_count}개의 오래된 백업 삭제 완료"
    fi
}

# 백업 메타데이터 생성
create_metadata() {
    log_info "백업 메타데이터 생성 중..."

    local metadata_file="${BACKUP_DIR}/metadata.txt"

    cat > "${metadata_file}" <<EOF
v-channel-bridge Backup Metadata
=================================

Backup Time: $(date '+%Y-%m-%d %H:%M:%S')
Timestamp: ${TIMESTAMP}
Hostname: $(hostname)
User: $(whoami)

Backup Contents:
- PostgreSQL Database
- Redis Data
- Matterbridge Configuration
- Environment Variables (masked)
- Docker Compose Files

Git Information:
- Branch: $(cd ${PROJECT_DIR} && git branch --show-current 2>/dev/null || echo "N/A")
- Commit: $(cd ${PROJECT_DIR} && git rev-parse --short HEAD 2>/dev/null || echo "N/A")
- Status: $(cd ${PROJECT_DIR} && git status --short 2>/dev/null | wc -l || echo "N/A") modified files

System Information:
- OS: $(uname -s)
- Kernel: $(uname -r)
- Docker Version: $(docker --version 2>/dev/null || echo "N/A")

Notes:
This backup was created automatically by backup.sh script.
To restore, use restore.sh script.
EOF

    log_info "메타데이터 생성 완료: ${metadata_file}"
}

# 백업 검증
verify_backup() {
    log_info "백업 파일 검증 중..."

    local errors=0

    # PostgreSQL dump 파일 확인
    if [ -f "${BACKUP_DIR}/postgres_${TIMESTAMP}.dump" ]; then
        local size=$(stat -f%z "${BACKUP_DIR}/postgres_${TIMESTAMP}.dump" 2>/dev/null || stat -c%s "${BACKUP_DIR}/postgres_${TIMESTAMP}.dump")
        if [ ${size} -lt 1024 ]; then
            log_error "PostgreSQL 백업 파일이 너무 작습니다 (${size} bytes)"
            errors=$((errors + 1))
        fi
    fi

    if [ ${errors} -eq 0 ]; then
        log_info "백업 파일 검증 완료"
        return 0
    else
        log_error "백업 파일 검증 실패: ${errors}개 오류"
        return 1
    fi
}

# 메인 실행
main() {
    echo "========================================"
    echo "v-channel-bridge Backup Script"
    echo "========================================"
    echo ""

    log_info "백업 시작..."

    # 백업 디렉토리 생성
    create_backup_dir

    # 각 항목 백업
    backup_postgresql
    backup_redis
    backup_matterbridge_config
    backup_env
    backup_docker_compose

    # 메타데이터 생성
    create_metadata

    # 백업 검증
    if ! verify_backup; then
        log_error "백업 검증 실패. 백업이 불완전할 수 있습니다."
    fi

    # 압축
    compress_backup

    # 오래된 백업 삭제
    cleanup_old_backups

    echo ""
    log_info "백업 완료!"
    log_info "백업 위치: ${BACKUP_BASE_DIR}/${TIMESTAMP}.tar.gz"

    # 백업 목록 표시
    echo ""
    log_info "최근 백업 목록:"
    ls -lh "${BACKUP_BASE_DIR}"/*.tar.gz 2>/dev/null | tail -5 || log_warn "백업 파일이 없습니다."

    echo ""
    echo "========================================"
}

# 스크립트 실행
main "$@"
