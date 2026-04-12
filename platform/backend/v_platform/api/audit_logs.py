"""
Audit Log API Endpoints

감사 로그 조회 및 관리를 위한 API 엔드포인트 (관리자 전용)
"""

import csv
import io
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func, or_

from v_platform.core.database import get_db_session
from v_platform.models.audit_log import AuditLog
from v_platform.models.user import User
from v_platform.schemas.audit_log import AuditLogResponse, AuditLogListResponse
from v_platform.utils.auth import require_permission

router = APIRouter(
    prefix="/api/audit-logs",
    tags=["Audit Logs"],
)

MAX_CSV_EXPORT_ROWS = 10000


def _build_audit_filters(
    action: Optional[str],
    user_id: Optional[int],
    user_email: Optional[str],
    resource_type: Optional[str],
    resource_id: Optional[str],
    status: Optional[str],
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    ip_address: Optional[str],
) -> list:
    """공통 필터 조건 빌드"""
    filters = []
    if action:
        filters.append(AuditLog.action == action)
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if user_email:
        filters.append(AuditLog.user_email.ilike(f"%{user_email}%"))
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)
    if resource_id:
        filters.append(AuditLog.resource_id == resource_id)
    if status:
        filters.append(AuditLog.status == status)
    if start_date:
        filters.append(AuditLog.timestamp >= start_date)
    if end_date:
        filters.append(AuditLog.timestamp <= end_date)
    if ip_address:
        filters.append(AuditLog.ip_address == ip_address)
    return filters


@router.get("/export/csv")
async def export_audit_logs_csv(
    request: Request,
    action: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    user_email: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    ip_address: Optional[str] = Query(None),
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("audit_logs", "read")),
):
    """
    감사 로그 CSV 내보내기 (관리자 전용)

    현재 필터 조건에 맞는 로그를 CSV로 내보냅니다. 최대 10,000건.
    """
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    query = db.query(AuditLog)
    query = query.filter(or_(AuditLog.app_id == app_id, AuditLog.app_id.is_(None)))
    filters = _build_audit_filters(
        action,
        user_id,
        user_email,
        resource_type,
        resource_id,
        status,
        start_date,
        end_date,
        ip_address,
    )
    if filters:
        query = query.filter(and_(*filters))

    logs = query.order_by(desc(AuditLog.timestamp)).limit(MAX_CSV_EXPORT_ROWS).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "Timestamp",
            "User Email",
            "Action",
            "Resource Type",
            "Resource ID",
            "Description",
            "Status",
            "Error Message",
            "IP Address",
            "User Agent",
        ]
    )
    for log in logs:
        writer.writerow(
            [
                log.id,
                log.timestamp.isoformat() if log.timestamp else "",
                log.user_email or "",
                log.action,
                log.resource_type or "",
                log.resource_id or "",
                log.description or "",
                log.status,
                log.error_message or "",
                log.ip_address or "",
                log.user_agent or "",
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=audit_logs_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        },
    )


@router.get("", response_model=AuditLogListResponse)
async def get_audit_logs(
    request: Request,
    page: int = Query(1, ge=1, description="페이지 번호"),
    per_page: int = Query(50, ge=1, le=500, description="페이지당 항목 수"),
    action: Optional[str] = Query(None, description="액션 필터 (예: user.login)"),
    user_id: Optional[int] = Query(None, description="사용자 ID 필터"),
    user_email: Optional[str] = Query(
        None, description="사용자 이메일 필터 (부분 일치)"
    ),
    resource_type: Optional[str] = Query(
        None, description="리소스 타입 필터 (예: user, config)"
    ),
    resource_id: Optional[str] = Query(None, description="리소스 ID 필터"),
    status: Optional[str] = Query(
        None, description="상태 필터 (success, failure, error)"
    ),
    start_date: Optional[datetime] = Query(None, description="시작 일시 (ISO 8601)"),
    end_date: Optional[datetime] = Query(None, description="종료 일시 (ISO 8601)"),
    ip_address: Optional[str] = Query(None, description="IP 주소 필터"),
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("audit_logs", "read")),
):
    """
    감사 로그 목록 조회 (관리자 전용)

    다양한 필터와 페이징을 지원하여 감사 로그를 조회합니다.
    """
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    query = db.query(AuditLog)
    query = query.filter(or_(AuditLog.app_id == app_id, AuditLog.app_id.is_(None)))
    filters = _build_audit_filters(
        action,
        user_id,
        user_email,
        resource_type,
        resource_id,
        status,
        start_date,
        end_date,
        ip_address,
    )
    if filters:
        query = query.filter(and_(*filters))

    total = query.with_entities(func.count(AuditLog.id)).scalar()

    offset = (page - 1) * per_page
    logs = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(per_page).all()

    total_pages = (total + per_page - 1) // per_page

    return AuditLogListResponse(
        logs=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: int,
    request: Request,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("audit_logs", "read")),
):
    """
    특정 감사 로그 조회 (관리자 전용)
    """
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    log = (
        db.query(AuditLog)
        .filter(
            AuditLog.id == log_id,
            or_(AuditLog.app_id == app_id, AuditLog.app_id.is_(None)),
        )
        .first()
    )

    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")

    return AuditLogResponse.model_validate(log)


@router.get("/stats/summary")
async def get_audit_stats(
    request: Request,
    days: int = Query(7, ge=1, le=365, description="통계 기간 (일)"),
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("audit_logs", "read")),
):
    """
    감사 로그 통계 조회 (관리자 전용)

    지정된 기간 동안의 액션별, 상태별 통계를 제공합니다.
    """
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    app_filter = or_(AuditLog.app_id == app_id, AuditLog.app_id.is_(None))

    # 기간 계산
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    # 전체 로그 수
    total_logs = (
        db.query(AuditLog).filter(AuditLog.timestamp >= start_date, app_filter).count()
    )

    # 상태별 통계
    status_stats = (
        db.query(AuditLog.status, func.count(AuditLog.id).label("count"))
        .filter(AuditLog.timestamp >= start_date, app_filter)
        .group_by(AuditLog.status)
        .all()
    )

    # 액션별 상위 10개
    action_stats = (
        db.query(AuditLog.action, func.count(AuditLog.id).label("count"))
        .filter(AuditLog.timestamp >= start_date, app_filter)
        .group_by(AuditLog.action)
        .order_by(desc("count"))
        .limit(10)
        .all()
    )

    # 사용자별 상위 10개
    user_stats = (
        db.query(AuditLog.user_email, func.count(AuditLog.id).label("count"))
        .filter(
            and_(AuditLog.timestamp >= start_date, AuditLog.user_email.isnot(None)),
            app_filter,
        )
        .group_by(AuditLog.user_email)
        .order_by(desc("count"))
        .limit(10)
        .all()
    )

    return {
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": datetime.now(timezone.utc).isoformat(),
        "total_logs": total_logs,
        "by_status": {status: count for status, count in status_stats},
        "top_actions": [
            {"action": action, "count": count} for action, count in action_stats
        ],
        "top_users": [
            {"user_email": email, "count": count} for email, count in user_stats
        ],
    }
