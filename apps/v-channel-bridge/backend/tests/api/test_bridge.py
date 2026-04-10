"""
Bridge API 테스트

Light-Zowe 브리지 제어 API 테스트
작성일: 2026-04-02
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def mock_bridge():
    """Mock Bridge 인스턴스"""
    bridge = MagicMock()
    bridge.is_running = True
    bridge.providers = {}
    bridge._tasks = []
    return bridge


class TestBridgeStatus:
    """브리지 상태 조회 테스트"""

    @patch("app.api.bridge.get_bridge")
    def test_get_status_success(
        self, mock_get_bridge, client, mock_bridge, auth_headers_admin
    ):
        """브리지 상태 조회 성공"""
        mock_get_bridge.return_value = mock_bridge

        response = client.get("/api/bridge/status", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert "is_running" in data
        assert "providers" in data
        assert "active_tasks" in data

    @patch("app.api.bridge.get_bridge")
    def test_get_status_not_initialized(
        self, mock_get_bridge, client, auth_headers_admin
    ):
        """브리지 초기화 안됨"""
        mock_get_bridge.return_value = None

        response = client.get("/api/bridge/status", headers=auth_headers_admin)

        assert response.status_code == 503
        assert response.json()["detail"] == "Bridge not initialized"

    def test_get_status_unauthenticated(self, client):
        """인증 없이 접근 시 401"""
        response = client.get("/api/bridge/status")
        assert response.status_code == 401


class TestBridgeProviders:
    """Provider 관리 테스트"""

    @patch("app.api.bridge.get_bridge")
    def test_get_providers(
        self, mock_get_bridge, client, mock_bridge, auth_headers_admin
    ):
        """Provider 목록 조회"""
        # Mock Provider
        mock_provider = MagicMock()
        mock_provider.platform_name = "slack"
        mock_provider.is_connected = True

        mock_bridge.providers = {"slack": mock_provider}
        mock_get_bridge.return_value = mock_bridge

        response = client.get("/api/bridge/providers", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["platform"] == "slack"
        assert data[0]["connected"] is True


class TestBridgeChannels:
    """채널 목록 조회 테스트"""

    @patch("app.api.bridge.get_bridge")
    @pytest.mark.asyncio
    async def test_get_channels_success(
        self, mock_get_bridge, client, mock_bridge, auth_headers_admin
    ):
        """채널 목록 조회 성공"""
        # Mock Provider
        mock_provider = MagicMock()
        mock_provider.is_connected = True

        # Mock Channel — API accesses .id, .name, .type.value
        mock_channel = MagicMock()
        mock_channel.id = "C123"
        mock_channel.name = "general"
        mock_channel.type.value = "public"

        # get_channels를 AsyncMock으로 설정
        mock_provider.get_channels = AsyncMock(return_value=[mock_channel])

        mock_bridge.providers = {"slack": mock_provider}
        mock_get_bridge.return_value = mock_bridge

        response = client.get("/api/bridge/channels/slack", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "C123"
        assert data[0]["name"] == "general"
        assert data[0]["type"] == "public"

    @patch("app.api.bridge.get_bridge")
    def test_get_channels_provider_not_found(
        self, mock_get_bridge, client, mock_bridge, auth_headers_admin
    ):
        """존재하지 않는 Provider"""
        mock_bridge.providers = {}
        mock_get_bridge.return_value = mock_bridge

        response = client.get(
            "/api/bridge/channels/unknown", headers=auth_headers_admin
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    @patch("app.api.bridge.get_bridge")
    def test_get_channels_provider_not_connected(
        self, mock_get_bridge, client, mock_bridge, auth_headers_admin
    ):
        """연결되지 않은 Provider"""
        mock_provider = MagicMock()
        mock_provider.is_connected = False

        mock_bridge.providers = {"slack": mock_provider}
        mock_get_bridge.return_value = mock_bridge

        response = client.get("/api/bridge/channels/slack", headers=auth_headers_admin)

        assert response.status_code == 503
        assert "not connected" in response.json()["detail"]


class TestBridgeRoutes:
    """라우팅 관리 테스트"""

    @patch("app.api.bridge.get_bridge")
    @pytest.mark.asyncio
    async def test_get_routes(
        self, mock_get_bridge, client, mock_bridge, auth_headers_admin
    ):
        """라우팅 목록 조회"""
        # Mock RouteManager
        mock_route_manager = MagicMock()
        mock_route_manager.get_all_routes = AsyncMock(
            return_value=[
                {
                    "source": {"platform": "slack", "channel_id": "C123"},
                    "targets": [
                        {
                            "platform": "teams",
                            "channel_id": "T456",
                            "channel_name": "general",
                        }
                    ],
                }
            ]
        )

        mock_bridge.route_manager = mock_route_manager
        mock_get_bridge.return_value = mock_bridge

        response = client.get("/api/bridge/routes", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["source"]["platform"] == "slack"
        assert data[0]["source"]["channel_id"] == "C123"
        assert len(data[0]["targets"]) == 1


class TestBridgeControl:
    """브리지 제어 테스트"""

    @patch("app.api.bridge.get_bridge")
    @pytest.mark.asyncio
    async def test_start_bridge(
        self, mock_get_bridge, client, mock_bridge, auth_headers_admin
    ):
        """브리지 시작"""
        mock_bridge.is_running = False
        mock_bridge.start = AsyncMock()
        mock_get_bridge.return_value = mock_bridge

        response = client.post("/api/bridge/start", headers=auth_headers_admin)

        assert response.status_code == 200
        assert "started" in response.json()["message"]
        mock_bridge.start.assert_called_once()

    @patch("app.api.bridge.get_bridge")
    @pytest.mark.asyncio
    async def test_start_bridge_already_running(
        self, mock_get_bridge, client, mock_bridge, auth_headers_admin
    ):
        """이미 실행 중인 브리지 시작 시도"""
        mock_bridge.is_running = True
        mock_get_bridge.return_value = mock_bridge

        response = client.post("/api/bridge/start", headers=auth_headers_admin)

        assert response.status_code == 200
        assert "already running" in response.json()["message"]

    @patch("app.api.bridge.get_bridge")
    @pytest.mark.asyncio
    async def test_stop_bridge(
        self, mock_get_bridge, client, mock_bridge, auth_headers_admin
    ):
        """브리지 중지"""
        mock_bridge.is_running = True
        mock_bridge.stop = AsyncMock()
        mock_get_bridge.return_value = mock_bridge

        response = client.post("/api/bridge/stop", headers=auth_headers_admin)

        assert response.status_code == 200
        assert "stopped" in response.json()["message"]
        mock_bridge.stop.assert_called_once()


class TestReloadProviders:
    """Provider Hot Reload 테스트"""

    @patch("app.db.get_db_session")
    @patch("app.api.bridge.get_bridge")
    @pytest.mark.asyncio
    async def test_reload_providers_success(
        self, mock_get_bridge, mock_get_db, client, auth_headers_admin
    ):
        """Provider 재로드 성공"""
        # Mock Bridge
        mock_bridge = MagicMock()
        mock_bridge.providers = {"slack": MagicMock()}
        mock_bridge.remove_provider = AsyncMock()
        mock_bridge.add_provider = AsyncMock(return_value=True)
        mock_get_bridge.return_value = mock_bridge

        # Mock DB Session
        mock_session = MagicMock()

        # Mock Account
        mock_account = MagicMock()
        mock_account.platform = "slack"
        mock_account.enabled = True
        mock_account.is_valid = True
        mock_account.token_decrypted = "xoxb-test"
        mock_account.app_token_decrypted = "xapp-test"

        # Mock Query
        mock_query = MagicMock()
        mock_query.filter.return_value.all.return_value = [mock_account]
        mock_session.query.return_value = mock_query

        # Mock get_db_session generator
        def mock_gen():
            yield mock_session

        mock_get_db.return_value = mock_gen()

        response = client.post(
            "/api/bridge/reload-providers", headers=auth_headers_admin
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "providers" in data
        assert "removed" in data
        assert "added" in data

    @patch("app.api.bridge.get_bridge")
    def test_reload_providers_not_initialized(
        self, mock_get_bridge, client, auth_headers_admin
    ):
        """브리지 초기화 안됨"""
        mock_get_bridge.return_value = None

        response = client.post(
            "/api/bridge/reload-providers", headers=auth_headers_admin
        )

        assert response.status_code == 503
        assert response.json()["detail"] == "Bridge not initialized"
