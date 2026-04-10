"""
Attachment Handler

첨부 파일 다운로드, 업로드, 임시 저장 및 정리를 처리하는 유틸리티
"""

import os
import aiofiles
import aiohttp
import structlog
from pathlib import Path
from typing import Optional
from datetime import datetime, timedelta, timezone

logger = structlog.get_logger(__name__)

# 임시 파일 저장 디렉토리
TEMP_DIR = Path("/tmp/vms-attachments")
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# 지원하는 MIME 타입
SUPPORTED_IMAGE_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
]

SUPPORTED_FILE_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "application/zip",
    "text/plain",
]

# 파일 크기 제한 (bytes)
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


class AttachmentHandler:
    """첨부 파일 처리 핸들러"""

    def __init__(self):
        self.temp_dir = TEMP_DIR

    async def download_file(
        self,
        url: str,
        headers: Optional[dict] = None,
        max_size: int = MAX_IMAGE_SIZE,
        fallback_filename: Optional[str] = None,
    ) -> Optional[str]:
        """
        URL에서 파일을 다운로드하여 임시 디렉토리에 저장

        Args:
            url: 파일 다운로드 URL
            headers: HTTP 헤더 (인증 토큰 등)
            max_size: 최대 파일 크기 (bytes)
            fallback_filename: URL에서 파일명 추출 실패 시 사용할 이름

        Returns:
            다운로드된 파일의 로컬 경로, 실패 시 None
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status != 200:
                        error_body = await response.text()
                        logger.error(
                            "Failed to download file",
                            url=url[:200],
                            status=response.status,
                            error_body=error_body[:500],
                        )
                        return None

                    # 파일 크기 확인
                    content_length = response.headers.get("Content-Length")
                    if content_length and int(content_length) > max_size:
                        logger.error(
                            "File size exceeds limit",
                            url=url[:200],
                            size=content_length,
                            max_size=max_size,
                        )
                        return None

                    # 파일명 결정 우선순위:
                    # 1. Content-Disposition 헤더
                    # 2. URL 경로에서 추출 (유효한 파일명인 경우)
                    # 3. fallback_filename 파라미터
                    # 4. Content-Type 기반 기본 이름
                    filename = self._extract_filename(response, url, fallback_filename)
                    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                    safe_filename = f"{timestamp}_{filename}"
                    local_path = self.temp_dir / safe_filename

                    # 파일 다운로드
                    async with aiofiles.open(local_path, "wb") as f:
                        async for chunk in response.content.iter_chunked(8192):
                            await f.write(chunk)

                    logger.info(
                        "File downloaded successfully",
                        url=url[:200],
                        local_path=str(local_path),
                        size=os.path.getsize(local_path),
                    )
                    return str(local_path)

        except Exception as e:
            logger.error("Error downloading file", url=url[:200], error=str(e))
            return None

    @staticmethod
    def _extract_filename(
        response: aiohttp.ClientResponse,
        url: str,
        fallback_filename: Optional[str] = None,
    ) -> str:
        """응답 헤더/URL/fallback에서 파일명 추출"""
        # 1. Content-Disposition 헤더
        cd = response.headers.get("Content-Disposition", "")
        if "filename=" in cd or "filename*=" in cd:
            # filename="name.ext" 또는 filename=name.ext
            import re as _re

            m = _re.search(r'filename\*?=["\']?(?:UTF-8\'\')?([^"\';\s]+)', cd)
            if m:
                name = m.group(1)
                if name and name != "$value":
                    return name

        # 2. URL 경로 마지막 세그먼트 (유효한 확장자가 있을 때만)
        url_name = url.split("?")[0].split("/")[-1]
        if url_name and url_name != "$value" and "." in url_name:
            return url_name

        # 3. fallback_filename
        if fallback_filename:
            return fallback_filename

        # 4. Content-Type 기반 기본 이름
        ct = response.headers.get("Content-Type", "application/octet-stream")
        ext_map = {
            "image/png": "image.png",
            "image/jpeg": "image.jpg",
            "image/gif": "image.gif",
            "image/webp": "image.webp",
            "application/pdf": "file.pdf",
            "text/plain": "file.txt",
        }
        base_ct = ct.split(";")[0].strip().lower()
        return ext_map.get(base_ct, "attachment.bin")

    async def cleanup_file(self, local_path: str) -> bool:
        """
        임시 파일 삭제

        Args:
            local_path: 삭제할 파일 경로

        Returns:
            삭제 성공 여부
        """
        try:
            if os.path.exists(local_path):
                os.remove(local_path)
                logger.info("File cleaned up", local_path=local_path)
                return True
            return False
        except Exception as e:
            logger.error("Error cleaning up file", local_path=local_path, error=str(e))
            return False

    async def cleanup_old_files(self, max_age_hours: int = 24) -> int:
        """
        오래된 임시 파일 정리

        Args:
            max_age_hours: 최대 파일 보관 시간 (시간)

        Returns:
            삭제된 파일 수
        """
        try:
            count = 0
            now = datetime.now(timezone.utc)
            cutoff_time = now - timedelta(hours=max_age_hours)

            for file_path in self.temp_dir.iterdir():
                if file_path.is_file():
                    file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if file_mtime < cutoff_time:
                        file_path.unlink()
                        count += 1
                        logger.debug("Old file deleted", file_path=str(file_path))

            if count > 0:
                logger.info(
                    "Old files cleaned up",
                    count=count,
                    max_age_hours=max_age_hours,
                )
            return count
        except Exception as e:
            logger.error("Error cleaning up old files", error=str(e))
            return 0

    def is_supported_image(self, mime_type: str) -> bool:
        """지원하는 이미지 타입인지 확인"""
        return mime_type.lower() in SUPPORTED_IMAGE_TYPES

    def is_supported_file(self, mime_type: str) -> bool:
        """지원하는 파일 타입인지 확인"""
        return mime_type.lower() in SUPPORTED_FILE_TYPES

    def get_max_size(self, mime_type: str) -> int:
        """MIME 타입에 따른 최대 파일 크기 반환"""
        if self.is_supported_image(mime_type):
            return MAX_IMAGE_SIZE
        return MAX_FILE_SIZE


# 싱글톤 인스턴스
attachment_handler = AttachmentHandler()
