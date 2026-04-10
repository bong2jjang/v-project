"""
Database Configuration

PostgreSQL 데이터베이스 설정 및 세션 관리
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
import logging

from app.models.base import Base

logger = logging.getLogger(__name__)

# Database URL - 기본값은 PostgreSQL 사용
# 개발/프로덕션 모두 PostgreSQL 권장
# SQLite는 테스트 목적으로만 사용 가능 (DATABASE_URL 환경 변수로 설정)
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://vmsuser:vmspassword@postgres:5432/vms_chat_ops"
)

# SQLite 지원을 위한 기본 디렉토리 (환경 변수로 SQLite URL 사용 시에만 활용)
DATABASE_DIR = os.getenv("DATABASE_DIR", "./data")

# Create engine with appropriate settings per backend
if "sqlite" in DATABASE_URL:
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        pool_size=20,
        max_overflow=30,
        pool_timeout=60,
        pool_pre_ping=True,
    )

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """
    데이터베이스 초기화

    테이블 생성 및 필요한 디렉토리 생성
    """
    # Import all models to register them with Base.metadata
    from app.models import (  # noqa: F401
        Message,
        MessageStats,
        User,
        UserRole,
        AuditLog,
        AuditAction,
        RefreshToken,
        PasswordResetToken,
        SystemSettings,
        MenuItem,
        UserPermission,
    )

    # Create data directory if not exists
    if "sqlite" in DATABASE_URL:
        os.makedirs(DATABASE_DIR, exist_ok=True)
        logger.info(f"Database directory created: {DATABASE_DIR}")

    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")

    # Run numbered migrations (idempotent)
    _run_migrations()


def _run_migrations():
    """번호 순서대로 마이그레이션 실행 (각 마이그레이션은 idempotent)"""
    import importlib.util
    import glob as glob_mod
    import pathlib

    migrations_dir = (
        pathlib.Path(__file__).resolve().parent.parent.parent / "migrations"
    )
    if not migrations_dir.is_dir():
        return

    # Platform migrations (p*) first, then App migrations (a*)
    p_files = sorted(glob_mod.glob(str(migrations_dir / "p[0-9]*.py")))
    a_files = sorted(glob_mod.glob(str(migrations_dir / "a[0-9]*.py")))
    files = p_files + a_files
    for fpath in files:
        name = pathlib.Path(fpath).stem
        try:
            spec = importlib.util.spec_from_file_location(name, fpath)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "migrate"):
                mod.migrate(engine)
        except Exception as e:
            logger.error(f"Migration {name} failed: {e}")


def drop_db():
    """
    데이터베이스 삭제 (테스트용)

    Warning: 모든 데이터가 삭제됩니다
    """
    Base.metadata.drop_all(bind=engine)
    logger.warning("Database tables dropped")


@contextmanager
def get_db() -> Session:
    """
    데이터베이스 세션 컨텍스트 매니저

    Usage:
        with get_db() as db:
            db.query(Message).all()
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        db.close()


def get_db_session() -> Session:
    """
    데이터베이스 세션 가져오기 (FastAPI dependency용)

    Usage:
        @app.get("/")
        def endpoint(db: Session = Depends(get_db_session)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
