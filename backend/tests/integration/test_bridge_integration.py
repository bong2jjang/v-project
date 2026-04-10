"""
Bridge 통합 테스트

Slack ↔ Teams 메시지 브리지의 전체 흐름을 검증합니다.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock

from app.services.websocket_bridge import WebSocketBridge
from app.services.route_manager import RouteManager
from app.adapters.slack_provider import SlackProvider
from app.adapters.teams_provider import TeamsProvider
from app.schemas.common_message import (
    CommonMessage,
    User,
    Channel,
    MessageType,
    Platform,
)


class TestBridgeIntegration:
    """브리지 통합 테스트"""

    @pytest.fixture
    def mock_redis(self):
        """Mock Redis 클라이언트"""
        mock = AsyncMock()
        mock.sadd = AsyncMock(return_value=1)
        mock.sismember = AsyncMock(return_value=0)
        mock.smembers = AsyncMock(return_value=[])
        mock.srem = AsyncMock(return_value=1)
        mock.hset = AsyncMock()
        mock.hgetall = AsyncMock(return_value={})
        mock.scan = AsyncMock(return_value=(0, []))
        mock.delete = AsyncMock(return_value=1)
        return mock

    @pytest.fixture
    def route_manager(self, mock_redis):
        """RouteManager 인스턴스"""
        return RouteManager(mock_redis)

    @pytest.fixture
    def bridge(self, route_manager):
        """WebSocketBridge 인스턴스"""
        return WebSocketBridge(route_manager)

    @pytest.mark.asyncio
    async def test_slack_to_teams_message_flow(self, bridge, route_manager):
        """Slack → Teams 메시지 브리지 플로우 테스트"""
        # 1. Provider 생성 (Mock)
        slack_provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        teams_provider = TeamsProvider(
            app_id="test-app",
            app_password="test-pass",
            tenant_id="test-tenant",
        )

        # Provider 연결 메서드 Mock
        slack_provider.connect = AsyncMock(return_value=True)
        teams_provider.connect = AsyncMock(return_value=True)
        slack_provider.send_message = AsyncMock(return_value=True)
        teams_provider.send_message = AsyncMock(return_value=True)

        # 2. Provider 등록
        await bridge.add_provider(slack_provider)
        await bridge.add_provider(teams_provider)

        # 3. 라우팅 룰 추가
        await route_manager.add_route(
            source_platform="slack",
            source_channel="C123456",
            target_platform="teams",
            target_channel="channel-789",
            target_channel_name="General",
        )

        # 4. Slack 메시지 생성
        slack_user = User(
            id="U123456",
            username="john.doe",
            display_name="John Doe",
            platform=Platform.SLACK,
        )
        slack_channel = Channel(id="C123456", name="general", platform=Platform.SLACK)

        slack_message = CommonMessage(
            message_id="msg-123",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.SLACK,
            user=slack_user,
            channel=slack_channel,
            text="Hello from Slack!",
        )

        # 5. 메시지 라우팅
        # route_manager.get_targets를 Mock하여 Teams 채널 반환
        teams_channel = Channel(
            id="channel-789", name="General", platform=Platform.TEAMS
        )
        route_manager.get_targets = AsyncMock(return_value=[teams_channel])

        await bridge._route_message(slack_message)

        # 6. 검증: Teams Provider의 send_message가 호출되었는지 확인
        teams_provider.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_teams_to_slack_message_flow(self, bridge, route_manager):
        """Teams → Slack 메시지 브리지 플로우 테스트"""
        # 1. Provider 생성 (Mock)
        slack_provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        teams_provider = TeamsProvider(
            app_id="test-app",
            app_password="test-pass",
            tenant_id="test-tenant",
        )

        # Provider 연결 메서드 Mock
        slack_provider.connect = AsyncMock(return_value=True)
        teams_provider.connect = AsyncMock(return_value=True)
        slack_provider.send_message = AsyncMock(return_value=True)
        teams_provider.send_message = AsyncMock(return_value=True)

        # 2. Provider 등록
        await bridge.add_provider(slack_provider)
        await bridge.add_provider(teams_provider)

        # 3. 라우팅 룰 추가
        await route_manager.add_route(
            source_platform="teams",
            source_channel="channel-789",
            target_platform="slack",
            target_channel="C123456",
            target_channel_name="general",
        )

        # 4. Teams 메시지 생성
        teams_user = User(
            id="user-456",
            username="jane.smith",
            display_name="Jane Smith",
            platform=Platform.TEAMS,
        )
        teams_channel = Channel(
            id="channel-789", name="General", platform=Platform.TEAMS
        )

        teams_message = CommonMessage(
            message_id="msg-456",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.TEAMS,
            user=teams_user,
            channel=teams_channel,
            text="Hello from Teams!",
        )

        # 5. 메시지 라우팅
        # route_manager.get_targets를 Mock하여 Slack 채널 반환
        slack_channel = Channel(id="C123456", name="general", platform=Platform.SLACK)
        route_manager.get_targets = AsyncMock(return_value=[slack_channel])

        await bridge._route_message(teams_message)

        # 6. 검증: Slack Provider의 send_message가 호출되었는지 확인
        slack_provider.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_bridge_status(self, bridge):
        """브리지 상태 조회 테스트"""
        # Provider 생성 및 등록 (Mock)
        slack_provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        teams_provider = TeamsProvider(
            app_id="test-app",
            app_password="test-pass",
            tenant_id="test-tenant",
        )

        slack_provider.connect = AsyncMock(return_value=True)
        teams_provider.connect = AsyncMock(return_value=True)

        await bridge.add_provider(slack_provider)
        await bridge.add_provider(teams_provider)

        # 상태 조회
        status = bridge.get_status()

        assert status["is_running"] is False
        assert len(status["providers"]) == 2

        # Provider 이름 확인
        provider_names = [p["platform"] for p in status["providers"]]
        assert "slack" in provider_names
        assert "teams" in provider_names


class TestMessageTransformation:
    """메시지 변환 통합 테스트"""

    def test_slack_to_teams_transformation(self):
        """Slack → Common → Teams 변환 테스트"""
        # 1. Slack 메시지
        slack_event = {
            "type": "message",
            "user": "U123456",
            "text": "Hello World",
            "channel": "C789012",
            "ts": "1234567890.123456",
        }

        # 2. Slack → Common Schema
        slack_provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        common_msg = slack_provider.transform_to_common(slack_event)

        assert common_msg.platform == Platform.SLACK
        assert common_msg.text == "Hello World"

        # 3. Common Schema → Teams
        # 플랫폼을 Teams로 변경
        common_msg.platform = Platform.TEAMS
        common_msg.channel = Channel(
            id="channel-789", name="General", platform=Platform.TEAMS
        )

        teams_provider = TeamsProvider(
            app_id="test-app",
            app_password="test-pass",
            tenant_id="test-tenant",
        )
        teams_msg = teams_provider.transform_from_common(common_msg)

        # transform_from_common은 sender info prefix를 추가함
        assert "Hello World" in teams_msg["body"]["content"]
        assert teams_msg["body"]["contentType"] == "html"

    def test_teams_to_slack_transformation(self):
        """Teams → Common → Slack 변환 테스트"""
        # 1. Teams Activity
        teams_activity = {
            "id": "activity-123",
            "timestamp": "2026-03-31T10:00:00Z",
            "type": "message",
            "text": "Hello Teams",
            "from": {"id": "user-456", "name": "Jane Smith"},
            "channelId": "teams",
            "conversation": {"id": "channel-789"},
        }

        # 2. Teams → Common Schema
        teams_provider = TeamsProvider(
            app_id="test-app",
            app_password="test-pass",
            tenant_id="test-tenant",
        )
        common_msg = teams_provider.transform_to_common(teams_activity)

        assert common_msg.platform == Platform.TEAMS
        assert common_msg.text == "Hello Teams"

        # 3. Common Schema → Slack
        # 플랫폼을 Slack으로 변경
        common_msg.platform = Platform.SLACK
        common_msg.channel = Channel(
            id="C123456", name="general", platform=Platform.SLACK
        )

        slack_provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
        slack_msg = slack_provider.transform_from_common(common_msg)

        assert slack_msg["channel"] == "C123456"
        assert slack_msg["text"] == "Hello Teams"
