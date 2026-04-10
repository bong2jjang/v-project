"""
Message Service

메시지 저장, 조회, 검색 기능
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy import or_, and_, func, desc, asc
from sqlalchemy.orm import Session
import os
import random
import logging

from app.models.message import Message
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)

# Cache TTL 설정
FILTER_OPTIONS_CACHE_TTL = 300  # 5 minutes in seconds
STATS_CACHE_TTL = 60  # 1 minute in seconds


class MessageService:
    """메시지 서비스"""

    @staticmethod
    def create_message(
        db: Session,
        text: str,
        gateway: str,
        source_account: str,
        source_channel: str,
        destination_account: str,
        destination_channel: str,
        source_user: Optional[str] = None,
        message_id: Optional[str] = None,
        protocol: Optional[str] = None,
        timestamp: Optional[datetime] = None,
        **kwargs,
    ) -> Message:
        """
        메시지 생성

        Args:
            db: 데이터베이스 세션
            text: 메시지 텍스트
            gateway: Gateway 이름
            source_account: 소스 계정
            source_channel: 소스 채널
            destination_account: 목적지 계정
            destination_channel: 목적지 채널
            source_user: 소스 사용자 (optional)
            message_id: 메시지 ID (optional)
            protocol: 프로토콜 (optional)
            timestamp: 타임스탬프 (optional, default: now)

        Returns:
            생성된 Message 객체
        """
        message = Message(
            text=text,
            gateway=gateway,
            source_account=source_account,
            source_channel=source_channel,
            destination_account=destination_account,
            destination_channel=destination_channel,
            source_user=source_user,
            message_id=message_id,
            protocol=protocol,
            timestamp=timestamp or datetime.now(timezone.utc),
            **kwargs,
        )

        db.add(message)
        db.commit()
        db.refresh(message)

        logger.info(f"Message created: {message.id}")

        # WebSocket 브로드캐스트 (비동기로 실행)
        from app.services.event_broadcaster import broadcaster

        if broadcaster:
            import asyncio

            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            asyncio.create_task(
                broadcaster.broadcast_message_created(message.to_dict())
            )

        return message

    @staticmethod
    def get_message(db: Session, message_id: int) -> Optional[Message]:
        """ID로 메시지 조회"""
        return db.query(Message).filter(Message.id == message_id).first()

    @staticmethod
    def search_messages(
        db: Session,
        q: Optional[str] = None,
        gateway: Optional[str | List[str]] = None,
        route: Optional[str] = None,
        channel: Optional[str | List[str]] = None,
        src_channel: Optional[List[str]] = None,
        dst_channel: Optional[List[str]] = None,
        user: Optional[str] = None,
        status: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        page: int = 1,
        per_page: int = 50,
        sort: str = "timestamp_desc",
    ) -> Dict[str, Any]:
        """
        메시지 검색

        Args:
            db: 데이터베이스 세션
            q: 검색 쿼리 (텍스트)
            gateway: Gateway 필터 (단일 값 또는 리스트)
            channel: 채널 필터 (단일 값 또는 리스트)
            user: 사용자 필터
            from_date: 시작 날짜
            to_date: 종료 날짜
            page: 페이지 번호 (1부터 시작)
            per_page: 페이지당 항목 수
            sort: 정렬 방식 (timestamp_asc, timestamp_desc)

        Returns:
            {
                "messages": [...],
                "total": int,
                "page": int,
                "per_page": int,
                "total_pages": int
            }
        """
        # Base query
        query = db.query(Message)

        # Text search
        if q:
            query = query.filter(Message.text.contains(q))

        # Gateway filter (supports list)
        if gateway:
            if isinstance(gateway, list) and len(gateway) > 0:
                query = query.filter(Message.gateway.in_(gateway))
            elif isinstance(gateway, str):
                query = query.filter(Message.gateway == gateway)

        # Route filter: "src→dst" → filter by source_account + destination_account
        if route:
            sep = "→"
            if sep in route:
                src, dst = route.split(sep, 1)
                query = query.filter(
                    Message.source_account == src.strip(),
                    Message.destination_account == dst.strip(),
                )

        # Channel filter (source or destination, supports list) — legacy
        if channel:
            if isinstance(channel, list) and len(channel) > 0:
                query = query.filter(
                    or_(
                        Message.source_channel.in_(channel),
                        Message.destination_channel.in_(channel),
                    )
                )
            elif isinstance(channel, str):
                query = query.filter(
                    or_(
                        Message.source_channel == channel,
                        Message.destination_channel == channel,
                    )
                )

        # Source channel filter
        if src_channel and len(src_channel) > 0:
            query = query.filter(Message.source_channel.in_(src_channel))

        # Destination channel filter
        if dst_channel and len(dst_channel) > 0:
            query = query.filter(Message.destination_channel.in_(dst_channel))

        # User filter
        if user:
            query = query.filter(Message.source_user == user)

        # Status filter
        if status:
            query = query.filter(Message.status == status)

        # Date range
        if from_date:
            query = query.filter(Message.timestamp >= from_date)
        if to_date:
            query = query.filter(Message.timestamp <= to_date)

        # Total count
        total = query.count()

        # Sorting
        if sort == "timestamp_asc":
            query = query.order_by(asc(Message.timestamp))
        else:  # timestamp_desc (default)
            query = query.order_by(desc(Message.timestamp))

        # Pagination
        offset = (page - 1) * per_page
        messages = query.limit(per_page).offset(offset).all()

        total_pages = (total + per_page - 1) // per_page

        return {
            "messages": [msg.to_dict() for msg in messages],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
        }

    @staticmethod
    def get_stats(
        db: Session,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        메시지 통계 조회 (1분 캐싱 적용)

        Args:
            db: 데이터베이스 세션
            from_date: 시작 날짜
            to_date: 종료 날짜

        Returns:
            {
                "total_messages": int,
                "by_gateway": {...},
                "by_channel": {...},
                "by_hour": {...},
                "by_day": {...}
            }
        """
        # Create cache key from date parameters
        cache_key = f"stats:{from_date}_{to_date}"

        # Try to get from Redis cache
        cached_stats = cache_service.get(cache_key)
        if cached_stats is not None:
            logger.info(f"Returning cached stats from Redis for key: {cache_key}")
            return cached_stats

        logger.info(f"Computing stats for key: {cache_key}")

        # Base query
        query = db.query(Message)

        # Date range
        if from_date:
            query = query.filter(Message.timestamp >= from_date)
        if to_date:
            query = query.filter(Message.timestamp <= to_date)

        # Total messages
        total_messages = query.count()

        # By gateway
        gateway_stats = {}
        for gateway, count in (
            db.query(Message.gateway, func.count(Message.id))
            .filter(
                and_(
                    Message.timestamp >= from_date if from_date else True,
                    Message.timestamp <= to_date if to_date else True,
                )
            )
            .group_by(Message.gateway)
            .all()
        ):
            gateway_stats[gateway] = count

        # By channel (source channels only)
        channel_stats = {}
        for channel, count in (
            db.query(Message.source_channel, func.count(Message.id))
            .filter(
                and_(
                    Message.timestamp >= from_date if from_date else True,
                    Message.timestamp <= to_date if to_date else True,
                )
            )
            .group_by(Message.source_channel)
            .all()
        ):
            channel_stats[channel] = count

        # By hour (0-23) - optimized with SQL aggregation
        hourly_stats = {str(i).zfill(2): 0 for i in range(24)}
        try:
            # Use SQL HOUR function for database-level aggregation
            from sqlalchemy import extract

            hourly_results = (
                db.query(
                    extract("hour", Message.timestamp).label("hour"),
                    func.count(Message.id),
                )
                .filter(
                    and_(
                        Message.timestamp >= from_date if from_date else True,
                        Message.timestamp <= to_date if to_date else True,
                    )
                )
                .group_by(extract("hour", Message.timestamp))
                .all()
            )
            for hour, count in hourly_results:
                if hour is not None:
                    hourly_stats[str(int(hour)).zfill(2)] = count
        except Exception:
            # Fallback to in-memory aggregation if extract doesn't work
            for msg in query.all():
                hour = msg.timestamp.hour
                hourly_stats[str(hour).zfill(2)] += 1

        # By day - optimized with SQL aggregation
        daily_stats = {}
        try:
            from sqlalchemy import cast, Date

            daily_results = (
                db.query(
                    cast(Message.timestamp, Date).label("date"),
                    func.count(Message.id),
                )
                .filter(
                    and_(
                        Message.timestamp >= from_date if from_date else True,
                        Message.timestamp <= to_date if to_date else True,
                    )
                )
                .group_by(cast(Message.timestamp, Date))
                .all()
            )
            for date, count in daily_results:
                if date is not None:
                    daily_stats[date.isoformat()] = count
        except Exception:
            # Fallback to in-memory aggregation
            for msg in query.all():
                date = msg.timestamp.date().isoformat()
                daily_stats[date] = daily_stats.get(date, 0) + 1

        # By status (sent / failed / pending / retrying)
        status_stats: Dict[str, int] = {}
        for status, count in (
            db.query(Message.status, func.count(Message.id))
            .filter(
                and_(
                    Message.timestamp >= from_date if from_date else True,
                    Message.timestamp <= to_date if to_date else True,
                )
            )
            .group_by(Message.status)
            .all()
        ):
            if status:
                status_stats[status] = count

        # By source platform (slack / teams)
        platform_stats: Dict[str, int] = {}
        for platform, count in (
            db.query(Message.source_account, func.count(Message.id))
            .filter(
                and_(
                    Message.timestamp >= from_date if from_date else True,
                    Message.timestamp <= to_date if to_date else True,
                )
            )
            .group_by(Message.source_account)
            .all()
        ):
            if platform:
                platform_stats[platform] = count

        # By direction (source_account → destination_account)
        direction_stats: Dict[str, int] = {}
        for src, dst, count in (
            db.query(
                Message.source_account,
                Message.destination_account,
                func.count(Message.id),
            )
            .filter(
                and_(
                    Message.timestamp >= from_date if from_date else True,
                    Message.timestamp <= to_date if to_date else True,
                )
            )
            .group_by(Message.source_account, Message.destination_account)
            .all()
        ):
            if src and dst:
                direction_stats[f"{src}→{dst}"] = count

        # With attachment count
        with_attachment = (
            db.query(func.count(Message.id))
            .filter(
                and_(
                    Message.has_attachment.is_(True),
                    Message.timestamp >= from_date if from_date else True,
                    Message.timestamp <= to_date if to_date else True,
                )
            )
            .scalar()
            or 0
        )

        # Delivery success rate: sent / (sent + failed) * 100
        sent = status_stats.get("sent", 0)
        failed = status_stats.get("failed", 0)
        success_rate = (
            round(sent / (sent + failed) * 100, 1) if (sent + failed) > 0 else None
        )

        # Prepare result
        result = {
            "total_messages": total_messages,
            "by_gateway": gateway_stats,
            "by_channel": channel_stats,
            "by_hour": hourly_stats,
            "by_day": daily_stats,
            "by_status": status_stats,
            "by_platform": platform_stats,
            "by_direction": direction_stats,
            "with_attachment": with_attachment,
            "success_rate": success_rate,
        }

        # Cache the result in Redis
        cache_service.set(cache_key, result, ttl=STATS_CACHE_TTL)
        logger.info(f"Cached stats in Redis for key: {cache_key}")

        return result

    @staticmethod
    def get_filter_options(db: Session) -> Dict[str, List[str]]:
        """
        필터 옵션 조회 (고급 필터링용)

        5분 캐싱 적용

        Args:
            db: 데이터베이스 세션

        Returns:
            {
                "gateways": [...],
                "channels": [...],
                "users": [...]
            }
        """
        # Try to get from Redis cache
        cache_key = "filter_options"
        cached_options = cache_service.get(cache_key)
        if cached_options is not None:
            logger.info("Returning cached filter options from Redis")
            return cached_options

        # Cache miss or expired - fetch from DB
        # Get unique gateways
        gateways = [
            row[0] for row in db.query(Message.gateway).distinct().all() if row[0]
        ]

        # Get unique channels with names — source and destination separately
        src_ch_rows = (
            db.query(Message.source_channel, Message.source_channel_name)
            .distinct(Message.source_channel)
            .all()
        )
        dst_ch_rows = (
            db.query(Message.destination_channel, Message.destination_channel_name)
            .distinct(Message.destination_channel)
            .all()
        )
        src_channel_labels: dict[str, str] = {}
        dst_channel_labels: dict[str, str] = {}
        src_channel_ids: list[str] = []
        dst_channel_ids: list[str] = []
        for ch_id, ch_name in src_ch_rows:
            if ch_id:
                src_channel_ids.append(ch_id)
                if ch_name and ch_name != ch_id:
                    src_channel_labels[ch_id] = ch_name
        for ch_id, ch_name in dst_ch_rows:
            if ch_id:
                dst_channel_ids.append(ch_id)
                if ch_name and ch_name != ch_id:
                    dst_channel_labels[ch_id] = ch_name
        src_channels = sorted(src_channel_ids)
        dst_channels = sorted(dst_channel_ids)
        # legacy combined list
        channel_id_set: set[str] = set(src_channel_ids) | set(dst_channel_ids)
        channel_labels = {**src_channel_labels, **dst_channel_labels}
        channels = sorted(channel_id_set)

        # Get unique users (with display names)
        user_rows = (
            db.query(
                Message.source_user,
                Message.source_user_display_name,
                Message.source_user_name,
            )
            .filter(Message.source_user.isnot(None))
            .distinct(Message.source_user)
            .all()
        )
        users = []
        user_labels: dict[str, str] = {}
        for user_id, display_name, user_name in user_rows:
            if user_id:
                users.append(user_id)
                label = display_name or user_name or user_id
                user_labels[user_id] = label

        # Slack API로 최신 프로필 조회 → "DisplayName(RealName)" 형태 레이블 생성
        slack_token = os.environ.get("SLACK_BOT_TOKEN")
        if slack_token and users:
            try:
                from slack_sdk import WebClient

                slack_client = WebClient(token=slack_token)
                for user_id in users:
                    try:
                        resp = slack_client.users_info(user=user_id)
                        if resp.get("ok"):
                            profile = resp["user"]["profile"]
                            display = profile.get("display_name") or ""
                            real = (
                                profile.get("real_name")
                                or resp["user"].get("real_name")
                                or ""
                            )
                            if display and real and display != real:
                                user_labels[user_id] = f"{display}({real})"
                            elif display:
                                user_labels[user_id] = display
                            elif real:
                                user_labels[user_id] = real
                    except Exception:
                        pass  # DB에 저장된 레이블 유지
            except Exception:
                pass  # slack_sdk 없거나 토큰 오류 시 DB 레이블 사용

        # Get distinct route pairs (source_account → destination_account)
        route_rows = (
            db.query(Message.source_account, Message.destination_account)
            .distinct()
            .all()
        )
        routes = sorted({f"{src}→{dst}" for src, dst in route_rows if src and dst})

        result = {
            "gateways": sorted(gateways),
            "channels": channels,
            "channel_labels": channel_labels,
            "src_channels": src_channels,
            "src_channel_labels": src_channel_labels,
            "dst_channels": dst_channels,
            "dst_channel_labels": dst_channel_labels,
            "users": sorted(users),
            "user_labels": user_labels,
            "routes": routes,
        }

        # Cache the result in Redis
        cache_service.set(cache_key, result, ttl=FILTER_OPTIONS_CACHE_TTL)
        logger.info("Cached filter options in Redis")

        return result

    @staticmethod
    def generate_test_data(db: Session, count: int = 100):
        """
        테스트 데이터 생성 (구분 가능한 정보 포함)

        Args:
            db: 데이터베이스 세션
            count: 생성할 메시지 수
        """
        # Slack 채널 (# 접두사)
        slack_channels = [
            "#general",
            "#random",
            "#dev-team",
            "#support",
            "#sales",
            "#marketing",
            "#announcements",
            "#watercooler",
        ]

        # Teams 채널 (일반 이름)
        teams_channels = [
            "General",
            "Random",
            "Development",
            "Customer Support",
            "Sales Team",
            "Marketing",
            "Company Announcements",
            "Social",
        ]

        users = [
            "김철수",
            "이영희",
            "박민수",
            "정수진",
            "최동욱",
            "alice",
            "bob",
            "charlie",
            "dave",
            "eve",
            "john.doe",
            "jane.smith",
            "mike.wilson",
        ]

        # 구분 가능한 메시지 템플릿 (번호 포함)
        messages_templates = [
            "[테스트] 안녕하세요! #{i}번 메시지입니다.",
            "[TEST] Good morning team - Message #{i}",
            "회의 알림: 오후 3시 #{i}번째 미팅",
            "[Action Required] PR #{i} 리뷰 요청드립니다",
            "업데이트 #{i}: 작업이 완료되었습니다",
            "[Discuss] 내일 논의할 항목 #{i}",
            "프로젝트 #{i} 진행 상황 공유",
            "[Help] #{i}번 이슈에 대한 도움이 필요합니다",
            "점심시간 공지 #{i}",
            "[Success] 배포 완료 - Build #{i}",
            "버그 수정: 이슈 #{i} 해결됨",
            "[Update] #{i}번째 주간 보고",
        ]

        for i in range(count):
            user = random.choice(users)

            # Slack -> Teams 또는 Teams -> Slack 방향 결정
            direction = random.choice(["slack_to_teams", "teams_to_slack"])

            if direction == "slack_to_teams":
                protocol = "slack"
                source_account = "slack"
                destination_account = "teams"
                source_channel = random.choice(slack_channels)
                dest_channel = random.choice(teams_channels)
            else:
                protocol = "teams"
                source_account = "teams"
                destination_account = "slack"
                source_channel = random.choice(teams_channels)
                dest_channel = random.choice(slack_channels)

            # gateway: 실제 브리지와 동일하게 "source→destination" 형식
            gateway = f"{source_account}→{destination_account}"

            # 메시지 텍스트에 번호 포함하여 구분 가능하게
            template = random.choice(messages_templates)
            text = template.replace("#{i}", str(i + 1))

            # Random timestamp (last 7 days for easier testing)
            timestamp = datetime.now(timezone.utc) - timedelta(
                days=random.randint(0, 7),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
                seconds=random.randint(0, 59),
            )

            # 채널 이름: Slack은 '#' 제거, Teams는 그대로 사용
            src_channel_name = source_channel.lstrip("#")
            dst_channel_name = dest_channel

            message = Message(
                text=text,
                gateway=gateway,
                source_account=source_account,
                source_channel=source_channel,
                source_channel_name=src_channel_name,
                destination_account=destination_account,
                destination_channel=dest_channel,
                destination_channel_name=dst_channel_name,
                source_user=user,
                protocol=protocol,
                timestamp=timestamp,
            )

            db.add(message)

        db.commit()
        logger.info(f"Generated {count} test messages with identifiable information")

    @staticmethod
    def delete_message(db: Session, message_id: int) -> bool:
        """
        메시지 삭제

        Args:
            db: 데이터베이스 세션
            message_id: 삭제할 메시지 ID

        Returns:
            삭제 성공 여부
        """
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            return False

        db.delete(message)
        db.commit()
        logger.info(f"Deleted message: {message_id}")

        # 캐시 무효화
        cache_service.delete("filter_options")

        return True

    @staticmethod
    def delete_all_messages(db: Session) -> int:
        """
        모든 메시지 삭제

        Args:
            db: 데이터베이스 세션

        Returns:
            삭제된 메시지 수
        """
        count = db.query(Message).count()
        db.query(Message).delete()
        db.commit()
        logger.info(f"Deleted all {count} messages")

        # 캐시 무효화
        cache_service.delete("filter_options")

        return count

    @staticmethod
    def delete_messages_by_filters(
        db: Session,
        gateway: Optional[str | List[str]] = None,
        channel: Optional[str | List[str]] = None,
        user: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> int:
        """
        조건에 맞는 메시지 삭제

        Args:
            db: 데이터베이스 세션
            gateway: Gateway 필터
            channel: 채널 필터
            user: 사용자 필터
            from_date: 시작 날짜
            to_date: 종료 날짜

        Returns:
            삭제된 메시지 수
        """
        # Base query
        query = db.query(Message)

        # Gateway filter
        if gateway:
            if isinstance(gateway, list) and len(gateway) > 0:
                query = query.filter(Message.gateway.in_(gateway))
            elif isinstance(gateway, str):
                query = query.filter(Message.gateway == gateway)

        # Channel filter (source or destination)
        if channel:
            if isinstance(channel, list) and len(channel) > 0:
                query = query.filter(
                    or_(
                        Message.source_channel.in_(channel),
                        Message.destination_channel.in_(channel),
                    )
                )
            elif isinstance(channel, str):
                query = query.filter(
                    or_(
                        Message.source_channel == channel,
                        Message.destination_channel == channel,
                    )
                )

        # User filter
        if user:
            query = query.filter(Message.source_user == user)

        # Date range
        if from_date:
            query = query.filter(Message.timestamp >= from_date)
        if to_date:
            query = query.filter(Message.timestamp <= to_date)

        # Count before delete
        count = query.count()

        # Delete
        query.delete(synchronize_session=False)
        db.commit()

        logger.info(
            f"Deleted {count} messages with filters: "
            f"gateway={gateway}, channel={channel}, user={user}, "
            f"from_date={from_date}, to_date={to_date}"
        )

        # 캐시 무효화
        cache_service.delete("filter_options")

        return count

    @staticmethod
    def count_messages_by_filters(
        db: Session,
        gateway: Optional[str | List[str]] = None,
        channel: Optional[str | List[str]] = None,
        user: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> int:
        """
        조건에 맞는 메시지 수 조회 (삭제 전 미리보기)

        Args:
            db: 데이터베이스 세션
            gateway: Gateway 필터
            channel: 채널 필터
            user: 사용자 필터
            from_date: 시작 날짜
            to_date: 종료 날짜

        Returns:
            조건에 맞는 메시지 수
        """
        # Base query
        query = db.query(Message)

        # Gateway filter
        if gateway:
            if isinstance(gateway, list) and len(gateway) > 0:
                query = query.filter(Message.gateway.in_(gateway))
            elif isinstance(gateway, str):
                query = query.filter(Message.gateway == gateway)

        # Channel filter
        if channel:
            if isinstance(channel, list) and len(channel) > 0:
                query = query.filter(
                    or_(
                        Message.source_channel.in_(channel),
                        Message.destination_channel.in_(channel),
                    )
                )
            elif isinstance(channel, str):
                query = query.filter(
                    or_(
                        Message.source_channel == channel,
                        Message.destination_channel == channel,
                    )
                )

        # User filter
        if user:
            query = query.filter(Message.source_user == user)

        # Date range
        if from_date:
            query = query.filter(Message.timestamp >= from_date)
        if to_date:
            query = query.filter(Message.timestamp <= to_date)

        return query.count()


# Global instance
message_service = MessageService()
