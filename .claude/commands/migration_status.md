# 시스템 상태 확인

v-project(v-platform + v-channel-bridge) 컴포넌트 현황과 Provider 연결 상태를 확인합니다.

## 아키텍처 구성요소 확인

```bash
# 핵심 파일 존재 여부
ls -la backend/app/schemas/common_message.py && echo "✅ Common Schema" || echo "❌ Common Schema"
ls -la backend/app/adapters/base.py && echo "✅ Provider Interface" || echo "❌ Provider Interface"
ls -la backend/app/adapters/slack_provider.py && echo "✅ Slack Provider" || echo "❌ Slack Provider"
ls -la backend/app/adapters/teams_provider.py && echo "✅ Teams Provider" || echo "❌ Teams Provider"
ls -la backend/app/services/route_manager.py && echo "✅ Route Manager" || echo "❌ Route Manager"
ls -la backend/app/services/websocket_bridge.py && echo "✅ WebSocket Bridge" || echo "❌ WebSocket Bridge"
ls -la backend/app/api/teams_webhook.py && echo "✅ Teams Webhook" || echo "❌ Teams Webhook"
ls -la backend/app/api/bridge.py && echo "✅ Bridge API" || echo "❌ Bridge API"
ls -la frontend/src/lib/api/bridge.ts && echo "✅ Frontend Bridge API" || echo "❌ Frontend Bridge API"
```

## Docker 서비스 상태

```bash
docker compose -f docker-compose.dev.yml ps
```

## Provider 연결 상태

```bash
# Backend API를 통한 Provider 상태 조회
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
docker exec v-project-backend python -m pytest tests/ -q 2>/dev/null | tail -5
```

## 컴포넌트 상태 요약

| 컴포넌트 | 상태 | 비고 |
|---|---|---|
| Slack Provider | ✅ 완성 | Socket Mode 동작 중 |
| Teams Provider | ✅ 코드 완성 | Azure Bot 등록 후 실 테스트 필요 |
| Route Manager | ✅ 완성 | 양방향/단방향 지원 |
| WebSocket Bridge | ✅ 완성 | 메시지 라우팅 동작 중 |
| Teams Webhook | ✅ 완성 | `/api/teams/webhook` |
| Frontend UI | ✅ 완성 | Route 관리 UI |

## 다음 작업 후보

- **Teams 실 테스트**: Azure Bot 등록 후 Teams 채널에서 메시지 송수신 검증
- **E2E 통합 테스트**: Slack ↔ Teams 완전한 흐름 테스트 코드 작성
- **모니터링 강화**: 메시지 전달 실패율 추적, 알림 설정
