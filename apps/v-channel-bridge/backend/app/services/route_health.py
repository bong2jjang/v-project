"""
Route Health Check 서비스

Route별 메시지 전송 상태를 사전 진단하고, 문제 발견 시
자동/수동 조치를 지원하는 기능.

설계 문서: docusaurus/docs/apps/v-channel-bridge/design/ROUTE_HEALTH_CHECK.md
"""

import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

import structlog
from sqlalchemy import func, case

from app.db.database import SessionLocal
from app.models.message import Message

logger = structlog.get_logger()


# ── 데이터 모델 ──────────────────────────────────────────


class CheckStatus(str, Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"


class OverallStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


@dataclass
class HealthCheck:
    name: str
    status: CheckStatus
    detail: str


@dataclass
class RouteHealth:
    route_id: str
    overall: OverallStatus
    checked_at: str
    checks: list[HealthCheck] = field(default_factory=list)
    latency_ms: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "route_id": self.route_id,
            "overall": self.overall.value,
            "checked_at": self.checked_at,
            "latency_ms": self.latency_ms,
            "checks": [
                {"name": c.name, "status": c.status.value, "detail": c.detail}
                for c in self.checks
            ],
        }


# ── RouteHealthChecker ───────────────────────────────────


class RouteHealthChecker:
    """Route별 상태 진단 서비스"""

    def __init__(self, bridge):
        """
        Args:
            bridge: WebSocketBridge 인스턴스
        """
        self.bridge = bridge

    async def check_route(
        self,
        source_platform: str,
        source_channel: str,
        target_platform: str,
        target_channel: str,
    ) -> RouteHealth:
        """개별 Route의 전체 health를 진단한다."""
        start = time.monotonic()
        route_id = (
            f"{source_platform}:{source_channel}→{target_platform}:{target_channel}"
        )
        checks: list[HealthCheck] = []

        # 1. Source Provider 연결 상태
        checks.append(self._check_provider(source_platform, "source"))

        # 2. Source Receiver 태스크 실행 여부
        checks.append(self._check_receiver(source_platform, "source"))

        # 3. Target Provider 연결 상태
        checks.append(self._check_provider(target_platform, "target"))

        # 4. Source 채널 접근 가능 여부
        checks.append(
            await self._check_channel_access(source_platform, source_channel, "source")
        )

        # 5. Target 채널 접근 가능 여부
        checks.append(
            await self._check_channel_access(target_platform, target_channel, "target")
        )

        # 6. Route enabled 상태
        checks.append(
            await self._check_route_enabled(
                source_platform, source_channel, target_platform, target_channel
            )
        )

        # 7. 최근 전송 이력
        checks.append(
            await self._check_recent_delivery(
                source_platform, source_channel, target_platform, target_channel
            )
        )

        # overall 판정
        has_fail = any(c.status == CheckStatus.FAIL for c in checks)
        has_warn = any(c.status == CheckStatus.WARN for c in checks)

        if has_fail:
            overall = OverallStatus.UNHEALTHY
        elif has_warn:
            overall = OverallStatus.DEGRADED
        else:
            overall = OverallStatus.HEALTHY

        elapsed = int((time.monotonic() - start) * 1000)
        return RouteHealth(
            route_id=route_id,
            overall=overall,
            checked_at=datetime.now(timezone.utc).isoformat(),
            checks=checks,
            latency_ms=elapsed,
        )

    # ── 개별 체크 ────────────────────────────────────────

    def _check_provider(self, platform: str, role: str) -> HealthCheck:
        """Provider 연결 상태 확인"""
        provider = self.bridge.providers.get(platform)
        name = f"{role}_provider_connected"

        if provider is None:
            return HealthCheck(
                name=name,
                status=CheckStatus.FAIL,
                detail=f"No {platform} provider registered",
            )

        if not provider.is_connected:
            return HealthCheck(
                name=name,
                status=CheckStatus.FAIL,
                detail=f"{platform} provider disconnected"
                + (f": {provider.last_error}" if provider.last_error else ""),
            )

        return HealthCheck(
            name=name,
            status=CheckStatus.PASS,
            detail=f"{platform} provider connected",
        )

    def _check_receiver(self, platform: str, role: str) -> HealthCheck:
        """Receiver 태스크 실행 여부 확인"""
        name = f"{role}_receiver_running"
        task = self.bridge._receiver_tasks.get(platform)

        if task is None:
            return HealthCheck(
                name=name,
                status=CheckStatus.FAIL,
                detail=f"No receiver task for {platform}",
            )

        if task.done():
            exc = None
            if not task.cancelled():
                try:
                    exc = task.exception()
                except Exception:
                    pass
            return HealthCheck(
                name=name,
                status=CheckStatus.FAIL,
                detail=f"Receiver task ended: {exc or 'cancelled'}",
            )

        return HealthCheck(
            name=name,
            status=CheckStatus.PASS,
            detail=f"{platform} receiver task active",
        )

    async def _check_channel_access(
        self, platform: str, channel_id: str, role: str
    ) -> HealthCheck:
        """채널 접근 가능 여부 확인"""
        name = f"{role}_channel_accessible"
        provider = self.bridge.providers.get(platform)

        if not provider or not provider.is_connected:
            return HealthCheck(
                name=name,
                status=CheckStatus.FAIL,
                detail=f"Cannot check — {platform} provider unavailable",
            )

        try:
            channels = await provider.get_channels()
            for ch in channels:
                if ch.id == channel_id:
                    label = ch.name or channel_id
                    return HealthCheck(
                        name=name,
                        status=CheckStatus.PASS,
                        detail=f"Channel {label} ({channel_id}) accessible",
                    )

            return HealthCheck(
                name=name,
                status=CheckStatus.FAIL,
                detail=f"Channel {channel_id} not found or bot removed",
            )
        except Exception as e:
            return HealthCheck(
                name=name,
                status=CheckStatus.FAIL,
                detail=f"Channel check error: {e}",
            )

    async def _check_route_enabled(
        self,
        source_platform: str,
        source_channel: str,
        target_platform: str,
        target_channel: str,
    ) -> HealthCheck:
        """Route enabled 상태 확인"""
        rm = self.bridge.route_manager
        key = rm._make_route_key(source_platform, source_channel)
        enabled_key = f"{key}:enabled"
        target_value = rm._make_target_value(target_platform, target_channel)

        try:
            flags = await rm.redis.hgetall(enabled_key)
            flag = flags.get(target_value, "1")

            if flag == "0":
                return HealthCheck(
                    name="route_enabled",
                    status=CheckStatus.FAIL,
                    detail="Route is disabled",
                )

            return HealthCheck(
                name="route_enabled",
                status=CheckStatus.PASS,
                detail="Route enabled",
            )
        except Exception as e:
            return HealthCheck(
                name="route_enabled",
                status=CheckStatus.WARN,
                detail=f"Could not check enabled status: {e}",
            )

    async def _check_recent_delivery(
        self,
        source_platform: str,
        source_channel: str,
        target_platform: str,
        target_channel: str,
    ) -> HealthCheck:
        """최근 전송 이력 확인 (DB 조회)"""
        name = "recent_delivery"
        try:
            since = datetime.now(timezone.utc) - timedelta(hours=24)
            gateway = f"{source_platform}→{target_platform}"

            db = SessionLocal()
            try:
                row = (
                    db.query(
                        func.count(Message.id).label("total"),
                        func.sum(
                            case(
                                (Message.status.in_(["sent", "partial_success"]), 1),
                                else_=0,
                            )
                        ).label("success"),
                        func.sum(case((Message.status == "failed", 1), else_=0)).label(
                            "failed"
                        ),
                    )
                    .filter(
                        Message.gateway == gateway,
                        Message.source_channel == source_channel,
                        Message.destination_channel == target_channel,
                        Message.created_at >= since,
                    )
                    .one()
                )

                total = row.total or 0
                success = int(row.success or 0)
                failed = int(row.failed or 0)

                if total == 0:
                    return HealthCheck(
                        name=name,
                        status=CheckStatus.WARN,
                        detail="No messages in last 24h (may be normal if channel is quiet)",
                    )

                rate = (success / total) * 100 if total > 0 else 0

                if failed > 0 and rate < 80:
                    return HealthCheck(
                        name=name,
                        status=CheckStatus.FAIL,
                        detail=f"Delivery rate {rate:.0f}% ({success}/{total}) — {failed} failures in 24h",
                    )
                elif failed > 0:
                    return HealthCheck(
                        name=name,
                        status=CheckStatus.WARN,
                        detail=f"Delivery rate {rate:.0f}% ({success}/{total}) — {failed} failures in 24h",
                    )
                else:
                    return HealthCheck(
                        name=name,
                        status=CheckStatus.PASS,
                        detail=f"Delivery rate {rate:.0f}% ({success}/{total} in 24h)",
                    )
            finally:
                db.close()

        except Exception as e:
            logger.warning("Recent delivery check failed", error=str(e))
            return HealthCheck(
                name=name,
                status=CheckStatus.WARN,
                detail=f"Could not query delivery stats: {e}",
            )

    # ── 전체 Route 일괄 체크 ─────────────────────────────

    async def check_all_routes(self) -> list[RouteHealth]:
        """모든 Route의 health를 일괄 진단"""
        routes = await self.bridge.route_manager.get_all_routes()
        results: list[RouteHealth] = []

        for route in routes:
            source = route["source"]
            for target in route["targets"]:
                health = await self.check_route(
                    source_platform=source["platform"],
                    source_channel=source["channel_id"],
                    target_platform=target["platform"],
                    target_channel=target["channel_id"],
                )
                results.append(health)

        return results


# ── RouteHealthMonitor (백그라운드) ──────────────────────


class RouteHealthMonitor:
    """백그라운드에서 Route 상태를 주기적으로 체크하고 자동 복구를 시도"""

    INTERVAL = 300  # 5분
    FAILURE_THRESHOLD = 3  # 연속 3회 실패 시 route 비활성화

    def __init__(self, bridge):
        self.bridge = bridge
        self.checker = RouteHealthChecker(bridge)
        self._failure_counts: dict[str, int] = {}
        self._last_results: dict[str, RouteHealth] = {}
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self):
        """모니터 시작"""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info("RouteHealthMonitor started", interval=self.INTERVAL)

    async def stop(self):
        """모니터 중지"""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        logger.info("RouteHealthMonitor stopped")

    def get_last_results(self) -> dict[str, dict]:
        """마지막 체크 결과 반환"""
        return {k: v.to_dict() for k, v in self._last_results.items()}

    async def _run(self):
        """메인 루프"""
        # 첫 체크 전 30초 대기 (서비스 초기화 시간)
        await asyncio.sleep(30)

        while self._running:
            try:
                await self._check_cycle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Health monitor cycle error", error=str(e))

            await asyncio.sleep(self.INTERVAL)

    async def _check_cycle(self):
        """한 사이클: 모든 route 체크 + 자동 복구"""
        results = await self.checker.check_all_routes()

        for health in results:
            route_key = health.route_id
            self._last_results[route_key] = health

            if health.overall == OverallStatus.UNHEALTHY:
                self._failure_counts[route_key] = (
                    self._failure_counts.get(route_key, 0) + 1
                )
                count = self._failure_counts[route_key]
                logger.warning(
                    "Route unhealthy",
                    route=route_key,
                    consecutive_failures=count,
                    checks=[
                        c.to_dict()
                        if hasattr(c, "to_dict")
                        else {
                            "name": c.name,
                            "status": c.status.value,
                            "detail": c.detail,
                        }
                        for c in health.checks
                        if c.status != CheckStatus.PASS
                    ],
                )
                await self._try_auto_heal(health, count)
            else:
                if route_key in self._failure_counts:
                    old = self._failure_counts.pop(route_key)
                    if old > 0:
                        logger.info(
                            "Route recovered", route=route_key, after_failures=old
                        )

    async def _try_auto_heal(self, health: RouteHealth, failure_count: int):
        """자동 복구 시도"""
        for check in health.checks:
            if check.status != CheckStatus.FAIL:
                continue

            # Provider 재연결 (연속 2회 이상)
            if "provider_connected" in check.name and failure_count >= 2:
                platform = check.name.split("_")[0]
                if platform in ("source", "target"):
                    # route_id에서 실제 platform 이름 추출
                    parts = health.route_id.split("→")
                    if platform == "source":
                        actual_platform = parts[0].split(":")[0]
                    else:
                        actual_platform = (
                            parts[1].split(":")[0] if len(parts) > 1 else None
                        )

                    if actual_platform:
                        await self._reconnect_provider(actual_platform)

            # Receiver 태스크 재시작 (즉시)
            if "receiver_running" in check.name:
                parts = health.route_id.split("→")
                if "source" in check.name:
                    actual_platform = parts[0].split(":")[0]
                else:
                    actual_platform = parts[1].split(":")[0] if len(parts) > 1 else None

                if actual_platform:
                    await self._restart_receiver(actual_platform)

            # Route 자동 비활성화 (연속 FAILURE_THRESHOLD회 이상, 채널 관련 오류)
            if (
                "channel_accessible" in check.name
                and failure_count >= self.FAILURE_THRESHOLD
            ):
                await self._disable_route(health.route_id)

    async def _reconnect_provider(self, platform: str):
        """Provider 재연결 시도"""
        provider = self.bridge.providers.get(platform)
        if not provider:
            return

        try:
            logger.info("Auto-heal: reconnecting provider", platform=platform)
            await provider.disconnect()
            connected = await provider.connect()
            if connected:
                logger.info("Auto-heal: provider reconnected", platform=platform)
            else:
                logger.warning("Auto-heal: reconnection failed", platform=platform)
        except Exception as e:
            logger.error(
                "Auto-heal: reconnection error", platform=platform, error=str(e)
            )

    async def _restart_receiver(self, platform: str):
        """Receiver 태스크 재시작"""
        provider = self.bridge.providers.get(platform)
        if not provider or not provider.is_connected:
            return

        try:
            # 기존 태스크 정리
            old_task = self.bridge._receiver_tasks.pop(platform, None)
            if old_task and not old_task.done():
                old_task.cancel()
                try:
                    await old_task
                except (asyncio.CancelledError, Exception):
                    pass
                if old_task in self.bridge._tasks:
                    self.bridge._tasks.remove(old_task)

            # 새 태스크 시작
            task = asyncio.create_task(
                self.bridge._receive_messages(platform, provider)
            )
            self.bridge._tasks.append(task)
            self.bridge._receiver_tasks[platform] = task
            logger.info("Auto-heal: receiver restarted", platform=platform)
        except Exception as e:
            logger.error(
                "Auto-heal: receiver restart error", platform=platform, error=str(e)
            )

    async def _disable_route(self, route_id: str):
        """Route 자동 비활성화"""
        try:
            parts = route_id.split("→")
            if len(parts) != 2:
                return

            source_parts = parts[0].split(":", 1)
            target_parts = parts[1].split(":", 1)
            if len(source_parts) != 2 or len(target_parts) != 2:
                return

            source_platform, source_channel = source_parts
            target_platform, target_channel = target_parts

            success = await self.bridge.route_manager.toggle_route_enabled(
                source_platform=source_platform,
                source_channel=source_channel,
                target_platform=target_platform,
                target_channel=target_channel,
                is_enabled=False,
            )

            if success:
                logger.warning(
                    "Auto-heal: route auto-disabled due to repeated failures",
                    route=route_id,
                )
        except Exception as e:
            logger.error("Auto-heal: route disable error", route=route_id, error=str(e))


# ── 싱글톤 ───────────────────────────────────────────────

_monitor_instance: Optional[RouteHealthMonitor] = None


def get_health_monitor() -> Optional[RouteHealthMonitor]:
    return _monitor_instance


def set_health_monitor(monitor: Optional[RouteHealthMonitor]):
    global _monitor_instance
    _monitor_instance = monitor
