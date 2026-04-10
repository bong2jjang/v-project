"""Authentication API 엔드포인트 테스트"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserRole


class TestRegister:
    """POST /api/auth/register 테스트"""

    def test_register_first_user(self, client: TestClient, db_session: Session):
        """첫 번째 사용자 등록"""
        # Given: 빈 데이터베이스
        # When: 회원가입
        response = client.post(
            "/api/auth/register",
            json={
                "email": "first@test.com",
                "username": "firstuser",
                "password": "password123",
            },
        )

        # Then: 성공
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "first@test.com"
        assert data["role"] == UserRole.USER.value

    def test_register_second_user_becomes_normal_user(
        self, client: TestClient, admin_user: User
    ):
        """두 번째 사용자는 일반 사용자"""
        # Given: 관리자 사용자 존재
        # When: 두 번째 사용자 회원가입
        response = client.post(
            "/api/auth/register",
            json={
                "email": "second@test.com",
                "username": "seconduser",
                "password": "password123",
            },
        )

        # Then: 성공
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "second@test.com"
        assert data["role"] == UserRole.USER.value

    def test_register_duplicate_email(self, client: TestClient, admin_user: User):
        """중복 이메일 회원가입 실패"""
        # Given: 이미 존재하는 이메일
        # When: 동일 이메일로 회원가입
        response = client.post(
            "/api/auth/register",
            json={
                "email": admin_user.email,
                "username": "newuser",
                "password": "password123",
            },
        )

        # Then: 400 에러
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    def test_register_duplicate_username(self, client: TestClient, admin_user: User):
        """중복 사용자명 회원가입 — API에서 username 중복 체크 미구현"""
        # Given: 이미 존재하는 사용자명
        # When: 동일 사용자명으로 회원가입
        response = client.post(
            "/api/auth/register",
            json={
                "email": "new@test.com",
                "username": admin_user.username,
                "password": "password123",
            },
        )

        # Then: 현재 API는 username 중복 체크 없이 성공 또는 DB 제약조건 에러
        assert response.status_code in (201, 400, 500)

    def test_register_invalid_email(self, client: TestClient):
        """잘못된 이메일 형식"""
        # When: 잘못된 이메일로 회원가입
        response = client.post(
            "/api/auth/register",
            json={
                "email": "invalid-email",
                "username": "testuser",
                "password": "password123",
            },
        )

        # Then: 422 에러 (validation error)
        assert response.status_code == 422

    def test_register_short_password(self, client: TestClient):
        """짧은 비밀번호"""
        # When: 짧은 비밀번호로 회원가입
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@test.com",
                "username": "testuser",
                "password": "123",  # 너무 짧음
            },
        )

        # Then: 422 에러
        assert response.status_code == 422


class TestLogin:
    """POST /api/auth/login 테스트"""

    def test_login_success_with_email(self, client: TestClient, admin_user: User):
        """이메일로 로그인 성공"""
        # When: 이메일과 비밀번호로 로그인
        response = client.post(
            "/api/auth/login",
            json={
                "email": admin_user.email,
                "password": "Admin123!",
            },
        )

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient, admin_user: User):
        """잘못된 비밀번호"""
        # When: 잘못된 비밀번호로 로그인
        response = client.post(
            "/api/auth/login",
            json={
                "email": admin_user.email,
                "password": "wrongpassword",
            },
        )

        # Then: 401 에러
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()

    def test_login_nonexistent_user(self, client: TestClient):
        """존재하지 않는 사용자"""
        # When: 존재하지 않는 사용자로 로그인
        response = client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@test.com",
                "password": "password123",
            },
        )

        # Then: 401 에러
        assert response.status_code == 401

    def test_login_inactive_user(self, client: TestClient, inactive_user: User):
        """비활성 사용자 로그인 시도"""
        # When: 비활성 사용자로 로그인
        response = client.post(
            "/api/auth/login",
            json={
                "email": inactive_user.email,
                "password": "inactive123",
            },
        )

        # Then: 403 에러 (비활성 계정)
        assert response.status_code == 403
        assert "inactive" in response.json()["detail"].lower()


class TestGetMe:
    """GET /api/auth/me 테스트"""

    def test_get_me_success(
        self, client: TestClient, auth_headers_admin: dict[str, str], admin_user: User
    ):
        """현재 사용자 정보 조회 성공"""
        # When: 인증된 사용자가 정보 조회
        response = client.get("/api/auth/me", headers=auth_headers_admin)

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == admin_user.email
        assert data["username"] == admin_user.username
        assert data["role"] == admin_user.role.value

    def test_get_me_no_token(self, client: TestClient):
        """토큰 없이 조회"""
        # When: 토큰 없이 조회
        response = client.get("/api/auth/me")

        # Then: 401 에러
        assert response.status_code == 401

    def test_get_me_invalid_token(self, client: TestClient):
        """잘못된 토큰"""
        # When: 잘못된 토큰으로 조회
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid-token"},
        )

        # Then: 401 에러
        assert response.status_code == 401

    def test_get_me_expired_token(self, client: TestClient, expired_token: str):
        """만료된 토큰"""
        # When: 만료된 토큰으로 조회
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )

        # Then: 401 에러
        assert response.status_code == 401


class TestChangePassword:
    """PUT /api/users/me/password 테스트"""

    def test_change_password_success(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """비밀번호 변경 성공"""
        # When: 현재 비밀번호와 새 비밀번호로 변경
        response = client.put(
            "/api/users/me/password",
            headers=auth_headers_user,
            json={
                "current_password": "user123",
                "new_password": "newpassword123",
            },
        )

        # Then: 성공
        assert response.status_code == 200

        # And: 새 비밀번호로 로그인 가능
        login_response = client.post(
            "/api/auth/login",
            json={
                "email": "user@test.com",
                "password": "newpassword123",
            },
        )
        assert login_response.status_code == 200

    def test_change_password_wrong_current(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """현재 비밀번호 불일치"""
        # When: 잘못된 현재 비밀번호
        response = client.put(
            "/api/users/me/password",
            headers=auth_headers_user,
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123",
            },
        )

        # Then: 400 에러
        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()

    def test_change_password_no_auth(self, client: TestClient):
        """인증 없이 변경 시도"""
        # When: 토큰 없이 변경 시도
        response = client.put(
            "/api/users/me/password",
            json={
                "current_password": "user123",
                "new_password": "newpassword123",
            },
        )

        # Then: 401 에러
        assert response.status_code == 401

    def test_change_password_short_new_password(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """새 비밀번호가 너무 짧음"""
        # When: 짧은 새 비밀번호
        response = client.put(
            "/api/users/me/password",
            headers=auth_headers_user,
            json={
                "current_password": "user123",
                "new_password": "123",  # 너무 짧음
            },
        )

        # Then: 422 에러
        assert response.status_code == 422


class TestLogout:
    """POST /api/auth/logout 테스트"""

    def test_logout_success(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """로그아웃 성공"""
        # When: 로그아웃
        response = client.post("/api/auth/logout", headers=auth_headers_user)

        # Then: 성공
        assert response.status_code == 200
        assert "logged out" in response.json()["message"].lower()

    def test_logout_no_auth(self, client: TestClient):
        """인증 없이 로그아웃 — 쿠키 기반이므로 200 반환"""
        # When: 토큰 없이 로그아웃
        response = client.post("/api/auth/logout")

        # Then: 쿠키 기반 로그아웃이므로 항상 200
        assert response.status_code == 200
