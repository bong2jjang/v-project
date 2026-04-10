"""Compatibility shim — re-exports Base from v_platform"""
from v_platform.models.base import Base  # noqa: F401

__all__ = ["Base"]
