"""v-channel-bridge 설정 관리 테스트

네이티브 WebSocket 브리지의 라우트 및 Provider 설정 관련 테스트입니다.
(이전 TOML 기반 ConfigManager는 제거되었습니다.)
"""

from unittest.mock import AsyncMock

import pytest

from app.services.websocket_bridge import WebSocketBridge


@pytest.fixture
def mock_route_manager():
    """모킹된 RouteManager"""
    rm = AsyncMock()
    rm.get_all_routes.return_value = []
    rm.get_targets.return_value = []
    return rm


@pytest.fixture
def bridge(mock_route_manager):
    """테스트용 WebSocketBridge 인스턴스"""
    return WebSocketBridge(route_manager=mock_route_manager)


class TestBridgeProviderManagement:
    """Provider 등록/제거 테스트"""

    @pytest.mark.asyncio
    async def test_add_provider_success(self, bridge):
        """Provider 등록 성공"""
        provider = AsyncMock()
        provider.platform_name = "slack"
        provider.connect.return_value = True

        result = await bridge.add_provider(provider)
        assert result is True
        assert "slack" in bridge.providers

    @pytest.mark.asyncio
    async def test_add_provider_connection_failure(self, bridge):
        """Provider 연결 실패"""
        provider = AsyncMock()
        provider.platform_name = "slack"
        provider.connect.return_value = False

        result = await bridge.add_provider(provider)
        assert result is False
        assert "slack" not in bridge.providers

    @pytest.mark.asyncio
    async def test_add_duplicate_provider(self, bridge):
        """중복 Provider 등록 시도"""
        provider1 = AsyncMock()
        provider1.platform_name = "slack"
        provider1.connect.return_value = True

        provider2 = AsyncMock()
        provider2.platform_name = "slack"
        provider2.connect.return_value = True

        await bridge.add_provider(provider1)
        result = await bridge.add_provider(provider2)
        assert result is False  # 이미 등록됨

    @pytest.mark.asyncio
    async def test_remove_provider_success(self, bridge):
        """Provider 제거 성공"""
        provider = AsyncMock()
        provider.platform_name = "slack"
        provider.connect.return_value = True

        await bridge.add_provider(provider)
        result = await bridge.remove_provider("slack")

        assert result is True
        assert "slack" not in bridge.providers
        provider.disconnect.assert_called_once()

    @pytest.mark.asyncio
    async def test_remove_nonexistent_provider(self, bridge):
        """존재하지 않는 Provider 제거"""
        result = await bridge.remove_provider("slack")
        assert result is False


class TestBridgeStatus:
    """브리지 상태 조회 테스트"""

    def test_initial_status(self, bridge):
        """초기 상태"""
        status = bridge.get_status()
        assert status["is_running"] is False
        assert status["providers"] == []
        assert status["active_tasks"] == 0

    @pytest.mark.asyncio
    async def test_status_with_providers(self, bridge):
        """Provider가 등록된 상태"""
        provider = AsyncMock()
        provider.platform_name = "slack"
        provider.connect.return_value = True
        provider.get_status.return_value = {
            "platform": "slack",
            "connected": True,
        }

        await bridge.add_provider(provider)

        status = bridge.get_status()
        assert len(status["providers"]) == 1


class TestBridgeLifecycle:
    """브리지 시작/정지 테스트"""

    @pytest.mark.asyncio
    async def test_start_bridge(self, bridge):
        """브리지 시작"""
        await bridge.start()
        assert bridge.is_running is True

    @pytest.mark.asyncio
    async def test_stop_bridge(self, bridge):
        """브리지 정지"""
        await bridge.start()
        await bridge.stop()
        assert bridge.is_running is False

    @pytest.mark.asyncio
    async def test_start_already_running(self, bridge):
        """이미 실행 중인 브리지 시작 시도"""
        await bridge.start()
        # 두 번째 start는 경고만 출력하고 무시됨
        await bridge.start()
        assert bridge.is_running is True
