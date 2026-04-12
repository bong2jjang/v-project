"""Image upload endpoint for platform notifications / markdown content."""

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse

from v_platform.utils.auth import get_current_user
from v_platform.models.user import User

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = os.path.join(
    os.environ.get("DATABASE_DIR", "/app/data"), "uploads", "images"
)
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}

MIME_EXT: dict[str, str] = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
}


@router.post("/image")
async def upload_image(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"허용되지 않는 파일 형식입니다: {file.content_type}",
        )

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기가 5MB를 초과합니다.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = MIME_EXT.get(file.content_type, ".png")
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(data)

    return {"url": f"/api/uploads/images/{filename}"}


@router.get("/images/{filename}")
async def get_uploaded_image(filename: str):
    # directory traversal 방지
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="잘못된 파일명입니다.")

    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    return FileResponse(filepath)
