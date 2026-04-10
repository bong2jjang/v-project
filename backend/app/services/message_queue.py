"""
Message Queue Service: 배치 큐를 사용한 메시지 저장 서비스

DB 부하를 최소화하기 위해 메시지 상태 업데이트를 큐에 모아서
일정 주기 또는 일정 개수마다 배치로 처리합니다.

작성일: 2026-04-03
"""

import asyncio
import structlog
from typing import Optional, List
from datetime import datetime, timezone
from dataclasses import dataclass

from app.db.database import SessionLocal
from app.models.message import Message
from app.schemas.common_message import CommonMessage

logger = structlog.get_logger()


@dataclass
class MessageStatus:
    """메시지 상태 업데이트 데이터"""

    message_id: str
    platform: str
    channel_id: str
    user_id: Optional[str]
    user_name: Optional[str]  # 사용자명
    user_display_name: Optional[str]  # 표시 이름
    text: str
    timestamp: datetime
    source_platform: str
    source_channel: str
    target_platform: str
    target_channel: str
    status: str  # pending, sent, failed, retrying
    source_channel_name: Optional[str] = None
    target_channel_name: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    delivered_at: Optional[datetime] = None
    # 첨부파일 정보
    has_attachment: bool = False
    attachment_count: int = 0
    attachment_details: Optional[List[dict]] = None
    message_type: str = "text"


class MessageQueue:
    """
    메시지 배치 큐 서비스

    메시지 상태 업데이트를 큐에 모아서 일정 주기/개수마다 DB에 배치 저장합니다.
    """

    def __init__(
        self,
        batch_size: int = 50,
        flush_interval: float = 5.0,  # seconds
    ):
        """
        MessageQueue 초기화

        Args:
            batch_size: 배치 저장 크기 (이 개수만큼 모이면 즉시 저장)
            flush_interval: 주기적 flush 간격 (초)
        """
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self._queue: asyncio.Queue[MessageStatus] = asyncio.Queue()
        self._is_running = False
        self._worker_task: Optional[asyncio.Task] = None

        logger.info(
            "MessageQueue initialized",
            batch_size=batch_size,
            flush_interval=flush_interval,
        )

    async def start(self):
        """큐 워커 시작"""
        if self._is_running:
            logger.warning("MessageQueue is already running")
            return

        self._is_running = True
        self._worker_task = asyncio.create_task(self._worker())

        logger.info("MessageQueue started")

    async def stop(self):
        """큐 워커 정지 (남은 메시지 모두 처리 후 종료)"""
        if not self._is_running:
            logger.warning("MessageQueue is not running")
            return

        self._is_running = False

        # 남은 메시지 모두 처리
        if not self._queue.empty():
            logger.info("Flushing remaining messages", remaining=self._queue.qsize())
            await self._flush_queue()

        # 워커 태스크 취소
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass

        logger.info("MessageQueue stopped")

    async def enqueue(self, message_status: MessageStatus):
        """
        메시지 상태를 큐에 추가

        Args:
            message_status: 저장할 메시지 상태 정보
        """
        try:
            await self._queue.put(message_status)

            logger.debug(
                "Message status enqueued",
                message_id=message_status.message_id,
                status=message_status.status,
                queue_size=self._queue.qsize(),
            )

        except Exception as e:
            logger.error(
                "Error enqueuing message status",
                message_id=message_status.message_id,
                error=str(e),
            )

    async def enqueue_from_common_message(
        self,
        message: CommonMessage,
        status: str,
        target_platform: str,
        target_channel: str,
        target_channel_name: Optional[str] = None,
        error_message: Optional[str] = None,
        retry_count: int = 0,
    ):
        """
        CommonMessage로부터 MessageStatus 생성하여 큐에 추가

        Args:
            message: CommonMessage 메시지
            status: 메시지 상태 (pending, sent, failed, retrying)
            target_platform: 타겟 플랫폼
            target_channel: 타겟 채널
            target_channel_name: 타겟 채널 표시명 (optional)
            error_message: 에러 메시지 (실패 시)
            retry_count: 재시도 횟수
        """
        # 첨부파일 정보 추출 (다운로드 상태 및 실패 원인 포함)
        att_details = None
        att_count = 0
        has_att = False
        if message.attachments:
            has_att = True
            att_count = len(message.attachments)
            att_details = []
            for att in message.attachments:
                detail: dict = {
                    "name": att.name,
                    "type": att.mime_type,
                    "size": att.size,
                    "url": att.delivered_url or att.url,
                    "download_status": att.download_status,
                }
                if att.download_status == "failed":
                    detail["error"] = getattr(att, "download_error", None) or "unknown"
                att_details.append(detail)

        # 메시지 타입 결정
        msg_type = message.type.value if message.type else "text"

        message_status = MessageStatus(
            message_id=message.message_id,
            platform=message.platform.value,
            channel_id=message.channel.id,
            user_id=message.user.id if message.user else None,
            user_name=message.user.username if message.user else None,
            user_display_name=message.user.display_name if message.user else None,
            text=message.text or "",
            timestamp=message.timestamp,
            source_platform=message.platform.value,
            source_channel=message.channel.id,
            source_channel_name=message.channel.name if message.channel else None,
            target_platform=target_platform,
            target_channel=target_channel,
            target_channel_name=target_channel_name,
            status=status,
            error_message=error_message,
            retry_count=retry_count,
            delivered_at=datetime.now(timezone.utc)
            if status in ("sent", "partial_success")
            else None,
            has_attachment=has_att,
            attachment_count=att_count,
            attachment_details=att_details,
            message_type=msg_type,
        )

        await self.enqueue(message_status)

    async def _worker(self):
        """배치 처리 워커 (백그라운드 태스크)"""
        logger.info("MessageQueue worker started")

        batch: List[MessageStatus] = []
        last_flush_time = asyncio.get_event_loop().time()

        try:
            while self._is_running:
                try:
                    # 타임아웃으로 주기적 flush 체크
                    message_status = await asyncio.wait_for(
                        self._queue.get(), timeout=1.0
                    )
                    batch.append(message_status)

                    # 배치 크기에 도달하면 즉시 flush
                    if len(batch) >= self.batch_size:
                        logger.info(
                            "Batch size reached, flushing",
                            batch_size=len(batch),
                        )
                        await self._flush_batch(batch)
                        batch.clear()
                        last_flush_time = asyncio.get_event_loop().time()

                except asyncio.TimeoutError:
                    # 타임아웃 - 주기적 flush 체크
                    current_time = asyncio.get_event_loop().time()
                    elapsed = current_time - last_flush_time

                    if batch and elapsed >= self.flush_interval:
                        logger.info(
                            "Flush interval reached, flushing",
                            batch_size=len(batch),
                            elapsed=elapsed,
                        )
                        await self._flush_batch(batch)
                        batch.clear()
                        last_flush_time = current_time

        except asyncio.CancelledError:
            logger.info("MessageQueue worker cancelled")
            # 남은 배치 flush
            if batch:
                await self._flush_batch(batch)
        except Exception as e:
            logger.error("Error in MessageQueue worker", error=str(e))

    async def _flush_queue(self):
        """큐의 모든 메시지를 즉시 flush"""
        batch: List[MessageStatus] = []

        while not self._queue.empty():
            try:
                message_status = self._queue.get_nowait()
                batch.append(message_status)
            except asyncio.QueueEmpty:
                break

        if batch:
            await self._flush_batch(batch)

    async def _flush_batch(self, batch: List[MessageStatus]):
        """배치를 DB에 저장"""
        if not batch:
            return

        logger.info("Flushing batch to database", count=len(batch))

        db = SessionLocal()
        try:
            saved_count = 0
            updated_count = 0

            for msg_status in batch:
                # 기존 메시지 조회 (message_id + destination_channel 복합 조건)
                existing = (
                    db.query(Message)
                    .filter(
                        Message.message_id == msg_status.message_id,
                        Message.destination_channel == msg_status.target_channel,
                    )
                    .first()
                )

                if existing:
                    # 기존 메시지 업데이트
                    existing.status = msg_status.status
                    existing.error_message = msg_status.error_message
                    existing.retry_count = msg_status.retry_count
                    existing.delivered_at = msg_status.delivered_at
                    updated_count += 1

                    logger.debug(
                        "Message status updated",
                        message_id=msg_status.message_id,
                        status=msg_status.status,
                    )
                else:
                    # 새 메시지 생성
                    new_message = Message(
                        message_id=msg_status.message_id,
                        text=msg_status.text,
                        gateway=f"{msg_status.source_platform}→{msg_status.target_platform}",
                        source_account=msg_status.source_platform,
                        source_channel=msg_status.source_channel,
                        source_channel_name=msg_status.source_channel_name,
                        source_user=msg_status.user_id,
                        source_user_name=msg_status.user_name,
                        source_user_display_name=msg_status.user_display_name,
                        destination_account=msg_status.target_platform,
                        destination_channel=msg_status.target_channel,
                        destination_channel_name=msg_status.target_channel_name,
                        protocol=msg_status.platform,
                        timestamp=msg_status.timestamp,
                        status=msg_status.status,
                        error_message=msg_status.error_message,
                        retry_count=msg_status.retry_count,
                        delivered_at=msg_status.delivered_at,
                        has_attachment=msg_status.has_attachment,
                        attachment_count=msg_status.attachment_count,
                        attachment_details=msg_status.attachment_details,
                        message_type=msg_status.message_type,
                    )
                    db.add(new_message)
                    saved_count += 1

                    logger.debug(
                        "New message saved",
                        message_id=msg_status.message_id,
                        user_name=msg_status.user_name,
                        display_name=msg_status.user_display_name,
                        status=msg_status.status,
                    )

            db.commit()

            logger.info(
                "✅ Batch flushed successfully",
                saved=saved_count,
                updated=updated_count,
                total=len(batch),
            )

        except Exception as e:
            logger.error("Error flushing batch to database", error=str(e))
            db.rollback()
        finally:
            db.close()


# 싱글톤 인스턴스
_message_queue: Optional[MessageQueue] = None


def get_message_queue() -> Optional[MessageQueue]:
    """메시지 큐 싱글톤 인스턴스 반환"""
    return _message_queue


def set_message_queue(queue: MessageQueue):
    """메시지 큐 싱글톤 인스턴스 설정"""
    global _message_queue
    _message_queue = queue
