"""
Teams Provider 테스트

Teams Provider의 메시지 변환 및 기본 동작을 검증합니다.
"""

from datetime import datetime
import pytest
from app.adapters.teams_provider import TeamsProvider, _markdown_to_teams_html
from app.schemas.common_message import (
    CommonMessage,
    User,
    Channel,
    MessageType,
    Platform,
)


class TestTeamsProviderTransformations:
    """Teams Provider 메시지 변환 테스트"""

    def test_transform_to_common_text_message(self):
        """Teams Activity → Common Schema 변환 테스트"""
        teams_activity = {
            "id": "activity-123",
            "timestamp": "2026-03-31T10:00:00Z",
            "type": "message",
            "text": "Hello Teams",
            "from": {"id": "user-456", "name": "Jane Smith"},
            "channelId": "teams",
            "conversation": {"id": "channel-789"},
        }

        provider = TeamsProvider(
            app_id="test-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
        )
        common_msg = provider.transform_to_common(teams_activity)

        assert common_msg.platform == Platform.TEAMS
        assert common_msg.text == "Hello Teams"
        assert common_msg.user.id == "user-456"
        assert common_msg.user.display_name == "Jane Smith"
        assert common_msg.type == MessageType.TEXT

    def test_transform_to_common_with_attachments(self):
        """첨부파일이 포함된 Teams 메시지 변환 테스트"""
        teams_activity = {
            "id": "activity-124",
            "timestamp": "2026-03-31T10:05:00Z",
            "type": "message",
            "text": "Check this file",
            "from": {"id": "user-456", "name": "Jane Smith"},
            "channelId": "teams",
            "conversation": {"id": "channel-789"},
            "attachments": [
                {
                    "id": "att-123",
                    "name": "presentation.pptx",
                    "contentType": "application/vnd.ms-powerpoint",
                    "contentUrl": "https://teams.microsoft.com/files/att-123",
                }
            ],
        }

        provider = TeamsProvider(
            app_id="test-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
        )
        common_msg = provider.transform_to_common(teams_activity)

        assert len(common_msg.attachments) == 1
        assert common_msg.attachments[0].name == "presentation.pptx"
        assert common_msg.attachments[0].mime_type == "application/vnd.ms-powerpoint"
        assert common_msg.type == MessageType.FILE

    def test_transform_from_common_basic(self):
        """Common Schema → Teams 메시지 변환 — HTML 발신자 prefix 포함"""
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

        provider = TeamsProvider(
            app_id="test-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
        )
        teams_msg = provider.transform_from_common(common_msg)

        # contentType은 "html"
        assert teams_msg["body"]["contentType"] == "html"

        # 발신자 prefix가 포함됨 — "[TEAMS] Jane Smith"
        content = teams_msg["body"]["content"]
        assert "[TEAMS] Jane Smith" in content
        assert "Hello Teams" in content

    def test_transform_from_common_slack_source(self):
        """Slack 발신 메시지는 platform prefix가 [SLACK]으로 표시됨"""
        user = User(
            id="U123",
            username="viktor",
            display_name="Viktor",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C456", name="general", platform=Platform.SLACK)
        common_msg = CommonMessage(
            message_id="msg-slack",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="Hello from Slack",
        )

        provider = TeamsProvider(
            app_id="test-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
        )
        teams_msg = provider.transform_from_common(common_msg)

        content = teams_msg["body"]["content"]
        assert "[SLACK] Viktor" in content
        assert "Hello from Slack" in content
        assert teams_msg["body"]["contentType"] == "html"

    def test_transform_from_common_with_attachments(self):
        """첨부파일이 포함된 Common Schema → Teams 변환 테스트"""
        from app.schemas.common_message import Attachment

        user = User(
            id="user-456",
            username="jane.smith",
            display_name="Jane Smith",
            platform=Platform.TEAMS,
        )
        channel = Channel(id="channel-789", name="General", platform=Platform.TEAMS)

        attachment = Attachment(
            id="att-123",
            name="document.pdf",
            mime_type="application/pdf",
            size=102400,
            url="https://files.example.com/document.pdf",
        )

        common_msg = CommonMessage(
            message_id="msg-124",
            timestamp=datetime.now(),
            type=MessageType.FILE,
            platform=Platform.TEAMS,
            user=user,
            channel=channel,
            text="See attachment",
            attachments=[attachment],
        )

        provider = TeamsProvider(
            app_id="test-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
        )
        # extra_html로 파일 링크 전달 (send_message에서 upload 후 삽입)
        file_link = '<a href="https://files.example.com/document.pdf">document.pdf</a>'
        teams_msg = provider.transform_from_common(common_msg, extra_html=[file_link])

        content = teams_msg["body"]["content"]
        assert "See attachment" in content
        assert "document.pdf" in content

    def test_transform_from_common_extra_html(self):
        """extra_html 파일 링크가 본문 뒤에 추가됨"""
        user = User(
            id="U1",
            username="alice",
            display_name="Alice",
            platform=Platform.SLACK,
        )
        channel = Channel(id="C1", name="general", platform=Platform.SLACK)
        common_msg = CommonMessage(
            message_id="m1",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text="File attached",
        )

        provider = TeamsProvider(
            app_id="test-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
        )
        teams_msg = provider.transform_from_common(
            common_msg,
            extra_html=['<a href="http://example.com/f.txt">f.txt</a>'],
        )

        assert "f.txt" in teams_msg["body"]["content"]


class TestTeamsProviderConfiguration:
    """Teams Provider 설정 테스트"""

    def test_provider_initialization(self):
        """Provider 초기화 테스트"""
        provider = TeamsProvider(
            app_id="test-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
            team_id="test-team-id",
        )

        assert provider.platform_name == "teams"
        assert provider.is_connected is False
        assert "app_id" in provider.config
        assert "app_password" in provider.config
        assert "tenant_id" in provider.config
        assert "team_id" in provider.config

    def test_bot_app_id_set_on_init(self):
        """bot_app_id가 초기화 시 설정됨"""
        provider = TeamsProvider(
            app_id="my-bot-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
        )
        assert provider.bot_app_id == "my-bot-app-id"

    def test_last_sent_ts_initially_none(self):
        """last_sent_ts가 초기화 시 None"""
        provider = TeamsProvider(
            app_id="test-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
        )
        assert provider.last_sent_ts is None

    def test_token_expires_at_initially_none(self):
        """_token_expires_at이 초기화 시 None"""
        provider = TeamsProvider(
            app_id="test-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
        )
        assert provider._token_expires_at is None

    def test_get_status(self):
        """Provider 상태 조회 테스트"""
        provider = TeamsProvider(
            app_id="test-app-id",
            app_password="test-password",
            tenant_id="test-tenant-id",
        )

        status = provider.get_status()

        assert status["platform"] == "teams"
        assert status["connected"] is False
        # app_password는 마스킹, app_id는 노출됨 (base.py: 'password' 키만 마스킹)
        assert status["config"]["app_password"] == "***"
        assert status["config"]["app_id"] == "test-app-id"


class TestParseChannelRef:
    """_parse_channel_ref 메서드 테스트"""

    def test_teamid_colon_channelid(self):
        """'teamId:channelId' 형식 파싱"""
        provider = TeamsProvider(
            app_id="a",
            app_password="b",
            tenant_id="c",
        )
        team_id, channel_id = provider._parse_channel_ref("TEAM123:19:xxx@thread.tacv2")
        assert team_id == "TEAM123"
        assert channel_id == "19:xxx@thread.tacv2"

    def test_plain_channel_id_uses_config(self):
        """단독 channelId는 config의 team_id 사용"""
        provider = TeamsProvider(
            app_id="a",
            app_password="b",
            tenant_id="c",
            team_id="CONFIG_TEAM",
        )
        team_id, channel_id = provider._parse_channel_ref("19:yyy@thread.tacv2")
        assert team_id == "CONFIG_TEAM"
        assert channel_id == "19:yyy@thread.tacv2"

    def test_no_team_id_returns_none(self):
        """team_id 미설정 시 None 반환"""
        provider = TeamsProvider(
            app_id="a",
            app_password="b",
            tenant_id="c",
        )
        team_id, channel_id = provider._parse_channel_ref("19:yyy@thread.tacv2")
        assert team_id is None
        assert channel_id == "19:yyy@thread.tacv2"


class TestBotSelfMessageFilter:
    """봇 자신의 메시지 필터 테스트"""

    @pytest.mark.asyncio
    async def test_ignores_own_app_id(self):
        """봇 자신의 app_id에서 온 Activity는 큐에 추가되지 않음"""
        from botbuilder.schema import Activity, ChannelAccount, ConversationAccount

        provider = TeamsProvider(
            app_id="my-bot-app-id",
            app_password="p",
            tenant_id="t",
        )
        provider.is_connected = True

        activity = Activity(
            type="message",
            text="Bot echo",
            from_property=ChannelAccount(id="my-bot-app-id", name="Bot"),
            channel_id="teams",
            conversation=ConversationAccount(id="conv-1"),
        )

        await provider.handle_activity(activity)

        # 큐가 비어있어야 함
        assert provider._message_queue.empty()

    @pytest.mark.asyncio
    async def test_passes_human_message(self):
        """사람 사용자의 Activity는 큐에 추가됨"""
        from botbuilder.schema import Activity, ChannelAccount, ConversationAccount

        provider = TeamsProvider(
            app_id="my-bot-app-id",
            app_password="p",
            tenant_id="t",
        )
        provider.is_connected = True

        activity = Activity(
            id="act-1",
            type="message",
            text="Hello from human",
            from_property=ChannelAccount(id="user-999", name="Alice"),
            channel_id="teams",
            conversation=ConversationAccount(id="conv-2"),
        )

        await provider.handle_activity(activity)

        assert not provider._message_queue.empty()
        msg = await provider._message_queue.get()
        assert msg.user.id == "user-999"
        assert msg.text == "Hello from human"

    @pytest.mark.asyncio
    async def test_ignores_non_message_activity(self):
        """type이 message가 아닌 Activity는 무시됨"""
        from botbuilder.schema import Activity, ChannelAccount, ConversationAccount

        provider = TeamsProvider(
            app_id="my-bot-app-id",
            app_password="p",
            tenant_id="t",
        )
        provider.is_connected = True

        activity = Activity(
            type="conversationUpdate",
            from_property=ChannelAccount(id="user-1", name="Alice"),
            channel_id="teams",
            conversation=ConversationAccount(id="conv-3"),
        )

        await provider.handle_activity(activity)

        assert provider._message_queue.empty()


class TestMarkdownToHtml:
    """_markdown_to_teams_html 변환 테스트"""

    def test_bold(self):
        assert _markdown_to_teams_html("**hello**") == "<b>hello</b>"

    def test_italic_asterisk(self):
        assert _markdown_to_teams_html("*hello*") == "<i>hello</i>"

    def test_italic_underscore(self):
        assert _markdown_to_teams_html("_hello_") == "<i>hello</i>"

    def test_code(self):
        assert _markdown_to_teams_html("`code`") == "<code>code</code>"

    def test_newline(self):
        assert _markdown_to_teams_html("line1\nline2") == "line1<br>line2"

    def test_plain_text_unchanged(self):
        assert _markdown_to_teams_html("hello world") == "hello world"
