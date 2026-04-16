"""v-channel-bridge 테스트 데이터 시드 스크립트.

현재 DB/Redis에 저장된 실제 데이터(계정/라우트)를 기준으로 테스트용
메시지 히스토리와 일별 통계만 재생성합니다.

- 계정(accounts): 그대로 보존 (실제 slack-default / teams-default 사용)
- 라우트(Redis route:*): 그대로 보존 (실 운영 채널 라우트)
- 메시지(messages): 기존 시드 데이터 삭제 후 재생성 (오늘 기준 7일치)
- 통계(message_stats): 기존 시드 데이터 삭제 후 재생성 (오늘 기준 7일치)

컨테이너 내에서 실행:
  docker exec v-project-bridge-backend python seed_bridge_data.py
"""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, text

import redis.asyncio as aioredis

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://vmsuser:vmspassword@postgres:5432/v_project"
)
REDIS_URL = os.getenv("REDIS_URL", "redis://:redispassword@redis:6379/0")

engine = create_engine(DATABASE_URL)


# ═════════════════════════════════════════════════════════════════════════════
# 실 데이터 조회 (계정 + 라우트)
# ═════════════════════════════════════════════════════════════════════════════
def load_accounts(conn) -> dict[str, dict]:
    """DB에서 현재 활성 계정 로드. platform → {id, name} 매핑."""
    rows = conn.execute(
        text(
            "SELECT id, platform, name FROM accounts "
            "WHERE enabled = TRUE AND is_valid = TRUE ORDER BY id"
        )
    ).fetchall()

    mapping: dict[str, dict] = {}
    for row in rows:
        if row.platform not in mapping:
            mapping[row.platform] = {"id": row.id, "name": row.name}

    return mapping


async def load_routes() -> list[dict]:
    """Redis에서 현재 라우트 로드. 양방향 쌍은 한 번만 반환."""
    r = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        seen: set[frozenset[str]] = set()
        routes: list[dict] = []

        keys = [k async for k in r.scan_iter(match="route:*")]
        base_keys = [
            k
            for k in keys
            if not any(
                k.endswith(suffix)
                for suffix in (
                    ":names",
                    ":modes",
                    ":bidirectional",
                    ":enabled",
                    ":source_name",
                )
            )
        ]

        for base_key in base_keys:
            # base_key 형식: route:{platform}:{channel_id}
            _, src_platform, src_channel = base_key.split(":", 2)
            targets = await r.smembers(base_key)
            names = await r.hgetall(f"{base_key}:names")
            modes = await r.hgetall(f"{base_key}:modes")
            bids = await r.hgetall(f"{base_key}:bidirectional")
            enableds = await r.hgetall(f"{base_key}:enabled")
            src_name = await r.get(f"{base_key}:source_name") or src_channel

            for target in targets:
                dst_platform, dst_channel = target.split(":", 1)
                dst_name = names.get(target, dst_channel)
                is_bi = bids.get(target) == "1"
                is_enabled = enableds.get(target, "1") == "1"

                pair_key = frozenset([f"{src_platform}:{src_channel}", target])
                if is_bi and pair_key in seen:
                    continue
                seen.add(pair_key)

                routes.append(
                    {
                        "src_platform": src_platform,
                        "src_channel": src_channel,
                        "src_name": src_name,
                        "dst_platform": dst_platform,
                        "dst_channel": dst_channel,
                        "dst_name": dst_name,
                        "mode": modes.get(target, "sender_info"),
                        "bidirectional": is_bi,
                        "enabled": is_enabled,
                    }
                )

        return routes
    finally:
        await r.aclose()


# ═════════════════════════════════════════════════════════════════════════════
# 메시지 생성 (실 채널/계정 기반, 오늘 기준 7일치)
# ═════════════════════════════════════════════════════════════════════════════
def seed_messages(conn, accounts: dict[str, dict], routes: list[dict]):
    """실 라우트 기반 메시지 히스토리 생성 (40건)."""
    print("\n── Messages ──")

    # 기존 테스트 데이터 제거 (재실행 안전)
    conn.execute(text("DELETE FROM messages"))
    conn.execute(text("ALTER SEQUENCE messages_id_seq RESTART WITH 1"))

    if not routes:
        print("  ⚠ 라우트가 없어 메시지 시드를 건너뜁니다.")
        return

    # 양방향 라우트 선호; 없으면 첫 번째 라우트
    primary = next((r for r in routes if r["bidirectional"]), routes[0])

    slack_side = {
        "platform": primary["src_platform"]
        if primary["src_platform"] == "slack"
        else primary["dst_platform"],
        "channel": primary["src_channel"]
        if primary["src_platform"] == "slack"
        else primary["dst_channel"],
        "name": primary["src_name"]
        if primary["src_platform"] == "slack"
        else primary["dst_name"],
    }
    teams_side = {
        "platform": primary["src_platform"]
        if primary["src_platform"] == "teams"
        else primary["dst_platform"],
        "channel": primary["src_channel"]
        if primary["src_platform"] == "teams"
        else primary["dst_channel"],
        "name": primary["src_name"]
        if primary["src_platform"] == "teams"
        else primary["dst_name"],
    }

    slack_acct = accounts.get("slack", {}).get("name", "slack")
    teams_acct = accounts.get("teams", {}).get("name", "teams")

    print(f"  ▸ Slack: {slack_acct} @ {slack_side['channel']} ({slack_side['name']})")
    print(f"  ▸ Teams: {teams_acct} @ {teams_side['channel']} ({teams_side['name']})")

    now = datetime.now(timezone.utc)

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

    messages_data: list[dict] = []
    msg_id = 1

    # ── slack → teams (15건) ──
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
        ts = now - timedelta(days=6 - (i // 3), hours=9 + (i % 8), minutes=i * 7)
        status = "sent" if i != 5 else "failed"
        error_msg = "Teams API timeout (503)" if status == "failed" else None
        retry = 3 if status == "failed" else 0
        delivered = ts + timedelta(seconds=2) if status == "sent" else None

        messages_data.append(
            {
                "id": msg_id,
                "message_id": str(int(ts.timestamp() * 1000)),
                "text": txt,
                "gateway": "slack→teams",
                "source_account": slack_acct,
                "source_channel": slack_side["channel"],
                "source_user": user[0],
                "destination_account": teams_acct,
                "destination_channel": teams_side["channel"],
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
                "source_channel_name": slack_side["name"],
                "destination_channel_name": teams_side["name"],
            }
        )
        msg_id += 1

    # ── teams → slack (15건) ──
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
        ts = now - timedelta(days=6 - (i // 3), hours=8 + (i % 8), minutes=i * 7 + 15)
        delivered = ts + timedelta(seconds=1)

        messages_data.append(
            {
                "id": msg_id,
                "message_id": str(int(ts.timestamp() * 1000)),
                "text": txt,
                "gateway": "teams→slack",
                "source_account": teams_acct,
                "source_channel": teams_side["channel"],
                "source_user": user[0],
                "destination_account": slack_acct,
                "destination_channel": slack_side["channel"],
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
                "source_channel_name": teams_side["name"],
                "destination_channel_name": slack_side["name"],
            }
        )
        msg_id += 1

    # ── 첨부파일 포함 (5건) ──
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
        [
            {"name": "error.log", "size": 52000, "type": "text/plain"},
            {"name": "stacktrace.txt", "size": 8900, "type": "text/plain"},
        ],
        [
            {
                "name": "meeting_notes.docx",
                "size": 45000,
                "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            }
        ],
        [{"name": "api_spec.yaml", "size": 32000, "type": "application/yaml"}],
    ]
    for i, txt in enumerate(attach_texts):
        user = slack_users[i % 4]
        ts = now - timedelta(days=3 - i if i < 3 else 0, hours=14, minutes=30 + i * 10)
        details = attach_details[i]
        messages_data.append(
            {
                "id": msg_id,
                "message_id": str(int(ts.timestamp() * 1000)),
                "text": txt,
                "gateway": "slack→teams",
                "source_account": slack_acct,
                "source_channel": slack_side["channel"],
                "source_user": user[0],
                "destination_account": teams_acct,
                "destination_channel": teams_side["channel"],
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
                "source_channel_name": slack_side["name"],
                "destination_channel_name": teams_side["name"],
            }
        )
        msg_id += 1

    # ── 재시도/실패 (5건) ──
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
        messages_data.append(
            {
                "id": msg_id,
                "message_id": str(int(ts.timestamp() * 1000)),
                "text": txt,
                "gateway": "slack→teams",
                "source_account": slack_acct,
                "source_channel": slack_side["channel"],
                "source_user": user[0],
                "destination_account": teams_acct,
                "destination_channel": teams_side["channel"],
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
                "source_channel_name": slack_side["name"],
                "destination_channel_name": teams_side["name"],
            }
        )
        msg_id += 1

    for m in messages_data:
        conn.execute(
            text(
                """
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
            """
            ),
            {
                **m,
                "attachment_details_json": json.dumps(m["attachment_details"])
                if m["attachment_details"]
                else None,
            },
        )

    conn.execute(
        text(
            "SELECT setval('messages_id_seq', "
            "GREATEST((SELECT MAX(id) FROM messages), 1))"
        )
    )
    print(f"  ✓ {len(messages_data)}건 메시지 생성 (기준일: {now.date()})")


# ═════════════════════════════════════════════════════════════════════════════
# 일별 통계 (오늘 기준 7일치)
# ═════════════════════════════════════════════════════════════════════════════
def seed_message_stats(conn, routes: list[dict]):
    """7일치 일별 메시지 통계 (실 라우트 채널 기반)."""
    print("\n── Message Stats ──")

    conn.execute(text("DELETE FROM message_stats"))
    conn.execute(text("ALTER SEQUENCE message_stats_id_seq RESTART WITH 1"))

    if not routes:
        print("  ⚠ 라우트가 없어 통계 시드를 건너뜁니다.")
        return

    primary = next((r for r in routes if r["bidirectional"]), routes[0])
    slack_channel = (
        primary["src_channel"]
        if primary["src_platform"] == "slack"
        else primary["dst_channel"]
    )
    teams_channel = (
        primary["src_channel"]
        if primary["src_platform"] == "teams"
        else primary["dst_channel"]
    )

    now = datetime.now(timezone.utc)
    daily_totals = [12, 18, 8, 25, 15, 22, 10]  # 과거 → 오늘

    for day_offset in range(7):
        day = (now - timedelta(days=6 - day_offset)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        total = daily_totals[day_offset]
        s2t = total // 2 + (day_offset % 3)
        t2s = total - s2t

        gateway_stats = {"slack→teams": s2t, "teams→slack": t2s}
        channel_stats = {
            slack_channel: s2t,
            teams_channel: t2s,
        }
        hourly = {}
        for h in range(24):
            if 9 <= h <= 18:
                hourly[f"{h:02d}"] = max(1, total // 10)
            else:
                hourly[f"{h:02d}"] = 0

        conn.execute(
            text(
                """
                INSERT INTO message_stats
                    (id, date, total_messages, gateway_stats, channel_stats, hourly_stats, updated_at)
                VALUES
                    (:id, :date, :total, CAST(:gw AS jsonb), CAST(:ch AS jsonb), CAST(:hr AS jsonb), NOW())
            """
            ),
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
        text(
            "SELECT setval('message_stats_id_seq', "
            "GREATEST((SELECT MAX(id) FROM message_stats), 1))"
        )
    )
    print(f"  ✓ 7일치 통계 생성 ({(now - timedelta(days=6)).date()} ~ {now.date()})")


# ═════════════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════════════
def main():
    print("=" * 60)
    print("v-channel-bridge 시드 재생성 (실 데이터 기반)")
    print("=" * 60)

    # 1) 실 데이터 로드
    with engine.connect() as conn:
        accounts = load_accounts(conn)

    routes = asyncio.run(load_routes())

    print("\n── Loaded Accounts ──")
    if not accounts:
        print("  ⚠ 활성 계정 없음")
    for platform, acct in accounts.items():
        print(f"  ▸ {platform}: #{acct['id']} {acct['name']}")

    print("\n── Loaded Routes ──")
    if not routes:
        print("  ⚠ 라우트 없음")
    for rt in routes:
        direction = "↔" if rt["bidirectional"] else "→"
        status = "✓" if rt["enabled"] else "✗"
        print(
            f"  {status} {rt['src_name']} ({rt['src_platform']}) {direction} "
            f"{rt['dst_name']} ({rt['dst_platform']})  [{rt['mode']}]"
        )

    # 2) 시드 재생성 (messages + message_stats만)
    with engine.connect() as conn:
        seed_messages(conn, accounts, routes)
        seed_message_stats(conn, routes)
        conn.commit()

    # 3) 검증
    print("\n── Verification ──")
    with engine.connect() as conn:
        for table in ["accounts", "messages", "message_stats"]:
            row = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
            print(f"  {table}: {row} rows")

    print("\n✅ 시드 재생성 완료 (계정/라우트는 보존)")


if __name__ == "__main__":
    main()
