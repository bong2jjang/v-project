"""Config API 엔드포인트 테스트"""

from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.api.config import get_config_manager
from app.main import app
from app.models.config import (
    MatterbridgeConfig,
    SlackConfig,
    TeamsConfig,
    ValidationResult,
)
from app.services.config_manager import ConfigError

client = TestClient(app)


@pytest.fixture
def mock_manager():
    """모킹된 ConfigManager"""
    manager = Mock()
    app.dependency_overrides[get_config_manager] = lambda: manager
    yield manager
    app.dependency_overrides.clear()


@pytest.fixture
def sample_config():
    """샘플 설정 데이터"""
    return {
        "general": {
            "MediaServerUpload": "http://localhost:8080",
        },
        "slack": {
            "myslack": {
                "Token": "xoxb-test-token",
            }
        },
        "teams": {
            "myteams": {
                "TenantID": "tenant-id",
                "AppID": "app-id",
                "AppPassword": "password",
            }
        },
        "gateway": [
            {
                "name": "test-gateway",
                "enable": True,
                "inout": [
                    {"account": "slack.myslack", "channel": "general"},
                    {"account": "teams.myteams", "channel": "19:xxx"},
                ],
            }
        ],
    }


class TestGetConfig:
    """GET /api/config/ 테스트"""

    def test_get_config_success(self, mock_manager, sample_config):
        """설정 조회 성공"""
        # Given: 설정 반환
        mock_manager.read_config.return_value = sample_config

        # When: API 호출
        response = client.get("/api/config/")

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert "general" in data
        assert "slack" in data
        assert "gateway" in data

    def test_get_config_error(self, mock_manager):
        """설정 조회 실패"""
        # Given: 에러 발생
        mock_manager.read_config.side_effect = ConfigError("File not found")

        # When: API 호출
        response = client.get("/api/config/")

        # Then: 500 에러
        assert response.status_code == 500
        data = response.json()
        assert "read_failed" in str(data["detail"])


class TestUpdateConfig:
    """PUT /api/config/ 테스트"""

    def test_update_config_success(self, mock_manager, sample_config):
        """설정 업데이트 성공"""
        # Given: 검증 성공 및 백업 경로
        mock_manager.validate_config.return_value = ValidationResult(
            valid=True, errors=[], warnings=[]
        )
        mock_manager.backup_config.return_value = "/path/to/backup.toml"
        mock_manager.write_config.return_value = True

        # When: API 호출
        response = client.put("/api/config/", json=sample_config)

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "backup_path" in data
        mock_manager.write_config.assert_called_once()

    def test_update_config_validation_failed(self, mock_manager, sample_config):
        """설정 검증 실패"""
        # Given: 검증 실패
        mock_manager.validate_config.return_value = ValidationResult(
            valid=False,
            errors=["Missing required field: gateway"],
            warnings=[],
        )

        # When: API 호출
        response = client.put("/api/config/", json=sample_config)

        # Then: 400 에러
        assert response.status_code == 400
        data = response.json()
        assert "validation_failed" in str(data["detail"])
        mock_manager.write_config.assert_not_called()

    def test_update_config_without_backup(self, mock_manager, sample_config):
        """백업 없이 업데이트"""
        # Given: 검증 성공
        mock_manager.validate_config.return_value = ValidationResult(
            valid=True, errors=[], warnings=[]
        )
        mock_manager.write_config.return_value = True

        # When: API 호출 (create_backup=False)
        response = client.put(
            "/api/config/", json=sample_config, params={"create_backup": False}
        )

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert "backup_path" not in data
        mock_manager.backup_config.assert_not_called()


class TestValidateConfig:
    """POST /api/config/validate 테스트"""

    def test_validate_current_config(self, mock_manager):
        """현재 설정 검증"""
        # Given: 검증 성공
        mock_manager.validate_config.return_value = ValidationResult(
            valid=True, errors=[], warnings=["No media server configured"]
        )

        # When: API 호출 (body 없음)
        response = client.post("/api/config/validate")

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert len(data["warnings"]) > 0

    def test_validate_provided_config(self, mock_manager, sample_config):
        """제공된 설정 검증"""
        # Given: 검증 성공
        mock_manager.validate_config.return_value = ValidationResult(
            valid=True, errors=[], warnings=[]
        )

        # When: API 호출 (설정 제공)
        response = client.post("/api/config/validate", json=sample_config)

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True

    def test_validate_invalid_config(self, mock_manager, sample_config):
        """잘못된 설정 검증"""
        # Given: 검증 실패
        mock_manager.validate_config.return_value = ValidationResult(
            valid=False,
            errors=["Gateway must have at least 2 channels"],
            warnings=[],
        )

        # When: API 호출
        response = client.post("/api/config/validate", json=sample_config)

        # Then: 성공 (검증 결과만 반환)
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert len(data["errors"]) > 0


class TestBackup:
    """POST /api/config/backup 테스트"""

    def test_create_backup_success(self, mock_manager):
        """백업 생성 성공"""
        # Given: 백업 성공
        mock_manager.backup_config.return_value = "/path/to/backup_20260320.toml"

        # When: API 호출
        response = client.post("/api/config/backup")

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert "backup_path" in data
        assert "backup_20260320" in data["backup_path"]

    def test_create_backup_error(self, mock_manager):
        """백업 생성 실패"""
        # Given: 에러 발생
        mock_manager.backup_config.side_effect = ConfigError("Permission denied")

        # When: API 호출
        response = client.post("/api/config/backup")

        # Then: 500 에러
        assert response.status_code == 500


class TestListBackups:
    """GET /api/config/backups 테스트"""

    def test_list_backups_success(self, mock_manager):
        """백업 목록 조회 성공"""
        from datetime import datetime

        # Given: 백업 목록
        mock_manager.list_backups.return_value = [
            ("/path/backup1.toml", datetime(2026, 3, 20, 10, 0, 0)),
            ("/path/backup2.toml", datetime(2026, 3, 19, 10, 0, 0)),
        ]

        # When: API 호출
        response = client.get("/api/config/backups")

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert "backups" in data
        assert len(data["backups"]) == 2
        assert data["backups"][0]["path"] == "/path/backup1.toml"

    def test_list_backups_empty(self, mock_manager):
        """빈 백업 목록"""
        # Given: 빈 목록
        mock_manager.list_backups.return_value = []

        # When: API 호출
        response = client.get("/api/config/backups")

        # Then: 성공 (빈 배열)
        assert response.status_code == 200
        data = response.json()
        assert data["backups"] == []


class TestRestore:
    """POST /api/config/restore 테스트"""

    def test_restore_success(self, mock_manager):
        """복원 성공"""
        # Given: 복원 성공
        mock_manager.restore_config.return_value = True

        # When: API 호출
        response = client.post(
            "/api/config/restore", json={"backup_path": "/path/backup.toml"}
        )

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert "restored" in data["message"].lower()

    def test_restore_backup_not_found(self, mock_manager):
        """백업 파일 없음"""
        # Given: 파일 없음
        mock_manager.restore_config.side_effect = ConfigError(
            "Backup file not found: /path/backup.toml"
        )

        # When: API 호출
        response = client.post(
            "/api/config/restore", json={"backup_path": "/path/backup.toml"}
        )

        # Then: 404 에러
        assert response.status_code == 404
        data = response.json()
        assert "backup_not_found" in str(data["detail"])

    def test_restore_invalid_backup(self, mock_manager):
        """잘못된 백업 파일"""
        # Given: 유효하지 않은 백업
        mock_manager.restore_config.side_effect = ConfigError(
            "Restored config is invalid: Missing gateway"
        )

        # When: API 호출
        response = client.post(
            "/api/config/restore", json={"backup_path": "/path/backup.toml"}
        )

        # Then: 400 에러
        assert response.status_code == 400
        data = response.json()
        assert "invalid_backup" in str(data["detail"])


class TestGetConfigModel:
    """GET /api/config/model 테스트"""

    def test_get_config_model_success(self, mock_manager):
        """설정 모델 조회 성공"""
        # Given: 모델 반환
        config_model = MatterbridgeConfig(
            slack={"myslack": SlackConfig(token="xoxb-test")},
            teams={
                "myteams": TeamsConfig(
                    tenant_id="tenant",
                    app_id="app",
                    app_password="pass",
                )
            },
            gateway=[],
        )
        mock_manager.get_config_model.return_value = config_model

        # When: API 호출
        response = client.get("/api/config/model")

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert "slack" in data
        assert "teams" in data

    def test_get_config_model_error(self, mock_manager):
        """설정 모델 조회 실패"""
        # Given: 에러 발생
        mock_manager.get_config_model.side_effect = ConfigError("Invalid config")

        # When: API 호출
        response = client.get("/api/config/model")

        # Then: 500 에러
        assert response.status_code == 500
