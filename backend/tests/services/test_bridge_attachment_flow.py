"""
WebSocketBridge 첨부파일 실패 흐름 테스트

_send_message 내 partial_success 판정 로직과
첨부파일 다운로드 실패 시 에러 메시지 수집을 검증합니다.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock

from app.services.websocket_bridge import WebSocketBridge
from app.services.route_manager import RouteManager
from app.services.message_queue import MessageQueue
from app.schemas.common_message import (
    CommonMessage,
    User,
    Channel,
    Attachment,
    MessageType,
    Platform,
)


def _make_message(
    attachments: list[Attachment] | None = None,
    target_channel: Channel | None = None,
) -> CommonMessage:
    """테스트용 CommonMessage 생성"""
    msg = CommonMessage(
        message_id="msg-att-001",
        timestamp=datetime(2026, 4, 10, 9, 0, 0),
        type=MessageType.IMAGE if attachments else MessageType.TEXT,
        platform=Platform.SLACK,
        user=User(
            id="U001",
            username="tester",
            display_name="Tester",
            platform=Platform.SLACK,
        ),
        channel=Channel(id="C100", name="general", platform=Platform.SLACK),
        text="파일 테스트",
        attachments=attachments or [],
    )
    if target_channel:
        msg.target_channels = [target_channel]
    return msg


class TestSendMessagePartialSuccess:
    """_send_message 첨부파일 실패 시 partial_success 판정 테스트"""

    @pytest.fixture
    def mock_redis(self):
        mock = AsyncMock()
        mock.smembers = AsyncMock(return_value=[])
        mock.hgetall = AsyncMock(return_value={})
        mock.get = AsyncMock(return_value=None)
        return mock

    @pytest.fixture
    def route_manager(self, mock_redis):
        rm = RouteManager(mock_redis)
        rm.get_message_mode = AsyncMock(return_value="sender_info")
        rm.get_thread_mapping = AsyncMock(return_value=None)
        rm.save_thread_mapping = AsyncMock()
        return rm

    @pytest.fixture
    def message_queue(self):
        mq = MessageQueue(batch_size=100, flush_interval=60)
        mq.enqueue_from_common_message = AsyncMock()
        return mq

    @pytest.fixture
    def bridge(self, route_manager, message_queue):
        b = WebSocketBridge(route_manager)
        b.message_queue = message_queue
        return b

    @pytest.mark.asyncio
    async def test_all_attachments_success_status_sent(self, bridge, message_queue):
        """모든 첨부파일 다운로드 성공 → status=sent"""
        att = Attachment(
            id="att-1",
            name="ok.png",
            mime_type="image/png",
            size=1024,
            url="https://slack.com/files/ok.png",
            download_status="pending",
        )
        target = Channel(id="T200", name="General", platform=Platform.TEAMS)
        msg = _make_message(attachments=[att], target_channel=target)

        # Provider 설정
        mock_provider = AsyncMock()
        mock_provider.send_message = AsyncMock(return_value=True)
        mock_provider.last_sent_ts = None
        mock_provider.download_file = AsyncMock(return_value="/tmp/ok.png")
        bridge.providers["teams"] = mock_provider

        # Source provider (Slack)
        mock_source = AsyncMock()
        mock_source.download_file = AsyncMock(return_value="/tmp/ok.png")
        bridge.providers["slack"] = mock_source

        await bridge._send_message(msg)

        message_queue.enqueue_from_common_message.assert_called_once()
        call_kwargs = message_queue.enqueue_from_common_message.call_args[1]
        assert call_kwargs["status"] == "sent"
        assert call_kwargs["error_message"] is None

    @pytest.mark.asyncio
    async def test_some_attachments_fail_status_partial_success(
        self, bridge, message_queue
    ):
        """일부 첨부파일 실패 + 전송 성공 → status=partial_success"""
        att_ok = Attachment(
            id="att-1",
            name="ok.png",
            mime_type="image/png",
            size=1024,
            url="https://slack.com/files/ok.png",
            download_status="pending",
        )
        att_fail = Attachment(
            id="att-2",
            name="fail.jpg",
            mime_type="image/jpeg",
            size=2048,
            url="https://slack.com/files/fail.jpg",
            download_status="pending",
        )
        target = Channel(id="T200", name="General", platform=Platform.TEAMS)
        msg = _make_message(attachments=[att_ok, att_fail], target_channel=target)

        # Teams provider
        mock_provider = AsyncMock()
        mock_provider.send_message = AsyncMock(return_value=True)
        mock_provider.last_sent_ts = None
        bridge.providers["teams"] = mock_provider

        # Source provider — 첫 번째 성공, 두 번째 실패
        mock_source = AsyncMock()

        async def _download_side_effect(file_url, file_id, filename):
            if "fail" in filename:
                return None  # 실패
            return f"/tmp/{filename}"

        mock_source.download_file = AsyncMock(side_effect=_download_side_effect)
        bridge.providers["slack"] = mock_source

        await bridge._send_message(msg)

        message_queue.enqueue_from_common_message.assert_called_once()
        call_kwargs = message_queue.enqueue_from_common_message.call_args[1]
        assert call_kwargs["status"] == "partial_success"
        assert "fail.jpg" in call_kwargs["error_message"]

    @pytest.mark.asyncio
    async def test_all_attachments_fail_but_text_sent(self, bridge, message_queue):
        """모든 첨부 실패 + 텍스트 전송 성공 → partial_success"""
        att = Attachment(
            id="att-1",
            name="broken.pdf",
            mime_type="application/pdf",
            size=0,
            url="https://slack.com/files/broken.pdf",
            download_status="pending",
        )
        target = Channel(id="T200", name="General", platform=Platform.TEAMS)
        msg = _make_message(attachments=[att], target_channel=target)

        mock_provider = AsyncMock()
        mock_provider.send_message = AsyncMock(return_value=True)
        mock_provider.last_sent_ts = None
        bridge.providers["teams"] = mock_provider

        mock_source = AsyncMock()
        mock_source.download_file = AsyncMock(return_value=None)
        bridge.providers["slack"] = mock_source

        await bridge._send_message(msg)

        call_kwargs = message_queue.enqueue_from_common_message.call_args[1]
        assert call_kwargs["status"] == "partial_success"
        assert "broken.pdf" in call_kwargs["error_message"]

    @pytest.mark.asyncio
    async def test_send_fails_with_attachment_error_combined(
        self, bridge, message_queue
    ):
        """전송 실패 + 첨부 실패 → status=failed, 에러 메시지 합산"""
        att = Attachment(
            id="att-1",
            name="fail.png",
            mime_type="image/png",
            size=0,
            url="https://slack.com/files/fail.png",
            download_status="pending",
        )
        target = Channel(id="T200", name="General", platform=Platform.TEAMS)
        msg = _make_message(attachments=[att], target_channel=target)

        mock_provider = AsyncMock()
        mock_provider.send_message = AsyncMock(return_value=False)
        mock_provider.last_sent_ts = None
        mock_provider.last_error = "API rate limited"
        bridge.providers["teams"] = mock_provider

        mock_source = AsyncMock()
        mock_source.download_file = AsyncMock(return_value=None)
        bridge.providers["slack"] = mock_source

        await bridge._send_message(msg)

        call_kwargs = message_queue.enqueue_from_common_message.call_args[1]
        assert call_kwargs["status"] == "failed"
        assert "API rate limited" in call_kwargs["error_message"]
        assert "fail.png" in call_kwargs["error_message"]

    @pytest.mark.asyncio
    async def test_download_exception_sets_download_error(self, bridge, message_queue):
        """다운로드 중 예외 → attachment.download_error에 에러 기록"""
        att = Attachment(
            id="att-1",
            name="crash.png",
            mime_type="image/png",
            size=1024,
            url="https://slack.com/files/crash.png",
            download_status="pending",
        )
        target = Channel(id="T200", name="General", platform=Platform.TEAMS)
        msg = _make_message(attachments=[att], target_channel=target)

        mock_provider = AsyncMock()
        mock_provider.send_message = AsyncMock(return_value=True)
        mock_provider.last_sent_ts = None
        bridge.providers["teams"] = mock_provider

        mock_source = AsyncMock()
        mock_source.download_file = AsyncMock(
            side_effect=Exception("SSL certificate error")
        )
        bridge.providers["slack"] = mock_source

        await bridge._send_message(msg)

        # 메시지가 enqueue된 원본의 attachment를 확인할 수는 없지만
        # target_message의 attachment가 수정되었으므로 partial_success
        call_kwargs = message_queue.enqueue_from_common_message.call_args[1]
        assert call_kwargs["status"] == "partial_success"
        assert "crash.png" in call_kwargs["error_message"]

    @pytest.mark.asyncio
    async def test_no_attachments_simple_sent(self, bridge, message_queue):
        """첨부파일 없는 일반 메시지 → sent"""
        target = Channel(id="T200", name="General", platform=Platform.TEAMS)
        msg = _make_message(target_channel=target)

        mock_provider = AsyncMock()
        mock_provider.send_message = AsyncMock(return_value=True)
        mock_provider.last_sent_ts = None
        bridge.providers["teams"] = mock_provider

        await bridge._send_message(msg)

        call_kwargs = message_queue.enqueue_from_common_message.call_args[1]
        assert call_kwargs["status"] == "sent"
        assert call_kwargs["error_message"] is None
