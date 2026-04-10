"""ConfigManager 단위 테스트"""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import tomli_w

from app.models.config import (
    GatewayConfig,
    GatewayInOutConfig,
    MatterbridgeConfig,
    SlackConfig,
    TeamsConfig,
)
from app.services.config_manager import ConfigError, ConfigManager


@pytest.fixture
def temp_config_dir():
    """임시 설정 디렉토리 생성"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_config_dict():
    """샘플 설정 딕셔너리"""
    return {
        "general": {
            "MediaServerUpload": "http://localhost:8080",
            "MediaDownloadSize": 1000000,
            "PreserveThreading": True,
        },
        "slack": {
            "myslack": {
                "Token": "xoxb-test-token",
                "PrefixMessagesWithNick": True,
                "UseAPI": True,
            }
        },
        "teams": {
            "myteams": {
                "TenantID": "tenant-id",
                "AppID": "app-id",
                "AppPassword": "app-password",
            }
        },
        "gateway": [
            {
                "name": "slack-teams-gateway",
                "enable": True,
                "inout": [
                    {"account": "slack.myslack", "channel": "general"},
                    {"account": "teams.myteams", "channel": "19:xxx@thread.tacv2"},
                ],
            }
        ],
    }


@pytest.fixture
def config_manager(temp_config_dir, sample_config_dict):
    """테스트용 ConfigManager 인스턴스"""
    config_path = temp_config_dir / "matterbridge.toml"

    # 샘플 설정 파일 생성
    with open(config_path, "wb") as f:
        tomli_w.dump(sample_config_dict, f)

    return ConfigManager(config_path=config_path)


class TestReadConfig:
    """read_config() 메서드 테스트"""

    def test_read_config_success(self, config_manager):
        """정상적인 설정 파일 읽기"""
        # When: 설정 읽기
        config = config_manager.read_config()

        # Then: 설정 데이터 반환
        assert "general" in config
        assert "slack" in config
        assert "teams" in config
        assert "gateway" in config
        assert config["general"]["MediaServerUpload"] == "http://localhost:8080"

    def test_read_config_file_not_found(self, temp_config_dir):
        """존재하지 않는 파일 읽기"""
        # Given: 존재하지 않는 파일
        config_path = temp_config_dir / "nonexistent.toml"
        manager = ConfigManager(config_path=config_path)

        # When/Then: 에러 발생
        with pytest.raises(ConfigError) as exc_info:
            manager.read_config()

        assert "not found" in str(exc_info.value).lower()

    def test_read_config_invalid_toml(self, temp_config_dir):
        """잘못된 TOML 파일 읽기"""
        # Given: 잘못된 TOML 파일
        config_path = temp_config_dir / "invalid.toml"
        with open(config_path, "w") as f:
            f.write("[invalid toml content\n")

        manager = ConfigManager(config_path=config_path)

        # When/Then: 파싱 에러
        with pytest.raises(ConfigError) as exc_info:
            manager.read_config()

        assert "parse" in str(exc_info.value).lower()


class TestWriteConfig:
    """write_config() 메서드 테스트"""

    def test_write_config_success(self, config_manager, sample_config_dict):
        """설정 파일 쓰기 성공"""
        # Given: 수정된 설정
        modified_config = sample_config_dict.copy()
        modified_config["general"]["MediaServerUpload"] = "http://newhost:9090"

        # When: 설정 쓰기
        result = config_manager.write_config(modified_config, create_backup=False)

        # Then: 성공
        assert result is True

        # 파일 확인
        written_config = config_manager.read_config()
        assert written_config["general"]["MediaServerUpload"] == "http://newhost:9090"

    def test_write_config_creates_backup(self, config_manager, sample_config_dict):
        """설정 쓰기 시 백업 생성"""
        # Given: 기존 설정 파일
        # When: 백업 옵션으로 쓰기
        modified_config = sample_config_dict.copy()
        result = config_manager.write_config(modified_config, create_backup=True)

        # Then: 성공 및 백업 파일 존재
        assert result is True
        backups = config_manager.list_backups()
        assert len(backups) == 1

    def test_write_config_atomic(self, config_manager, sample_config_dict):
        """원자적 쓰기 보장 (임시 파일 사용)"""
        # Given: 설정
        # When: 쓰기 중 에러 발생을 시뮬레이션
        with patch("pathlib.Path.replace", side_effect=OSError("Simulated error")):
            with pytest.raises(ConfigError):
                config_manager.write_config(sample_config_dict, create_backup=False)

        # Then: 원본 파일은 영향 없음
        original_config = config_manager.read_config()
        assert (
            original_config["general"]["MediaServerUpload"] == "http://localhost:8080"
        )


class TestValidateConfig:
    """validate_config() 메서드 테스트"""

    def test_validate_valid_config(self, config_manager):
        """유효한 설정 검증"""
        # When: 검증
        result = config_manager.validate_config()

        # Then: 성공
        assert result.valid is True
        assert len(result.errors) == 0

    def test_validate_no_gateway(self, temp_config_dir):
        """Gateway가 없는 설정"""
        # Given: Gateway 없는 설정
        config = {
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
        }

        config_path = temp_config_dir / "test.toml"
        with open(config_path, "wb") as f:
            tomli_w.dump(config, f)

        manager = ConfigManager(config_path=config_path)

        # When: 검증
        result = manager.validate_config()

        # Then: 실패
        assert result.valid is False
        assert any("gateway" in error.lower() for error in result.errors)

    def test_validate_insufficient_channels(self, temp_config_dir):
        """채널이 2개 미만인 Gateway"""
        # Given: 채널이 1개만 있는 Gateway
        config = {
            "slack": {
                "myslack": {
                    "Token": "xoxb-test",
                }
            },
            "gateway": [
                {
                    "name": "test-gateway",
                    "enable": True,
                    "inout": [
                        {"account": "slack.myslack", "channel": "general"}
                    ],  # 1개만
                }
            ],
        }

        config_path = temp_config_dir / "test.toml"
        with open(config_path, "wb") as f:
            tomli_w.dump(config, f)

        manager = ConfigManager(config_path=config_path)

        # When: 검증
        result = manager.validate_config()

        # Then: 실패
        assert result.valid is False
        assert any("2 channels" in error for error in result.errors)

    def test_validate_undefined_account(self, temp_config_dir):
        """정의되지 않은 계정 참조"""
        # Given: 존재하지 않는 계정을 참조하는 Gateway
        config = {
            "slack": {
                "myslack": {
                    "Token": "xoxb-test",
                }
            },
            "gateway": [
                {
                    "name": "test-gateway",
                    "enable": True,
                    "inout": [
                        {"account": "slack.myslack", "channel": "general"},
                        {
                            "account": "slack.undefined",  # 정의 안 됨
                            "channel": "other",
                        },
                    ],
                }
            ],
        }

        config_path = temp_config_dir / "test.toml"
        with open(config_path, "wb") as f:
            tomli_w.dump(config, f)

        manager = ConfigManager(config_path=config_path)

        # When: 검증
        result = manager.validate_config()

        # Then: 실패
        assert result.valid is False
        assert any("undefined" in error.lower() for error in result.errors)

    def test_validate_warning_no_media_server(self, temp_config_dir):
        """MediaServerUpload 없을 때 경고"""
        # Given: MediaServerUpload 없는 설정
        config = {
            "slack": {
                "myslack": {
                    "Token": "xoxb-test",
                }
            },
            "teams": {
                "myteams": {
                    "TenantID": "tenant",
                    "AppID": "app",
                    "AppPassword": "pass",
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

        config_path = temp_config_dir / "test.toml"
        with open(config_path, "wb") as f:
            tomli_w.dump(config, f)

        manager = ConfigManager(config_path=config_path)

        # When: 검증
        result = manager.validate_config()

        # Then: 경고 발생 (general 섹션이 없으므로)
        assert result.valid is True  # 에러는 아님
        assert len(result.warnings) > 0
        assert any(
            "general" in warning.lower() or "sharing" in warning.lower()
            for warning in result.warnings
        )


class TestBackupRestore:
    """backup_config() 및 restore_config() 메서드 테스트"""

    def test_backup_config_success(self, config_manager):
        """설정 백업 성공"""
        # When: 백업
        backup_path = config_manager.backup_config()

        # Then: 백업 파일 생성
        assert Path(backup_path).exists()
        assert "matterbridge_" in backup_path
        assert backup_path.endswith(".toml")

    def test_backup_list(self, config_manager):
        """백업 목록 조회"""
        # Given: 여러 백업 생성
        import time

        config_manager.backup_config()
        time.sleep(1.1)  # 타임스탬프 구분을 위해 1초 대기
        config_manager.backup_config()

        # When: 목록 조회
        backups = config_manager.list_backups()

        # Then: 2개 이상
        assert len(backups) >= 2
        assert all(isinstance(path, str) for path, _ in backups)

    def test_restore_config_success(self, config_manager, sample_config_dict):
        """설정 복원 성공"""
        import copy

        # Given: 백업 생성 후 설정 변경
        backup_path = config_manager.backup_config()

        # 설정 변경
        modified_config = copy.deepcopy(sample_config_dict)
        modified_config["general"]["MediaServerUpload"] = "http://changed:8080"
        config_manager.write_config(modified_config, create_backup=False)

        # 변경 확인
        changed = config_manager.read_config()
        assert changed["general"]["MediaServerUpload"] == "http://changed:8080"

        # When: 복원
        result = config_manager.restore_config(backup_path)

        # Then: 성공 및 원래 값으로 복원
        assert result is True
        restored = config_manager.read_config()
        assert restored["general"]["MediaServerUpload"] == "http://localhost:8080"

    def test_restore_invalid_backup(self, config_manager):
        """존재하지 않는 백업 파일 복원"""
        # Given: 존재하지 않는 백업 경로
        # When/Then: 에러 발생
        with pytest.raises(ConfigError) as exc_info:
            config_manager.restore_config("/nonexistent/backup.toml")

        assert "not found" in str(exc_info.value).lower()


class TestConfigModel:
    """get_config_model() 및 update_config_model() 테스트"""

    def test_get_config_model(self, config_manager):
        """Pydantic 모델로 설정 가져오기"""
        # When: 모델 가져오기
        model = config_manager.get_config_model()

        # Then: MatterbridgeConfig 인스턴스
        assert isinstance(model, MatterbridgeConfig)
        assert "myslack" in model.slack
        assert "myteams" in model.teams
        assert len(model.gateway) == 1

    def test_update_config_model(self, config_manager):
        """Pydantic 모델로 설정 업데이트"""
        # Given: 새로운 설정 모델
        new_config = MatterbridgeConfig(
            slack={
                "myslack": SlackConfig(
                    token="new-token",
                    use_api=True,
                )
            },
            teams={
                "myteams": TeamsConfig(
                    tenant_id="new-tenant",
                    app_id="new-app",
                    app_password="new-pass",
                )
            },
            gateway=[
                GatewayConfig(
                    name="new-gateway",
                    enable=True,
                    inout=[
                        GatewayInOutConfig(account="slack.myslack", channel="channel1"),
                        GatewayInOutConfig(account="teams.myteams", channel="channel2"),
                    ],
                )
            ],
        )

        # When: 업데이트
        result = config_manager.update_config_model(new_config, create_backup=False)

        # Then: 성공
        assert result is True

        # 확인
        updated = config_manager.get_config_model()
        assert updated.slack["myslack"].token == "new-token"
        assert updated.teams["myteams"].tenant_id == "new-tenant"
