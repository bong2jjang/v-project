"""
Audit Log Schemas

감사 로그 관련 Pydantic 스키마
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AuditLogResponse(BaseModel):
    """감사 로그 응답 스키마"""

    id: int
    timestamp: datetime
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    details: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """감사 로그 목록 응답 스키마 (페이징)"""

    logs: list[AuditLogResponse] = Field(..., description="감사 로그 목록")
    total: int = Field(..., description="전체 로그 수")
    page: int = Field(..., description="현재 페이지")
    per_page: int = Field(..., description="페이지당 항목 수")
    total_pages: int = Field(..., description="전체 페이지 수")
