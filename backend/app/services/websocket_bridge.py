"""
WebSocket Bridge: 비동기 메시지 라우팅 엔진

Zowe Chat의 Message Broker 개념을 FastAPI WebSocket으로 구현.
Provider에서 받은 메시지를 라우팅 룰에 따라 다른 Provider로 전송합니다.

작성일: 2026-03-31
"""

import asyncio
import structlog
from typing import Dict, List, Optional

from app.schemas.common_message import CommonMessage
from app.adapters.base import BasePlatformProvider
from app.services.route_manager import RouteManager
from app.services.command_processor import CommandProcessor
from app.services.message_queue import MessageQueue

logger = structlog.get_logger()


class WebSocketBridge:
    """
    비동기 메시지 브리지

    여러 Provider를 통합 관리하고, 메시지를 라우팅하며,
    커맨드를 처리하는 핵심 엔진입니다.
    """

    def __init__(
        self, route_manager: RouteManager, message_queue: Optional[MessageQueue] = None
    ):
        """
        WebSocketBridge 초기화

        Args:
            route_manager: Redis 기반 라우팅 룰 관리자
            message_queue: 메시지 배치 큐 (선택)
        """
        self.providers: Dict[str, BasePlatformProvider] = {}
        self.route_manager = route_manager
        self.command_processor = CommandProcessor(bridge=self)
        self.message_queue = message_queue
        self.is_running = False
        self._tasks: List[asyncio.Task] = []

        logger.info(
            "WebSocketBridge initialized", has_message_queue=message_queue is not None
        )

    async def add_provider(self, provider: BasePlatformProvider) -> bool:
        """
        Provider 등록 및 연결

        Args:
            provider: 등록할 Provider 인스턴스

        Returns:
            등록 성공 여부
        """
        try:
            platform_name = provider.platform_name

            # 이미 등록된 Provider인지 확인
            if platform_name in self.providers:
                logger.warning("Provider already registered", platform=platform_name)
                return False

            # Provider 연결
            connected = await provider.connect()
            if not connected:
                logger.error("Failed to connect provider", platform=platform_name)
                return False

            # Provider 등록
            self.providers[platform_name] = provider

            logger.info("Provider registered successfully", platform=platform_name)

            return True

        except Exception as e:
            logger.error(
                "Error adding provider", platform=provider.platform_name, error=str(e)
            )
            return False

    async def remove_provider(self, platform_name: str) -> bool:
        """
        Provider 제거 및 연결 해제

        Args:
            platform_name: 제거할 플랫폼 이름

        Returns:
            제거 성공 여부
        """
        try:
            if platform_name not in self.providers:
                logger.warning("Provider not found", platform=platform_name)
                return False

            provider = self.providers[platform_name]
            await provider.disconnect()
            del self.providers[platform_name]

            logger.info("Provider removed successfully", platform=platform_name)

            return True

        except Exception as e:
            logger.error(
                "Error removing provider", platform=platform_name, error=str(e)
            )
            return False

    async def start(self):
        """브리지 시작 및 메시지 수신 시작"""
        if self.is_running:
            logger.warning("Bridge is already running")
            return

        self.is_running = True

        logger.info("Bridge starting", providers=list(self.providers.keys()))

        # 메시지 큐 시작
        if self.message_queue:
            await self.message_queue.start()
            logger.info("Message queue started")

        # 각 Provider의 메시지 수신 태스크 시작
        for platform_name, provider in self.providers.items():
            task = asyncio.create_task(self._receive_messages(platform_name, provider))
            self._tasks.append(task)

        logger.info("Bridge started successfully")

    async def stop(self):
        """브리지 정지 및 모든 태스크 취소"""
        if not self.is_running:
            logger.warning("Bridge is not running")
            return

        self.is_running = False

        logger.info("Bridge stopping")

        # 모든 태스크 취소
        for task in self._tasks:
            task.cancel()

        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

        # 모든 Provider 연결 해제
        for platform_name in list(self.providers.keys()):
            await self.remove_provider(platform_name)

        # 메시지 큐 정지 (남은 메시지 모두 처리)
        if self.message_queue:
            await self.message_queue.stop()
            logger.info("Message queue stopped")

        logger.info("Bridge stopped successfully")

    async def _receive_messages(
        self, platform_name: str, provider: BasePlatformProvider
    ):
        """
        Provider로부터 메시지 수신 및 라우팅

        Args:
            platform_name: 플랫폼 이름
            provider: Provider 인스턴스
        """
        logger.info("Starting message receiver", platform=platform_name)

        try:
            async for message in provider.receive_messages():
                if not self.is_running:
                    break

                await self._route_message(message)

        except asyncio.CancelledError:
            logger.info("Message receiver cancelled", platform=platform_name)
        except Exception as e:
            logger.error(
                "Error in message receiver", platform=platform_name, error=str(e)
            )

    async def _route_message(self, message: CommonMessage):
        """
        메시지 라우팅 처리

        1. 커맨드 체크 및 처리
        2. 라우팅 룰 조회
        3. 타겟 Provider로 전송

        Args:
            message: CommonMessage 스키마 메시지
        """
        try:
            logger.info(
                "🚀 Routing message",
                message_id=message.message_id,
                platform=message.platform.value,
                channel=message.channel.id,
                text=message.text[:50] if message.text else None,
            )

            # 1. 커맨드 처리
            if message.is_command():
                logger.info(
                    "Processing command",
                    message_id=message.message_id,
                    text=message.text,
                )
                response = await self.command_processor.process(message)
                if response:
                    # 커맨드 응답을 발신자에게 전송
                    await self._send_message(response)
                return

            # 2. 라우팅 룰 조회
            targets = await self.route_manager.get_targets(
                message.platform.value, message.channel.id
            )

            if not targets:
                logger.info(
                    "⚠️ No routing targets found",
                    platform=message.platform.value,
                    channel=message.channel.id,
                )
                if self.message_queue:
                    await self.message_queue.enqueue_from_common_message(
                        message=message,
                        status="no_route",
                        target_platform="none",
                        target_channel="none",
                        error_message="No routing targets found",
                    )
                return

            logger.info(
                "📍 Found routing targets",
                targets_count=len(targets),
                targets=[f"{t.platform.value}:{t.id}" for t in targets],
            )

            # 3. 타겟 Provider로 전송
            for target in targets:
                target_message = message.model_copy(deep=True)
                target_message.target_channels = [target]

                await self._send_message(target_message)

            logger.info(
                "✅ Message routed successfully",
                message_id=message.message_id,
                targets_count=len(targets),
            )

        except Exception as e:
            logger.error(
                "Error routing message", message_id=message.message_id, error=str(e)
            )

            # 라우팅 실패 시에도 메시지를 DB에 저장 (타겟이 있으면 각 타겟별로 저장)
            if self.message_queue:
                try:
                    # 타겟 조회 시도 (이미 조회했을 수도 있음)
                    targets = await self.route_manager.get_targets(
                        message.platform.value, message.channel.id
                    )

                    if targets:
                        # 각 타겟별로 실패 기록
                        for target in targets:
                            await self.message_queue.enqueue_from_common_message(
                                message=message,
                                status="failed",
                                target_platform=target.platform.value,
                                target_channel=target.id,
                                error_message=f"Routing error: {str(e)}",
                            )
                    else:
                        # 타겟이 없으면 소스 채널에 기록
                        await self.message_queue.enqueue_from_common_message(
                            message=message,
                            status="failed",
                            target_platform=message.platform.value,
                            target_channel=message.channel.id,
                            error_message=f"No targets found or routing error: {str(e)}",
                        )

                    logger.info(
                        "Failed message saved to DB",
                        message_id=message.message_id,
                        error=str(e),
                    )

                except Exception as save_error:
                    logger.error(
                        "Failed to save error message to DB",
                        message_id=message.message_id,
                        error=str(save_error),
                    )

    async def _send_message(self, message: CommonMessage) -> bool:
        """
        메시지 전송

        Args:
            message: 전송할 메시지 (target_channels 포함)

        Returns:
            전송 성공 여부
        """
        try:
            # target_channels가 지정된 경우
            if message.target_channels:
                for target_channel in message.target_channels:
                    platform = target_channel.platform.value
                    provider = self.providers.get(platform)

                    if not provider:
                        logger.warning(
                            "Provider not found for target", platform=platform
                        )

                        # 메시지 큐에 실패 상태 추가
                        if self.message_queue:
                            await self.message_queue.enqueue_from_common_message(
                                message=message,
                                status="failed",
                                target_platform=platform,
                                target_channel=target_channel.id,
                                error_message=f"Provider not found: {platform}",
                            )

                        continue

                    # 이 라우트의 message_mode 조회
                    message_mode = await self.route_manager.get_message_mode(
                        source_platform=message.platform.value,
                        source_channel=message.channel.id,
                        target_platform=platform,
                        target_channel=target_channel.id,
                    )

                    logger.debug(
                        "Using message mode for route",
                        source=f"{message.platform.value}:{message.channel.id}",
                        target=f"{platform}:{target_channel.id}",
                        mode=message_mode,
                    )

                    # 타겟 채널로 메시지 업데이트
                    target_message = message.model_copy(deep=True)
                    target_message.channel = target_channel

                    # 첨부 파일이 있으면 병렬 다운로드 (소스 플랫폼에서)
                    if target_message.attachments:
                        source_provider = self.providers.get(message.platform.value)

                        if source_provider and hasattr(
                            source_provider, "download_file"
                        ):
                            pending = [
                                att
                                for att in target_message.attachments
                                if att.download_status == "pending" and att.url
                            ]

                            if pending:

                                async def _download_one(att):
                                    try:
                                        local_path = (
                                            await source_provider.download_file(
                                                file_url=att.url,
                                                file_id=att.id,
                                                filename=att.name,
                                            )
                                        )
                                        if local_path:
                                            att.local_path = local_path
                                            att.download_status = "downloaded"
                                            logger.info(
                                                "Attachment downloaded for relay",
                                                filename=att.name,
                                            )
                                        else:
                                            att.download_status = "failed"
                                            att.download_error = (
                                                "Download returned None"
                                            )
                                            logger.error(
                                                "Failed to download attachment",
                                                filename=att.name,
                                                url=att.url[:200] if att.url else None,
                                            )
                                    except Exception as e:
                                        att.download_status = "failed"
                                        att.download_error = str(e)
                                        logger.error(
                                            "Error downloading attachment",
                                            filename=att.name,
                                            error=str(e),
                                        )

                                await asyncio.gather(
                                    *[_download_one(att) for att in pending]
                                )

                    # 스레드 메시지인 경우 thread_id 변환
                    if target_message.thread_id:
                        thread_mapping = await self.route_manager.get_thread_mapping(
                            source_platform=message.platform.value,
                            source_channel=message.channel.id,
                            source_ts=target_message.thread_id,
                        )

                        if thread_mapping:
                            (
                                target_platform,
                                target_channel_id,
                                target_ts,
                            ) = thread_mapping
                            target_message.thread_id = target_ts
                            logger.debug(
                                "Thread mapping applied",
                                original=message.thread_id,
                                converted=target_ts,
                            )
                        else:
                            # 매핑이 없으면 thread_id 제거 (잘못된 ID로 전송 실패 방지)
                            logger.debug(
                                "No thread mapping found, clearing thread_id",
                                thread_id=target_message.thread_id,
                            )
                            target_message.thread_id = None

                    # 편집 메시지 처리 (Mode 2: editable)
                    if (
                        message.is_edited
                        and message_mode == "editable"
                        and platform in ("slack", "teams")
                    ):
                        # 원본 메시지 ts 찾기 (thread mapping 활용)
                        original_mapping = await self.route_manager.get_thread_mapping(
                            source_platform=message.platform.value,
                            source_channel=message.channel.id,
                            source_ts=message.message_id,
                        )

                        if original_mapping:
                            (
                                target_platform,
                                target_channel_id,
                                target_ts,
                            ) = original_mapping

                            # chat.update로 실제 메시지 편집
                            try:
                                # _(edited)_ 제거하고 원본 텍스트만 사용
                                edit_text = (
                                    message.text.replace(" _(edited)_", "")
                                    if message.text
                                    else ""
                                )

                                result = await provider.app.client.chat_update(
                                    channel=target_channel.id,
                                    ts=target_ts,
                                    text=edit_text,
                                )

                                success = result.get("ok", False)
                                logger.info(
                                    "✏️ Message updated (Mode 2)",
                                    channel=target_channel.id,
                                    ts=target_ts,
                                    success=success,
                                )
                            except Exception as e:
                                logger.error(
                                    "Failed to update message",
                                    error=str(e),
                                    ts=target_ts,
                                )
                                success = False
                        else:
                            # 매핑을 찾을 수 없으면 새 메시지로 전송 (fallback)
                            logger.warning(
                                "Original message mapping not found, sending as new message"
                            )
                            success = await provider.send_message(target_message)

                    # 삭제 메시지 처리 (Mode 2: editable)
                    elif (
                        message.type == "system"
                        and message.text
                        and "삭제되었습니다" in message.text
                        and message_mode == "editable"
                        and platform in ("slack", "teams")
                    ):
                        # 삭제된 메시지의 원본 ts 찾기
                        # message_id가 "{ts}_deleted" 형식이므로 파싱
                        if "_deleted" in message.message_id:
                            original_ts = message.message_id.replace("_deleted", "")

                            # thread mapping에서 타겟 ts 찾기
                            original_mapping = (
                                await self.route_manager.get_thread_mapping(
                                    source_platform=message.platform.value,
                                    source_channel=message.channel.id,
                                    source_ts=original_ts,
                                )
                            )

                            if original_mapping:
                                (
                                    target_platform,
                                    target_channel_id,
                                    target_ts,
                                ) = original_mapping

                                # chat.delete로 실제 메시지 삭제
                                try:
                                    result = await provider.app.client.chat_delete(
                                        channel=target_channel.id,
                                        ts=target_ts,
                                    )

                                    success = result.get("ok", False)
                                    logger.info(
                                        "🗑️ Message deleted (Mode 2)",
                                        channel=target_channel.id,
                                        ts=target_ts,
                                        success=success,
                                    )
                                except Exception as e:
                                    logger.error(
                                        "Failed to delete message",
                                        error=str(e),
                                        ts=target_ts,
                                    )
                                    success = False
                            else:
                                # 매핑을 찾을 수 없으면 삭제 알림 메시지 전송 (fallback)
                                logger.warning(
                                    "Original message mapping not found, sending deletion notification"
                                )
                                success = await provider.send_message(target_message)
                        else:
                            # fallback
                            success = await provider.send_message(target_message)

                    # 일반 메시지 전송
                    else:
                        # Provider가 발신자 정보(username, icon)를 직접 설정하도록 함
                        # (Matterbridge 방식: prefix 없이 username과 icon만 사용)
                        success = await provider.send_message(target_message)

                    logger.debug(
                        "Message sent to target",
                        message_id=message.message_id,
                        platform=platform,
                        channel=target_channel.id,
                        success=success,
                    )

                    # 전송 성공 시 thread mapping 저장 (Slack provider의 경우)
                    # 양방향 매핑을 저장하여 역방향 댓글도 지원
                    if (
                        success
                        and hasattr(provider, "last_sent_ts")
                        and provider.last_sent_ts
                    ):
                        # 정방향: source → target
                        await self.route_manager.save_thread_mapping(
                            source_platform=message.platform.value,
                            source_channel=message.channel.id,
                            source_ts=message.message_id,
                            target_platform=platform,
                            target_channel=target_channel.id,
                            target_ts=provider.last_sent_ts,
                        )
                        # 역방향: target → source (댓글 지원을 위해)
                        await self.route_manager.save_thread_mapping(
                            source_platform=platform,
                            source_channel=target_channel.id,
                            source_ts=provider.last_sent_ts,
                            target_platform=message.platform.value,
                            target_channel=message.channel.id,
                            target_ts=message.message_id,
                        )
                        logger.debug(
                            "Thread mapping saved (bidirectional)",
                            forward=f"{message.platform.value}:{message.channel.id}:{message.message_id}→{platform}:{target_channel.id}:{provider.last_sent_ts}",
                            reverse=f"{platform}:{target_channel.id}:{provider.last_sent_ts}→{message.platform.value}:{message.channel.id}:{message.message_id}",
                        )

                    # 메시지 큐에 상태 추가
                    if self.message_queue:
                        _err = (
                            None
                            if success
                            else (
                                getattr(provider, "last_error", None) or "Send failed"
                            )
                        )
                        # 첨부 파일 다운로드 실패 정보 추가
                        failed_atts = (
                            [
                                att.name
                                for att in target_message.attachments
                                if att.download_status == "failed"
                            ]
                            if target_message.attachments
                            else []
                        )
                        if failed_atts:
                            att_err = (
                                f"Attachment download failed: {', '.join(failed_atts)}"
                            )
                            _err = f"{_err}; {att_err}" if _err else att_err

                        # 전송 성공이지만 일부 첨부 실패 → partial_success
                        if success and failed_atts:
                            _status = "partial_success"
                        elif success:
                            _status = "sent"
                        else:
                            _status = "failed"

                        if not success:
                            logger.info(
                                "Capturing send failure detail",
                                provider_last_error=getattr(
                                    provider, "last_error", None
                                ),
                                error_message=_err,
                                platform=platform,
                                channel=target_channel.id,
                            )
                        await self.message_queue.enqueue_from_common_message(
                            message=message,
                            status=_status,
                            target_platform=platform,
                            target_channel=target_channel.id,
                            target_channel_name=target_channel.name,
                            error_message=_err,
                        )

            # 기본 채널로 전송
            else:
                platform = message.channel.platform.value
                provider = self.providers.get(platform)

                if not provider:
                    logger.warning("Provider not found", platform=platform)

                    # 메시지 큐에 실패 상태 추가
                    if self.message_queue:
                        await self.message_queue.enqueue_from_common_message(
                            message=message,
                            status="failed",
                            target_platform=platform,
                            target_channel=message.channel.id,
                            error_message=f"Provider not found: {platform}",
                        )

                    return False

                success = await provider.send_message(message)

                logger.debug(
                    "Message sent",
                    message_id=message.message_id,
                    platform=platform,
                    channel=message.channel.id,
                    success=success,
                )

                # 메시지 큐에 상태 추가
                if self.message_queue:
                    await self.message_queue.enqueue_from_common_message(
                        message=message,
                        status="sent" if success else "failed",
                        target_platform=platform,
                        target_channel=message.channel.id,
                        error_message=None
                        if success
                        else (getattr(provider, "last_error", None) or "Send failed"),
                    )

            return True

        except Exception as e:
            logger.error(
                "Error sending message", message_id=message.message_id, error=str(e)
            )

            # 메시지 큐에 실패 상태 추가
            if self.message_queue:
                target_platform = (
                    message.target_channels[0].platform.value
                    if message.target_channels
                    else message.platform.value
                )
                target_channel = (
                    message.target_channels[0].id
                    if message.target_channels
                    else message.channel.id
                )

                await self.message_queue.enqueue_from_common_message(
                    message=message,
                    status="failed",
                    target_platform=target_platform,
                    target_channel=target_channel,
                    error_message=str(e),
                )

            return False

    def get_status(self) -> Dict:
        """
        브리지 상태 조회

        Returns:
            상태 정보 딕셔너리
        """
        return {
            "is_running": self.is_running,
            "providers": [
                provider.get_status() for provider in self.providers.values()
            ],
            "active_tasks": len(self._tasks),
        }

    async def get_provider_channels(self, platform: str) -> List[Dict]:
        """
        특정 플랫폼의 채널 목록 조회

        Args:
            platform: 플랫폼 이름

        Returns:
            채널 정보 리스트
        """
        provider = self.providers.get(platform)
        if not provider:
            logger.warning("Provider not found", platform=platform)
            return []

        try:
            channels = await provider.get_channels()
            return [
                {"id": ch.id, "name": ch.name, "platform": ch.platform.value}
                for ch in channels
            ]
        except Exception as e:
            logger.error("Error getting channels", platform=platform, error=str(e))
            return []


# 싱글톤 인스턴스 (FastAPI에서 사용)
_bridge_instance: Optional[WebSocketBridge] = None


def get_bridge() -> Optional[WebSocketBridge]:
    """브리지 싱글톤 인스턴스 반환"""
    return _bridge_instance


def set_bridge(bridge: WebSocketBridge):
    """브리지 싱글톤 인스턴스 설정"""
    global _bridge_instance
    _bridge_instance = bridge
