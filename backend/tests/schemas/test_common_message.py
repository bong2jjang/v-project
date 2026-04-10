"""
Common Message Schema 테스트

Common Schema의 기본 동작과 변환 로직을 검증합니다.
"""

from datetime import datetime
from app.schemas.common_message import (
    CommonMessage,
    User,
    Channel,
    Attachment,
    MessageType,
    Platform,
)


class TestCommonMessage:
    """CommonMessage 기본 동작 테스트"""

    def test_create_text_message(self):
        """텍스트 메시지 생성 테스트"""
        user = User(
            id="U123456",
            username="john.doe",
            display_name="John Doe",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C789012", name="general", platform=Platform.SLACK)

        message = CommonMessage(
            message_id="msg-123",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="Hello World",
        )

        assert message.text == "Hello World"
        assert message.platform == Platform.SLACK
        assert message.type == MessageType.TEXT
        assert message.user.id == "U123456"
        assert message.channel.id == "C789012"

    def test_message_with_attachments(self):
        """첨부파일이 포함된 메시지 테스트"""
        user = User(
            id="U123456",
            username="john.doe",
            display_name="John Doe",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C789012", name="general", platform=Platform.SLACK)

        attachment = Attachment(
            id="att-123",
            name="screenshot.png",
            mime_type="image/png",
            size=102400,
            url="https://example.com/files/screenshot.png",
        )

        message = CommonMessage(
            message_id="msg-456",
            timestamp=datetime.now(),
            type=MessageType.IMAGE,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="Check this out",
            attachments=[attachment],
        )

        assert len(message.attachments) == 1
        assert message.attachments[0].name == "screenshot.png"
        assert message.attachments[0].mime_type == "image/png"

    def test_is_command(self):
        """커맨드 메시지 감지 테스트"""
        user = User(
            id="U123456",
            username="john.doe",
            display_name="John Doe",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C789012", name="general", platform=Platform.SLACK)

        # 커맨드 메시지
        cmd_message = CommonMessage(
            message_id="msg-789",
            timestamp=datetime.now(),
            type=MessageType.COMMAND,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="/vms status",
        )

        assert cmd_message.is_command() is True

        # 일반 메시지
        text_message = CommonMessage(
            message_id="msg-790",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="Hello",
        )

        assert text_message.is_command() is False

    def test_parse_command(self):
        """커맨드 파싱 테스트"""
        user = User(
            id="U123456",
            username="john.doe",
            display_name="John Doe",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C789012", name="general", platform=Platform.SLACK)

        message = CommonMessage(
            message_id="msg-901",
            timestamp=datetime.now(),
            type=MessageType.COMMAND,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="/vms status --verbose",
        )

        command, args = message.parse_command()

        assert command == "/vms"
        assert args == ["status", "--verbose"]

    def test_parse_command_no_args(self):
        """인자 없는 커맨드 파싱 테스트"""
        user = User(
            id="U123456",
            username="john.doe",
            display_name="John Doe",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C789012", name="general", platform=Platform.SLACK)

        message = CommonMessage(
            message_id="msg-902",
            timestamp=datetime.now(),
            type=MessageType.COMMAND,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="/help",
        )

        command, args = message.parse_command()

        assert command == "/help"
        assert args == []

    def test_thread_message(self):
        """스레드 메시지 테스트"""
        user = User(
            id="U123456",
            username="john.doe",
            display_name="John Doe",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C789012", name="general", platform=Platform.SLACK)

        reply_message = CommonMessage(
            message_id="msg-101",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="Reply message",
            thread_id="msg-100",
            parent_id="msg-100",
        )

        assert reply_message.thread_id == "msg-100"
        assert reply_message.parent_id == "msg-100"


class TestAttachmentDownloadFields:
    """Attachment 다운로드 관련 필드 테스트"""

    def test_download_error_field(self):
        """download_error 필드가 정상 설정됨"""
        att = Attachment(
            id="att-001",
            name="file.png",
            mime_type="image/png",
            size=1024,
            url="https://example.com/file.png",
            download_status="failed",
            download_error="HTTP 403: Forbidden",
        )
        assert att.download_error == "HTTP 403: Forbidden"
        assert att.download_status == "failed"

    def test_download_error_default_none(self):
        """download_error 기본값은 None"""
        att = Attachment(
            id="att-002",
            name="ok.pdf",
            mime_type="application/pdf",
            size=5000,
            url="https://example.com/ok.pdf",
        )
        assert att.download_error is None
        assert att.download_status == "pending"

    def test_download_status_lifecycle(self):
        """다운로드 상태 전이: pending → downloaded → uploaded"""
        att = Attachment(
            id="att-003",
            name="doc.xlsx",
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            size=20000,
            url="https://example.com/doc.xlsx",
        )
        assert att.download_status == "pending"

        att.download_status = "downloaded"
        att.local_path = "/tmp/vms-attachments/doc.xlsx"
        assert att.download_status == "downloaded"

        att.download_status = "uploaded"
        att.delivered_url = "https://teams.com/files/doc.xlsx"
        assert att.download_status == "uploaded"
        assert att.delivered_url is not None

    def test_attachment_serialization_with_download_error(self):
        """download_error가 JSON 직렬화에 포함됨"""
        att = Attachment(
            id="att-004",
            name="fail.jpg",
            mime_type="image/jpeg",
            size=0,
            url="https://example.com/fail.jpg",
            download_status="failed",
            download_error="Connection timeout after 30s",
        )
        data = att.model_dump()
        assert data["download_error"] == "Connection timeout after 30s"
        assert data["download_status"] == "failed"


class TestSlackTransformation:
    """Slack 메시지 변환 테스트 (가상)"""

    def test_slack_to_common_basic(self):
        """
        Slack 메시지 → Common Schema 변환 테스트

        실제 SlackProvider 구현 시 사용할 테스트 케이스
        """
        slack_event = {
            "type": "message",
            "user": "U123456",
            "text": "Hello World",
            "channel": "C789012",
            "ts": "1234567890.123456",
        }

        # SlackProvider 구현 시 이 로직 사용
        # common_msg = slack_provider.transform_to_common(slack_event)

        # 예상 결과
        expected_text = "Hello World"
        expected_user_id = "U123456"

        assert slack_event["user"] == expected_user_id
        assert slack_event["text"] == expected_text

    def test_common_to_slack_basic(self):
        """
        Common Schema → Slack 메시지 변환 테스트

        실제 SlackProvider 구현 시 사용할 테스트 케이스
        """
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
            text="Hello World",
        )

        # SlackProvider 구현 시 이 로직 사용
        # slack_msg = slack_provider.transform_from_common(common_msg)

        # 예상 결과
        expected_slack_msg = {"channel": "C789012", "text": "Hello World"}

        assert common_msg.channel.id == expected_slack_msg["channel"]
        assert common_msg.text == expected_slack_msg["text"]


class TestTeamsTransformation:
    """Teams 메시지 변환 테스트 (가상)"""

    def test_teams_to_common_basic(self):
        """
        Teams Activity → Common Schema 변환 테스트

        실제 TeamsProvider 구현 시 사용할 테스트 케이스
        """
        teams_activity = {
            "id": "activity-123",
            "timestamp": "2026-03-31T10:00:00Z",
            "type": "message",
            "text": "Hello Teams",
            "from": {"id": "user-456", "name": "Jane Smith"},
            "channelId": "channel-789",
        }

        # TeamsProvider 구현 시 이 로직 사용
        # common_msg = teams_provider.transform_to_common(teams_activity)

        # 예상 결과
        expected_text = "Hello Teams"
        expected_user_id = "user-456"

        assert teams_activity["from"]["id"] == expected_user_id
        assert teams_activity["text"] == expected_text

    def test_common_to_teams_basic(self):
        """
        Common Schema → Teams Activity 변환 테스트

        실제 TeamsProvider 구현 시 사용할 테스트 케이스
        """
        user = User(
            id="user-456",
            username="jane.smith",
            display_name="Jane Smith",
            platform=Platform.TEAMS,
        )
        channel = Channel(id="channel-789", name="General", platform=Platform.TEAMS)

        common_msg = CommonMessage(
            message_id="msg-123",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.TEAMS,
            user=user,
            channel=channel,
            text="Hello Teams",
        )

        # TeamsProvider 구현 시 이 로직 사용
        # teams_activity = teams_provider.transform_from_common(common_msg)

        # 예상 결과
        expected_channel = "channel-789"
        expected_text = "Hello Teams"

        assert common_msg.channel.id == expected_channel
        assert common_msg.text == expected_text
