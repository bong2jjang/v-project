"""
Audit Logger Utility

감사 로그를 생성하는 유틸리티 함수
"""

from datetime import datetime, timezone
from typing import Optional
import json
from sqlalchemy.orm import Session

from v_platform.models.audit_log import AuditLog, AuditAction
from v_platform.models.user import User


def create_audit_log(
    db: Session,
    action: AuditAction,
    user: Optional[User] = None,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    description: Optional[str] = None,
    details: Optional[dict] = None,
    status: str = "success",
    error_message: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    app_id: Optional[str] = None,
    request=None,
) -> AuditLog:
    """
    감사 로그 생성

    Args:
        db: 데이터베이스 세션
        action: 액션 타입 (AuditAction enum)
        user: 사용자 객체 (선택적)
        user_id: 사용자 ID (user 객체가 없을 때)
        user_email: 사용자 이메일 (user 객체가 없을 때)
        resource_type: 리소스 타입 (user, config, bridge, route 등)
        resource_id: 리소스 ID
        description: 액션 설명
        details: 추가 정보 (딕셔너리, JSON으로 저장됨)
        status: 상태 (success, failure, error)
        error_message: 에러 메시지
        ip_address: IP 주소
        user_agent: User Agent

    Returns:
        AuditLog: 생성된 감사 로그
    """
    # user 객체에서 정보 추출
    if user:
        user_id = user.id
        user_email = user.email

    # Extract app_id from request if not explicitly provided
    if app_id is None and request and hasattr(request, 'app') and hasattr(request.app, 'state'):
        app_id = getattr(request.app.state, 'app_id', None)

    # details를 JSON 문자열로 변환
    details_json = None
    if details:
        try:
            details_json = json.dumps(details, ensure_ascii=False)
        except (TypeError, ValueError):
            details_json = str(details)

    # 감사 로그 생성
    audit_log = AuditLog(
        timestamp=datetime.now(timezone.utc),
        user_id=user_id,
        user_email=user_email,
        action=action.value if isinstance(action, AuditAction) else action,
        resource_type=resource_type,
        resource_id=resource_id,
        description=description,
        details=details_json,
        status=status,
        error_message=error_message,
        ip_address=ip_address,
        user_agent=user_agent,
        app_id=app_id,
    )

    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)

    return audit_log


def log_user_login(
    db: Session,
    user: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """사용자 로그인 로그"""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_LOGIN,
        user=user,
        resource_type="user",
        resource_id=str(user.id),
        description=f"User {user.email} logged in",
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_user_register(
    db: Session,
    user: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """사용자 등록 로그"""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_REGISTER,
        user=user,
        resource_type="user",
        resource_id=str(user.id),
        description=f"User {user.email} registered",
        details={"role": user.role.value if user.role else None},
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_user_update(
    db: Session,
    user: User,
    updated_by: User,
    changes: dict,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """사용자 정보 수정 로그"""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_UPDATE,
        user=updated_by,
        resource_type="user",
        resource_id=str(user.id),
        description=f"User {user.email} updated by {updated_by.email}",
        details={"changes": changes},
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_user_delete(
    db: Session,
    user_email: str,
    user_id: int,
    deleted_by: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """사용자 삭제 로그"""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_DELETE,
        user=deleted_by,
        resource_type="user",
        resource_id=str(user_id),
        description=f"User {user_email} deleted by {deleted_by.email}",
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_user_role_change(
    db: Session,
    user: User,
    old_role: str,
    new_role: str,
    changed_by: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """사용자 역할 변경 로그"""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_ROLE_CHANGE,
        user=changed_by,
        resource_type="user",
        resource_id=str(user.id),
        description=f"User {user.email} role changed from {old_role} to {new_role} by {changed_by.email}",
        details={"old_role": old_role, "new_role": new_role},
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_user_password_change(
    db: Session,
    user: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """사용자 비밀번호 변경 로그"""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_PASSWORD_CHANGE,
        user=user,
        resource_type="user",
        resource_id=str(user.id),
        description=f"User {user.email} changed password",
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_password_reset_request(
    db: Session,
    email: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """비밀번호 재설정 요청 로그"""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_PASSWORD_RESET_REQUEST,
        user_email=email,
        resource_type="user",
        description=f"Password reset requested for {email}",
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_password_reset(
    db: Session,
    user: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """비밀번호 재설정 완료 로그"""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_PASSWORD_RESET,
        user=user,
        resource_type="user",
        resource_id=str(user.id),
        description=f"User {user.email} reset password via email",
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_menu_action(
    db: Session,
    action: AuditAction,
    actor: User,
    menu_label: str,
    menu_id: Optional[int] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """메뉴 관련 액션 로그"""
    return create_audit_log(
        db=db,
        action=action,
        user=actor,
        resource_type="menu",
        resource_id=str(menu_id) if menu_id else None,
        description=f"Menu '{menu_label}' {action.value.split('.')[-1]} by {actor.email}",
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_permission_update(
    db: Session,
    actor: User,
    target_user_id: int,
    target_user_email: str,
    grants: list[dict],
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """권한 변경 로그"""
    return create_audit_log(
        db=db,
        action=AuditAction.PERMISSION_UPDATE,
        user=actor,
        resource_type="permission",
        resource_id=str(target_user_id),
        description=f"Permissions for user {target_user_email} updated by {actor.email}",
        details={"target_user_id": target_user_id, "grants": grants},
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_bridge_action(
    db: Session,
    action: AuditAction,
    user: User,
    description: str,
    details: Optional[dict] = None,
    status: str = "success",
    error_message: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """메시지 브리지 액션 로그"""
    return create_audit_log(
        db=db,
        action=action,
        user=user,
        resource_type="bridge",
        description=description,
        details=details,
        status=status,
        error_message=error_message,
        ip_address=ip_address,
        user_agent=user_agent,
    )


def log_config_action(
    db: Session,
    action: AuditAction,
    user: User,
    description: str,
    details: Optional[dict] = None,
    status: str = "success",
    error_message: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """Config 액션 로그"""
    return create_audit_log(
        db=db,
        action=action,
        user=user,
        resource_type="config",
        description=description,
        details=details,
        status=status,
        error_message=error_message,
        ip_address=ip_address,
        user_agent=user_agent,
    )
