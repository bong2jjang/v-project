#!/bin/bash
################################################################################
# VMS Chat Ops Restore Script
#
# 이 스크립트는 backup.sh로 생성된 백업을 복원합니다.
#
# 사용법:
#   ./scripts/restore.sh <backup-file.tar.gz>
#   ./scripts/restore.sh backups/20260322_140000.tar.gz
#
# 주의사항:
#   - 복원 전 현재 데이터가 삭제될 수 있으니 주의하세요
#   - 복원 전에 현재 상태를 백업하는 것을 권장합니다
#   - 서비스를 중지한 상태에서 실행하는 것을 권장합니다
################################################################################

set -e  # 에러 발생 시 즉시 종료
set -u  # 정의되지 않은 변수 사용 시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 기본 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 사용법 표시
usage() {
    cat <<EOF
사용법: $0 <backup-file.tar.gz>

예시:
  $0 backups/20260322_140000.tar.gz
  $0 /path/to/backup/20260322_140000.tar.gz

옵션:
  --skip-confirmation    확인 프롬프트 건너뛰기
  --help                도움말 표시

주의사항:
  - 복원 전 현재 데이터가 삭제될 수 있습니다
  - 복원 전에 현재 상태를 백업하는 것을 권장합니다
  - 서비스를 중지한 상태에서 실행하세요

EOF
    exit 1
}

# 인자 확인
if [ $# -lt 1 ]; then
    log_error "백업 파일을 지정해주세요."
    usage
fi

BACKUP_FILE="$1"
SKIP_CONFIRMATION=false

# 옵션 파싱
for arg in "$@"; do
    case $arg in
        --skip-confirmation)
            SKIP_CONFIRMATION=true
            ;;
        --help)
            usage
            ;;
    esac
done

# 백업 파일 존재 확인
if [ ! -f "${BACKUP_FILE}" ]; then
    log_error "백업 파일을 찾을 수 없습니다: ${BACKUP_FILE}"
    exit 1
fi

# 백업 파일 압축 해제
extract_backup() {
    log_step "백업 파일 압축 해제 중..."

    local temp_dir="/tmp/vms-restore-$$"
    mkdir -p "${temp_dir}"

    tar -xzf "${BACKUP_FILE}" -C "${temp_dir}"

    # 압축 해제된 디렉토리 찾기
    RESTORE_DIR=$(find "${temp_dir}" -mindepth 1 -maxdepth 1 -type d | head -1)

    if [ -z "${RESTORE_DIR}" ]; then
        log_error "백업 디렉토리를 찾을 수 없습니다."
        exit 1
    fi

    log_info "압축 해제 완료: ${RESTORE_DIR}"
}

# 백업 메타데이터 표시
show_metadata() {
    log_step "백업 정보 표시..."

    local metadata_file="${RESTORE_DIR}/metadata.txt"

    if [ -f "${metadata_file}" ]; then
        echo ""
        cat "${metadata_file}"
        echo ""
    else
        log_warn "메타데이터 파일이 없습니다."
    fi
}

# 확인 프롬프트
confirm_restore() {
    if [ "${SKIP_CONFIRMATION}" = true ]; then
        return 0
    fi

    echo ""
    log_warn "⚠️  경고: 복원 작업은 현재 데이터를 덮어씁니다!"
    echo ""
    read -p "계속하시겠습니까? (yes/no): " -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "복원 작업이 취소되었습니다."
        exit 0
    fi
}

# 서비스 중지 확인
check_services() {
    log_step "Docker 서비스 상태 확인 중..."

    local running_services=$(docker ps --format '{{.Names}}' | grep '^vms-' | wc -l)

    if [ ${running_services} -gt 0 ]; then
        log_warn "실행 중인 VMS 서비스가 ${running_services}개 있습니다."
        echo ""
        echo "실행 중인 서비스:"
        docker ps --format 'table {{.Names}}\t{{.Status}}' | grep 'vms-'
        echo ""

        if [ "${SKIP_CONFIRMATION}" = false ]; then
            read -p "서비스를 중지하시겠습니까? (yes/no): " -r
            echo ""

            if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
                log_info "서비스 중지 중..."
                cd "${PROJECT_DIR}"
                docker compose -f docker-compose.dev.yml down
                log_info "서비스 중지 완료"
            else
                log_warn "서비스가 실행 중인 상태에서 복원합니다. 데이터 손상 가능성이 있습니다."
            fi
        fi
    else
        log_info "실행 중인 VMS 서비스가 없습니다."
    fi
}

# PostgreSQL 복원
restore_postgresql() {
    log_step "PostgreSQL 데이터베이스 복원 중..."

    local pg_container="vms-postgres"
    local db_name="vms_chat_ops"
    local db_user="vmsuser"
    local dump_file=$(find "${RESTORE_DIR}" -name "postgres_*.dump" | head -1)

    if [ -z "${dump_file}" ]; then
        log_warn "PostgreSQL 백업 파일을 찾을 수 없습니다. 건너뜁니다."
        return 0
    fi

    # PostgreSQL 컨테이너가 실행 중인지 확인
    if ! docker ps --format '{{.Names}}' | grep -q "^${pg_container}$"; then
        log_warn "PostgreSQL 컨테이너가 실행 중이 아닙니다."
        log_info "서비스를 시작합니다..."
        cd "${PROJECT_DIR}"
        docker compose -f docker-compose.dev.yml up -d postgres
        sleep 5  # 컨테이너 시작 대기
    fi

    # 백업 파일을 컨테이너로 복사
    docker cp "${dump_file}" ${pg_container}:/tmp/restore.dump

    # 기존 연결 종료
    docker exec ${pg_container} psql -U ${db_user} -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db_name}' AND pid <> pg_backend_pid();" || true

    # 데이터베이스 삭제 및 재생성
    docker exec ${pg_container} psql -U ${db_user} -d postgres -c "DROP DATABASE IF EXISTS ${db_name};"
    docker exec ${pg_container} psql -U ${db_user} -d postgres -c "CREATE DATABASE ${db_name};"

    # 백업 복원
    docker exec ${pg_container} pg_restore \
        -U ${db_user} \
        -d ${db_name} \
        -c \
        /tmp/restore.dump || log_warn "일부 오류가 발생했지만 계속 진행합니다."

    # 임시 파일 삭제
    docker exec ${pg_container} rm /tmp/restore.dump

    log_info "PostgreSQL 복원 완료"
}

# Redis 복원
restore_redis() {
    log_step "Redis 데이터 복원 중..."

    local redis_container="vms-redis"
    local rdb_file=$(find "${RESTORE_DIR}" -name "redis_*.rdb" | head -1)

    if [ -z "${rdb_file}" ]; then
        log_warn "Redis 백업 파일을 찾을 수 없습니다. 건너뜁니다."
        return 0
    fi

    # Redis 컨테이너가 실행 중인지 확인
    if ! docker ps --format '{{.Names}}' | grep -q "^${redis_container}$"; then
        log_warn "Redis 컨테이너가 실행 중이 아닙니다."
        log_info "서비스를 시작합니다..."
        cd "${PROJECT_DIR}"
        docker compose -f docker-compose.dev.yml up -d redis
        sleep 3  # 컨테이너 시작 대기
    fi

    # Redis 중지
    docker exec ${redis_container} redis-cli SHUTDOWN NOSAVE || true
    sleep 2

    # 백업 파일 복사
    docker cp "${rdb_file}" ${redis_container}:/data/dump.rdb

    # Redis 재시작
    docker restart ${redis_container}
    sleep 2

    log_info "Redis 복원 완료"
}

# Matterbridge 설정 복원
restore_matterbridge_config() {
    log_step "Matterbridge 설정 파일 복원 중..."

    local config_file=$(find "${RESTORE_DIR}" -name "matterbridge_*.toml" | head -1)

    if [ -z "${config_file}" ]; then
        log_warn "Matterbridge 설정 파일을 찾을 수 없습니다. 건너뜁니다."
        return 0
    fi

    # 현재 설정 백업
    if [ -f "${PROJECT_DIR}/matterbridge.toml" ]; then
        cp "${PROJECT_DIR}/matterbridge.toml" "${PROJECT_DIR}/matterbridge.toml.bak.$(date +%s)"
        log_info "현재 설정을 백업했습니다."
    fi

    # 설정 파일 복원
    cp "${config_file}" "${PROJECT_DIR}/matterbridge.toml"

    log_info "Matterbridge 설정 복원 완료"
}

# Docker Compose 파일 복원 (선택사항)
restore_docker_compose() {
    log_step "Docker Compose 파일 복원 확인 중..."

    local compose_files=$(find "${RESTORE_DIR}" -name "docker-compose*.yml")

    if [ -z "${compose_files}" ]; then
        log_info "Docker Compose 파일 백업이 없습니다. 건너뜁니다."
        return 0
    fi

    echo ""
    log_warn "Docker Compose 파일을 복원하시겠습니까?"
    log_warn "현재 파일이 백업된 버전으로 대체됩니다."
    echo ""

    if [ "${SKIP_CONFIRMATION}" = false ]; then
        read -p "복원하시겠습니까? (yes/no): " -r
        echo ""

        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log_info "Docker Compose 파일 복원을 건너뜁니다."
            return 0
        fi
    fi

    for compose_file in ${compose_files}; do
        local filename=$(basename "${compose_file}")
        cp "${compose_file}" "${PROJECT_DIR}/${filename}"
        log_info "복원됨: ${filename}"
    done
}

# 서비스 재시작
restart_services() {
    log_step "서비스 재시작 중..."

    cd "${PROJECT_DIR}"

    log_info "서비스 중지 중..."
    docker compose -f docker-compose.dev.yml down

    log_info "서비스 시작 중..."
    docker compose -f docker-compose.dev.yml up -d

    log_info "서비스 헬스체크 대기 중..."
    sleep 10

    # 서비스 상태 확인
    docker compose -f docker-compose.dev.yml ps

    log_info "서비스 재시작 완료"
}

# 임시 파일 정리
cleanup() {
    log_step "임시 파일 정리 중..."

    if [ -n "${RESTORE_DIR:-}" ] && [ -d "${RESTORE_DIR}" ]; then
        rm -rf "$(dirname ${RESTORE_DIR})"
        log_info "임시 파일 삭제 완료"
    fi
}

# 메인 실행
main() {
    echo "========================================"
    echo "VMS Chat Ops Restore Script"
    echo "========================================"
    echo ""

    log_info "복원 시작..."
    log_info "백업 파일: ${BACKUP_FILE}"

    # 백업 파일 압축 해제
    extract_backup

    # 백업 정보 표시
    show_metadata

    # 확인 프롬프트
    confirm_restore

    # 서비스 상태 확인
    check_services

    # 복원 실행
    restore_postgresql
    restore_redis
    restore_matterbridge_config
    restore_docker_compose

    # 서비스 재시작
    if [ "${SKIP_CONFIRMATION}" = false ]; then
        echo ""
        read -p "서비스를 재시작하시겠습니까? (yes/no): " -r
        echo ""

        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            restart_services
        else
            log_info "서비스 재시작을 건너뜁니다."
            log_warn "수동으로 서비스를 재시작해주세요: docker compose -f docker-compose.dev.yml up -d"
        fi
    else
        restart_services
    fi

    # 정리
    cleanup

    echo ""
    log_info "복원 완료!"

    echo ""
    echo "========================================"
}

# 에러 발생 시 정리
trap cleanup EXIT ERR

# 스크립트 실행
main "$@"
