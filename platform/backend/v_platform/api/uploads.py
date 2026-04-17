"""Image upload endpoint — DB BLOB 기반 저장.

멀티앱 아키텍처에서 앱별 Docker 볼륨 격리로 인해 파일시스템 공유가
불가능하므로, 업로드 파일은 PostgreSQL BYTEA로 저장합니다.

URL 형식은 기존과 동일하게 `/api/uploads/{purpose}/{id}` 유지하여
프론트엔드/기존 avatar_url 레코드 호환성을 보장합니다.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.uploaded_file import UploadedFile
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}


def _validate_image(file: UploadFile, data: bytes, max_size: int) -> None:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"허용되지 않는 파일 형식입니다: {file.content_type}",
        )
    if len(data) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기가 {max_size // (1024 * 1024)}MB를 초과합니다.",
        )


def save_uploaded_file(
    db: Session,
    data: bytes,
    mime_type: str,
    purpose: str,
    uploaded_by: int | None,
) -> str:
    """파일을 DB에 저장하고 UUID를 반환."""
    file_id = uuid.uuid4().hex
    record = UploadedFile(
        id=file_id,
        content=data,
        mime_type=mime_type,
        size=len(data),
        purpose=purpose,
        uploaded_by=uploaded_by,
    )
    db.add(record)
    db.commit()
    return file_id


def _serve_file(db: Session, file_id: str, purpose: str) -> Response:
    # 레거시 URL (/api/uploads/avatars/abc123.png) 호환: 확장자 제거
    if "." in file_id:
        file_id = file_id.rsplit(".", 1)[0]

    record = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == file_id, UploadedFile.purpose == purpose)
        .first()
    )
    if record is None:
        # 아바타는 204(이니셜 fallback), 일반 이미지는 404
        if purpose == "avatar":
            return Response(status_code=204)
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    return Response(
        content=record.content,
        media_type=record.mime_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.post("/image")
async def upload_image(
    file: UploadFile,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    data = await file.read()
    _validate_image(file, data, MAX_IMAGE_SIZE)

    file_id = save_uploaded_file(
        db=db,
        data=data,
        mime_type=file.content_type,
        purpose="image",
        uploaded_by=current_user.id,
    )
    return {"url": f"/api/uploads/images/{file_id}"}


@router.get("/images/{file_id}")
async def get_uploaded_image(
    file_id: str,
    db: Session = Depends(get_db_session),
):
    return _serve_file(db, file_id, purpose="image")


@router.get("/avatars/{file_id}")
async def get_avatar_image(
    file_id: str,
    db: Session = Depends(get_db_session),
):
    """아바타 이미지 서빙 (인증 불필요).

    파일이 없으면 204를 반환해 프론트엔드 콘솔 404 노이즈를 줄입니다.
    클라이언트는 `<img onError>`로 이니셜 fallback을 렌더해야 합니다.
    """
    return _serve_file(db, file_id, purpose="avatar")
