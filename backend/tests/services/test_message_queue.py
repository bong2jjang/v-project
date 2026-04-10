"""
MessageQueue 단위 테스트

enqueue_from_common_message의 MessageStatus 생성 로직,
partial_success 상태, 첨부파일 상세 정보 기록을 검증합니다.
"""

import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

from app.schemas.common_message import (
    CommonMessage,
    User,
    Channel,
    Attachment,
    MessageType,
    Platform,
)
from app.services.message_queue import MessageQueue, MessageStatus


def _make_user() -> User:
    return User(
        id="U001",
        username="alice",
        display_name="Alice Kim",
        platform=Platform.SLACK,
    )


def _make_channel() -> Channel:
    return Channel(id="C100", name="general", platform=Platform.SLACK)


def _make_message(
    text: str = "hello",
    attachments: list[Attachment] | None = None,
    msg_type: MessageType = MessageType.TEXT,
) -> CommonMessage:
    return CommonMessage(
        message_id="msg-001",
        timestamp=datetime(2026, 4, 10, 9, 0, 0),
        type=msg_type,
        platform=Platform.SLACK,
        user=_make_user(),
        channel=_make_channel(),
        text=text,
        attachments=attachments or [],
    )


class TestEnqueueFromCommonMessage:
    """enqueue_from_common_message 테스트 — MessageStatus 생성 로직 검증"""

    @pytest.mark.asyncio
    async def test_text_message_sent(self):
        """텍스트 메시지 sent 상태 → delivered_at 설정됨"""
        mq = MessageQueue(batch_size=100, flush_interval=60)
        msg = _make_message("안녕하세요")

        await mq.enqueue_from_common_message(
            message=msg,
            status="sent",
            target_platform="teams",
            target_channel="T200",
            target_channel_name="General",
        )

        status: MessageStatus = mq._queue.get_nowait()
        assert status.message_id == "msg-001"
        assert status.status == "sent"
        assert status.platform == "slack"
        assert status.source_channel == "C100"
        assert status.target_platform == "teams"
        assert status.target_channel == "T200"
        assert status.target_channel_name == "General"
        assert status.user_name == "alice"
        assert status.user_display_name == "Alice Kim"
        assert status.delivered_at is not None
        assert status.has_attachment is False
        assert status.attachment_count == 0
        assert status.attachment_details is None
        assert status.message_type == "text"

    @pytest.mark.asyncio
    async def test_failed_message_no_delivered_at(self):
        """failed 상태 → delivered_at 미설정"""
        mq = MessageQueue()
        msg = _make_message()

        await mq.enqueue_from_common_message(
            message=msg,
            status="failed",
            target_platform="teams",
            target_channel="T200",
            error_message="Timeout",
            retry_count=2,
        )

        status = mq._queue.get_nowait()
        assert status.status == "failed"
        assert status.delivered_at is None
        assert status.error_message == "Timeout"
        assert status.retry_count == 2

    @pytest.mark.asyncio
    async def test_partial_success_sets_delivered_at(self):
        """partial_success 상태 → delivered_at 설정됨"""
        mq = MessageQueue()
        att = Attachment(
            id="att-1",
            name="img.png",
            mime_type="image/png",
            size=1024,
            url="https://example.com/img.png",
            download_status="failed",
            download_error="403 Forbidden",
        )
        msg = _make_message("파일 포함", attachments=[att])

        await mq.enqueue_from_common_message(
            message=msg,
            status="partial_success",
            target_platform="teams",
            target_channel="T200",
            error_message="Attachment download failed: img.png",
        )

        status = mq._queue.get_nowait()
        assert status.status == "partial_success"
        assert status.delivered_at is not None
        assert status.error_message == "Attachment download failed: img.png"

    @pytest.mark.asyncio
    async def test_attachment_details_success(self):
        """첨부파일 성공 시 download_status=downloaded, error 미포함"""
        mq = MessageQueue()
        att = Attachment(
            id="att-1",
            name="report.pdf",
            mime_type="application/pdf",
            size=50000,
            url="https://example.com/report.pdf",
            delivered_url="https://teams.com/files/report.pdf",
            download_status="uploaded",
        )
        msg = _make_message("리포트", attachments=[att], msg_type=MessageType.FILE)

        await mq.enqueue_from_common_message(
            message=msg,
            status="sent",
            target_platform="teams",
            target_channel="T200",
        )

        status = mq._queue.get_nowait()
        assert status.has_attachment is True
        assert status.attachment_count == 1
        assert status.message_type == "file"

        detail = status.attachment_details[0]
        assert detail["name"] == "report.pdf"
        assert detail["type"] == "application/pdf"
        assert detail["size"] == 50000
        assert detail["url"] == "https://teams.com/files/report.pdf"
        assert detail["download_status"] == "uploaded"
        assert "error" not in detail

    @pytest.mark.asyncio
    async def test_attachment_details_failed_includes_error(self):
        """첨부파일 실패 시 download_status=failed, error 포함"""
        mq = MessageQueue()
        att = Attachment(
            id="att-2",
            name="secret.docx",
            mime_type="application/msword",
            size=0,
            url="https://example.com/secret.docx",
            download_status="failed",
            download_error="HTTP 403: Forbidden",
        )
        msg = _make_message("파일 전송 시도", attachments=[att])

        await mq.enqueue_from_common_message(
            message=msg,
            status="partial_success",
            target_platform="teams",
            target_channel="T200",
        )

        status = mq._queue.get_nowait()
        detail = status.attachment_details[0]
        assert detail["download_status"] == "failed"
        assert detail["error"] == "HTTP 403: Forbidden"

    @pytest.mark.asyncio
    async def test_multiple_attachments_mixed_status(self):
        """여러 첨부파일 — 성공/실패 혼합"""
        mq = MessageQueue()
        att_ok = Attachment(
            id="att-1",
            name="ok.png",
            mime_type="image/png",
            size=1000,
            url="https://example.com/ok.png",
            delivered_url="https://teams.com/ok.png",
            download_status="uploaded",
        )
        att_fail = Attachment(
            id="att-2",
            name="fail.jpg",
            mime_type="image/jpeg",
            size=0,
            url="https://example.com/fail.jpg",
            download_status="failed",
            download_error="Connection timeout",
        )
        msg = _make_message("혼합 첨부", attachments=[att_ok, att_fail])

        await mq.enqueue_from_common_message(
            message=msg,
            status="partial_success",
            target_platform="teams",
            target_channel="T200",
        )

        status = mq._queue.get_nowait()
        assert status.attachment_count == 2
        assert status.attachment_details[0]["download_status"] == "uploaded"
        assert "error" not in status.attachment_details[0]
        assert status.attachment_details[1]["download_status"] == "failed"
        assert status.attachment_details[1]["error"] == "Connection timeout"

    @pytest.mark.asyncio
    async def test_source_channel_name_from_message(self):
        """CommonMessage의 channel.name이 source_channel_name에 반영"""
        mq = MessageQueue()
        msg = _make_message()

        await mq.enqueue_from_common_message(
            message=msg,
            status="sent",
            target_platform="teams",
            target_channel="T200",
        )

        status = mq._queue.get_nowait()
        assert status.source_channel_name == "general"


class TestFlushBatch:
    """_flush_batch 테스트 — DB 저장 로직 검증"""

    def _make_status(
        self, message_id: str = "msg-001", status: str = "sent"
    ) -> MessageStatus:
        return MessageStatus(
            message_id=message_id,
            platform="slack",
            channel_id="C100",
            user_id="U001",
            user_name="alice",
            user_display_name="Alice Kim",
            text="test message",
            timestamp=datetime(2026, 4, 10, 9, 0, 0),
            source_platform="slack",
            source_channel="C100",
            source_channel_name="general",
            target_platform="teams",
            target_channel="T200",
            target_channel_name="General",
            status=status,
            delivered_at=datetime.utcnow()
            if status in ("sent", "partial_success")
            else None,
        )

    @pytest.mark.asyncio
    async def test_flush_creates_new_message(self):
        """새 메시지 → Message 레코드 생성"""
        mq = MessageQueue()
        batch = [self._make_status()]

        mock_session = MagicMock()
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = None
        mock_session.query.return_value = mock_query

        mock_msg_cls = MagicMock()
        mock_msg_instance = MagicMock()
        mock_msg_instance.message_id = "msg-001"
        mock_msg_instance.gateway = "slack→teams"
        mock_msg_instance.source_account = "slack"
        mock_msg_instance.destination_account = "teams"
        mock_msg_instance.status = "sent"
        mock_msg_cls.return_value = mock_msg_instance

        with patch(
            "app.services.message_queue.SessionLocal", return_value=mock_session
        ), patch("app.services.message_queue.Message", mock_msg_cls):
            await mq._flush_batch(batch)

        mock_session.add.assert_called_once_with(mock_msg_instance)
        mock_session.commit.assert_called_once()
        mock_session.close.assert_called_once()

        # Message 생성자 호출 인자 검증
        call_kwargs = mock_msg_cls.call_args[1]
        assert call_kwargs["message_id"] == "msg-001"
        assert call_kwargs["gateway"] == "slack→teams"
        assert call_kwargs["source_account"] == "slack"
        assert call_kwargs["destination_account"] == "teams"
        assert call_kwargs["status"] == "sent"

    @pytest.mark.asyncio
    async def test_flush_updates_existing_message(self):
        """기존 메시지 → 상태 업데이트"""
        mq = MessageQueue()
        batch = [self._make_status(status="failed")]

        existing = MagicMock()
        existing.message_id = "msg-001"
        existing.status = "pending"

        mock_session = MagicMock()
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = existing
        mock_session.query.return_value = mock_query

        with patch(
            "app.services.message_queue.SessionLocal", return_value=mock_session
        ), patch("app.services.message_queue.Message"):
            await mq._flush_batch(batch)

        assert existing.status == "failed"
        mock_session.add.assert_not_called()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_flush_rollback_on_error(self):
        """DB 저장 중 에러 → rollback"""
        mq = MessageQueue()
        batch = [self._make_status()]

        mock_session = MagicMock()
        mock_session.query.side_effect = Exception("DB connection lost")

        with patch(
            "app.services.message_queue.SessionLocal", return_value=mock_session
        ), patch("app.services.message_queue.Message"):
            await mq._flush_batch(batch)

        mock_session.rollback.assert_called_once()
        mock_session.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_flush_empty_batch_noop(self):
        """빈 배치 → 아무 작업도 하지 않음"""
        mq = MessageQueue()

        with patch("app.services.message_queue.SessionLocal") as mock_sl:
            await mq._flush_batch([])

        mock_sl.assert_not_called()


class TestQueueLifecycle:
    """MessageQueue start/stop 테스트"""

    @pytest.mark.asyncio
    async def test_start_sets_running(self):
        """start() 호출 → _is_running = True"""
        mq = MessageQueue()
        await mq.start()
        assert mq._is_running is True
        assert mq._worker_task is not None
        await mq.stop()

    @pytest.mark.asyncio
    async def test_stop_flushes_remaining(self):
        """stop() 시 남은 큐 항목 flush"""
        mq = MessageQueue()

        status = MessageStatus(
            message_id="msg-999",
            platform="slack",
            channel_id="C100",
            user_id="U001",
            user_name="alice",
            user_display_name="Alice Kim",
            text="remaining",
            timestamp=datetime.utcnow(),
            source_platform="slack",
            source_channel="C100",
            target_platform="teams",
            target_channel="T200",
            status="sent",
        )
        await mq._queue.put(status)
        mq._is_running = True  # stop()이 early return하지 않도록 설정

        mock_session = MagicMock()
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = None
        mock_session.query.return_value = mock_query

        with patch(
            "app.services.message_queue.SessionLocal", return_value=mock_session
        ), patch("app.services.message_queue.Message") as mock_msg_cls:
            mock_msg_cls.return_value = MagicMock()
            await mq.stop()

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_double_start_ignored(self):
        """이미 실행 중 → 중복 start 무시"""
        mq = MessageQueue()
        await mq.start()
        first_task = mq._worker_task
        await mq.start()
        assert mq._worker_task is first_task
        await mq.stop()
