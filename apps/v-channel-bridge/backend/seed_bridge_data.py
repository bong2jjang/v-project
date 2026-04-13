"""v-channel-bridge 테스트 데이터 시드 스크립트.

컨테이너 내에서 실행:
  docker exec v-channel-bridge-backend python seed_bridge_data.py

생성 데이터:
  - Accounts: Slack 2개 + Teams 2개 (암호화 토큰)
  - Messages: 40건 (slack→teams, teams→slack, 다양한 상태/사용자/채널)
  - Message Stats: 7일치 일별 통계
  - Redis Routes: 4개 라우트 (양방향)
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

# ── DB 연결 ──────────────────────────────────────────────────────────────────
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://vmsuser:vmspassword@postgres:5432/v_project"
)
engine = create_engine(DATABASE_URL)

# ── 암호화 ───────────────────────────────────────────────────────────────────
from v_platform.utils.encryption import encrypt

# ── Redis ────────────────────────────────────────────────────────────────────
import redis.asyncio as aioredis

REDIS_URL = os.getenv("REDIS_URL", "redis://:redispassword@redis:6379/0")


# ═════════════════════════════════════════════════════════════════════════════
# 1. Accounts (Slack 2개, Teams 2개)
# ═════════════════════════════════════════════════════════════════════════════
def seed_accounts(conn):
    """4개 계정 생성 — 실제 토큰은 더미값이지만 암호화는 정상 적용."""
    print("\n── Accounts ──")

    accounts = [
        {
            "id": 1,
            "platform": "slack",
            "name": "dev-slack-bot",
            "token": encrypt("xoxb-1111-2222-dev-slack-token-placeholder"),
            "app_token": encrypt("xapp-1-dev-slack-app-token-placeholder"),
            "tenant_id": None,
            "app_id": None,
            "app_password": None,
            "prefix_messages_with_nick": True,
            "edit_suffix": " (edited)",
            "edit_disable": False,
            "use_username": True,
            "no_send_join_part": True,
            "use_api": True,
            "debug": False,
            "is_valid": True,
            "validation_errors": None,
            "enabled": True,
            "created_by": 1,
            "updated_by": 1,
        },
        {
            "id": 2,
            "platform": "slack",
            "name": "prod-slack-bot",
            "token": encrypt("xoxb-3333-4444-prod-slack-token-placeholder"),
            "app_token": encrypt("xapp-1-prod-slack-app-token-placeholder"),
            "tenant_id": None,
            "app_id": None,
            "app_password": None,
            "prefix_messages_with_nick": True,
            "edit_suffix": " (edited)",
            "edit_disable": False,
            "use_username": True,
            "no_send_join_part": True,
            "use_api": True,
            "debug": True,
            "is_valid": True,
            "validation_errors": None,
            "enabled": True,
            "created_by": 1,
            "updated_by": 1,
        },
        {
            "id": 3,
            "platform": "teams",
            "name": "dev-teams-bot",
            "token": None,
            "app_token": None,
            "tenant_id": encrypt("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
            "app_id": encrypt("11111111-2222-3333-4444-555555555555"),
            "app_password": encrypt("dev-teams-app-password-placeholder"),
            "prefix_messages_with_nick": True,
            "edit_suffix": " (edited)",
            "edit_disable": False,
            "use_username": True,
            "no_send_join_part": True,
            "use_api": True,
            "debug": False,
            "is_valid": True,
            "validation_errors": None,
            "enabled": True,
            "created_by": 1,
            "updated_by": 1,
        },
        {
            "id": 4,
            "platform": "teams",
            "name": "prod-teams-bot",
            "token": None,
            "app_token": None,
            "tenant_id": encrypt("f6e5d4c3-b2a1-0987-fedc-ba0987654321"),
            "app_id": encrypt("66666666-7777-8888-9999-000000000000"),
            "app_password": encrypt("prod-teams-app-password-placeholder"),
            "prefix_messages_with_nick": True,
            "edit_suffix": " (edited)",
            "edit_disable": False,
            "use_username": True,
            "no_send_join_part": True,
            "use_api": True,
            "debug": False,
            "is_valid": True,
            "validation_errors": None,
            "enabled": False,
            "created_by": 1,
            "updated_by": 1,
        },
    ]

    for acct in accounts:
        conn.execute(
            text("""
                INSERT INTO accounts (
                    id, platform, name, token, app_token,
                    tenant_id, app_id, app_password,
                    prefix_messages_with_nick, edit_suffix, edit_disable,
                    use_username, no_send_join_part, use_api, debug,
                    is_valid, validation_errors, enabled,
                    created_at, updated_at, created_by, updated_by
                ) VALUES (
                    :id, :platform, :name, :token, :app_token,
                    :tenant_id, :app_id, :app_password,
                    :prefix_messages_with_nick, :edit_suffix, :edit_disable,
                    :use_username, :no_send_join_part, :use_api, :debug,
                    :is_valid, :validation_errors, :enabled,
                    NOW(), NOW(), :created_by, :updated_by
                )
                ON CONFLICT (id) DO NOTHING
            """),
            acct,
        )
        print(f"  ✓ Account #{acct['id']}: {acct['platform']}/{acct['name']}")

    conn.execute(
        text("SELECT setval('accounts_id_seq', GREATEST((SELECT MAX(id) FROM accounts), 1))")
    )


# ═════════════════════════════════════════════════════════════════════════════
# 2. Messages (40건 — 다양한 방향/상태/사용자/채널)
# ═════════════════════════════════════════════════════════════════════════════
def seed_messages(conn):
    """40건의 메시지 히스토리 생성."""
    print("\n── Messages ──")

    now = datetime.now(timezone.utc)

    # 채널 정보
    slack_channels = [
        ("C0GENERAL01", "general"),
        ("C0DEVELOP01", "dev-team"),
        ("C0ALERT001", "alerts"),
        ("C0RANDOM01", "random"),
    ]
    teams_channels = [
        ("t1:19:general@thread.tacv2", "General"),
        ("t1:19:dev-team@thread.tacv2", "Development"),
        ("t1:19:alerts@thread.tacv2", "Alerts"),
        ("t1:19:random@thread.tacv2", "Random"),
    ]

    # 사용자 정보
    slack_users = [
        ("U001VIKTOR", "이춘봉(Viktor)", "이춘봉(Viktor)"),
        ("U002KIMBS", "김병수", "김병수"),
        ("U003LEEJH", "이정현", "이정현"),
        ("U004PARKSY", "박서연", "박서연"),
        ("U005BOT", "deploy-bot", "Deploy Bot"),
    ]
    teams_users = [
        ("aad-user-001", "정구환", "정구환"),
        ("aad-user-002", "최민지", "최민지"),
        ("aad-user-003", "한승우", "한승우"),
    ]

    # 메시지 템플릿
    messages_data = []
    msg_id = 1

    # ── slack→teams 메시지 (15건) ──
    s2t_texts = [
        "안녕하세요, 오늘 배포 일정 확인 부탁드립니다",
        "PR #142 리뷰 완료했습니다. LGTM 👍",
        "Jenkins 빌드 실패 — `test_auth_flow` 에서 timeout",
        "다음주 월요일 스프린트 리뷰 참석 가능하신가요?",
        "DB 마이그레이션 v15 적용 완료. 스테이징 확인해주세요",
        "긴급: 프로덕션 에러율 5% 초과",
        "Grafana 대시보드 업데이트했습니다 — latency 패널 추가",
        "코드 리뷰 코멘트 반영 완료. 재리뷰 부탁합니다",
        "오늘 점심 뭐 먹을까요?",
        "금요일 회식 장소 투표 올렸습니다",
        "v2.1.0 릴리즈 노트 작성 중입니다",
        "Slack 봇 명령어 `/bridge status` 추가했습니다",
        "테스트 환경 Redis 메모리 부족 경고",
        "모니터링 알림 임계값 조정 필요합니다",
        "주간 보고서 공유합니다",
    ]
    for i, txt in enumerate(s2t_texts):
        user = slack_users[i % len(slack_users)]
        src_ch = slack_channels[i % len(slack_channels)]
        dst_ch = teams_channels[i % len(teams_channels)]
        ts = now - timedelta(days=6 - (i // 3), hours=9 + (i % 8), minutes=i * 7)
        status = "sent" if i != 5 else "failed"  # 긴급 메시지는 실패로
        error_msg = "Teams API timeout (503)" if status == "failed" else None
        retry = 3 if status == "failed" else 0
        delivered = ts + timedelta(seconds=2) if status == "sent" else None

        messages_data.append({
            "id": msg_id,
            "message_id": str(int(ts.timestamp() * 1000)),
            "text": txt,
            "gateway": "slack→teams",
            "source_account": "slack",
            "source_channel": src_ch[0],
            "source_user": user[0],
            "destination_account": "teams",
            "destination_channel": dst_ch[0],
            "protocol": "slack",
            "timestamp": ts,
            "created_at": ts + timedelta(seconds=1),
            "has_attachment": False,
            "attachment_count": 0,
            "message_type": "text",
            "message_format": "text",
            "status": status,
            "error_message": error_msg,
            "retry_count": retry,
            "delivered_at": delivered,
            "source_user_name": user[1],
            "source_user_display_name": user[2],
            "attachment_details": None,
            "source_channel_name": src_ch[1],
            "destination_channel_name": dst_ch[1],
        })
        msg_id += 1

    # ── teams→slack 메시지 (15건) ──
    t2s_texts = [
        "배포 일정 확인했습니다. 15시 예정입니다",
        "리뷰 감사합니다. merge 진행합니다",
        "timeout 원인 확인 중입니다. DB connection pool 의심",
        "월요일 참석 가능합니다",
        "스테이징 확인 완료. 이상 없습니다",
        "에러율 원인: 외부 API rate limit. 백오프 적용합니다",
        "대시보드 잘 만드셨네요. P99 패널도 추가하면 좋겠어요",
        "LGTM. merge 해주세요",
        "짜장면 투표요!",
        "저도 회식 참석합니다",
        "릴리즈 노트에 보안 패치 항목 추가해주세요",
        "명령어 잘 됩니다. `/bridge routes` 도 부탁합니다",
        "Redis maxmemory 2GB로 올렸습니다",
        "CPU 임계값 80%→90%로 조정했습니다",
        "보고서 확인했습니다. LGTM",
    ]
    for i, txt in enumerate(t2s_texts):
        user = teams_users[i % len(teams_users)]
        src_ch = teams_channels[i % len(teams_channels)]
        dst_ch = slack_channels[i % len(slack_channels)]
        ts = now - timedelta(days=6 - (i // 3), hours=8 + (i % 8), minutes=i * 7 + 15)
        delivered = ts + timedelta(seconds=1)

        messages_data.append({
            "id": msg_id,
            "message_id": str(int(ts.timestamp() * 1000)),
            "text": txt,
            "gateway": "teams→slack",
            "source_account": "teams",
            "source_channel": src_ch[0],
            "source_user": user[0],
            "destination_account": "slack",
            "destination_channel": dst_ch[0],
            "protocol": "teams",
            "timestamp": ts,
            "created_at": ts + timedelta(seconds=1),
            "has_attachment": False,
            "attachment_count": 0,
            "message_type": "text",
            "message_format": "text",
            "status": "sent",
            "error_message": None,
            "retry_count": 0,
            "delivered_at": delivered,
            "source_user_name": user[1],
            "source_user_display_name": user[2],
            "attachment_details": None,
            "source_channel_name": src_ch[1],
            "destination_channel_name": dst_ch[1],
        })
        msg_id += 1

    # ── 첨부파일 포함 메시지 (5건) ──
    attach_texts = [
        "스크린샷 첨부합니다",
        "설계 문서 공유",
        "에러 로그 파일",
        "회의록 첨부",
        "API 스펙 문서",
    ]
    attach_details = [
        [{"name": "screenshot.png", "size": 245000, "type": "image/png"}],
        [{"name": "design_v2.pdf", "size": 1200000, "type": "application/pdf"}],
        [{"name": "error.log", "size": 52000, "type": "text/plain"},
         {"name": "stacktrace.txt", "size": 8900, "type": "text/plain"}],
        [{"name": "meeting_notes.docx", "size": 45000, "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}],
        [{"name": "api_spec.yaml", "size": 32000, "type": "application/yaml"}],
    ]
    for i, txt in enumerate(attach_texts):
        user = slack_users[i % 4]
        ts = now - timedelta(days=3 - i, hours=14, minutes=30)
        details = attach_details[i]
        messages_data.append({
            "id": msg_id,
            "message_id": str(int(ts.timestamp() * 1000)),
            "text": txt,
            "gateway": "slack→teams",
            "source_account": "slack",
            "source_channel": slack_channels[0][0],
            "source_user": user[0],
            "destination_account": "teams",
            "destination_channel": teams_channels[0][0],
            "protocol": "slack",
            "timestamp": ts,
            "created_at": ts + timedelta(seconds=2),
            "has_attachment": True,
            "attachment_count": len(details),
            "message_type": "text",
            "message_format": "text",
            "status": "sent",
            "error_message": None,
            "retry_count": 0,
            "delivered_at": ts + timedelta(seconds=3),
            "source_user_name": user[1],
            "source_user_display_name": user[2],
            "attachment_details": details,
            "source_channel_name": slack_channels[0][1],
            "destination_channel_name": teams_channels[0][1],
        })
        msg_id += 1

    # ── 재시도/실패 메시지 (5건) ──
    fail_texts = [
        "이 메시지는 재시도 중입니다",
        "Teams 서버 점검으로 전송 실패",
        "네트워크 타임아웃 발생",
        "인증 토큰 만료 — 재시도 중",
        "메시지 크기 초과 (4KB limit)",
    ]
    fail_statuses = ["retrying", "failed", "failed", "retrying", "failed"]
    fail_errors = [
        "Retry attempt 2/5 — Teams API 503",
        "Teams service unavailable (503) after 5 retries",
        "Connection timeout after 30s",
        "Retry attempt 1/5 — Token refresh in progress",
        "Message too large: 4,200 bytes exceeds 4,096 limit",
    ]
    for i, txt in enumerate(fail_texts):
        user = slack_users[i % 4]
        ts = now - timedelta(days=1, hours=i * 2, minutes=10)
        messages_data.append({
            "id": msg_id,
            "message_id": str(int(ts.timestamp() * 1000)),
            "text": txt,
            "gateway": "slack→teams",
            "source_account": "slack",
            "source_channel": slack_channels[1][0],
            "source_user": user[0],
            "destination_account": "teams",
            "destination_channel": teams_channels[1][0],
            "protocol": "slack",
            "timestamp": ts,
            "created_at": ts + timedelta(seconds=1),
            "has_attachment": False,
            "attachment_count": 0,
            "message_type": "text",
            "message_format": "text",
            "status": fail_statuses[i],
            "error_message": fail_errors[i],
            "retry_count": 5 if fail_statuses[i] == "failed" else (i + 1),
            "delivered_at": None,
            "source_user_name": user[1],
            "source_user_display_name": user[2],
            "attachment_details": None,
            "source_channel_name": slack_channels[1][1],
            "destination_channel_name": teams_channels[1][1],
        })
        msg_id += 1

    # ── INSERT ──
    import json

    for m in messages_data:
        conn.execute(
            text("""
                INSERT INTO messages (
                    id, message_id, text, gateway,
                    source_account, source_channel, source_user,
                    destination_account, destination_channel,
                    protocol, "timestamp", created_at,
                    has_attachment, attachment_count, message_type, message_format,
                    status, error_message, retry_count, delivered_at,
                    source_user_name, source_user_display_name,
                    attachment_details,
                    source_channel_name, destination_channel_name
                ) VALUES (
                    :id, :message_id, :text, :gateway,
                    :source_account, :source_channel, :source_user,
                    :destination_account, :destination_channel,
                    :protocol, :timestamp, :created_at,
                    :has_attachment, :attachment_count, :message_type, :message_format,
                    :status, :error_message, :retry_count, :delivered_at,
                    :source_user_name, :source_user_display_name,
                    CAST(:attachment_details_json AS jsonb),
                    :source_channel_name, :destination_channel_name
                )
                ON CONFLICT (id) DO NOTHING
            """),
            {
                **m,
                "attachment_details_json": json.dumps(m["attachment_details"]) if m["attachment_details"] else None,
            },
        )

    print(f"  ✓ {len(messages_data)} messages inserted")

    conn.execute(
        text("SELECT setval('messages_id_seq', GREATEST((SELECT MAX(id) FROM messages), 1))")
    )


# ═════════════════════════════════════════════════════════════════════════════
# 3. Message Stats (7일치)
# ═════════════════════════════════════════════════════════════════════════════
def seed_message_stats(conn):
    """7일치 일별 메시지 통계."""
    print("\n── Message Stats ──")

    now = datetime.now(timezone.utc)

    for day_offset in range(7):
        day = (now - timedelta(days=6 - day_offset)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        total = [12, 18, 8, 25, 15, 22, 10][day_offset]
        s2t = total // 2 + (day_offset % 3)
        t2s = total - s2t

        gateway_stats = {"slack→teams": s2t, "teams→slack": t2s}
        channel_stats = {
            "C0GENERAL01": total // 3,
            "C0DEVELOP01": total // 4,
            "C0ALERT001": total // 5,
            "C0RANDOM01": total - (total // 3 + total // 4 + total // 5),
        }
        hourly = {}
        for h in range(24):
            if 9 <= h <= 18:
                hourly[f"{h:02d}"] = max(1, total // 10)
            else:
                hourly[f"{h:02d}"] = 0

        import json

        conn.execute(
            text("""
                INSERT INTO message_stats (id, date, total_messages, gateway_stats, channel_stats, hourly_stats, updated_at)
                VALUES (:id, :date, :total, CAST(:gw AS jsonb), CAST(:ch AS jsonb), CAST(:hr AS jsonb), NOW())
                ON CONFLICT (id) DO NOTHING
            """),
            {
                "id": day_offset + 1,
                "date": day,
                "total": total,
                "gw": json.dumps(gateway_stats),
                "ch": json.dumps(channel_stats),
                "hr": json.dumps(hourly),
            },
        )

    conn.execute(
        text("SELECT setval('message_stats_id_seq', GREATEST((SELECT MAX(id) FROM message_stats), 1))")
    )
    print("  ✓ 7 days of stats inserted")


# ═════════════════════════════════════════════════════════════════════════════
# 4. Redis Routes (양방향 4개)
# ═════════════════════════════════════════════════════════════════════════════
async def seed_routes():
    """Redis에 4개 양방향 라우트 생성."""
    print("\n── Redis Routes ──")

    r = aioredis.from_url(REDIS_URL, decode_responses=True)

    routes = [
        {
            "src_platform": "slack",
            "src_channel": "C0GENERAL01",
            "src_name": "general",
            "dst_platform": "teams",
            "dst_channel": "t1:19:general@thread.tacv2",
            "dst_name": "General",
            "mode": "sender_info",
            "bidirectional": True,
            "enabled": True,
        },
        {
            "src_platform": "slack",
            "src_channel": "C0DEVELOP01",
            "src_name": "dev-team",
            "dst_platform": "teams",
            "dst_channel": "t1:19:dev-team@thread.tacv2",
            "dst_name": "Development",
            "mode": "sender_info",
            "bidirectional": True,
            "enabled": True,
        },
        {
            "src_platform": "slack",
            "src_channel": "C0ALERT001",
            "src_name": "alerts",
            "dst_platform": "teams",
            "dst_channel": "t1:19:alerts@thread.tacv2",
            "dst_name": "Alerts",
            "mode": "editable",
            "bidirectional": False,
            "enabled": True,
        },
        {
            "src_platform": "slack",
            "src_channel": "C0RANDOM01",
            "src_name": "random",
            "dst_platform": "teams",
            "dst_channel": "t1:19:random@thread.tacv2",
            "dst_name": "Random",
            "mode": "sender_info",
            "bidirectional": True,
            "enabled": False,
        },
    ]

    for rt in routes:
        prefix = "route:"
        key = f"{prefix}{rt['src_platform']}:{rt['src_channel']}"
        value = f"{rt['dst_platform']}:{rt['dst_channel']}"

        # 타겟 추가
        await r.sadd(key, value)
        # 이름 저장
        await r.hset(f"{key}:names", value, rt["dst_name"])
        await r.set(f"{key}:source_name", rt["src_name"])
        # 모드
        await r.hset(f"{key}:modes", value, rt["mode"])
        # 양방향 플래그
        await r.hset(f"{key}:bidirectional", value, "1" if rt["bidirectional"] else "0")
        # 활성 플래그
        await r.hset(f"{key}:enabled", value, "1" if rt["enabled"] else "0")

        direction = "↔" if rt["bidirectional"] else "→"
        status = "✓" if rt["enabled"] else "✗ (disabled)"
        print(f"  {status} {rt['src_name']} {direction} {rt['dst_name']}  [{rt['mode']}]")

        # 양방향 → 역방향도 추가
        if rt["bidirectional"]:
            rev_key = f"{prefix}{rt['dst_platform']}:{rt['dst_channel']}"
            rev_value = f"{rt['src_platform']}:{rt['src_channel']}"
            await r.sadd(rev_key, rev_value)
            await r.hset(f"{rev_key}:names", rev_value, rt["src_name"])
            await r.set(f"{rev_key}:source_name", rt["dst_name"])
            await r.hset(f"{rev_key}:modes", rev_value, rt["mode"])
            await r.hset(f"{rev_key}:bidirectional", rev_value, "1")
            await r.hset(f"{rev_key}:enabled", rev_value, "1" if rt["enabled"] else "0")

    await r.aclose()
    print(f"  ✓ {len(routes)} routes created")


# ═════════════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════════════
def main():
    print("=" * 60)
    print("v-channel-bridge 테스트 데이터 시드")
    print("=" * 60)

    with engine.connect() as conn:
        seed_accounts(conn)
        seed_messages(conn)
        seed_message_stats(conn)
        conn.commit()

    # Redis routes (async)
    asyncio.run(seed_routes())

    # ── 검증 ──
    print("\n── Verification ──")
    with engine.connect() as conn:
        for table in ["accounts", "messages", "message_stats"]:
            row = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
            print(f"  {table}: {row} rows")

    print("\n✅ 시드 완료!")


if __name__ == "__main__":
    main()
