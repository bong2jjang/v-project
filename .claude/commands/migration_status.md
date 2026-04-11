# 시스템 상태 확인

v-project(v-platform + v-channel-bridge + v-platform-template + v-platform-portal) 멀티 앱 시스템 현황을 확인합니다.

## 플랫폼 핵심 파일 확인

```bash
# v-platform 핵심 파일
ls -la platform/backend/v_platform/app.py && echo "✅ PlatformApp" || echo "❌ PlatformApp"
ls -la platform/backend/v_platform/api/ && echo "✅ Platform API (15 routers)" || echo "❌ Platform API"
ls -la platform/backend/v_platform/models/ && echo "✅ Platform Models (11)" || echo "❌ Platform Models"
ls -la platform/backend/v_platform/services/ && echo "✅ Platform Services (12)" || echo "❌ Platform Services"
ls -la platform/frontend/v-platform-core/src/pages/ && echo "✅ Platform Pages (17)" || echo "❌ Platform Pages"
```

## 앱 상태 확인

```bash
# v-channel-bridge
ls -la apps/v-channel-bridge/backend/app/main.py && echo "✅ v-channel-bridge backend" || echo "❌ v-channel-bridge backend"
ls -la apps/v-channel-bridge/frontend/src/App.tsx && echo "✅ v-channel-bridge frontend" || echo "❌ v-channel-bridge frontend"

# v-platform-template
ls -la apps/v-platform-template/backend/app/main.py && echo "✅ v-platform-template backend" || echo "❌ v-platform-template backend"
ls -la apps/v-platform-template/frontend/src/App.tsx && echo "✅ v-platform-template frontend" || echo "❌ v-platform-template frontend"

# v-platform-portal
ls -la apps/v-platform-portal/backend/ && echo "✅ v-platform-portal backend" || echo "❌ v-platform-portal backend"
ls -la apps/v-platform-portal/frontend/ && echo "✅ v-platform-portal frontend" || echo "❌ v-platform-portal frontend"
```

## Docker 서비스 상태

```bash
# 기본 서비스
docker compose ps

# 프로필 포함 전체 서비스
docker compose --profile template --profile portal ps
```

## Provider 연결 상태 (v-channel-bridge)

```bash
curl -s http://localhost:8000/api/bridge/status | python3 -m json.tool
```

## Redis 라우팅 룰 현황

```bash
# 등록된 Route 수
docker exec v-project-redis redis-cli -a redispassword --scan --pattern "route:*" | grep -v "names\|modes\|bidirectional\|source_name" | wc -l

# Route 목록
docker exec v-project-redis redis-cli -a redispassword --scan --pattern "route:*" | grep -v "names\|modes\|bidirectional\|source_name" | sort
```

## 테스트 상태

```bash
docker exec v-channel-bridge-backend python -m pytest tests/ -q 2>/dev/null | tail -5
```

## 컴포넌트 상태 요약

| 컴포넌트 | 상태 | 비고 |
|---|---|---|
| v-platform Backend | ✅ 완성 | PlatformApp, 15 라우터, 12 서비스, 11 모델 |
| v-platform Frontend | ✅ 완성 | 17 페이지, 6 스토어, 11 훅, 60+ 컴포넌트 |
| v-channel-bridge | ✅ 완성 | Slack/Teams 양방향 브리지 |
| v-platform-template | ✅ 완성 | 새 앱 스캐폴딩 템플릿 |
| v-platform-portal | ✅ 완성 | AppRegistry, SSO Relay, App Launcher |
| Multi-app 데이터 격리 | ✅ 완성 | app_id 기반 (menu_items, audit_logs, system_settings) |
| Token Relay SSO | ✅ 완성 | 포털 → 앱 JWT 자동 인증 |
| Migrations | ✅ 완성 | p001~p016 |
