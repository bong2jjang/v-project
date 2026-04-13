"""Teams Graph API Change Notifications 구독 관리

Teams 채널/채팅에 대한 Graph API 구독을 생성/갱신/삭제합니다.
라우팅된 Teams 채널에 대해서만 구독을 유지합니다.

Graph API 구독 제약:
- /teams/{teamId}/channels/{channelId}/messages: 최대 60분 수명 (팀 채널)
- /chats/{chatId}/messages: 최대 60분 수명 (DM/그룹 채팅)
- 갱신은 만료 전에 PATCH로 수행
- ChannelMessage.Read.All (Application) 권한 필요 (팀 채널)
- Chat.Read.All (Application) 권한 필요 (채팅)
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

import aiohttp
import structlog

logger = structlog.get_logger()

# 구독 갱신 주기: 50분 (최대 60분 수명에서 여유 10분)
_RENEWAL_INTERVAL_SEC = 50 * 60
# 구독 수명: 59분
_SUBSCRIPTION_LIFETIME_MIN = 59


class TeamsSubscriptionManager:
    """Graph API Change Notifications 구독 관리자

    브리지 시작 시 초기화되어, 라우팅된 Teams 채널에 대한 구독을
    생성하고 주기적으로 갱신합니다.
    """

    def __init__(self, teams_provider, route_manager, notification_url: str):
        """
        Args:
            teams_provider: TeamsProvider 인스턴스 (토큰 획득용)
            route_manager: RouteManager 인스턴스 (라우팅 채널 조회용)
            notification_url: Graph API가 알림을 보낼 HTTPS URL
        """
        self.teams_provider = teams_provider
        self.route_manager = route_manager
        self.notification_url = notification_url

        # subscription_id → {team_id, channel_id, expires_at}
        self._subscriptions: dict[str, dict] = {}
        # channel_key (teamId:channelId) → subscription_id
        self._channel_to_sub: dict[str, str] = {}

        self._renewal_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self):
        """구독 관리 시작: 서버 준비 후 초기 구독 생성 + 갱신 루프"""
        self._running = True
        logger.info(
            "TeamsSubscriptionManager starting",
            notification_url=self.notification_url,
        )

        # 갱신 루프 시작 (초기 구독은 서버 시작 후 지연 실행)
        self._renewal_task = asyncio.create_task(self._delayed_start())

    async def stop(self):
        """구독 관리 중지: 모든 구독 삭제"""
        self._running = False

        if self._renewal_task and not self._renewal_task.done():
            self._renewal_task.cancel()
            try:
                await self._renewal_task
            except asyncio.CancelledError:
                pass

        # 모든 구독 삭제
        for sub_id in list(self._subscriptions.keys()):
            await self._delete_subscription(sub_id)

        logger.info("TeamsSubscriptionManager stopped")

    async def _delayed_start(self):
        """서버가 완전히 시작된 후 초기 구독 생성 (10초 대기)"""
        try:
            await asyncio.sleep(10)
            if not self._running:
                return
            logger.info("Starting initial subscription sync")
            await self._sync_subscriptions()
            # 갱신 루프 진입
            await self._renewal_loop()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Delayed start error", error=str(e))

    async def _renewal_loop(self):
        """주기적으로 구독 갱신 및 동기화"""
        try:
            while self._running:
                await asyncio.sleep(_RENEWAL_INTERVAL_SEC)
                if not self._running:
                    break
                await self._sync_subscriptions()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Subscription renewal loop error", error=str(e))

    @staticmethod
    def _make_channel_key(team_id: str | None, channel_id: str) -> str:
        """채널/채팅을 고유 식별하는 키 생성

        팀 채널: "{team_id}:{channel_id}"
        채팅(DM): "chat:{channel_id}"
        """
        if team_id is None:
            return f"chat:{channel_id}"
        return f"{team_id}:{channel_id}"

    async def _sync_subscriptions(self):
        """라우팅된 Teams 채널/채팅과 구독 상태를 동기화

        1. 라우트에서 Teams 소스 채널 목록 조회
        2. 새 채널에 구독 생성, 기존 채널은 갱신, 불필요한 구독은 삭제
        """
        try:
            # 라우팅된 Teams 채널 조회
            routed_channels = await self._get_routed_teams_channels()

            if not routed_channels:
                logger.info(
                    "No routed Teams channels found, skipping subscription sync"
                )
                # 기존 구독 모두 삭제
                for sub_id in list(self._subscriptions.keys()):
                    await self._delete_subscription(sub_id)
                return

            routed_keys = set()
            for team_id, channel_id in routed_channels:
                channel_key = self._make_channel_key(team_id, channel_id)
                routed_keys.add(channel_key)

                if channel_key in self._channel_to_sub:
                    # 기존 구독 갱신
                    sub_id = self._channel_to_sub[channel_key]
                    await self._renew_subscription(sub_id)
                else:
                    # 새 구독 생성
                    await self._create_subscription(team_id, channel_id)

            # 라우트에서 제거된 채널의 구독 삭제
            for channel_key in list(self._channel_to_sub.keys()):
                if channel_key not in routed_keys:
                    sub_id = self._channel_to_sub[channel_key]
                    await self._delete_subscription(sub_id)

        except Exception as e:
            logger.error("Error syncing subscriptions", error=str(e))

    async def _get_routed_teams_channels(
        self,
    ) -> list[tuple[str | None, str]]:
        """라우팅 룰에서 Teams가 소스인 채널/채팅 목록 조회

        Returns:
            [(team_id, channel_id), ...] 리스트
            team_id가 None이면 DM/그룹 채팅
        """
        routes = await self.route_manager.get_all_routes()
        channels = []
        seen = set()

        for route in routes:
            source = route.get("source", {})
            source_platform = source.get("platform")
            source_channel = source.get("channel_id", "")
            targets = route.get("targets", [])

            # Teams 소스 채널: 활성(is_enabled=True) 타겟이 하나라도 있을 때만 구독
            if source_platform == "teams":
                has_enabled_target = any(t.get("is_enabled", True) for t in targets)
                if has_enabled_target:
                    team_id, channel_id = self.teams_provider._parse_channel_ref(
                        source_channel
                    )
                    if channel_id:
                        key = self._make_channel_key(team_id, channel_id)
                        if key not in seen:
                            seen.add(key)
                            channels.append((team_id, channel_id))

            # 양방향 라우트의 Teams 타겟도 소스가 됨 (해당 타겟이 활성일 때만)
            for target in targets:
                if (
                    target.get("platform") == "teams"
                    and target.get("is_bidirectional")
                    and target.get("is_enabled", True)
                ):
                    target_channel = target.get("channel_id", "")
                    team_id, channel_id = self.teams_provider._parse_channel_ref(
                        target_channel
                    )
                    if channel_id:
                        key = self._make_channel_key(team_id, channel_id)
                        if key not in seen:
                            seen.add(key)
                            channels.append((team_id, channel_id))

        logger.info(
            "Routed Teams channels found",
            count=len(channels),
            chat_count=sum(1 for t, _ in channels if t is None),
        )
        return channels

    async def _create_subscription(
        self, team_id: str | None, channel_id: str, *, _retries: int = 2
    ) -> bool:
        """특정 Teams 채널 또는 채팅에 대한 Graph API 구독 생성

        team_id가 None이면 채팅(/chats/{chatId}/messages),
        아니면 팀 채널(/teams/{teamId}/channels/{channelId}/messages).

        Validation timeout 시 최대 _retries회 재시도합니다.
        """
        try:
            token = await self.teams_provider._get_access_token()
        except Exception as e:
            logger.error("Failed to get token for subscription", error=str(e))
            return False

        is_chat = team_id is None
        expiration = datetime.now(timezone.utc) + timedelta(
            minutes=_SUBSCRIPTION_LIFETIME_MIN
        )

        if is_chat:
            resource = f"/chats/{channel_id}/messages"
            client_state = f"vms-channel-bridge-chat-{channel_id[:8]}"
        else:
            resource = f"/teams/{team_id}/channels/{channel_id}/messages"
            client_state = f"vms-channel-bridge-{team_id[:8]}"

        payload = {
            "changeType": "created,updated,deleted",
            "notificationUrl": self.notification_url,
            "resource": resource,
            "expirationDateTime": expiration.strftime("%Y-%m-%dT%H:%M:%S.0000000Z"),
            "clientState": client_state,
        }

        url = "https://graph.microsoft.com/v1.0/subscriptions"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        for attempt in range(_retries + 1):
            try:
                session = await self._get_session()
                async with session.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 201:
                        result = await resp.json()
                        sub_id = result["id"]
                        channel_key = self._make_channel_key(team_id, channel_id)

                        self._subscriptions[sub_id] = {
                            "team_id": team_id,
                            "channel_id": channel_id,
                            "is_chat": is_chat,
                            "expires_at": expiration,
                        }
                        self._channel_to_sub[channel_key] = sub_id

                        logger.info(
                            "Graph subscription created",
                            subscription_id=sub_id,
                            channel=channel_id[:30],
                            is_chat=is_chat,
                            resource=resource,
                            expires_at=expiration.isoformat(),
                            attempt=attempt + 1,
                        )
                        return True
                    else:
                        error_text = await resp.text()
                        is_validation_timeout = "validation" in error_text.lower() and (
                            "timed out" in error_text.lower()
                            or "timeout" in error_text.lower()
                        )

                        if is_validation_timeout and attempt < _retries:
                            logger.warning(
                                "Subscription validation timed out, retrying",
                                channel=channel_id[:30],
                                is_chat=is_chat,
                                attempt=attempt + 1,
                                max_retries=_retries,
                            )
                            # 만료 시간 갱신 (재시도 시 새로운 만료 시간 사용)
                            expiration = datetime.now(timezone.utc) + timedelta(
                                minutes=_SUBSCRIPTION_LIFETIME_MIN
                            )
                            payload["expirationDateTime"] = expiration.strftime(
                                "%Y-%m-%dT%H:%M:%S.0000000Z"
                            )
                            await asyncio.sleep(3)
                            continue

                        logger.error(
                            "Failed to create Graph subscription",
                            status=resp.status,
                            error=error_text[:500],
                            channel=channel_id[:30],
                            is_chat=is_chat,
                            attempt=attempt + 1,
                        )
                        return False

            except Exception as e:
                if attempt < _retries:
                    logger.warning(
                        "Error creating subscription, retrying",
                        error=str(e),
                        attempt=attempt + 1,
                    )
                    await asyncio.sleep(3)
                    continue
                logger.error("Error creating Graph subscription", error=str(e))
                return False

        return False

    async def _renew_subscription(self, subscription_id: str) -> bool:
        """기존 구독 갱신 (만료 시간 연장)"""
        sub_info = self._subscriptions.get(subscription_id)
        if not sub_info:
            return False

        try:
            token = await self.teams_provider._get_access_token()
        except Exception:
            return False

        expiration = datetime.now(timezone.utc) + timedelta(
            minutes=_SUBSCRIPTION_LIFETIME_MIN
        )

        url = f"https://graph.microsoft.com/v1.0/subscriptions/{subscription_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {
            "expirationDateTime": expiration.strftime("%Y-%m-%dT%H:%M:%S.0000000Z"),
        }

        try:
            session = await self._get_session()
            async with session.patch(
                url,
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 200:
                    sub_info["expires_at"] = expiration
                    logger.debug(
                        "Graph subscription renewed",
                        subscription_id=subscription_id,
                        expires_at=expiration.isoformat(),
                    )
                    return True
                elif resp.status == 404:
                    # 구독이 이미 만료/삭제됨 → 재생성
                    logger.warning(
                        "Subscription not found, recreating",
                        subscription_id=subscription_id,
                    )
                    channel_key = self._make_channel_key(
                        sub_info["team_id"], sub_info["channel_id"]
                    )
                    del self._subscriptions[subscription_id]
                    self._channel_to_sub.pop(channel_key, None)
                    return await self._create_subscription(
                        sub_info["team_id"], sub_info["channel_id"]
                    )
                else:
                    error_text = await resp.text()
                    logger.warning(
                        "Failed to renew subscription",
                        status=resp.status,
                        error=error_text[:200],
                    )
                    return False

        except Exception as e:
            logger.warning("Error renewing subscription", error=str(e))
            return False

    async def _delete_subscription(self, subscription_id: str):
        """구독 삭제"""
        sub_info = self._subscriptions.pop(subscription_id, None)
        if sub_info:
            channel_key = self._make_channel_key(
                sub_info["team_id"], sub_info["channel_id"]
            )
            self._channel_to_sub.pop(channel_key, None)

        try:
            token = await self.teams_provider._get_access_token()
            url = f"https://graph.microsoft.com/v1.0/subscriptions/{subscription_id}"
            headers = {"Authorization": f"Bearer {token}"}

            session = await self._get_session()
            async with session.delete(
                url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status in (200, 204, 404):
                    logger.info(
                        "Graph subscription deleted",
                        subscription_id=subscription_id,
                    )
                else:
                    logger.warning("Failed to delete subscription", status=resp.status)

        except Exception as e:
            logger.warning("Error deleting subscription", error=str(e))

    async def _get_session(self) -> aiohttp.ClientSession:
        """TeamsProvider의 aiohttp 세션 재사용"""
        if not self.teams_provider.session:
            self.teams_provider.session = aiohttp.ClientSession()
        return self.teams_provider.session


# 싱글톤
_subscription_manager: Optional[TeamsSubscriptionManager] = None


def get_subscription_manager() -> Optional[TeamsSubscriptionManager]:
    return _subscription_manager


def set_subscription_manager(mgr: Optional[TeamsSubscriptionManager]):
    global _subscription_manager
    _subscription_manager = mgr
