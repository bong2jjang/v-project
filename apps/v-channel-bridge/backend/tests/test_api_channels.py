"""Channels API 엔드포인트 테스트"""

from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.api.channels import get_config_manager
from app.schemas.channel import ChannelMapping, ChannelStatus


@pytest.fixture
def mock_channels_manager(client: TestClient):
    """채널 관리용 mock ConfigManager"""
    from app.main import app

    manager = Mock()
    app.dependency_overrides[get_config_manager] = lambda: manager
    yield manager
    app.dependency_overrides.clear()


@pytest.fixture
def sample_channels():
    """샘플 채널 매핑 데이터"""
    return [
        ChannelMapping(
            id=1,
            slack_channel_id="C12345",
            slack_channel_name="general",
            teams_channel_id="19:abc@thread.tacv2",
            teams_channel_name="General",
            is_active=True,
            last_message_time="2026-03-22T10:30:00",
            message_count=150,
        ),
        ChannelMapping(
            id=2,
            slack_channel_id="C67890",
            slack_channel_name="random",
            teams_channel_id="19:xyz@thread.tacv2",
            teams_channel_name="Random",
            is_active=True,
            last_message_time="2026-03-22T11:00:00",
            message_count=75,
        ),
    ]


class TestListChannels:
    """GET /api/channels/ 테스트"""

    def test_list_channels_success(
        self,
        client: TestClient,
        auth_headers_user: dict[str, str],
        mock_channels_manager,
        sample_channels,
    ):
        """채널 목록 조회 성공"""
        # Given: 채널 데이터 반환
        mock_channels_manager.get_channel_mappings.return_value = sample_channels

        # When: API 호출
        response = client.get("/api/channels/", headers=auth_headers_user)

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["slack_channel_name"] == "general"
        assert data[1]["slack_channel_name"] == "random"

    def test_list_channels_no_auth(self, client: TestClient):
        """인증 없이 조회"""
        # When: 토큰 없이 조회
        response = client.get("/api/channels/")

        # Then: 401 Unauthorized
        assert response.status_code == 401

    def test_list_channels_empty(
        self,
        client: TestClient,
        auth_headers_user: dict[str, str],
        mock_channels_manager,
    ):
        """채널 매핑이 없는 경우"""
        # Given: 빈 목록 반환
        mock_channels_manager.get_channel_mappings.return_value = []

        # When: API 호출
        response = client.get("/api/channels/", headers=auth_headers_user)

        # Then: 빈 배열 반환
        assert response.status_code == 200
        assert response.json() == []


class TestGetChannel:
    """GET /api/channels/{channel_id} 테스트"""

    def test_get_channel_success(
        self,
        client: TestClient,
        auth_headers_user: dict[str, str],
        mock_channels_manager,
        sample_channels,
    ):
        """특정 채널 조회 성공"""
        # Given: 채널 반환
        mock_channels_manager.get_channel_mapping.return_value = sample_channels[0]

        # When: API 호출
        response = client.get("/api/channels/1", headers=auth_headers_user)

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["slack_channel_name"] == "general"

    def test_get_channel_not_found(
        self,
        client: TestClient,
        auth_headers_user: dict[str, str],
        mock_channels_manager,
    ):
        """존재하지 않는 채널"""
        # Given: None 반환
        mock_channels_manager.get_channel_mapping.return_value = None

        # When: API 호출
        response = client.get("/api/channels/999", headers=auth_headers_user)

        # Then: 404 Not Found
        assert response.status_code == 404
        assert "채널을 찾을 수 없습니다" in response.json()["detail"]


class TestCreateChannelMapping:
    """POST /api/channels/ 테스트"""

    def test_create_channel_success(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        mock_channels_manager,
    ):
        """채널 매핑 생성 성공"""
        # Given: 생성된 채널 반환
        created_channel = ChannelMapping(
            id=3,
            slack_channel_id="C111",
            slack_channel_name="dev",
            teams_channel_id="19:dev@thread.tacv2",
            teams_channel_name="Development",
            is_active=True,
        )
        mock_channels_manager.create_channel_mapping.return_value = created_channel

        # When: 채널 생성
        response = client.post(
            "/api/channels/",
            headers=auth_headers_admin,
            json={
                "slack_channel_id": "C111",
                "slack_channel_name": "dev",
                "teams_channel_id": "19:dev@thread.tacv2",
                "teams_channel_name": "Development",
                "is_active": True,
            },
        )

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 3
        assert data["slack_channel_name"] == "dev"

    def test_create_channel_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """일반 사용자가 생성 시도"""
        # When: 일반 사용자가 생성
        response = client.post(
            "/api/channels/",
            headers=auth_headers_user,
            json={
                "slack_channel_id": "C111",
                "slack_channel_name": "dev",
                "teams_channel_id": "19:dev@thread.tacv2",
                "teams_channel_name": "Development",
            },
        )

        # Then: 403 Forbidden
        assert response.status_code == 403

    def test_create_channel_duplicate(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        mock_channels_manager,
    ):
        """중복 채널 생성"""
        # Given: 예외 발생
        from app.services.config_manager import ConfigError

        mock_channels_manager.create_channel_mapping.side_effect = ConfigError(
            "이미 존재하는 채널 매핑입니다"
        )

        # When: 중복 생성
        response = client.post(
            "/api/channels/",
            headers=auth_headers_admin,
            json={
                "slack_channel_id": "C12345",
                "slack_channel_name": "general",
                "teams_channel_id": "19:abc@thread.tacv2",
                "teams_channel_name": "General",
            },
        )

        # Then: 400 Bad Request
        assert response.status_code == 400


class TestUpdateChannelMapping:
    """PUT /api/channels/{channel_id} 테스트"""

    def test_update_channel_success(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        mock_channels_manager,
        sample_channels,
    ):
        """채널 매핑 수정 성공"""
        # Given: 수정된 채널 반환
        updated_channel = sample_channels[0]
        updated_channel.is_active = False
        mock_channels_manager.update_channel_mapping.return_value = updated_channel

        # When: 채널 수정
        response = client.put(
            "/api/channels/1",
            headers=auth_headers_admin,
            json={"is_active": False},
        )

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    def test_update_channel_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """일반 사용자가 수정 시도"""
        # When: 일반 사용자가 수정
        response = client.put(
            "/api/channels/1",
            headers=auth_headers_user,
            json={"is_active": False},
        )

        # Then: 403 Forbidden
        assert response.status_code == 403

    def test_update_channel_not_found(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        mock_channels_manager,
    ):
        """존재하지 않는 채널 수정"""
        # Given: None 반환
        mock_channels_manager.update_channel_mapping.return_value = None

        # When: 없는 채널 수정
        response = client.put(
            "/api/channels/999",
            headers=auth_headers_admin,
            json={"is_active": False},
        )

        # Then: 404 Not Found
        assert response.status_code == 404


class TestDeleteChannelMapping:
    """DELETE /api/channels/{channel_id} 테스트"""

    def test_delete_channel_success(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        mock_channels_manager,
    ):
        """채널 매핑 삭제 성공"""
        # Given: 삭제 성공 반환
        mock_channels_manager.delete_channel_mapping.return_value = True

        # When: 채널 삭제
        response = client.delete("/api/channels/1", headers=auth_headers_admin)

        # Then: 성공
        assert response.status_code == 200
        assert "삭제되었습니다" in response.json()["message"]

    def test_delete_channel_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """일반 사용자가 삭제 시도"""
        # When: 일반 사용자가 삭제
        response = client.delete("/api/channels/1", headers=auth_headers_user)

        # Then: 403 Forbidden
        assert response.status_code == 403

    def test_delete_channel_not_found(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        mock_channels_manager,
    ):
        """존재하지 않는 채널 삭제"""
        # Given: False 반환
        mock_channels_manager.delete_channel_mapping.return_value = False

        # When: 없는 채널 삭제
        response = client.delete("/api/channels/999", headers=auth_headers_admin)

        # Then: 404 Not Found
        assert response.status_code == 404


class TestChannelStatus:
    """GET /api/channels/status 테스트"""

    def test_get_channel_status_success(
        self,
        client: TestClient,
        auth_headers_user: dict[str, str],
        mock_channels_manager,
    ):
        """채널 상태 조회 성공"""
        # Given: 상태 데이터 반환
        status_data = [
            ChannelStatus(
                slack_channel="general",
                teams_channel="General",
                is_active=True,
                last_sync="2026-03-22T10:30:00",
                message_count=150,
            ),
            ChannelStatus(
                slack_channel="random",
                teams_channel="Random",
                is_active=True,
                last_sync="2026-03-22T11:00:00",
                message_count=75,
            ),
        ]
        mock_channels_manager.get_channel_status.return_value = status_data

        # When: 상태 조회
        response = client.get("/api/channels/status", headers=auth_headers_user)

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["slack_channel"] == "general"
        assert data[0]["message_count"] == 150

    def test_get_channel_status_no_auth(self, client: TestClient):
        """인증 없이 상태 조회"""
        # When: 토큰 없이 조회
        response = client.get("/api/channels/status")

        # Then: 401 Unauthorized
        assert response.status_code == 401


class TestSyncChannel:
    """POST /api/channels/{channel_id}/sync 테스트"""

    def test_sync_channel_success(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        mock_channels_manager,
    ):
        """채널 동기화 성공"""
        # Given: 동기화 성공
        mock_channels_manager.sync_channel.return_value = True

        # When: 동기화 요청
        response = client.post(
            "/api/channels/1/sync",
            headers=auth_headers_admin,
        )

        # Then: 성공
        assert response.status_code == 200
        assert "동기화되었습니다" in response.json()["message"]

    def test_sync_channel_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """일반 사용자가 동기화 시도"""
        # When: 일반 사용자가 동기화
        response = client.post(
            "/api/channels/1/sync",
            headers=auth_headers_user,
        )

        # Then: 403 Forbidden
        assert response.status_code == 403

    def test_sync_channel_not_found(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        mock_channels_manager,
    ):
        """존재하지 않는 채널 동기화"""
        # Given: 동기화 실패
        mock_channels_manager.sync_channel.return_value = False

        # When: 없는 채널 동기화
        response = client.post(
            "/api/channels/999/sync",
            headers=auth_headers_admin,
        )

        # Then: 404 Not Found
        assert response.status_code == 404
