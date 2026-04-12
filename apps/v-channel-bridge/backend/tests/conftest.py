"""공통 pytest fixtures"""

# ruff: noqa: E402 — os.environ must be set before any app imports

import os

# quick_test.py는 라이브 서버 테스트이므로 pytest 수집 제외
collect_ignore = ["quick_test.py"]

# 테스트 환경 설정 — 모든 import보다 먼저 설정해야 함
os.environ["TESTING"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from datetime import datetime, timedelta
from typing import Generator
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.db.database import get_db_session
from app.main import app
from app.models.user import User
from app.schemas.user import UserRole
from app.utils.auth import create_access_token, get_password_hash


# 테스트용 인메모리 데이터베이스
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """테스트용 데이터베이스 세션"""
    # 테이블 생성
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # 테이블 삭제
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session: Session) -> TestClient:
    """테스트 클라이언트"""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db_session] = override_get_db

    # Rate limiter 비활성화 (테스트 환경)
    from app.api.auth import limiter as auth_limiter

    auth_limiter.enabled = False
    if hasattr(app.state, "limiter"):
        app.state.limiter.enabled = False

    client = TestClient(app)
    yield client

    # 정리
    auth_limiter.enabled = True
    if hasattr(app.state, "limiter"):
        app.state.limiter.enabled = True
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db_session: Session) -> User:
    """관리자 사용자 fixture"""
    user = User(
        email="admin@test.com",
        username="admin",
        hashed_password=get_password_hash("Admin123!"),
        role=UserRole.SYSTEM_ADMIN,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def normal_user(db_session: Session) -> User:
    """일반 사용자 fixture"""
    user = User(
        email="user@test.com",
        username="testuser",
        hashed_password=get_password_hash("user123"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def inactive_user(db_session: Session) -> User:
    """비활성 사용자 fixture"""
    user = User(
        email="inactive@test.com",
        username="inactive",
        hashed_password=get_password_hash("inactive123"),
        role=UserRole.USER,
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user: User) -> str:
    """관리자 토큰 fixture"""
    token_data = {
        "sub": admin_user.email,
        "email": admin_user.email,
        "user_id": admin_user.id,
        "role": admin_user.role.value,
    }
    return create_access_token(token_data)


@pytest.fixture
def user_token(normal_user: User) -> str:
    """일반 사용자 토큰 fixture"""
    token_data = {
        "sub": normal_user.email,
        "email": normal_user.email,
        "user_id": normal_user.id,
        "role": normal_user.role.value,
    }
    return create_access_token(token_data)


@pytest.fixture
def expired_token() -> str:
    """만료된 토큰 fixture"""
    token_data = {
        "sub": "test@test.com",
        "user_id": 999,
        "role": "user",
        "exp": datetime.utcnow() - timedelta(hours=1),  # 1시간 전 만료
    }
    return create_access_token(token_data, expires_delta=timedelta(hours=-1))


@pytest.fixture
def auth_headers_admin(admin_token: str) -> dict[str, str]:
    """관리자 인증 헤더"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def auth_headers_user(user_token: str) -> dict[str, str]:
    """일반 사용자 인증 헤더"""
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
def mock_config_manager():
    """모킹된 ConfigManager"""
    from app.api.config import get_config_manager

    manager = Mock()
    app.dependency_overrides[get_config_manager] = lambda: manager
    yield manager
    app.dependency_overrides.clear()


@pytest.fixture
def mock_bridge():
    """모킹된 WebSocketBridge"""
    from app.services.websocket_bridge import set_bridge

    bridge = Mock()
    bridge.is_running = True
    bridge.providers = {}
    bridge._tasks = []
    set_bridge(bridge)
    yield bridge
    set_bridge(None)


@pytest.fixture
def sample_bridge_config() -> dict:
    """샘플 v-channel-bridge 설정 (routes 기반)"""
    return {
        "routes": [
            {
                "source_platform": "slack",
                "source_channel": "C12345",
                "target_platform": "teams",
                "target_channel": "19:xxx@thread.tacv2",
                "message_mode": "sender_info",
                "is_bidirectional": True,
                "is_enabled": True,
            }
        ],
        "providers": {
            "slack": {"token": "xoxb-test-token"},
            "teams": {
                "tenant_id": "tenant-id",
                "app_id": "app-id",
                "app_password": "password",
            },
        },
    }


@pytest.fixture(autouse=True)
def reset_db_overrides():
    """각 테스트 후 dependency_overrides 초기화"""
    yield
    app.dependency_overrides.clear()
