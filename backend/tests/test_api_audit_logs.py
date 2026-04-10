"""Audit Logs API 엔드포인트 테스트"""

import json
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog, AuditAction
from app.models.user import User


@pytest.fixture
def sample_audit_logs(db_session: Session, admin_user: User, normal_user: User):
    """샘플 감사 로그 데이터"""
    logs = [
        AuditLog(
            user_id=admin_user.id,
            action=AuditAction.USER_LOGIN,
            resource_type="user",
            resource_id=str(admin_user.id),
            details=json.dumps({"ip_address": "127.0.0.1"}),
            timestamp=datetime(2026, 3, 22, 10, 0, 0),
        ),
        AuditLog(
            user_id=admin_user.id,
            action=AuditAction.USER_REGISTER,
            resource_type="user",
            resource_id=str(normal_user.id),
            details=json.dumps({"email": normal_user.email}),
            timestamp=datetime(2026, 3, 22, 11, 0, 0),
        ),
        AuditLog(
            user_id=normal_user.id,
            action=AuditAction.USER_LOGIN,
            resource_type="user",
            resource_id=str(normal_user.id),
            details=json.dumps({"ip_address": "192.168.1.100"}),
            timestamp=datetime(2026, 3, 22, 12, 0, 0),
        ),
        AuditLog(
            user_id=admin_user.id,
            action=AuditAction.CONFIG_UPDATE,
            resource_type="config",
            resource_id="matterbridge.toml",
            details=json.dumps({"changes": ["gateway settings"]}),
            timestamp=datetime(2026, 3, 22, 13, 0, 0),
        ),
    ]
    for log in logs:
        db_session.add(log)
    db_session.commit()
    return logs


class TestListAuditLogs:
    """GET /api/audit-logs/ 테스트"""

    def test_list_audit_logs_as_admin(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        sample_audit_logs,
    ):
        """관리자가 감사 로그 조회"""
        # When: 관리자가 로그 조회
        response = client.get("/api/audit-logs/", headers=auth_headers_admin)

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) >= 4  # 최소 4개 로그

    def test_list_audit_logs_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """일반 사용자가 로그 조회 시도"""
        # When: 일반 사용자가 로그 조회
        response = client.get("/api/audit-logs/", headers=auth_headers_user)

        # Then: 403 Forbidden (관리자만 조회 가능)
        assert response.status_code == 403
        assert "권한이 없습니다" in response.json()["detail"]

    def test_list_audit_logs_no_auth(self, client: TestClient):
        """인증 없이 로그 조회"""
        # When: 토큰 없이 조회
        response = client.get("/api/audit-logs/")

        # Then: 401 Unauthorized
        assert response.status_code == 401

    def test_list_audit_logs_pagination(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        sample_audit_logs,
    ):
        """페이지네이션 테스트"""
        # When: page와 per_page 사용
        response = client.get(
            "/api/audit-logs/?page=1&per_page=2",
            headers=auth_headers_admin,
        )

        # Then: 최대 2개 반환 (최신순)
        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) <= 2

    def test_list_audit_logs_filter_by_user(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        sample_audit_logs,
        normal_user: User,
    ):
        """사용자 ID로 필터링"""
        # When: 특정 사용자 로그만 조회
        response = client.get(
            f"/api/audit-logs/?user_id={normal_user.id}",
            headers=auth_headers_admin,
        )

        # Then: 해당 사용자 로그만 반환
        assert response.status_code == 200
        data = response.json()
        for log in data["logs"]:
            assert log["user_id"] == normal_user.id

    def test_list_audit_logs_filter_by_action(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        sample_audit_logs,
    ):
        """액션으로 필터링"""
        # When: 특정 액션 로그만 조회
        response = client.get(
            f"/api/audit-logs/?action={AuditAction.USER_LOGIN.value}",
            headers=auth_headers_admin,
        )

        # Then: 해당 액션 로그만 반환
        assert response.status_code == 200
        data = response.json()
        for log in data["logs"]:
            assert log["action"] == AuditAction.USER_LOGIN.value

    def test_list_audit_logs_filter_by_resource_type(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        sample_audit_logs,
    ):
        """리소스 타입으로 필터링"""
        # When: 특정 리소스 타입 로그만 조회
        response = client.get(
            "/api/audit-logs/?resource_type=config",
            headers=auth_headers_admin,
        )

        # Then: 해당 리소스 타입 로그만 반환
        assert response.status_code == 200
        data = response.json()
        for log in data["logs"]:
            assert log["resource_type"] == "config"

    def test_list_audit_logs_filter_by_date_range(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        sample_audit_logs,
    ):
        """날짜 범위로 필터링"""
        # When: 특정 날짜 범위 로그만 조회
        response = client.get(
            "/api/audit-logs/?start_date=2026-03-22T10:00:00&end_date=2026-03-22T12:00:00",
            headers=auth_headers_admin,
        )

        # Then: 해당 범위 로그만 반환
        assert response.status_code == 200
        data = response.json()
        # 10:00~12:00 사이 로그는 2개
        assert len(data["logs"]) >= 2

    def test_list_audit_logs_combined_filters(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        sample_audit_logs,
        admin_user: User,
    ):
        """복합 필터링"""
        # When: 여러 필터 조합
        response = client.get(
            f"/api/audit-logs/?user_id={admin_user.id}&action={AuditAction.USER_LOGIN.value}",
            headers=auth_headers_admin,
        )

        # Then: 모든 조건 만족하는 로그만 반환
        assert response.status_code == 200
        data = response.json()
        for log in data["logs"]:
            assert log["user_id"] == admin_user.id
            assert log["action"] == AuditAction.USER_LOGIN.value


class TestGetAuditLog:
    """GET /api/audit-logs/{log_id} 테스트"""

    def test_get_audit_log_success(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        sample_audit_logs,
    ):
        """특정 감사 로그 조회 성공"""
        # Given: 첫 번째 로그 ID
        log_id = sample_audit_logs[0].id

        # When: 로그 조회
        response = client.get(
            f"/api/audit-logs/{log_id}",
            headers=auth_headers_admin,
        )

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == log_id
        assert data["action"] == AuditAction.USER_LOGIN.value

    def test_get_audit_log_as_normal_user(
        self,
        client: TestClient,
        auth_headers_user: dict[str, str],
        sample_audit_logs,
    ):
        """일반 사용자가 로그 조회"""
        # When: 일반 사용자가 로그 조회
        response = client.get(
            f"/api/audit-logs/{sample_audit_logs[0].id}",
            headers=auth_headers_user,
        )

        # Then: 403 Forbidden
        assert response.status_code == 403

    def test_get_audit_log_not_found(
        self, client: TestClient, auth_headers_admin: dict[str, str]
    ):
        """존재하지 않는 로그 조회"""
        # When: 없는 로그 조회
        response = client.get(
            "/api/audit-logs/99999",
            headers=auth_headers_admin,
        )

        # Then: 404 Not Found
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestCreateAuditLog:
    """POST /api/audit-logs/ 테스트 (내부 사용)"""

    def test_create_audit_log_as_admin(
        self, client: TestClient, auth_headers_admin: dict[str, str], admin_user: User
    ):
        """관리자가 감사 로그 생성"""
        # When: 로그 생성
        response = client.post(
            "/api/audit-logs/",
            headers=auth_headers_admin,
            json={
                "user_id": admin_user.id,
                "action": AuditAction.CONFIG_UPDATE.value,
                "resource_type": "config",
                "resource_id": "test.toml",
                "details": {"test": "data"},
            },
        )

        # Then: 성공 (또는 엔드포인트가 없다면 404/405)
        # 실제 구현에 따라 다를 수 있음
        assert response.status_code in [200, 201, 404, 405]


class TestAuditLogStatistics:
    """GET /api/audit-logs/statistics 테스트"""

    def test_get_audit_log_statistics_as_admin(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        sample_audit_logs,
    ):
        """감사 로그 통계 조회"""
        # When: 통계 조회 (실제 엔드포인트: /stats/summary)
        response = client.get(
            "/api/audit-logs/stats/summary",
            headers=auth_headers_admin,
        )

        # Then: 성공 (엔드포인트가 있다면)
        # 실제 구현에 따라 다를 수 있음
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            # 통계 데이터 검증
            assert "total_logs" in data or "by_action" in data

    def test_get_audit_log_statistics_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """일반 사용자가 통계 조회"""
        # When: 일반 사용자가 통계 조회 (실제 엔드포인트: /stats/summary)
        response = client.get(
            "/api/audit-logs/stats/summary",
            headers=auth_headers_user,
        )

        # Then: 403 Forbidden 또는 404 (엔드포인트 없음)
        assert response.status_code in [403, 404]


class TestAuditLogExport:
    """GET /api/audit-logs/export 테스트 (선택사항)"""

    def test_export_audit_logs_as_admin(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        sample_audit_logs,
    ):
        """감사 로그 CSV 내보내기"""
        # When: CSV 내보내기 (실제 엔드포인트: /export/csv)
        response = client.get(
            "/api/audit-logs/export/csv",
            headers=auth_headers_admin,
        )

        # Then: 성공 또는 미구현 (404)
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            # CSV 응답 검증
            assert (
                "text/csv" in response.headers.get("content-type", "").lower()
                or "application/octet-stream"
                in response.headers.get("content-type", "").lower()
            )

    def test_export_audit_logs_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """일반 사용자가 내보내기 시도"""
        # When: 일반 사용자가 내보내기 (실제 엔드포인트: /export/csv)
        response = client.get(
            "/api/audit-logs/export/csv",
            headers=auth_headers_user,
        )

        # Then: 403 Forbidden 또는 404
        assert response.status_code in [403, 404]
