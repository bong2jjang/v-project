"""통합 테스트

v-channel-bridge의 여러 컴포넌트가 함께 동작하는 전체 플로우를 테스트합니다.
"""

from unittest.mock import AsyncMock, Mock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestBridgeStatusWorkflow:
    """브리지 상태 조회 통합 테스트"""

    @patch("app.api.bridge.get_bridge")
    def test_bridge_status_when_running(self, mock_get_bridge):
        """브리지 실행 중일 때 상태 조회"""
        mock_bridge = Mock()
        mock_bridge.is_running = True
        mock_bridge.providers = {}
        mock_bridge._tasks = []
        mock_get_bridge.return_value = mock_bridge

        response = client.get("/api/bridge/status")
        assert response.status_code == 200
        data = response.json()
        assert data["is_running"] is True

    @patch("app.api.bridge.get_bridge")
    def test_bridge_status_not_initialized(self, mock_get_bridge):
        """브리지가 초기화되지 않았을 때"""
        mock_get_bridge.return_value = None

        response = client.get("/api/bridge/status")
        assert response.status_code == 503


class TestRouteManagement:
    """라우팅 룰 관리 통합 테스트"""

    @patch("app.api.bridge.get_bridge")
    def test_get_routes(self, mock_get_bridge):
        """라우팅 룰 목록 조회"""
        mock_bridge = Mock()
        mock_bridge.route_manager = AsyncMock()
        mock_bridge.route_manager.get_all_routes.return_value = [
            {
                "source": {
                    "platform": "slack",
                    "channel": "C123",
                    "channel_name": "general",
                },
                "target": {
                    "platform": "teams",
                    "channel": "19:xxx",
                    "channel_name": "General",
                },
                "message_mode": "sender_info",
                "is_bidirectional": True,
                "is_enabled": True,
            }
        ]
        mock_get_bridge.return_value = mock_bridge

        response = client.get("/api/bridge/routes")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["source"]["platform"] == "slack"
        assert data[0]["target"]["platform"] == "teams"


class TestProviderManagement:
    """Provider 관리 통합 테스트"""

    @patch("app.api.bridge.get_bridge")
    def test_get_providers(self, mock_get_bridge):
        """Provider 목록 조회"""
        mock_provider = Mock()
        mock_provider.platform_name = "slack"
        mock_provider.is_connected = True

        mock_bridge = Mock()
        mock_bridge.providers = {"slack": mock_provider}
        mock_get_bridge.return_value = mock_bridge

        response = client.get("/api/bridge/providers")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["platform"] == "slack"
        assert data[0]["connected"] is True


class TestErrorHandling:
    """에러 처리 통합 테스트"""

    @patch("app.api.bridge.get_bridge")
    def test_bridge_not_initialized(self, mock_get_bridge):
        """브리지 미초기화 시 503"""
        mock_get_bridge.return_value = None

        response = client.get("/api/bridge/status")
        assert response.status_code == 503

        response = client.get("/api/bridge/providers")
        assert response.status_code == 503

        response = client.get("/api/bridge/routes")
        assert response.status_code == 503
