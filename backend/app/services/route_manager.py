"""
Route Manager: Redis 기반 동적 라우팅 엔진

재시작 없이 실시간으로 라우팅 룰을 추가/제거/조회할 수 있습니다.

예시:
    - Slack #general → Teams General
    - Slack #dev → Teams Development
    - Teams Engineering → Slack #engineering

작성일: 2026-03-31
"""

import structlog
from typing import List, Optional, Dict, Any
import redis.asyncio as aioredis

from app.schemas.common_message import Channel, Platform

logger = structlog.get_logger()


class RouteManager:
    """
    Redis 기반 동적 라우팅 관리자

    설정 변경 시 즉시 반영되며, 서버 재시작이 필요 없습니다.
    """

    def __init__(self, redis_client: aioredis.Redis):
        """
        RouteManager 초기화

        Args:
            redis_client: Redis 클라이언트 인스턴스
        """
        self.redis = redis_client
        self.route_prefix = "route:"

        logger.info("RouteManager initialized")

    def _make_route_key(self, source_platform: str, source_channel: str) -> str:
        """
        라우팅 룰 Redis 키 생성

        Args:
            source_platform: 소스 플랫폼 (예: "slack")
            source_channel: 소스 채널 ID (예: "C789012")

        Returns:
            Redis 키 (예: "route:slack:C789012")
        """
        return f"{self.route_prefix}{source_platform}:{source_channel}"

    def _make_target_value(self, target_platform: str, target_channel: str) -> str:
        """
        타겟 채널 값 생성

        Args:
            target_platform: 타겟 플랫폼 (예: "teams")
            target_channel: 타겟 채널 ID (예: "channel-456")

        Returns:
            타겟 값 (예: "teams:channel-456")
        """
        return f"{target_platform}:{target_channel}"

    def _parse_target(self, target_value: str) -> Optional[tuple[str, str]]:
        """
        타겟 값 파싱

        Args:
            target_value: 타겟 값 (예: "teams:channel-456")

        Returns:
            (platform, channel_id) 튜플 또는 None
        """
        try:
            parts = target_value.split(":", 1)
            if len(parts) != 2:
                return None
            return (parts[0], parts[1])
        except Exception as e:
            logger.error(
                "Error parsing target value", target_value=target_value, error=str(e)
            )
            return None

    async def add_route(
        self,
        source_platform: str,
        source_channel: str,
        target_platform: str,
        target_channel: str,
        target_channel_name: Optional[str] = None,
        source_channel_name: Optional[str] = None,
        message_mode: Optional[str] = "sender_info",
        is_bidirectional: bool = True,  # 기본값: 양방향
        is_enabled: bool = True,  # 기본값: 활성
    ) -> bool:
        """
        라우팅 룰 추가

        Args:
            source_platform: 소스 플랫폼
            source_channel: 소스 채널 ID
            target_platform: 타겟 플랫폼
            target_channel: 타겟 채널 ID
            target_channel_name: 타겟 채널 이름 (선택)
            source_channel_name: 소스 채널 이름 (선택)
            message_mode: 메시지 모드 ("sender_info" or "editable")
            is_bidirectional: 양방향 라우트 여부 (기본값: True)

        Returns:
            추가 성공 여부

        Example:
            ```python
            await route_manager.add_route(
                source_platform="slack",
                source_channel="C789012",
                target_platform="teams",
                target_channel="channel-456",
                target_channel_name="General",
                source_channel_name="general",
                is_bidirectional=True
            )
            ```
        """
        try:
            key = self._make_route_key(source_platform, source_channel)
            value = self._make_target_value(target_platform, target_channel)

            # 중복 확인: 이미 동일한 route가 존재하면 False 반환
            existing = await self.redis.sismember(key, value)
            if existing:
                logger.info(
                    "Route already exists — skipped",
                    source_platform=source_platform,
                    source_channel=source_channel,
                    target_platform=target_platform,
                    target_channel=target_channel,
                )
                return False

            # Redis Set에 추가
            result = await self.redis.sadd(key, value)

            # 타겟 채널 이름 저장 (선택적)
            if target_channel_name and target_channel_name.strip():
                name_key = f"{key}:names"
                await self.redis.hset(name_key, value, target_channel_name)

            # 소스 채널 이름 저장 (선택적)
            if source_channel_name and source_channel_name.strip():
                source_name_key = f"{key}:source_name"
                await self.redis.set(source_name_key, source_channel_name)

            # 메시지 모드 저장 (선택적)
            if message_mode:
                mode_key = f"{key}:modes"
                await self.redis.hset(mode_key, value, message_mode)

            # 양방향 플래그 저장
            bidirectional_key = f"{key}:bidirectional"
            await self.redis.hset(
                bidirectional_key, value, "1" if is_bidirectional else "0"
            )

            # 활성/비활성 플래그 저장
            enabled_key = f"{key}:enabled"
            await self.redis.hset(enabled_key, value, "1" if is_enabled else "0")

            # 양방향이면 역방향 라우트도 자동 추가
            if is_bidirectional:
                reverse_key = self._make_route_key(target_platform, target_channel)
                reverse_value = self._make_target_value(source_platform, source_channel)
                await self.redis.sadd(reverse_key, reverse_value)

                # 역방향 이름 저장
                if source_channel_name and source_channel_name.strip():
                    reverse_name_key = f"{reverse_key}:names"
                    await self.redis.hset(
                        reverse_name_key, reverse_value, source_channel_name
                    )

                if target_channel_name and target_channel_name.strip():
                    reverse_source_name_key = f"{reverse_key}:source_name"
                    await self.redis.set(reverse_source_name_key, target_channel_name)

                # 역방향 메시지 모드 저장
                if message_mode:
                    reverse_mode_key = f"{reverse_key}:modes"
                    await self.redis.hset(reverse_mode_key, reverse_value, message_mode)

                # 역방향도 양방향 플래그 저장
                reverse_bidirectional_key = f"{reverse_key}:bidirectional"
                await self.redis.hset(reverse_bidirectional_key, reverse_value, "1")

                # 역방향도 활성/비활성 플래그 저장
                reverse_enabled_key = f"{reverse_key}:enabled"
                await self.redis.hset(
                    reverse_enabled_key, reverse_value, "1" if is_enabled else "0"
                )

                logger.debug(
                    "Reverse route added",
                    source_platform=target_platform,
                    source_channel=target_channel,
                    target_platform=source_platform,
                    target_channel=source_channel,
                )

            logger.info(
                "Route added",
                source_platform=source_platform,
                source_channel=source_channel,
                target_platform=target_platform,
                target_channel=target_channel,
                is_bidirectional=is_bidirectional,
                added=result > 0,
            )

            return True

        except Exception as e:
            logger.error(
                "Error adding route",
                source_platform=source_platform,
                source_channel=source_channel,
                target_platform=target_platform,
                target_channel=target_channel,
                error=str(e),
            )
            return False

    async def _remove_single_direction(
        self,
        source_platform: str,
        source_channel: str,
        target_platform: str,
        target_channel: str,
    ) -> bool:
        """단방향 라우트 하나를 Redis에서 제거 (메타데이터 포함)"""
        key = self._make_route_key(source_platform, source_channel)
        value = self._make_target_value(target_platform, target_channel)

        result = await self.redis.srem(key, value)

        # 타겟 관련 메타데이터 제거
        for suffix in (":names", ":modes", ":bidirectional", ":enabled"):
            await self.redis.hdel(f"{key}{suffix}", value)

        # 마지막 타겟이 제거된 경우 소스 메타데이터 전체 삭제
        remaining = await self.redis.smembers(key)
        if not remaining:
            await self.redis.delete(f"{key}:source_name")

        return result > 0

    async def remove_route(
        self,
        source_platform: str,
        source_channel: str,
        target_platform: str,
        target_channel: str,
    ) -> bool:
        """
        라우팅 룰 제거

        양방향 라우트인 경우 역방향도 함께 제거합니다.

        Args:
            source_platform: 소스 플랫폼
            source_channel: 소스 채널 ID
            target_platform: 타겟 플랫폼
            target_channel: 타겟 채널 ID

        Returns:
            제거 성공 여부
        """
        try:
            key = self._make_route_key(source_platform, source_channel)
            value = self._make_target_value(target_platform, target_channel)

            # 양방향 여부 확인 (제거 전에 먼저 조회)
            bidirectional_key = f"{key}:bidirectional"
            is_bidirectional = (await self.redis.hget(bidirectional_key, value)) == "1"

            # 정방향 제거
            result = await self._remove_single_direction(
                source_platform, source_channel, target_platform, target_channel
            )

            # 양방향이면 역방향도 제거
            if is_bidirectional:
                await self._remove_single_direction(
                    target_platform, target_channel, source_platform, source_channel
                )
                logger.debug(
                    "Reverse route removed",
                    source_platform=target_platform,
                    source_channel=target_channel,
                    target_platform=source_platform,
                    target_channel=source_channel,
                )

            logger.info(
                "Route removed",
                source_platform=source_platform,
                source_channel=source_channel,
                target_platform=target_platform,
                target_channel=target_channel,
                is_bidirectional=is_bidirectional,
                removed=result,
            )

            return result

        except Exception as e:
            logger.error(
                "Error removing route",
                source_platform=source_platform,
                source_channel=source_channel,
                target_platform=target_platform,
                target_channel=target_channel,
                error=str(e),
            )
            return False

    async def _get_all_targets(
        self, source_platform: str, source_channel: str
    ) -> List[Channel]:
        """모든 타겟 조회 (활성/비활성 구분 없이) - 관리 UI용"""
        try:
            key = self._make_route_key(source_platform, source_channel)
            name_key = f"{key}:names"

            target_values = await self.redis.smembers(key)
            if not target_values:
                return []

            names = await self.redis.hgetall(name_key)

            channels = []
            for target_value in target_values:
                parsed = self._parse_target(target_value)
                if not parsed:
                    continue

                platform_str, channel_id = parsed

                try:
                    platform = Platform(platform_str)
                except ValueError:
                    continue

                channel_name = names.get(target_value, channel_id)
                channel = Channel(id=channel_id, name=channel_name, platform=platform)
                channels.append(channel)

            return channels

        except Exception as e:
            logger.error(
                "Error getting all targets",
                source_platform=source_platform,
                source_channel=source_channel,
                error=str(e),
            )
            return []

    async def get_targets(
        self, source_platform: str, source_channel: str
    ) -> List[Channel]:
        """
        소스 채널의 타겟 채널 목록 조회

        Args:
            source_platform: 소스 플랫폼
            source_channel: 소스 채널 ID

        Returns:
            Channel 객체 리스트
        """
        try:
            key = self._make_route_key(source_platform, source_channel)
            name_key = f"{key}:names"
            enabled_key = f"{key}:enabled"

            # Redis Set에서 타겟 목록 조회
            target_values = await self.redis.smembers(key)

            if not target_values:
                return []

            # 채널 이름 및 활성 상태 조회 (한 번에)
            names = await self.redis.hgetall(name_key)
            enabled_flags = await self.redis.hgetall(enabled_key)

            # Channel 객체 리스트 생성 (비활성 라우트 제외)
            channels = []
            for target_value in target_values:
                # 비활성 라우트 필터링 (기본값: 활성)
                if enabled_flags.get(target_value, "1") == "0":
                    continue

                parsed = self._parse_target(target_value)
                if not parsed:
                    continue

                platform_str, channel_id = parsed

                try:
                    platform = Platform(platform_str)
                except ValueError:
                    logger.warning("Invalid platform in route", platform=platform_str)
                    continue

                # 채널 이름 조회
                channel_name = names.get(target_value, channel_id)

                channel = Channel(id=channel_id, name=channel_name, platform=platform)
                channels.append(channel)

            return channels

        except Exception as e:
            logger.error(
                "Error getting targets",
                source_platform=source_platform,
                source_channel=source_channel,
                error=str(e),
            )
            return []

    async def get_message_mode(
        self,
        source_platform: str,
        source_channel: str,
        target_platform: str,
        target_channel: str,
    ) -> str:
        """
        특정 라우트의 메시지 모드 조회

        Args:
            source_platform: 소스 플랫폼
            source_channel: 소스 채널 ID
            target_platform: 타겟 플랫폼
            target_channel: 타겟 채널 ID

        Returns:
            message_mode ("sender_info" or "editable"), 기본값: "sender_info"
        """
        try:
            key = self._make_route_key(source_platform, source_channel)
            mode_key = f"{key}:modes"
            target_value = self._make_target_value(target_platform, target_channel)

            # Redis Hash에서 메시지 모드 조회
            message_mode = await self.redis.hget(mode_key, target_value)

            # 기본값 반환
            return message_mode if message_mode else "sender_info"

        except Exception as e:
            logger.error(
                "Error getting message mode",
                source_platform=source_platform,
                source_channel=source_channel,
                target_platform=target_platform,
                target_channel=target_channel,
                error=str(e),
            )
            return "sender_info"

    async def toggle_route_enabled(
        self,
        source_platform: str,
        source_channel: str,
        target_platform: str,
        target_channel: str,
        is_enabled: bool,
    ) -> bool:
        """
        라우트 활성/비활성 토글

        양방향 라우트인 경우 역방향도 함께 토글합니다.

        Args:
            source_platform: 소스 플랫폼
            source_channel: 소스 채널 ID
            target_platform: 타겟 플랫폼
            target_channel: 타겟 채널 ID
            is_enabled: 활성 여부

        Returns:
            토글 성공 여부
        """
        try:
            key = self._make_route_key(source_platform, source_channel)
            value = self._make_target_value(target_platform, target_channel)
            enabled_val = "1" if is_enabled else "0"

            # 정방향 활성/비활성 설정
            enabled_key = f"{key}:enabled"
            await self.redis.hset(enabled_key, value, enabled_val)

            # 양방향이면 역방향도 함께 토글
            bidirectional_key = f"{key}:bidirectional"
            is_bidirectional = (await self.redis.hget(bidirectional_key, value)) == "1"

            if is_bidirectional:
                reverse_key = self._make_route_key(target_platform, target_channel)
                reverse_value = self._make_target_value(source_platform, source_channel)
                reverse_enabled_key = f"{reverse_key}:enabled"
                await self.redis.hset(reverse_enabled_key, reverse_value, enabled_val)

            logger.info(
                "Route enabled toggled",
                source_platform=source_platform,
                source_channel=source_channel,
                target_platform=target_platform,
                target_channel=target_channel,
                is_enabled=is_enabled,
                is_bidirectional=is_bidirectional,
            )

            return True

        except Exception as e:
            logger.error(
                "Error toggling route enabled",
                source_platform=source_platform,
                source_channel=source_channel,
                target_platform=target_platform,
                target_channel=target_channel,
                error=str(e),
            )
            return False

    async def get_all_routes(self) -> List[Dict[str, Any]]:
        """
        모든 라우팅 룰 조회

        Returns:
            라우팅 룰 리스트
        """
        try:
            # 모든 route: 키 조회
            pattern = f"{self.route_prefix}*"
            keys = []

            # SCAN으로 키 조회 (대량의 키가 있을 경우 안전)
            cursor = 0
            while True:
                cursor, batch = await self.redis.scan(
                    cursor=cursor, match=pattern, count=100
                )
                # 메타데이터 키(:names, :source_name, :modes, :bidirectional, :enabled) 제외
                keys.extend(
                    [
                        k
                        for k in batch
                        if not k.endswith(":names")
                        and not k.endswith(":source_name")
                        and not k.endswith(":modes")
                        and not k.endswith(":bidirectional")
                        and not k.endswith(":enabled")
                    ]
                )

                if cursor == 0:
                    break

            # 각 키의 라우팅 정보 조회
            routes = []
            # 양방향 라우트 중복 방지: frozenset({source_id, target_id})로 추적
            seen_bidirectional_pairs: set = set()

            for key in keys:
                # 키 파싱: route:platform:channel_id
                parts = key.split(":", 2)
                if len(parts) != 3:
                    continue

                _, source_platform, source_channel = parts

                # 소스 채널 이름 조회
                source_name_key = f"{key}:source_name"
                source_channel_name = await self.redis.get(source_name_key)

                # 타겟 목록 조회 (활성/비활성 모두 포함)
                targets = await self._get_all_targets(source_platform, source_channel)

                if targets:
                    # message_mode 조회
                    mode_key = f"{key}:modes"
                    modes_dict = await self.redis.hgetall(mode_key)

                    # bidirectional 플래그 조회
                    bidirectional_key = f"{key}:bidirectional"
                    bidirectional_dict = await self.redis.hgetall(bidirectional_key)

                    # enabled 플래그 조회
                    enabled_key = f"{key}:enabled"
                    enabled_dict = await self.redis.hgetall(enabled_key)

                    # 각 source-target 쌍을 개별 Route로 생성
                    for t in targets:
                        target_value = self._make_target_value(t.platform.value, t.id)
                        message_mode = modes_dict.get(
                            target_value, "sender_info"
                        )  # 기본값
                        is_bidirectional = (
                            bidirectional_dict.get(target_value, "1") == "1"
                        )  # 기본값: True
                        is_enabled = (
                            enabled_dict.get(target_value, "1") == "1"
                        )  # 기본값: 활성

                        # 양방향 역방향은 숨김 (A↔B를 1개로 표시)
                        if is_bidirectional:
                            source_id = f"{source_platform}:{source_channel}"
                            target_id = f"{t.platform.value}:{t.id}"
                            pair = frozenset((source_id, target_id))
                            if pair in seen_bidirectional_pairs:
                                continue
                            seen_bidirectional_pairs.add(pair)

                        routes.append(
                            {
                                "source": {
                                    "platform": source_platform,
                                    "channel_id": source_channel,
                                    "channel_name": source_channel_name
                                    if source_channel_name
                                    else source_channel,
                                },
                                "targets": [
                                    {
                                        "platform": t.platform.value,
                                        "channel_id": t.id,
                                        "channel_name": t.name,
                                        "message_mode": message_mode,
                                        "is_bidirectional": is_bidirectional,
                                        "is_enabled": is_enabled,
                                    }
                                ],
                            }
                        )

            logger.info("Retrieved all routes", count=len(routes))

            return routes

        except Exception as e:
            logger.error("Error getting all routes", error=str(e))
            return []

    async def clear_routes(
        self,
        source_platform: Optional[str] = None,
        source_channel: Optional[str] = None,
    ) -> int:
        """
        라우팅 룰 삭제

        Args:
            source_platform: 삭제할 플랫폼 (None이면 전체)
            source_channel: 삭제할 채널 (None이면 해당 플랫폼 전체)

        Returns:
            삭제된 키 개수
        """
        try:
            if source_platform and source_channel:
                # 특정 채널의 라우팅 룰만 삭제
                key = self._make_route_key(source_platform, source_channel)
                name_key = f"{key}:names"

                deleted = await self.redis.delete(key, name_key)

                logger.info(
                    "Cleared specific route",
                    source_platform=source_platform,
                    source_channel=source_channel,
                    deleted=deleted,
                )

                return deleted

            elif source_platform:
                # 특정 플랫폼의 모든 라우팅 룰 삭제
                pattern = f"{self.route_prefix}{source_platform}:*"
            else:
                # 모든 라우팅 룰 삭제
                pattern = f"{self.route_prefix}*"

            # SCAN으로 키 조회 및 삭제
            cursor = 0
            deleted_count = 0

            while True:
                cursor, keys = await self.redis.scan(
                    cursor=cursor, match=pattern, count=100
                )

                if keys:
                    deleted = await self.redis.delete(*keys)
                    deleted_count += deleted

                if cursor == 0:
                    break

            logger.info(
                "Cleared routes", source_platform=source_platform, deleted=deleted_count
            )

            return deleted_count

        except Exception as e:
            logger.error(
                "Error clearing routes",
                source_platform=source_platform,
                source_channel=source_channel,
                error=str(e),
            )
            return 0

    async def save_thread_mapping(
        self,
        source_platform: str,
        source_channel: str,
        source_ts: str,
        target_platform: str,
        target_channel: str,
        target_ts: str,
        ttl_days: int = 7,
    ) -> bool:
        """
        스레드 메시지 ID 매핑 저장 (크로스 채널 스레드 지원)

        Args:
            source_platform: 소스 플랫폼 (예: "slack")
            source_channel: 소스 채널 ID
            source_ts: 소스 메시지 timestamp
            target_platform: 타겟 플랫폼
            target_channel: 타겟 채널 ID
            target_ts: 타겟 메시지 timestamp
            ttl_days: 매핑 유효 기간 (일)

        Returns:
            저장 성공 여부
        """
        try:
            key = f"thread:{source_platform}:{source_channel}:{source_ts}"
            value = f"{target_platform}:{target_channel}:{target_ts}"

            # 매핑 저장 (TTL 설정)
            await self.redis.setex(key, ttl_days * 86400, value)

            logger.debug(
                "Thread mapping saved",
                source=f"{source_platform}:{source_channel}:{source_ts}",
                target=value,
                ttl_days=ttl_days,
            )

            return True

        except Exception as e:
            logger.error(
                "Error saving thread mapping",
                source_platform=source_platform,
                source_channel=source_channel,
                source_ts=source_ts,
                error=str(e),
            )
            return False

    async def get_thread_mapping(
        self,
        source_platform: str,
        source_channel: str,
        source_ts: str,
    ) -> Optional[tuple[str, str, str]]:
        """
        스레드 메시지 ID 매핑 조회

        Args:
            source_platform: 소스 플랫폼
            source_channel: 소스 채널 ID
            source_ts: 소스 메시지 timestamp

        Returns:
            (target_platform, target_channel, target_ts) 튜플 또는 None
        """
        try:
            key = f"thread:{source_platform}:{source_channel}:{source_ts}"
            value = await self.redis.get(key)

            if not value:
                return None

            # "platform:channel:ts" 형식 파싱
            parts = value.split(":", 2)
            if len(parts) != 3:
                logger.warning(
                    "Invalid thread mapping format",
                    key=key,
                    value=value,
                )
                return None

            target_platform, target_channel, target_ts = parts

            logger.debug(
                "Thread mapping found",
                source=f"{source_platform}:{source_channel}:{source_ts}",
                target=value,
            )

            return (target_platform, target_channel, target_ts)

        except Exception as e:
            logger.error(
                "Error getting thread mapping",
                source_platform=source_platform,
                source_channel=source_channel,
                source_ts=source_ts,
                error=str(e),
            )
            return None
