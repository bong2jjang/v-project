"""Compatibility shim — re-exports from v_platform.core"""
from v_platform.models.base import Base  # noqa: F401
from v_platform.core.database import (  # noqa: F401
    engine,
    SessionLocal,
    init_db,
    drop_db,
    get_db,
    get_db_session,
)

__all__ = [
    "Base",
    "engine",
    "SessionLocal",
    "init_db",
    "drop_db",
    "get_db",
    "get_db_session",
]
