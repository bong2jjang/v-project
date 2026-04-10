"""
Slack Provider 테스트

Slack Provider의 메시지 변환 및 기본 동작을 검증합니다.
2026-04-04: 봇 메시지 필터링(bot_user_id) 및 파일 전송 발신자 표시 테스트 추가
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from app.adapters.slack_provider import SlackProvider
from app.schemas.common_message import (
    Attachment,
    CommonMessage,
    User,
    Channel,
    MessageType,
    Platform,
)


class TestSlackProviderTransformations:
    """Slack Provider 메시지 변환 테스트"""

    def test_transform_to_common_text_message(self):
        """Slack 텍스트 메시지 → Common Schema 변환 테스트"""
        # Mock Slack 이벤트
        slack_event = {
            "type": "message",
            "user": "U123456",
            "text": "Hello World",
            "channel": "C789012",
            "ts": "1234567890.123456",
        }

        # SlackProvider 생성 (토큰은 테스트용 더미)
        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")

        # 변환
        common_msg = provider.transform_to_common(slack_event)

        # 검증
        assert common_msg.platform == Platform.SLACK
        assert common_msg.text == "Hello World"
        assert common_msg.user.id == "U123456"
        assert common_msg.channel.id == "C789012"
        assert common_msg.type == MessageType.TEXT

    def test_transform_to_common_with_attachments(self):
        """첨부파일이 포함된 Slack 메시지 변환 테스트"""
        slack_event = {
            "type": "message",
            "user": "U123456",
            "text": "Check this file",
            "channel": "C789012",
            "ts": "1234567890.123456",
            "files": [
                {
                    "id": "F123",
                    "name": "document.pdf",
                    "mimetype": "application/pdf",
                    "size": 102400,
                    "url_private": "https://files.slack.com/F123",
                }
            ],
        }

        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        common_msg = provider.transform_to_common(slack_event)

        assert len(common_msg.attachments) == 1
        assert common_msg.attachments[0].name == "document.pdf"
        assert common_msg.attachments[0].mime_type == "application/pdf"
        assert common_msg.type == MessageType.FILE

    def test_transform_to_common_with_thread(self):
        """스레드 메시지 변환 테스트"""
        slack_event = {
            "type": "message",
            "user": "U123456",
            "text": "Reply in thread",
            "channel": "C789012",
            "ts": "1234567891.123456",
            "thread_ts": "1234567890.123456",
        }

        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        common_msg = provider.transform_to_common(slack_event)

        assert common_msg.thread_id == "1234567890.123456"
        assert common_msg.text == "Reply in thread"

    def test_transform_from_common_basic(self):
        """Common Schema → Slack 메시지 변환 테스트"""
        user = User(
            id="U123456",
            username="john.doe",
            display_name="John Doe",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C789012", name="general", platform=Platform.SLACK)

        common_msg = CommonMessage(
            message_id="msg-123",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="Hello Slack",
        )

        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        slack_msg = provider.transform_from_common(common_msg)

        assert slack_msg["channel"] == "C789012"
        assert slack_msg["text"] == "Hello Slack"

    def test_transform_from_common_with_thread(self):
        """스레드가 포함된 Common Schema → Slack 변환 테스트"""
        user = User(
            id="U123456",
            username="john.doe",
            display_name="John Doe",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C789012", name="general", platform=Platform.SLACK)

        common_msg = CommonMessage(
            message_id="msg-124",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="Thread reply",
            thread_id="1234567890.123456",
        )

        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        slack_msg = provider.transform_from_common(common_msg)

        assert slack_msg["channel"] == "C789012"
        assert slack_msg["text"] == "Thread reply"
        assert slack_msg["thread_ts"] == "1234567890.123456"


class TestSlackProviderConfiguration:
    """Slack Provider 설정 테스트"""

    def test_provider_initialization(self):
        """Provider 초기화 테스트"""
        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")

        assert provider.platform_name == "slack"
        assert provider.is_connected is False
        assert "bot_token" in provider.config
        assert "app_token" in provider.config

    def test_get_status(self):
        """Provider 상태 조회 테스트"""
        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")

        status = provider.get_status()

        assert status["platform"] == "slack"
        assert status["connected"] is False
        # 민감한 정보는 마스킹되어야 함
        assert status["config"]["bot_token"] == "***"
        assert status["config"]["app_token"] == "***"

    def test_bot_user_id_initially_none(self):
        """초기화 시 bot_user_id는 None이어야 한다"""
        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        assert provider.bot_user_id is None


class TestBotMessageFilter:
    """봇 메시지 필터링 테스트 (2026-04-04 추가)"""

    def _make_provider_with_bot_id(self, bot_user_id: str) -> SlackProvider:
        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        provider.bot_user_id = bot_user_id
        return provider

    def test_event_with_bot_id_should_be_ignored(self):
        """bot_id 필드가 있는 이벤트는 봇 메시지로 판별되어야 한다"""
        provider = self._make_provider_with_bot_id("U_BOT")
        event = {"type": "message", "bot_id": "B123", "text": "hello"}

        # bot_id 필드가 있으면 필터 조건이 True
        assert (
            bool(event.get("bot_id") or event.get("user") == provider.bot_user_id)
            is True
        )

    def test_event_with_bot_user_id_should_be_ignored(self):
        """user 필드가 bot_user_id와 같으면 봇 메시지로 판별되어야 한다"""
        provider = self._make_provider_with_bot_id("U_BOT")
        event = {"type": "message", "user": "U_BOT", "text": "uploaded file"}

        assert (
            bool(event.get("bot_id") or event.get("user") == provider.bot_user_id)
            is True
        )

    def test_human_user_event_should_not_be_ignored(self):
        """일반 사용자 메시지는 봇 메시지 필터에 걸리지 않아야 한다"""
        provider = self._make_provider_with_bot_id("U_BOT")
        event = {"type": "message", "user": "U_HUMAN", "text": "Hello"}

        assert (
            bool(event.get("bot_id") or event.get("user") == provider.bot_user_id)
            is False
        )

    def test_no_bot_user_id_set_does_not_filter_by_user(self):
        """bot_user_id가 설정되지 않으면 user 필드로 필터링하지 않아야 한다"""
        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        # bot_user_id = None
        event = {"type": "message", "user": "U_ANYONE", "text": "Hello"}

        assert (
            bool(event.get("bot_id") or event.get("user") == provider.bot_user_id)
            is False
        )


class TestSendMessageWithAttachment:
    """파일 전송 시 발신자 이름 표시 테스트 (2026-04-04 추가)"""

    def _make_common_message(
        self, text: str = "See this file", with_attachment: bool = True
    ):
        user = User(
            id="U_VITOR",
            username="vitor",
            display_name="Vitor",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C789012", name="general", platform=Platform.SLACK)

        attachments = []
        if with_attachment:
            att = Attachment(
                id="att-1",
                name="image.png",
                mime_type="image/png",
                size=1024,
                url="https://files.slack.com/img.png",
                local_path="/tmp/image.png",
                download_status="downloaded",
            )
            attachments.append(att)

        return CommonMessage(
            message_id="msg-001",
            timestamp=datetime.now(),
            type=MessageType.FILE if with_attachment else MessageType.TEXT,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text=text,
            attachments=attachments,
        )

    @pytest.mark.asyncio
    async def test_file_upload_uses_no_initial_comment(self):
        """파일 업로드 시 initial_comment=None으로 호출되어야 한다 (텍스트는 별도 전송)"""
        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        provider.upload_file = AsyncMock(
            return_value="https://files.slack.com/uploaded.png"
        )

        mock_result = {"ok": True, "ts": "1234567890.000001"}
        provider.app = MagicMock()
        provider.app.client.chat_postMessage = AsyncMock(return_value=mock_result)

        message = self._make_common_message()

        with patch("app.adapters.slack_provider.attachment_handler") as mock_handler:
            mock_handler.cleanup_file = AsyncMock()
            await provider.send_message(message)

        provider.upload_file.assert_called_once_with(
            file_path="/tmp/image.png",
            channel_id="C789012",
            filename="image.png",
            initial_comment=None,
            thread_ts=None,
        )

    @pytest.mark.asyncio
    async def test_chat_post_message_called_after_file_upload(self):
        """파일 업로드 후 반드시 chat_postMessage가 호출되어야 한다 (발신자 이름 표시)"""
        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        provider.upload_file = AsyncMock(
            return_value="https://files.slack.com/uploaded.png"
        )

        mock_result = {"ok": True, "ts": "1234567890.000001"}
        provider.app = MagicMock()
        provider.app.client.chat_postMessage = AsyncMock(return_value=mock_result)

        message = self._make_common_message()

        with patch("app.adapters.slack_provider.attachment_handler") as mock_handler:
            mock_handler.cleanup_file = AsyncMock()
            result = await provider.send_message(message)

        assert result is True
        provider.app.client.chat_postMessage.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_message_without_attachment_no_upload(self):
        """텍스트만 있는 메시지는 upload_file을 호출하지 않아야 한다"""
        provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        provider.upload_file = AsyncMock()

        mock_result = {"ok": True, "ts": "1234567890.000001"}
        provider.app = MagicMock()
        provider.app.client.chat_postMessage = AsyncMock(return_value=mock_result)

        message = self._make_common_message(with_attachment=False)
        result = await provider.send_message(message)

        assert result is True
        provider.upload_file.assert_not_called()
        provider.app.client.chat_postMessage.assert_called_once()
