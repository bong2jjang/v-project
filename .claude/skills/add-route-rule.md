---
name: add-route-rule
description: Redis 라우팅 룰 추가 - 양방향 룰 자동 생성, 형식 검증, 동적 업데이트
---

# 라우팅 룰 추가 스킬

Redis 기반 동적 라우팅 룰을 추가합니다. 양방향 메시지 브리지를 위한 룰을 자동으로 생성합니다.

## 입력 파라미터

- `source_platform`: 소스 플랫폼 (slack, teams)
- `source_channel`: 소스 채널 ID 또는 이름
- `target_platform`: 타겟 플랫폼 (slack, teams)
- `target_channel`: 타겟 채널 ID 또는 이름
- `bidirectional`: 양방향 룰 생성 여부 (기본값: true)

## 라우팅 룰 형식

### Redis Key 형식
```
route:{source_platform}:{source_channel}
```

### Redis Value (Set)
```
{target_platform}:{target_channel}
```

### 예시
```
Key: route:slack:#general
Value: teams:General

Key: route:teams:General
Value: slack:#general
```

## 워크플로우

### 1. 입력 검증

```bash
#!/bin/bash
# 입력 형식 검증

validate_input() {
    local platform=$1
    local channel=$2

    # 플랫폼 검증
    if [[ ! "$platform" =~ ^(slack|teams)$ ]]; then
        echo "❌ 잘못된 플랫폼: $platform (허용: slack, teams)"
        return 1
    fi

    # 채널 형식 검증
    if [[ "$platform" == "slack" ]]; then
        # Slack: #으로 시작하거나 C로 시작하는 채널 ID
        if [[ ! "$channel" =~ ^#.+$ ]] && [[ ! "$channel" =~ ^C[A-Z0-9]+$ ]]; then
            echo "❌ 잘못된 Slack 채널 형식: $channel"
            echo "   허용 형식: #channel-name 또는 C12345678"
            return 1
        fi
    elif [[ "$platform" == "teams" ]]; then
        # Teams: 일반 문자열 또는 19:로 시작하는 채널 ID
        if [[ -z "$channel" ]]; then
            echo "❌ Teams 채널이 비어있습니다"
            return 1
        fi
    fi

    return 0
}
```

### 2. 중복 확인

```bash
#!/bin/bash
# 기존 룰 확인

check_existing_rule() {
    local source="$1:$2"
    local target="$3:$4"

    # Redis에서 기존 룰 확인
    existing=$(docker compose -f docker-compose.dev.yml exec -T redis \
        redis-cli SMEMBERS "route:$source")

    if echo "$existing" | grep -q "$target"; then
        echo "⚠️  라우팅 룰이 이미 존재합니다"
        echo "   $source → $target"
        return 1
    fi

    return 0
}
```

### 3. 라우팅 룰 추가

```bash
#!/bin/bash
# 라우팅 룰 추가 함수

add_route_rule() {
    local source_platform=$1
    local source_channel=$2
    local target_platform=$3
    local target_channel=$4
    local bidirectional=${5:-true}

    # 입력 검증
    validate_input "$source_platform" "$source_channel" || return 1
    validate_input "$target_platform" "$target_channel" || return 1

    # Redis Key/Value 구성
    local source_key="route:${source_platform}:${source_channel}"
    local target_value="${target_platform}:${target_channel}"

    echo "📝 라우팅 룰 추가 중..."
    echo "   Source: ${source_platform}:${source_channel}"
    echo "   Target: ${target_platform}:${target_channel}"

    # 중복 확인
    if ! check_existing_rule "$source_platform" "$source_channel" \
                             "$target_platform" "$target_channel"; then
        echo "   ℹ️  기존 룰 유지"
    else
        # Redis에 룰 추가
        docker compose -f docker-compose.dev.yml exec -T redis \
            redis-cli SADD "$source_key" "$target_value" > /dev/null

        echo "   ✅ 단방향 룰 추가 완료"
    fi

    # 양방향 룰 추가
    if [[ "$bidirectional" == "true" ]]; then
        local reverse_key="route:${target_platform}:${target_channel}"
        local reverse_value="${source_platform}:${source_channel}"

        if ! check_existing_rule "$target_platform" "$target_channel" \
                                 "$source_platform" "$source_channel"; then
            echo "   ℹ️  역방향 룰 유지"
        else
            docker compose -f docker-compose.dev.yml exec -T redis \
                redis-cli SADD "$reverse_key" "$reverse_value" > /dev/null

            echo "   ✅ 양방향 룰 추가 완료"
        fi
    fi

    echo ""
    echo "✅ 라우팅 룰 추가 성공"
}
```

### 4. 검증

```bash
#!/bin/bash
# 추가된 룰 검증

verify_route_rule() {
    local source_platform=$1
    local source_channel=$2
    local target_platform=$3
    local target_channel=$4

    local source_key="route:${source_platform}:${source_channel}"
    local target_value="${target_platform}:${target_channel}"

    echo "🔍 라우팅 룰 검증 중..."

    # Redis에서 룰 조회
    members=$(docker compose -f docker-compose.dev.yml exec -T redis \
        redis-cli SMEMBERS "$source_key")

    if echo "$members" | grep -q "$target_value"; then
        echo "✅ 라우팅 룰 정상 동작"
        echo "   $source_key → $target_value"
        return 0
    else
        echo "❌ 라우팅 룰을 찾을 수 없습니다"
        echo "   Expected: $source_key → $target_value"
        return 1
    fi
}
```

## 사용 예시

### 예시 1: Slack ↔ Teams 양방향 룰

```bash
# 사용법
add_route_rule "slack" "#general" "teams" "General" "true"

# 생성되는 Redis 데이터
# Key: route:slack:#general
# Value: teams:General

# Key: route:teams:General
# Value: slack:#general
```

### 예시 2: 단방향 룰 (Slack → Teams만)

```bash
add_route_rule "slack" "#announcements" "teams" "Announcements" "false"

# 생성되는 Redis 데이터
# Key: route:slack:#announcements
# Value: teams:Announcements
# (역방향 룰 없음)
```

### 예시 3: 다중 타겟 룰

```bash
# Slack #general → Teams General
add_route_rule "slack" "#general" "teams" "General"

# Slack #general → Teams Development (추가)
docker compose -f docker-compose.dev.yml exec redis \
    redis-cli SADD "route:slack:#general" "teams:Development"

# 결과: #general 메시지가 2개 Teams 채널로 전송됨
```

## 전체 스크립트

```bash
#!/bin/bash
# backend/scripts/add_route_rule.sh

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 함수 정의 (위 섹션의 함수들)
validate_input() { ... }
check_existing_rule() { ... }
add_route_rule() { ... }
verify_route_rule() { ... }

# 메인 실행
main() {
    if [ $# -lt 4 ]; then
        echo "Usage: $0 <source_platform> <source_channel> <target_platform> <target_channel> [bidirectional]"
        echo ""
        echo "Examples:"
        echo "  $0 slack '#general' teams 'General'"
        echo "  $0 slack '#dev' teams 'Development' true"
        echo "  $0 teams 'General' slack '#general' false"
        exit 1
    fi

    local source_platform=$1
    local source_channel=$2
    local target_platform=$3
    local target_channel=$4
    local bidirectional=${5:-true}

    # 라우팅 룰 추가
    add_route_rule "$source_platform" "$source_channel" \
                   "$target_platform" "$target_channel" \
                   "$bidirectional"

    # 검증
    verify_route_rule "$source_platform" "$source_channel" \
                      "$target_platform" "$target_channel"

    if [[ "$bidirectional" == "true" ]]; then
        verify_route_rule "$target_platform" "$target_channel" \
                          "$source_platform" "$source_channel"
    fi
}

main "$@"
```

## 라우팅 룰 관리 명령어

### 모든 룰 조회

```bash
# 모든 라우팅 룰 Key 조회
docker compose -f docker-compose.dev.yml exec redis \
    redis-cli --scan --pattern "route:*"

# 특정 룰의 타겟 조회
docker compose -f docker-compose.dev.yml exec redis \
    redis-cli SMEMBERS "route:slack:#general"
```

### 룰 삭제

```bash
# 특정 타겟 제거
docker compose -f docker-compose.dev.yml exec redis \
    redis-cli SREM "route:slack:#general" "teams:General"

# 전체 룰 삭제
docker compose -f docker-compose.dev.yml exec redis \
    redis-cli DEL "route:slack:#general"
```

### 룰 수정

```bash
# 기존 룰 삭제 후 재추가
docker compose -f docker-compose.dev.yml exec redis \
    redis-cli DEL "route:slack:#general"

add_route_rule "slack" "#general" "teams" "NewChannel"
```

## 트러블슈팅

### 문제 1: Redis 연결 실패

**증상:**
```
Error: Could not connect to Redis at redis:6379: Connection refused
```

**해결:**
```bash
# Redis 컨테이너 상태 확인
docker compose -f docker-compose.dev.yml ps redis

# Redis 시작
docker compose -f docker-compose.dev.yml up -d redis
```

### 문제 2: 룰이 적용되지 않음

**증상:**
메시지가 라우팅되지 않음

**확인 사항:**
```bash
# 1. Redis 룰 확인
docker compose -f docker-compose.dev.yml exec redis \
    redis-cli SMEMBERS "route:slack:#general"

# 2. Backend 로그 확인
docker compose -f docker-compose.dev.yml logs backend | grep -i "route"

# 3. Backend 재시작 (캐시 갱신)
docker compose -f docker-compose.dev.yml restart backend
```

### 문제 3: 채널 형식 오류

**증상:**
```
❌ 잘못된 Slack 채널 형식: general
```

**해결:**
```bash
# Slack 채널은 #으로 시작해야 함
add_route_rule "slack" "#general" "teams" "General"  # ✓ 올바름
add_route_rule "slack" "general" "teams" "General"   # ✗ 잘못됨
```

## Web UI 통합 (선택사항)

```typescript
// frontend/src/components/settings/RouteRuleManager.tsx

async function addRouteRule(
  sourcePlatform: 'slack' | 'teams',
  sourceChannel: string,
  targetPlatform: 'slack' | 'teams',
  targetChannel: string,
  bidirectional: boolean = true
) {
  const response = await fetch('/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: { platform: sourcePlatform, channel: sourceChannel },
      target: { platform: targetPlatform, channel: targetChannel },
      bidirectional
    })
  });

  if (!response.ok) {
    throw new Error('Failed to add route rule');
  }

  return response.json();
}
```

## 관련 스킬
- `backup-config` - 라우팅 룰 추가 전 Redis 백업
- `validate-common-schema` - 라우팅 테스트용 메시지 변환 검증

## 사용 시점

- Week 2: Slack Provider 완성 후 테스트용 룰 추가
- Week 3: Teams Provider 완성 후 양방향 룰 추가
- Week 4: 프로덕션 채널 매핑 설정
