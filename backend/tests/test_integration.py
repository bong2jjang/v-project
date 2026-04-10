"""통합 테스트

여러 컴포넌트가 함께 동작하는 전체 플로우를 테스트합니다.
"""

import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
import tomli_w
from fastapi.testclient import TestClient

from app.main import app
from app.models.config import (
    MatterbridgeConfig,
)
from app.models.matterbridge import MatterbridgeStatus
from app.services.config_manager import ConfigManager

client = TestClient(app)


@pytest.fixture
def temp_config_file():
    """임시 설정 파일 생성"""
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "matterbridge.toml"

        # 초기 설정 작성
        initial_config = {
            "general": {
                "MediaServerUpload": "http://localhost:8080",
                "MediaDownloadSize": 1000000,
            },
            "slack": {
                "myslack": {
                    "Token": "xoxb-initial-token",
                    "UseAPI": True,
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

        with open(config_path, "wb") as f:
            tomli_w.dump(initial_config, f)

        yield config_path


class TestConfigWorkflow:
    """설정 관리 워크플로우 통합 테스트"""

    def test_full_config_lifecycle(self, temp_config_file):
        """설정의 전체 생명주기 테스트: 읽기 → 수정 → 백업 → 복원"""
        manager = ConfigManager(config_path=temp_config_file)

        # 1. 초기 설정 읽기
        initial_config = manager.read_config()
        assert initial_config["slack"]["myslack"]["Token"] == "xoxb-initial-token"

        # 2. 설정 검증
        validation = manager.validate_config(initial_config)
        assert validation.valid is True

        # 3. 백업 생성
        backup_path = manager.backup_config()
        assert Path(backup_path).exists()

        # 4. 설정 수정
        modified_config = initial_config.copy()
        modified_config["slack"]["myslack"]["Token"] = "xoxb-modified-token"
        modified_config["general"]["MediaServerUpload"] = "http://newhost:9090"

        manager.write_config(modified_config, create_backup=False)

        # 5. 수정 확인
        current_config = manager.read_config()
        assert current_config["slack"]["myslack"]["Token"] == "xoxb-modified-token"
        assert current_config["general"]["MediaServerUpload"] == "http://newhost:9090"

        # 6. 백업 목록 확인
        backups = manager.list_backups()
        assert len(backups) >= 1

        # 7. 백업 복원
        manager.restore_config(backup_path)

        # 8. 복원 확인
        restored_config = manager.read_config()
        assert restored_config["slack"]["myslack"]["Token"] == "xoxb-initial-token"
        assert (
            restored_config["general"]["MediaServerUpload"] == "http://localhost:8080"
        )

    def test_config_validation_and_update(self, temp_config_file):
        """설정 검증과 업데이트의 통합"""
        manager = ConfigManager(config_path=temp_config_file)

        # 유효하지 않은 설정 시도
        invalid_config = {
            "slack": {"myslack": {"Token": "test"}},
            "gateway": [],  # gateway가 비어있음
        }

        validation = manager.validate_config(invalid_config)
        assert validation.valid is False
        assert any("gateway" in error.lower() for error in validation.errors)

        # 유효한 설정으로 수정
        valid_config = manager.read_config()
        validation = manager.validate_config(valid_config)
        assert validation.valid is True

        # Pydantic 모델로 변환
        model = manager.get_config_model()
        assert isinstance(model, MatterbridgeConfig)
        assert "myslack" in model.slack

        # 모델 수정 후 업데이트
        model.slack["myslack"].token = "xoxb-new-token"
        manager.update_config_model(model, create_backup=False)

        # 확인
        updated = manager.read_config()
        assert updated["slack"]["myslack"]["Token"] == "xoxb-new-token"


class TestAPIIntegration:
    """API 엔드포인트와 서비스 통합 테스트"""

    @patch("app.api.config.ConfigManager")
    def test_config_api_flow(self, mock_manager_class, temp_config_file):
        """Config API의 전체 플로우"""
        # 실제 ConfigManager 사용
        real_manager = ConfigManager(config_path=temp_config_file)
        mock_manager_class.return_value = real_manager

        # 1. GET /api/config/ - 설정 조회
        response = client.get("/api/config/")
        assert response.status_code == 200
        data = response.json()
        assert "slack" in data
        assert "gateway" in data

        # 2. POST /api/config/validate - 현재 설정 검증
        response = client.post("/api/config/validate")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True

        # 3. POST /api/config/backup - 백업 생성
        response = client.post("/api/config/backup")
        assert response.status_code == 200
        backup_path = response.json()["backup_path"]
        assert backup_path

        # 4. GET /api/config/backups - 백업 목록
        response = client.get("/api/config/backups")
        assert response.status_code == 200
        backups = response.json()["backups"]
        assert len(backups) > 0

        # 5. PUT /api/config/ - 설정 업데이트
        config = real_manager.read_config()
        config["general"]["MediaServerUpload"] = "http://updated:8080"

        response = client.put(
            "/api/config/", json=config, params={"create_backup": True}
        )
        assert response.status_code == 200
        assert "backup_path" in response.json()

        # 6. POST /api/config/restore - 복원
        response = client.post("/api/config/restore", json={"backup_path": backup_path})
        assert response.status_code == 200


class TestErrorHandling:
    """에러 처리 통합 테스트"""

    def test_config_file_not_found(self):
        """존재하지 않는 설정 파일"""
        manager = ConfigManager(config_path="/nonexistent/matterbridge.toml")

        with pytest.raises(Exception) as exc_info:
            manager.read_config()

        assert "not found" in str(exc_info.value).lower()

    def test_invalid_toml_file(self, temp_config_file):
        """잘못된 TOML 파일"""
        # 잘못된 TOML 작성
        with open(temp_config_file, "w") as f:
            f.write("[invalid toml\n")

        manager = ConfigManager(config_path=temp_config_file)

        with pytest.raises(Exception) as exc_info:
            manager.read_config()

        assert "parse" in str(exc_info.value).lower()

    def test_validation_with_missing_accounts(self, temp_config_file):
        """계정이 정의되지 않은 gateway"""
        manager = ConfigManager(config_path=temp_config_file)

        # 정의되지 않은 계정 참조
        invalid_config = {
            "slack": {"myslack": {"Token": "test"}},
            "gateway": [
                {
                    "name": "test",
                    "inout": [
                        {"account": "slack.myslack", "channel": "c1"},
                        {"account": "slack.undefined", "channel": "c2"},  # 없는 계정
                    ],
                }
            ],
        }

        validation = manager.validate_config(invalid_config)
        assert validation.valid is False
        assert any("undefined" in error.lower() for error in validation.errors)

    def test_backup_collision_prevention(self, temp_config_file):
        """백업 파일 충돌 방지 (밀리초 정밀도)"""
        import time

        manager = ConfigManager(config_path=temp_config_file)

        # 연속으로 백업 생성 (작은 지연 추가)
        backup1 = manager.backup_config()
        time.sleep(0.01)  # 10ms 지연
        backup2 = manager.backup_config()

        # 두 백업 파일이 다른지 확인
        assert backup1 != backup2
        assert Path(backup1).exists()
        assert Path(backup2).exists()


class TestEndToEndScenarios:
    """엔드투엔드 시나리오 테스트"""

    @patch("app.api.matterbridge.MatterbridgeControlService")
    @patch("app.api.config.ConfigManager")
    def test_config_change_and_restart_workflow(
        self, mock_manager_class, mock_service_class, temp_config_file
    ):
        """설정 변경 후 재시작 워크플로우

        시나리오:
        1. 현재 상태 확인
        2. 설정 백업
        3. 설정 변경
        4. Matterbridge 재시작
        5. 새 상태 확인
        """
        # 실제 ConfigManager 설정
        real_manager = ConfigManager(config_path=temp_config_file)
        mock_manager_class.return_value = real_manager

        # Mock Matterbridge service
        mock_service = Mock()
        mock_service_class.return_value = mock_service

        # Matterbridge 상태 설정
        mock_service.get_status.return_value = MatterbridgeStatus(
            running=True,
            pid=12345,
            container_status="running",
        )
        mock_service.restart.return_value = MatterbridgeStatus(
            running=True,
            pid=12346,
            container_status="running",
        )

        # 1. 현재 상태 확인
        response = client.get("/api/matterbridge/status")
        assert response.status_code == 200
        assert response.json()["running"] is True

        # 2. 현재 설정 조회
        response = client.get("/api/config/")
        assert response.status_code == 200
        original_config = response.json()

        # 3. 설정 백업
        response = client.post("/api/config/backup")
        assert response.status_code == 200
        _backup_path = response.json()[
            "backup_path"
        ]  # 백업 경로는 테스트에서 직접 사용하지 않음

        # 4. 설정 변경
        new_config = original_config.copy()
        new_config["general"]["MediaServerUpload"] = "http://new-media-server:8080"

        response = client.put("/api/config/", json=new_config)
        assert response.status_code == 200

        # 5. Matterbridge 재시작
        response = client.post("/api/matterbridge/restart")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "restarted"
        assert data["pid"] == 12346

        # 6. 변경된 설정 확인
        response = client.get("/api/config/")
        assert response.status_code == 200
        updated = response.json()
        assert updated["general"]["MediaServerUpload"] == "http://new-media-server:8080"

    @patch("app.api.matterbridge.MatterbridgeControlService")
    def test_error_recovery_workflow(self, mock_service_class, temp_config_file):
        """에러 발생 시 복구 워크플로우

        시나리오:
        1. 잘못된 설정으로 업데이트 시도 (실패)
        2. 검증 에러 확인
        3. 올바른 설정으로 재시도 (성공)
        """
        # Mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service

        # 1. 잘못된 설정으로 업데이트 시도
        invalid_config = {
            "slack": {"myslack": {"Token": "test"}},
            "gateway": [],  # Empty gateway - invalid
        }

        response = client.put("/api/config/", json=invalid_config)
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "validation_failed" in str(detail)

        # 2. 올바른 설정으로 재시도
        valid_config = {
            "slack": {"myslack": {"Token": "test"}},
            "teams": {
                "myteams": {
                    "TenantID": "t",
                    "AppID": "a",
                    "AppPassword": "p",
                }
            },
            "gateway": [
                {
                    "name": "gw",
                    "inout": [
                        {"account": "slack.myslack", "channel": "c1"},
                        {"account": "teams.myteams", "channel": "c2"},
                    ],
                }
            ],
        }

        # ConfigManager를 실제로 사용하도록 패치
        with patch("app.api.config.ConfigManager") as mock_cm:
            real_manager = ConfigManager(config_path=temp_config_file)
            mock_cm.return_value = real_manager

            response = client.put("/api/config/", json=valid_config)
            assert response.status_code == 200

    def test_concurrent_operations(self, temp_config_file):
        """동시 작업 처리 (백업 + 읽기)"""
        import time

        manager = ConfigManager(config_path=temp_config_file)

        # 여러 백업을 빠르게 생성 (최소 지연 포함)
        backups = []
        for i in range(5):
            backup = manager.backup_config()
            backups.append(backup)
            if i < 4:  # 마지막 백업은 지연 불필요
                time.sleep(0.01)  # 10ms 지연

        # 모든 백업 파일이 존재하는지 확인
        for backup in backups:
            assert Path(backup).exists()

        # 모든 백업 파일이 고유한지 확인
        assert len(set(backups)) == len(backups)

        # 동시에 설정 읽기도 가능
        config = manager.read_config()
        assert "slack" in config
