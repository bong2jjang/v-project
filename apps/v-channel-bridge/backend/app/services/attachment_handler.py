"""
Attachment Handler: 첨부 파일 다운로드/업로드 처리

Slack ↔ Teams 간 이미지 및 파일 첨부를 처리합니다.

작성일: 2026-04-03
"""

import os
import asyncio
import structlog
import aiohttp
import tempfile
from typing import Optional, Dict, Any, List
from pathlib import Path

from app.schemas.common_message import Attachment

logger = structlog.get_logger()

# 설정
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
TEMP_DIR = Path(tempfile.gettempdir()) / "vms_channel_bridge_attachments"
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
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
]


class AttachmentHandler:
    """첨부 파일 처리 핸들러"""

    def __init__(self):
        """AttachmentHandler 초기화"""
        # 임시 디렉토리 생성
        TEMP_DIR.mkdir(parents=True, exist_ok=True)
        logger.info("AttachmentHandler initialized", temp_dir=str(TEMP_DIR))

    async def download_file(
        self,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        timeout: int = 30,
    ) -> Optional[Path]:
        """
        파일 다운로드

        Args:
            url: 다운로드할 파일 URL
            headers: HTTP 헤더 (인증 토큰 등)
            timeout: 타임아웃 (초)

        Returns:
            다운로드된 파일 경로 또는 None (실패 시)
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, headers=headers, timeout=aiohttp.ClientTimeout(total=timeout)
                ) as resp:
                    if resp.status != 200:
                        logger.error(
                            "File download failed", url=url, status=resp.status
                        )
                        return None

                    # 파일 크기 확인
                    content_length = resp.headers.get("Content-Length")
                    if content_length and int(content_length) > MAX_FILE_SIZE:
                        logger.warning(
                            "File too large",
                            url=url,
                            size=content_length,
                            max_size=MAX_FILE_SIZE,
                        )
                        return None

                    # 임시 파일 생성
                    temp_file = TEMP_DIR / f"download_{os.urandom(8).hex()}"
                    content = await resp.read()

                    # 파일 저장
                    temp_file.write_bytes(content)

                    logger.info(
                        "File downloaded successfully",
                        url=url,
                        file_path=str(temp_file),
                        size=len(content),
                    )

                    return temp_file

        except asyncio.TimeoutError:
            logger.error("File download timeout", url=url)
            return None
        except Exception as e:
            logger.error("Error downloading file", url=url, error=str(e))
            return None

    async def upload_file_to_slack(
        self, file_path: Path, filename: str, channel: str, slack_client: Any
    ) -> Optional[str]:
        """
        Slack에 파일 업로드

        Args:
            file_path: 업로드할 파일 경로
            filename: 파일명
            channel: Slack 채널 ID
            slack_client: Slack 클라이언트

        Returns:
            업로드된 파일 URL 또는 None (실패 시)
        """
        try:
            # Slack files.upload API 호출
            response = await slack_client.files_upload_v2(
                channels=channel,
                file=str(file_path),
                filename=filename,
            )

            if response.get("ok"):
                file_info = response.get("file", {})
                file_url = file_info.get("url_private", file_info.get("permalink"))

                logger.info(
                    "File uploaded to Slack",
                    filename=filename,
                    channel=channel,
                    url=file_url,
                )

                return file_url
            else:
                logger.error(
                    "Slack file upload failed",
                    error=response.get("error"),
                    filename=filename,
                )
                return None

        except Exception as e:
            logger.error(
                "Error uploading file to Slack", filename=filename, error=str(e)
            )
            return None

    async def upload_file_to_teams(
        self,
        file_path: Path,
        filename: str,
        team_id: str,
        channel_id: str,
        access_token: str,
    ) -> Optional[str]:
        """
        Teams에 파일 업로드

        Args:
            file_path: 업로드할 파일 경로
            filename: 파일명
            team_id: Teams Team ID
            channel_id: Teams Channel ID
            access_token: MS Graph API Access Token

        Returns:
            업로드된 파일 URL 또는 None (실패 시)
        """
        try:
            # MS Graph API를 사용한 파일 업로드
            url = f"https://graph.microsoft.com/v1.0/teams/{team_id}/channels/{channel_id}/filesFolder/children"

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/octet-stream",
            }

            async with aiohttp.ClientSession() as session:
                with open(file_path, "rb") as f:
                    file_content = f.read()

                async with session.put(
                    f"{url}/{filename}/content",
                    headers=headers,
                    data=file_content,
                ) as resp:
                    if resp.status in [200, 201]:
                        result = await resp.json()
                        file_url = result.get("webUrl")

                        logger.info(
                            "File uploaded to Teams",
                            filename=filename,
                            channel=channel_id,
                            url=file_url,
                        )

                        return file_url
                    else:
                        error_text = await resp.text()
                        logger.error(
                            "Teams file upload failed",
                            status=resp.status,
                            error=error_text,
                            filename=filename,
                        )
                        return None

        except Exception as e:
            logger.error(
                "Error uploading file to Teams", filename=filename, error=str(e)
            )
            return None

    def cleanup_file(self, file_path: Path):
        """
        임시 파일 삭제

        Args:
            file_path: 삭제할 파일 경로
        """
        try:
            if file_path.exists():
                file_path.unlink()
                logger.debug("Temporary file deleted", file_path=str(file_path))
        except Exception as e:
            logger.warning(
                "Failed to delete temporary file",
                file_path=str(file_path),
                error=str(e),
            )

    async def process_attachments(
        self,
        attachments: List[Attachment],
        source_platform: str,
        target_platform: str,
        **kwargs,
    ) -> List[Attachment]:
        """
        첨부 파일 처리 (다운로드 → 업로드)

        Args:
            attachments: 첨부 파일 리스트
            source_platform: 소스 플랫폼
            target_platform: 타겟 플랫폼
            **kwargs: 플랫폼별 추가 파라미터

        Returns:
            업로드된 첨부 파일 리스트
        """
        processed_attachments = []

        for attachment in attachments:
            try:
                # 1. 파일 다운로드
                logger.info(
                    "Processing attachment",
                    name=attachment.name,
                    mime_type=attachment.mime_type,
                )

                # 헤더 설정 (인증 토큰 등)
                headers = kwargs.get("download_headers")
                file_path = await self.download_file(attachment.url, headers=headers)

                if not file_path:
                    logger.warning("Attachment download failed", name=attachment.name)
                    continue

                # 2. 파일 업로드
                uploaded_url = None

                if target_platform == "slack":
                    slack_client = kwargs.get("slack_client")
                    channel = kwargs.get("channel")
                    uploaded_url = await self.upload_file_to_slack(
                        file_path, attachment.name, channel, slack_client
                    )

                elif target_platform == "teams":
                    team_id = kwargs.get("team_id")
                    channel_id = kwargs.get("channel_id")
                    access_token = kwargs.get("access_token")
                    uploaded_url = await self.upload_file_to_teams(
                        file_path, attachment.name, team_id, channel_id, access_token
                    )

                # 3. 임시 파일 삭제
                self.cleanup_file(file_path)

                # 4. 업로드된 첨부 파일 정보 추가
                if uploaded_url:
                    processed_attachment = Attachment(
                        id=attachment.id,
                        name=attachment.name,
                        mime_type=attachment.mime_type,
                        size=attachment.size,
                        url=uploaded_url,
                    )
                    processed_attachments.append(processed_attachment)
                else:
                    logger.warning("Attachment upload failed", name=attachment.name)

            except Exception as e:
                logger.error(
                    "Error processing attachment", name=attachment.name, error=str(e)
                )

        return processed_attachments


# 싱글톤 인스턴스
_attachment_handler: Optional[AttachmentHandler] = None


def get_attachment_handler() -> AttachmentHandler:
    """AttachmentHandler 싱글톤 인스턴스 반환"""
    global _attachment_handler
    if _attachment_handler is None:
        _attachment_handler = AttachmentHandler()
    return _attachment_handler
