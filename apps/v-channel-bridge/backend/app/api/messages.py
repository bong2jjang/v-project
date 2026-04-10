"""
Messages API

메시지 히스토리 조회 및 검색 API
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List
import csv
import json
import io
import logging

from app.db import get_db_session
from app.models.user import User
from app.services.message_service import message_service
from app.utils.auth import get_current_user, require_permission

router = APIRouter(prefix="/api/messages")
logger = logging.getLogger(__name__)


@router.get("/filters/options")
async def get_filter_options(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    필터 옵션 조회 (인증 필요)

    사용 가능한 gateway, channel, user 목록 반환
    """
    try:
        options = message_service.get_filter_options(db)
        return options
    except Exception as e:
        logger.error(f"Error getting filter options: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/summary")
async def get_stats(
    from_date: Optional[datetime] = Query(None, description="Start date"),
    to_date: Optional[datetime] = Query(None, description="End date"),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    메시지 통계 (인증 필요)

    기간별 메시지 통계 조회

    - **from_date**: 시작 날짜
    - **to_date**: 종료 날짜
    """
    try:
        stats = message_service.get_stats(
            db=db,
            from_date=from_date,
            to_date=to_date,
        )
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-data")
async def generate_test_data(
    count: int = Query(
        100, ge=1, le=1000, description="Number of messages to generate"
    ),
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("messages", "write")),
):
    """
    테스트 데이터 생성 (관리자 전용)

    랜덤한 테스트 메시지 생성
    """
    try:
        message_service.generate_test_data(db, count)
        return {"message": f"Generated {count} test messages"}
    except Exception as e:
        logger.error(f"Error generating test data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def search_messages(
    q: Optional[str] = Query(None, description="Search query"),
    gateway: Optional[List[str]] = Query(
        None, description="Filter by gateway (can be multiple)"
    ),
    route: Optional[str] = Query(
        None,
        description="Filter by route pair 'src→dst' (source_account→destination_account)",
    ),
    channel: Optional[List[str]] = Query(
        None, description="Filter by channel (can be multiple)"
    ),
    src_channel: Optional[List[str]] = Query(
        None, description="Filter by source channel"
    ),
    dst_channel: Optional[List[str]] = Query(
        None, description="Filter by destination channel"
    ),
    user: Optional[str] = Query(None, description="Filter by user"),
    status: Optional[str] = Query(
        None, description="Filter by status (sent, failed, retrying, pending)"
    ),
    from_date: Optional[datetime] = Query(None, description="Start date (ISO format)"),
    to_date: Optional[datetime] = Query(None, description="End date (ISO format)"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=100, description="Items per page"),
    sort: str = Query(
        "timestamp_desc", description="Sort order (timestamp_asc, timestamp_desc)"
    ),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    메시지 검색 (인증 필요)

    여러 필터를 조합하여 메시지 검색

    - **q**: 텍스트 검색
    - **gateway**: Gateway 필터 (여러 개 가능)
    - **channel**: 채널 필터 (여러 개 가능, source 또는 destination)
    - **user**: 사용자 필터
    - **from_date**: 시작 날짜 (ISO 8601 format)
    - **to_date**: 종료 날짜 (ISO 8601 format)
    - **page**: 페이지 번호 (1부터 시작)
    - **per_page**: 페이지당 항목 수 (최대 100)
    - **sort**: 정렬 방식 (timestamp_asc, timestamp_desc)
    """
    try:
        result = message_service.search_messages(
            db=db,
            q=q,
            gateway=gateway,
            route=route,
            channel=channel,
            src_channel=src_channel,
            dst_channel=dst_channel,
            user=user,
            status=status,
            from_date=from_date,
            to_date=to_date,
            page=page,
            per_page=per_page,
            sort=sort,
        )
        return result
    except Exception as e:
        logger.error(f"Error searching messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{message_id}")
async def get_message(
    message_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    메시지 상세 조회 (인증 필요)

    ID로 특정 메시지 조회
    """
    message = message_service.get_message(db, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    return message.to_dict()


@router.post("/export/csv")
async def export_csv(
    q: Optional[str] = None,
    gateway: Optional[str] = None,
    channel: Optional[str] = None,
    user: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    CSV Export (인증 필요)

    필터링된 메시지를 CSV 형식으로 내보내기
    """
    try:
        # Get all messages (no pagination)
        result = message_service.search_messages(
            db=db,
            q=q,
            gateway=gateway,
            channel=channel,
            user=user,
            from_date=from_date,
            to_date=to_date,
            page=1,
            per_page=10000,  # Max export limit
        )

        messages = result["messages"]

        # Create CSV
        output = io.StringIO()
        fieldnames = [
            "id",
            "timestamp",
            "gateway",
            "source_channel",
            "source_user",
            "destination_channel",
            "text",
            "status",
            "has_attachment",
            "attachment_count",
            "attachment_files",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for msg in messages:
            # 첨부파일명 목록
            att_files = ""
            if msg.get("attachment_details"):
                att_files = ", ".join(
                    a.get("name", "")
                    for a in msg["attachment_details"]
                    if a.get("name")
                )
            writer.writerow(
                {
                    "id": msg["id"],
                    "timestamp": msg["timestamp"],
                    "gateway": msg["gateway"],
                    "source_channel": msg["source"]["channel"],
                    "source_user": msg["source"].get("user", ""),
                    "destination_channel": msg["destination"]["channel"],
                    "text": msg["text"],
                    "status": msg.get("status", ""),
                    "has_attachment": msg.get("has_attachment", False),
                    "attachment_count": msg.get("attachment_count", 0),
                    "attachment_files": att_files,
                }
            )

        csv_content = output.getvalue()

        # UTF-8 BOM 추가 (Excel 한글 깨짐 방지)
        from fastapi.responses import Response

        csv_bytes = b"\xef\xbb\xbf" + csv_content.encode("utf-8")

        return Response(
            content=csv_bytes,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename=messages_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
            },
        )

    except Exception as e:
        logger.error(f"Error exporting CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/json")
async def export_json(
    q: Optional[str] = None,
    gateway: Optional[str] = None,
    channel: Optional[str] = None,
    user: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    JSON Export (인증 필요)

    필터링된 메시지를 JSON 형식으로 내보내기
    """
    try:
        # Get all messages (no pagination)
        result = message_service.search_messages(
            db=db,
            q=q,
            gateway=gateway,
            channel=channel,
            user=user,
            from_date=from_date,
            to_date=to_date,
            page=1,
            per_page=10000,  # Max export limit
        )

        messages = result["messages"]

        # 전체 컨텍스트 포함 JSON
        from fastapi.responses import Response

        export_data = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "total": len(messages),
            "messages": messages,
        }

        return Response(
            content=json.dumps(export_data, indent=2, ensure_ascii=False),
            media_type="application/json; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename=messages_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
            },
        )

    except Exception as e:
        logger.error(f"Error exporting JSON: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("messages", "write")),
):
    """
    메시지 삭제 (관리자 전용)

    특정 메시지를 ID로 삭제
    """
    try:
        success = message_service.delete_message(db, message_id)
        if not success:
            raise HTTPException(status_code=404, detail="Message not found")

        return {"message": f"Message {message_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("")
async def delete_all_messages(
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("messages", "write")),
):
    """
    모든 메시지 삭제 (관리자 전용)

    데이터베이스의 모든 메시지를 삭제합니다.
    주의: 이 작업은 되돌릴 수 없습니다!
    """
    try:
        count = message_service.delete_all_messages(db)
        return {"message": "All messages deleted successfully", "deleted_count": count}
    except Exception as e:
        logger.error(f"Error deleting all messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete-by-filters")
async def delete_messages_by_filters(
    gateway: Optional[List[str]] = Query(None, description="Filter by gateway"),
    channel: Optional[List[str]] = Query(None, description="Filter by channel"),
    user: Optional[str] = Query(None, description="Filter by user"),
    from_date: Optional[datetime] = Query(None, description="Start date"),
    to_date: Optional[datetime] = Query(None, description="End date"),
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("messages", "write")),
):
    """
    조건에 맞는 메시지 삭제 (관리자 전용)

    필터 조건에 맞는 메시지만 삭제합니다.

    - **gateway**: Gateway 필터 (여러 개 가능)
    - **channel**: 채널 필터 (여러 개 가능)
    - **user**: 사용자 필터
    - **from_date**: 시작 날짜
    - **to_date**: 종료 날짜
    """
    try:
        count = message_service.delete_messages_by_filters(
            db=db,
            gateway=gateway,
            channel=channel,
            user=user,
            from_date=from_date,
            to_date=to_date,
        )
        return {
            "message": f"Deleted {count} messages matching the filters",
            "deleted_count": count,
        }
    except Exception as e:
        logger.error(f"Error deleting messages by filters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/count-by-filters")
async def count_messages_by_filters(
    gateway: Optional[List[str]] = Query(None, description="Filter by gateway"),
    channel: Optional[List[str]] = Query(None, description="Filter by channel"),
    user: Optional[str] = Query(None, description="Filter by user"),
    from_date: Optional[datetime] = Query(None, description="Start date"),
    to_date: Optional[datetime] = Query(None, description="End date"),
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("messages", "write")),
):
    """
    조건에 맞는 메시지 수 조회 (관리자 전용)

    삭제 전 미리보기용: 필터 조건에 맞는 메시지 개수를 반환합니다.

    - **gateway**: Gateway 필터 (여러 개 가능)
    - **channel**: 채널 필터 (여러 개 가능)
    - **user**: 사용자 필터
    - **from_date**: 시작 날짜
    - **to_date**: 종료 날짜
    """
    try:
        count = message_service.count_messages_by_filters(
            db=db,
            gateway=gateway,
            channel=channel,
            user=user,
            from_date=from_date,
            to_date=to_date,
        )
        return {"count": count}
    except Exception as e:
        logger.error(f"Error counting messages by filters: {e}")
        raise HTTPException(status_code=500, detail=str(e))
