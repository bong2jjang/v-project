"""User Management API 엔드포인트 테스트"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserRole


class TestListUsers:
    """GET /api/users/ 테스트"""

    def test_list_users_as_admin(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        admin_user: User,
        normal_user: User,
    ):
        """관리자가 사용자 목록 조회"""
        # When: 관리자가 목록 조회
        response = client.get("/api/users/", headers=auth_headers_admin)

        # Then: 성공 (UserListResponse 형식으로 반환)
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert len(data["users"]) >= 2
        emails = [user["email"] for user in data["users"]]
        assert admin_user.email in emails
        assert normal_user.email in emails

    def test_list_users_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """일반 사용자가 목록 조회 시도"""
        # When: 일반 사용자가 목록 조회
        response = client.get("/api/users/", headers=auth_headers_user)

        # Then: 403 Forbidden
        assert response.status_code == 403
        # require_permission이 반환하는 실제 에러 메시지
        assert "권한이 없습니다" in response.json()["detail"]

    def test_list_users_no_auth(self, client: TestClient):
        """인증 없이 목록 조회"""
        # When: 토큰 없이 조회
        response = client.get("/api/users/")

        # Then: 401 Unauthorized
        assert response.status_code == 401

    def test_list_users_pagination(
        self,
        client: TestClient,
        auth_headers_admin: dict[str, str],
        db_session: Session,
    ):
        """페이지네이션 테스트"""
        # Given: 여러 사용자 생성
        for i in range(15):
            user = User(
                email=f"user{i}@test.com",
                username=f"user{i}",
                hashed_password="hashed",
                role=UserRole.USER,
                is_active=True,
            )
            db_session.add(user)
        db_session.commit()

        # When: page와 per_page 사용 (API는 page/per_page 쿼리 파라미터를 사용)
        response = client.get(
            "/api/users/?page=1&per_page=10",
            headers=auth_headers_admin,
        )

        # Then: 최대 10개 반환 (UserListResponse 형식)
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert len(data["users"]) <= 10


class TestGetUser:
    """GET /api/users/{user_id} 테스트"""

    def test_get_user_as_admin(
        self, client: TestClient, auth_headers_admin: dict[str, str], normal_user: User
    ):
        """관리자가 특정 사용자 조회"""
        # When: 관리자가 사용자 조회
        response = client.get(
            f"/api/users/{normal_user.id}",
            headers=auth_headers_admin,
        )

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == normal_user.email
        assert data["username"] == normal_user.username

    def test_get_user_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str], admin_user: User
    ):
        """일반 사용자가 타 사용자 조회"""
        # When: 일반 사용자가 다른 사용자 조회
        response = client.get(
            f"/api/users/{admin_user.id}",
            headers=auth_headers_user,
        )

        # Then: 403 Forbidden
        assert response.status_code == 403

    def test_get_user_nonexistent(
        self, client: TestClient, auth_headers_admin: dict[str, str]
    ):
        """존재하지 않는 사용자 조회"""
        # When: 없는 ID로 조회
        response = client.get(
            "/api/users/99999",
            headers=auth_headers_admin,
        )

        # Then: 404 Not Found (API는 영문 메시지 반환)
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]


class TestCreateUser:
    """POST /api/users/ 테스트"""

    def test_create_user_as_admin(
        self, client: TestClient, auth_headers_admin: dict[str, str]
    ):
        """관리자가 사용자 생성"""
        # When: 관리자가 사용자 생성 (비밀번호 최소 8자)
        response = client.post(
            "/api/users/",
            headers=auth_headers_admin,
            json={
                "email": "newuser@test.com",
                "username": "newuser",
                "password": "password123",
                "role": "user",
                "is_active": True,
            },
        )

        # Then: 성공 (201 Created)
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@test.com"
        assert data["username"] == "newuser"
        assert data["role"] == "user"
        assert data["is_active"] is True

    def test_create_user_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str]
    ):
        """일반 사용자가 사용자 생성 시도"""
        # When: 일반 사용자가 생성 시도 (비밀번호 최소 8자)
        response = client.post(
            "/api/users/",
            headers=auth_headers_user,
            json={
                "email": "newuser@test.com",
                "username": "newuser",
                "password": "password123",
                "role": "user",
            },
        )

        # Then: 403 Forbidden
        assert response.status_code == 403

    def test_create_user_duplicate_email(
        self, client: TestClient, auth_headers_admin: dict[str, str], normal_user: User
    ):
        """중복 이메일로 생성"""
        # When: 기존 이메일로 생성 (비밀번호 최소 8자)
        response = client.post(
            "/api/users/",
            headers=auth_headers_admin,
            json={
                "email": normal_user.email,
                "username": "different",
                "password": "password123",
                "role": "user",
            },
        )

        # Then: 400 Bad Request (API는 영문 에러 메시지 반환)
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    def test_create_user_duplicate_username(
        self, client: TestClient, auth_headers_admin: dict[str, str], normal_user: User
    ):
        """중복 사용자명으로 생성 — API는 username 중복 검사를 하지 않으므로 201 성공"""
        # When: 기존 사용자명으로 생성 (비밀번호 최소 8자)
        response = client.post(
            "/api/users/",
            headers=auth_headers_admin,
            json={
                "email": "different@test.com",
                "username": normal_user.username,
                "password": "password123",
                "role": "user",
            },
        )

        # Then: 201 Created (현재 API는 username 중복 검사 없음)
        assert response.status_code == 201


class TestUpdateUser:
    """PUT /api/users/{user_id} 테스트"""

    def test_update_user_as_admin(
        self, client: TestClient, auth_headers_admin: dict[str, str], normal_user: User
    ):
        """관리자가 사용자 정보 수정 (username, email, is_active)"""
        # When: 관리자가 사용자 정보 수정 (UserUpdate 스키마에 role 필드 없음)
        response = client.put(
            f"/api/users/{normal_user.id}",
            headers=auth_headers_admin,
            json={
                "email": "updated@test.com",
                "username": "updateduser",
                "is_active": False,
            },
        )

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "updated@test.com"
        assert data["username"] == "updateduser"
        assert data["is_active"] is False

    def test_update_user_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str], admin_user: User
    ):
        """일반 사용자가 타 사용자 수정 시도"""
        # When: 일반 사용자가 다른 사용자 수정
        response = client.put(
            f"/api/users/{admin_user.id}",
            headers=auth_headers_user,
            json={
                "email": "hacker@test.com",
                "username": "hacker",
            },
        )

        # Then: 403 Forbidden
        assert response.status_code == 403

    def test_update_user_partial_update(
        self, client: TestClient, auth_headers_admin: dict[str, str], normal_user: User
    ):
        """부분 업데이트"""
        # When: 일부 필드만 수정
        response = client.put(
            f"/api/users/{normal_user.id}",
            headers=auth_headers_admin,
            json={
                "is_active": False,  # 활성 상태만 변경
            },
        )

        # Then: 성공, 다른 필드는 유지
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == normal_user.email  # 기존 값 유지
        assert data["username"] == normal_user.username  # 기존 값 유지
        assert data["is_active"] is False  # 변경됨

    def test_update_user_nonexistent(
        self, client: TestClient, auth_headers_admin: dict[str, str]
    ):
        """존재하지 않는 사용자 수정"""
        # When: 없는 ID로 수정
        response = client.put(
            "/api/users/99999",
            headers=auth_headers_admin,
            json={"email": "test@test.com"},
        )

        # Then: 404 Not Found
        assert response.status_code == 404


class TestDeleteUser:
    """DELETE /api/users/{user_id} 테스트"""

    def test_delete_user_as_admin(
        self, client: TestClient, auth_headers_admin: dict[str, str], normal_user: User
    ):
        """관리자가 사용자 삭제"""
        # When: 관리자가 사용자 삭제
        response = client.delete(
            f"/api/users/{normal_user.id}",
            headers=auth_headers_admin,
        )

        # Then: 204 No Content (응답 본문 없음)
        assert response.status_code == 204

        # And: 삭제된 사용자 조회 불가
        get_response = client.get(
            f"/api/users/{normal_user.id}",
            headers=auth_headers_admin,
        )
        assert get_response.status_code == 404

    def test_delete_user_as_normal_user(
        self, client: TestClient, auth_headers_user: dict[str, str], admin_user: User
    ):
        """일반 사용자가 삭제 시도"""
        # When: 일반 사용자가 삭제 시도
        response = client.delete(
            f"/api/users/{admin_user.id}",
            headers=auth_headers_user,
        )

        # Then: 403 Forbidden
        assert response.status_code == 403

    def test_delete_user_nonexistent(
        self, client: TestClient, auth_headers_admin: dict[str, str]
    ):
        """존재하지 않는 사용자 삭제"""
        # When: 없는 ID로 삭제
        response = client.delete(
            "/api/users/99999",
            headers=auth_headers_admin,
        )

        # Then: 404 Not Found
        assert response.status_code == 404

    def test_delete_self(
        self, client: TestClient, auth_headers_admin: dict[str, str], admin_user: User
    ):
        """자기 자신을 삭제 시도"""
        # When: 자기 자신을 삭제
        response = client.delete(
            f"/api/users/{admin_user.id}",
            headers=auth_headers_admin,
        )

        # Then: 400 Bad Request (자기 자신은 삭제 불가)
        assert response.status_code == 400


class TestUpdateProfile:
    """PUT /api/users/me 테스트 (본인 프로필 수정)"""

    def test_update_own_profile(
        self, client: TestClient, auth_headers_user: dict[str, str], normal_user: User
    ):
        """자신의 프로필 수정"""
        # When: 자신의 프로필 수정 (엔드포인트: PUT /api/users/me)
        response = client.put(
            "/api/users/me",
            headers=auth_headers_user,
            json={
                "username": "newusername",
            },
        )

        # Then: 성공
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "newusername"

    def test_update_profile_no_auth(self, client: TestClient):
        """인증 없이 프로필 수정"""
        # When: 토큰 없이 수정 (엔드포인트: PUT /api/users/me)
        response = client.put(
            "/api/users/me",
            json={"username": "hacker"},
        )

        # Then: 401 Unauthorized
        assert response.status_code == 401

    def test_update_profile_duplicate_username(
        self, client: TestClient, auth_headers_user: dict[str, str], admin_user: User
    ):
        """다른 사용자의 사용자명으로 변경 — API는 username 중복 검사 없이 200 반환"""
        # When: 이미 사용 중인 사용자명으로 변경 (엔드포인트: PUT /api/users/me)
        response = client.put(
            "/api/users/me",
            headers=auth_headers_user,
            json={
                "username": admin_user.username,
            },
        )

        # Then: 200 OK (현재 API는 /me 엔드포인트에서 username 중복 검사 없음)
        assert response.status_code == 200
