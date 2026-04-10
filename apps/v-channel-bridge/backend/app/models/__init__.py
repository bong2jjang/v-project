"""
Database Models — re-exports from v_platform + app-local models
"""

# Platform models (from v_platform)
from v_platform.models.user import User, UserRole  # noqa: F401
from v_platform.models.audit_log import AuditLog, AuditAction  # noqa: F401
from v_platform.models.refresh_token import RefreshToken  # noqa: F401
from v_platform.models.password_reset_token import PasswordResetToken  # noqa: F401
from v_platform.models.system_settings import SystemSettings  # noqa: F401
from v_platform.models.user_oauth_token import UserOAuthToken  # noqa: F401
from v_platform.models.menu_item import MenuItem  # noqa: F401
from v_platform.models.user_permission import UserPermission, AccessLevel  # noqa: F401
from v_platform.models.permission_group import PermissionGroup  # noqa: F401
from v_platform.models.company import Company  # noqa: F401
from v_platform.models.department import Department  # noqa: F401

# App models (v-channel-bridge)
from .message import Message, MessageStats  # noqa: F401
from .account import Account  # noqa: F401

# Configure cross-model relationships (Account ↔ UserOAuthToken)
UserOAuthToken._configure_account_relationship()

__all__ = [
    "Message",
    "MessageStats",
    "User",
    "UserRole",
    "AuditLog",
    "AuditAction",
    "RefreshToken",
    "PasswordResetToken",
    "SystemSettings",
    "Account",
    "UserOAuthToken",
    "MenuItem",
    "UserPermission",
    "AccessLevel",
]
