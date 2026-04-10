"""
Teams Provider: Microsoft Teams Graph API 기반 어댑터

Zowe Chat의 Provider Pattern을 Microsoft Teams에 적용.
Graph API를 사용하여 메시지 송수신을 처리합니다.

작성일: 2026-03-31
"""

import asyncio
import structlog
from typing import AsyncIterator, List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone

import aiohttp
from botbuilder.core import (
    BotFrameworkAdapter,
    BotFrameworkAdapterSettings,
    TurnContext,
)
from botbuilder.schema import (
    Activity,
    ActivityTypes,
    ChannelAccount,
    ConversationAccount,
    ConversationReference,
)

from app.adapters.base import BasePlatformProvider
from app.schemas.common_message import (
    CommonMessage,
    User,
    Channel,
    ChannelType,
    Attachment,
    MessageType,
    Platform,
)
from app.utils.message_formatter import convert_slack_to_teams_markdown
from app.utils.attachment_handler import attachment_handler

logger = structlog.get_logger()

# 토큰 만료 여유 시간 (초) — 만료 60초 전에 갱신
_TOKEN_REFRESH_MARGIN = 60


def _markdown_to_teams_html(text: str) -> str:
    """
    Markdown → Teams HTML 변환

    Teams Graph API는 contentType="html"일 때 기본 HTML 태그를 지원합니다.
    """
    import re

    result = text.replace("\r\n", "\n")

    # 코드 블록 임시 보호 (```) — \x00 구분자로 italic 패턴 간섭 방지
    code_blocks: list[str] = []

    def save_code_block(match: re.Match) -> str:
        code_blocks.append(match.group(1))
        return f"\x00CODEBLOCK{len(code_blocks) - 1}\x00"

    result = re.sub(r"```([\s\S]*?)```", save_code_block, result)

    # 인라인 코드 임시 보호 (`)
    inline_codes: list[str] = []

    def save_inline_code(match: re.Match) -> str:
        inline_codes.append(match.group(1))
        return f"\x00INLINECODE{len(inline_codes) - 1}\x00"

    result = re.sub(r"`([^`]+)`", save_inline_code, result)

    # **bold** → <b>bold</b>
    result = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", result)

    # *italic* / _italic_ → <i>...</i>
    result = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", result)
    result = re.sub(r"(?<!_)_([^_]+)_(?!_)", r"<i>\1</i>", result)

    # ~~strikethrough~~ / ~strikethrough~ → <strike>...</strike>
    result = re.sub(r"~~(.+?)~~", r"<strike>\1</strike>", result)
    result = re.sub(r"(?<!~)~(?!~)([^~]+)~(?!~)", r"<strike>\1</strike>", result)

    # 코드 블록 복원
    for i, code in enumerate(code_blocks):
        result = result.replace(f"\x00CODEBLOCK{i}\x00", f"<pre>{code}</pre>")

    # 인라인 코드 복원
    for i, code in enumerate(inline_codes):
        result = result.replace(f"\x00INLINECODE{i}\x00", f"<code>{code}</code>")

    # 줄바꿈 → <br>
    result = result.replace("\n", "<br>")

    return result


class TeamsProvider(BasePlatformProvider):
    """
    Microsoft Teams 제공자

    Microsoft Graph API와 Bot Framework를 사용하여
    Teams 메시지 수신 및 전송을 처리합니다.
    BasePlatformProvider 인터페이스를 구현합니다.
    """

    def __init__(
        self,
        app_id: str,
        app_password: str,
        tenant_id: str,
        team_id: Optional[str] = None,
        account_id: Optional[int] = None,
        webhook_url: Optional[str] = None,
    ):
        """
        TeamsProvider 초기화

        Args:
            app_id: Azure AD Application (Client) ID
            app_password: Azure AD Client Secret
            tenant_id: Azure AD Tenant ID
            team_id: Teams Team ID (선택적 — 단일 팀만 사용할 때 지정)
            account_id: DB Account ID (delegated auth 토큰 조회용)
            webhook_url: Power Automate Incoming Webhook URL (선택적)
        """
        config = {
            "app_id": app_id,
            "app_password": app_password,
            "tenant_id": tenant_id,
            "team_id": team_id,
        }
        super().__init__("teams", config)
        self.account_id: Optional[int] = account_id
        self.webhook_url: Optional[str] = webhook_url

        # Bot Framework Adapter 설정
        settings = BotFrameworkAdapterSettings(app_id, app_password)
        self.adapter = BotFrameworkAdapter(settings)

        # Graph API 설정
        self.graph_base_url = "https://graph.microsoft.com/v1.0"
        self.access_token: Optional[str] = None
        self._token_expires_at: Optional[float] = None  # Unix timestamp
        self.session: Optional[aiohttp.ClientSession] = None

        # 봇 자신의 app_id (메시지 루프 방지)
        self.bot_app_id: str = app_id

        # 전송된 마지막 메시지 ID (스레드 매핑용)
        self.last_sent_ts: Optional[str] = None

        # 봇이 보낸 메시지 ID 추적 (에코 루프 방지)
        self._sent_message_ids: set[str] = set()

        # 채널 이름 캐시 (channel_id → displayName)
        self._channel_name_cache: Dict[str, str] = {}

        # 메시지 큐
        self._message_queue: asyncio.Queue = asyncio.Queue()

        logger.info("TeamsProvider initialized")

    async def _resolve_channel_name(self, conv_id: str) -> Optional[str]:
        """Graph API로 채널 이름 조회 후 캐시에 저장"""
        team_id = self.config.get("team_id")
        if not team_id:
            return None

        try:
            token = await self._get_access_token()
            headers = {"Authorization": f"Bearer {token}"}

            if not self.session:
                self.session = aiohttp.ClientSession()

            url = f"{self.graph_base_url}/teams/{team_id}/channels"
            async with self.session.get(
                url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
                for ch in data.get("value", []):
                    ch_id = ch.get("id", "")
                    ch_name = ch.get("displayName", "")
                    if ch_id and ch_name:
                        self._channel_name_cache[ch_id] = ch_name
                        self._channel_name_cache[f"{team_id}:{ch_id}"] = ch_name

                return self._channel_name_cache.get(conv_id)
        except Exception as e:
            logger.warning(
                "Failed to resolve channel name", conv_id=conv_id, error=str(e)
            )
            return None

    async def _get_access_token(self) -> str:
        """
        OAuth 2.0 Client Credentials Flow로 액세스 토큰 획득

        토큰이 만료 60초 이내라면 갱신합니다.

        Returns:
            액세스 토큰
        """
        import time

        # 유효한 토큰이 있으면 재사용
        if self.access_token and self._token_expires_at:
            if time.time() < self._token_expires_at - _TOKEN_REFRESH_MARGIN:
                return self.access_token

        # 토큰 갱신
        tenant_id = self.config.get("tenant_id")
        app_id = self.config.get("app_id")
        app_password = self.config.get("app_password")

        token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

        data = {
            "client_id": app_id,
            "client_secret": app_password,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }

        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(token_url, data=data) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    self.access_token = result.get("access_token")
                    expires_in = int(result.get("expires_in", 3599))
                    import time as _time

                    self._token_expires_at = _time.time() + expires_in
                    logger.info(
                        "Teams access token acquired",
                        expires_in_sec=expires_in,
                    )
                    return self.access_token
                else:
                    error_text = await resp.text()
                    logger.error(
                        "Failed to get Teams access token",
                        status=resp.status,
                        error=error_text,
                    )
                    raise Exception(f"Failed to get access token: {error_text}")

        except Exception as e:
            logger.error("Error getting Teams access token", error=str(e))
            raise

    def _parse_channel_ref(self, channel_id: str) -> tuple[str | None, str]:
        """
        채널 참조 파싱

        - "chat:{chatId}" → (None, chatId) — 1:1/그룹 채팅
        - "teamId:channelId" → (teamId, channelId) — 팀 채널
        - 단독 channelId → (Provider team_id, channelId)

        Args:
            channel_id: 채널 ID

        Returns:
            (team_id, channel_id) 튜플. 채팅인 경우 team_id=None
        """
        # 채팅 ID: "chat:" 접두사
        if channel_id.startswith("chat:"):
            return None, channel_id[5:]

        if ":" in channel_id and not channel_id.startswith("19:"):
            # "teamId:19:xxxx@thread.tacv2" 형식
            team_part, channel_part = channel_id.split(":", 1)
            return team_part, channel_part

        # 단독 channelId — Provider 설정에서 team_id 사용
        team_id = self.config.get("team_id")
        return team_id, channel_id

    async def connect(self) -> bool:
        """
        Teams 연결 (Graph API 인증)

        Returns:
            연결 성공 여부
        """
        try:
            await self._get_access_token()
            self.is_connected = True
            logger.info("Teams Provider connected")
            return True

        except Exception as e:
            logger.error("Failed to connect Teams Provider", error=str(e))
            self.is_connected = False
            return False

    async def disconnect(self) -> bool:
        """
        Teams 연결 해제

        Returns:
            연결 해제 성공 여부
        """
        try:
            if self.session:
                await self.session.close()
                self.session = None

            self.access_token = None
            self._token_expires_at = None
            self.is_connected = False

            logger.info("Teams Provider disconnected")
            return True

        except Exception as e:
            logger.error("Failed to disconnect Teams Provider", error=str(e))
            return False

    async def upload_file(
        self,
        file_path: str,
        team_id: str,
        channel_id: str,
        filename: Optional[str] = None,
        message_text: Optional[str] = None,
    ) -> Optional[str]:
        """
        Teams 채널에 파일 업로드 (SharePoint Drive 경유)

        Teams Graph API의 올바른 파일 업로드 절차:
        1. 팀의 DriveItem에 파일 업로드
        2. 업로드된 파일의 webUrl 반환

        Args:
            file_path: 업로드할 파일의 로컬 경로
            team_id: 팀 ID
            channel_id: 채널 ID
            filename: 파일명 (None이면 원본 파일명 사용)
            message_text: 파일과 함께 보낼 메시지 (현재 미사용)

        Returns:
            업로드된 파일의 webUrl, 실패 시 None
        """
        try:
            import os
            import aiofiles

            if not os.path.exists(file_path):
                logger.error("File not found for Teams upload", file_path=file_path)
                return None

            if not team_id:
                logger.error("team_id required for Teams file upload")
                return None

            if not filename:
                filename = os.path.basename(file_path)

            token = await self._get_access_token()
            headers = {"Authorization": f"Bearer {token}"}

            if not self.session:
                self.session = aiohttp.ClientSession()

            # Step 1: 팀의 기본 Drive 루트에 파일 업로드
            upload_url = (
                f"{self.graph_base_url}/groups/{team_id}"
                f"/drive/root:/{filename}:/content"
            )

            async with aiofiles.open(file_path, "rb") as f:
                file_content = await f.read()

            async with self.session.put(
                upload_url,
                data=file_content,
                headers={**headers, "Content-Type": "application/octet-stream"},
            ) as resp:
                if resp.status in [200, 201]:
                    result = await resp.json()
                    web_url = result.get("webUrl", "")
                    logger.info(
                        "File uploaded to Teams Drive",
                        filename=filename,
                        url=web_url,
                    )
                    return web_url
                else:
                    error_text = await resp.text()
                    logger.error(
                        "Teams file upload failed",
                        status=resp.status,
                        error=error_text,
                    )
                    return None

        except Exception as e:
            logger.error("Error uploading file to Teams", error=str(e))
            return None

    async def _upload_file_to_onedrive(
        self,
        file_path: str,
        filename: str,
    ) -> Optional[str]:
        """OneDrive에 파일 업로드 (Delegated Auth) — DM 파일 전송용

        채팅(DM)에서는 SharePoint Drive가 없으므로, 사용자의 OneDrive에
        VMS-ChatOps 폴더로 업로드한 뒤 공유 링크를 반환합니다.

        Args:
            file_path: 업로드할 파일의 로컬 경로
            filename: 파일명

        Returns:
            공유 다운로드 링크 URL, 실패 시 None
        """
        try:
            import os
            import aiofiles

            if not os.path.exists(file_path):
                logger.error("File not found for OneDrive upload", file_path=file_path)
                return None

            delegated_token = await self._get_delegated_token_if_available()
            if not delegated_token:
                logger.warning("No delegated token for OneDrive upload")
                return None

            headers = {
                "Authorization": f"Bearer {delegated_token}",
                "Content-Type": "application/octet-stream",
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            # OneDrive /me/drive에 업로드 (VMS-ChatOps 폴더)
            safe_filename = filename.replace("/", "_").replace("\\", "_")
            upload_url = (
                f"{self.graph_base_url}/me/drive"
                f"/root:/VMS-ChatOps/{safe_filename}:/content"
            )

            async with aiofiles.open(file_path, "rb") as f:
                file_content = await f.read()

            async with self.session.put(
                upload_url,
                data=file_content,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status in [200, 201]:
                    result = await resp.json()
                    item_id = result.get("id", "")
                    web_url = result.get("webUrl", "")
                    logger.info(
                        "File uploaded to OneDrive",
                        filename=safe_filename,
                        item_id=item_id,
                        web_url=web_url,
                    )
                else:
                    error_text = await resp.text()
                    logger.error(
                        "OneDrive file upload failed",
                        status=resp.status,
                        error=error_text[:500],
                    )
                    return None

            # 공유 링크 생성
            share_url = f"{self.graph_base_url}/me/drive/items/{item_id}" f"/createLink"
            share_payload = {
                "type": "view",
                "scope": "organization",
            }
            share_headers = {
                "Authorization": f"Bearer {delegated_token}",
                "Content-Type": "application/json",
            }

            async with self.session.post(
                share_url,
                json=share_payload,
                headers=share_headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status in [200, 201]:
                    share_result = await resp.json()
                    link = share_result.get("link", {}).get("webUrl", web_url)
                    logger.info(
                        "OneDrive sharing link created",
                        filename=safe_filename,
                        share_url=link,
                    )
                    return link
                else:
                    # 공유 링크 생성 실패 시 webUrl 반환 (직접 접근 URL)
                    logger.warning(
                        "Failed to create sharing link, using webUrl",
                        status=resp.status,
                    )
                    return web_url

        except Exception as e:
            logger.error("Error uploading file to OneDrive", error=str(e))
            return None

    async def download_file(
        self,
        file_url: str,
        file_id: str,
        filename: Optional[str] = None,
    ) -> Optional[str]:
        """
        Teams에서 파일 다운로드

        Args:
            file_url: Teams 파일 URL
            file_id: Teams 파일 ID
            filename: 원본 파일명 (URL에서 추출 불가 시 fallback)

        Returns:
            다운로드된 로컬 파일 경로, 실패 시 None
        """
        try:
            token = await self._get_access_token()
            headers = {"Authorization": f"Bearer {token}"}

            local_path = await attachment_handler.download_file(
                url=file_url,
                headers=headers,
                fallback_filename=filename,
            )

            if local_path:
                logger.info(
                    "File downloaded from Teams",
                    file_id=file_id,
                    local_path=local_path,
                )
                return local_path
            else:
                logger.error(
                    "Failed to download file from Teams",
                    file_id=file_id,
                    url=file_url[:200],
                )
                return None

        except Exception as e:
            logger.error("Error downloading file from Teams", error=str(e))
            return None

    async def send_message(self, message: CommonMessage) -> bool:
        """
        Common Schema 메시지를 Teams 메시지로 변환하여 전송

        Args:
            message: CommonMessage 스키마 메시지

        Returns:
            전송 성공 여부
        """
        self.last_sent_ts = None  # 전송 전 초기화
        self.last_error = None

        try:
            # REACTION 타입: Teams Graph API는 프로그래밍적 리액션 추가 미지원 → 텍스트로 전송
            if message.type == MessageType.REACTION:
                message.type = MessageType.TEXT
                # thread_id가 없으면 일반 메시지로 전송 (리액션 대상 메시지를 못 찾은 경우)

            channel_id = message.channel.id
            team_id, actual_channel_id = self._parse_channel_ref(channel_id)
            is_chat = team_id is None

            if not is_chat and not team_id:
                self.last_error = (
                    "team_id is required to send Teams channel message. "
                    "Set team_id in TeamsProvider config or encode as "
                    "'teamId:channelId' in the route."
                )
                logger.error(self.last_error, channel_id=channel_id)
                return False

            # 첨부 파일 처리: 이미지 → hostedContents 인라인, 비이미지 → SharePoint
            file_links: list[str] = []
            hosted_contents: list[dict] = []
            inline_img_html: list[str] = []

            if message.attachments:
                upload_targets = [
                    att
                    for att in message.attachments
                    if att.local_path and att.download_status == "downloaded"
                ]

                if upload_targets:
                    if is_chat:
                        # 채팅: 이미지 → hostedContents 인라인, 비이미지 → 텍스트 fallback
                        for idx, att in enumerate(upload_targets):
                            if att.mime_type and att.mime_type.startswith("image/"):
                                try:
                                    import base64

                                    with open(att.local_path, "rb") as f:
                                        content_bytes = base64.b64encode(
                                            f.read()
                                        ).decode("ascii")
                                    temp_id = str(idx + 1)
                                    hosted_contents.append(
                                        {
                                            "@microsoft.graph.temporaryId": temp_id,
                                            "contentBytes": content_bytes,
                                            "contentType": att.mime_type,
                                        }
                                    )
                                    inline_img_html.append(
                                        f'<img src="../hostedContents/{temp_id}/$value" '
                                        f'alt="{att.name}" />'
                                    )
                                    att.download_status = "uploaded"
                                    await attachment_handler.cleanup_file(
                                        att.local_path
                                    )
                                    logger.info(
                                        "Chat image prepared as hostedContent",
                                        filename=att.name,
                                        index=temp_id,
                                    )
                                except Exception as e:
                                    logger.warning(
                                        "Failed to prepare chat hostedContent",
                                        filename=att.name,
                                        error=str(e),
                                    )
                                    file_links.append(f"📎 {att.name}")
                                    await attachment_handler.cleanup_file(
                                        att.local_path
                                    )
                            else:
                                # 비이미지: OneDrive 업로드 (Delegated Auth)
                                file_url = await self._upload_file_to_onedrive(
                                    file_path=att.local_path,
                                    filename=att.name,
                                )
                                if file_url:
                                    att.delivered_url = file_url
                                    att.download_status = "uploaded"
                                    file_links.append(
                                        f'<a href="{file_url}">📎 {att.name}</a>'
                                    )
                                    logger.info(
                                        "Chat attachment uploaded to OneDrive",
                                        filename=att.name,
                                        url=file_url,
                                    )
                                else:
                                    att.download_status = "failed"
                                    file_links.append(f"📎 {att.name}")
                                    logger.warning(
                                        "Failed to upload chat attachment",
                                        filename=att.name,
                                    )
                                await attachment_handler.cleanup_file(att.local_path)
                    else:
                        for idx, att in enumerate(upload_targets):
                            if att.mime_type.startswith("image/"):
                                # 이미지 → hostedContents 인라인 삽입
                                try:
                                    import base64

                                    with open(att.local_path, "rb") as f:
                                        content_bytes = base64.b64encode(
                                            f.read()
                                        ).decode("ascii")
                                    temp_id = str(idx + 1)
                                    hosted_contents.append(
                                        {
                                            "@microsoft.graph.temporaryId": temp_id,
                                            "contentBytes": content_bytes,
                                            "contentType": att.mime_type,
                                        }
                                    )
                                    inline_img_html.append(
                                        f'<img src="../hostedContents/{temp_id}/$value" '
                                        f'alt="{att.name}" />'
                                    )
                                    att.download_status = "uploaded"
                                    await attachment_handler.cleanup_file(
                                        att.local_path
                                    )
                                    logger.info(
                                        "Image prepared as hostedContent",
                                        filename=att.name,
                                        index=temp_id,
                                    )
                                except Exception as e:
                                    logger.warning(
                                        "Failed to prepare hostedContent, "
                                        "falling back to SharePoint upload",
                                        filename=att.name,
                                        error=str(e),
                                    )
                                    # fallback: SharePoint 업로드
                                    file_url = await self.upload_file(
                                        file_path=att.local_path,
                                        team_id=team_id,
                                        channel_id=actual_channel_id,
                                        filename=att.name,
                                    )
                                    if file_url:
                                        att.delivered_url = file_url
                                        att.download_status = "uploaded"
                                        file_links.append(
                                            f'<a href="{file_url}">{att.name}</a>'
                                        )
                                    else:
                                        att.download_status = "failed"
                                        file_links.append(f"📎 {att.name}")
                                    await attachment_handler.cleanup_file(
                                        att.local_path
                                    )
                            else:
                                # 비이미지 → SharePoint 업로드
                                file_url = await self.upload_file(
                                    file_path=att.local_path,
                                    team_id=team_id,
                                    channel_id=actual_channel_id,
                                    filename=att.name,
                                )
                                if file_url:
                                    att.delivered_url = file_url
                                    att.download_status = "uploaded"
                                    file_links.append(
                                        f'<a href="{file_url}">{att.name}</a>'
                                    )
                                    logger.info(
                                        "Attachment uploaded to Teams",
                                        filename=att.name,
                                        url=file_url,
                                    )
                                else:
                                    att.download_status = "failed"
                                    file_links.append(f"📎 {att.name}")
                                    logger.error(
                                        "Failed to upload attachment to Teams",
                                        filename=att.name,
                                    )
                                await attachment_handler.cleanup_file(att.local_path)

            # 텍스트가 없고 파일도 없으면 아무것도 하지 않음
            if not message.text and not file_links and not hosted_contents:
                self.last_sent_ts = None
                return True

            # 메시지 변환 (파일 링크 + 인라인 이미지 HTML 포함)
            extra_html = file_links + inline_img_html
            teams_msg = self.transform_from_common(
                message, extra_html=extra_html if extra_html else None
            )

            # hostedContents가 있으면 payload에 추가
            if hosted_contents:
                teams_msg["hostedContents"] = hosted_contents

            # 전송 방식 시도 (이전 성공 방식 우선)
            delegated_token = await self._get_delegated_token_if_available()

            # 1순위: Delegated Auth (Graph API)
            if delegated_token:
                try:
                    result = await asyncio.wait_for(
                        self._send_via_graph_delegated(
                            teams_msg,
                            team_id,
                            actual_channel_id,
                            delegated_token,
                            thread_id=message.thread_id,
                        ),
                        timeout=5.0,
                    )
                    if result:
                        return True
                except asyncio.TimeoutError:
                    logger.warning(
                        "Delegated auth send timed out (5s)",
                        channel=actual_channel_id,
                    )
                self.last_error = (
                    f"Delegated auth send failed for channel {actual_channel_id}"
                )
                logger.warning(
                    "Delegated auth send failed, trying fallback",
                    channel=actual_channel_id,
                )

            # 2순위: Webhook (Power Automate Incoming Webhook)
            if self.webhook_url:
                try:
                    return await asyncio.wait_for(
                        self._send_via_webhook(teams_msg, message),
                        timeout=5.0,
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        "Webhook send timed out (5s)",
                        channel=actual_channel_id,
                    )

            # 3순위: Bot Framework Proactive Messaging
            service_url = "https://smba.trafficmanager.net/kr/"

            if is_chat:
                conversation_id = actual_channel_id
            else:
                conversation_id = actual_channel_id

            conversation_ref = ConversationReference(
                service_url=service_url,
                channel_id="msteams",
                conversation=ConversationAccount(
                    id=conversation_id,
                    is_group=not is_chat,
                ),
                bot=ChannelAccount(
                    id=self.bot_app_id,
                    name="Bot",
                ),
            )

            sent_id = None

            async def _send_callback(turn_context: TurnContext):
                nonlocal sent_id
                activity = Activity(
                    type=ActivityTypes.message,
                    text=teams_msg["body"]["content"],
                    text_format="html",
                )
                # 스레드 답글인 경우 reply_to_id 설정
                if message.thread_id:
                    activity.reply_to_id = message.thread_id
                response = await turn_context.send_activity(activity)
                if response and response.id:
                    sent_id = response.id

            try:
                await self.adapter.continue_conversation(
                    conversation_ref,
                    _send_callback,
                    self.bot_app_id,
                )
                self.last_sent_ts = sent_id
                logger.debug(
                    "Teams message sent via Bot Framework",
                    channel=actual_channel_id,
                    message_id=self.last_sent_ts,
                )
                return True
            except Exception as bot_err:
                self.last_error = f"Bot Framework send failed: {bot_err}"
                logger.warning(
                    "Teams Bot Framework send failed",
                    error=str(bot_err),
                    channel=actual_channel_id,
                )
                return False

        except Exception as e:
            self.last_error = f"Error sending Teams message: {e}"
            logger.error("Error sending Teams message", error=str(e))
            return False

    async def _send_via_graph_delegated(
        self,
        teams_msg: dict,
        team_id: Optional[str],
        channel_id: str,
        delegated_token: str,
        thread_id: Optional[str] = None,
    ) -> bool:
        """
        Graph API Delegated Auth로 채널 메시지 전송

        ChannelMessage.Send Delegated 권한 사용
        thread_id가 있으면 /replies 엔드포인트로 답글 전송
        """
        try:
            if not team_id:
                # 채팅(DM/그룹채팅): /chats/{chatId}/messages
                if thread_id:
                    url = (
                        f"{self.graph_base_url}/chats/{channel_id}"
                        f"/messages/{thread_id}/replies"
                    )
                else:
                    url = f"{self.graph_base_url}/chats/{channel_id}/messages"
            elif thread_id:
                url = (
                    f"{self.graph_base_url}/teams/{team_id}"
                    f"/channels/{channel_id}/messages/{thread_id}/replies"
                )
            else:
                url = (
                    f"{self.graph_base_url}/teams/{team_id}"
                    f"/channels/{channel_id}/messages"
                )
            headers = {
                "Authorization": f"Bearer {delegated_token}",
                "Content-Type": "application/json",
            }
            payload = teams_msg

            session = self.session or aiohttp.ClientSession()
            should_close = self.session is None

            try:
                async with session.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status == 201:
                        data = await resp.json()
                        self.last_sent_ts = data.get("id")
                        # 에코 루프 방지: 봇이 보낸 메시지 ID 추적
                        if self.last_sent_ts:
                            self._sent_message_ids.add(self.last_sent_ts)
                            # 메모리 누수 방지: 최근 100개만 유지
                            if len(self._sent_message_ids) > 100:
                                self._sent_message_ids = set(
                                    list(self._sent_message_ids)[-50:]
                                )
                        logger.info(
                            "Teams message sent via Graph API (delegated)",
                            channel=channel_id,
                            message_id=self.last_sent_ts,
                        )
                        return True
                    else:
                        body = await resp.text()
                        self.last_error = f"Graph API {resp.status}: {body[:200]}"
                        logger.warning(
                            "Graph API delegated send failed",
                            status=resp.status,
                            body=body[:300],
                            channel=channel_id,
                        )
                        return False
            finally:
                if should_close:
                    await session.close()

        except Exception as e:
            logger.error("Error sending via Graph API delegated", error=str(e))
            return False

    async def _send_via_webhook(self, teams_msg: dict, message: CommonMessage) -> bool:
        """
        Power Automate Incoming Webhook으로 메시지 전송

        Adaptive Card 형식으로 POST 요청을 보냅니다.
        """
        try:
            # 닉네임 + 텍스트 조합
            text = teams_msg.get("body", {}).get("content", "")
            if not text:
                text = message.text or ""

            # HTML 태그 제거 (webhook은 plain text 기반)
            import re

            plain_text = re.sub(r"<[^>]+>", "", text)

            # 발신자 정보 포함
            sender = message.user.display_name or message.user.username
            platform = message.platform.value if message.platform else "unknown"
            formatted_text = f"**[{platform}] {sender}**: {plain_text}"

            payload = {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": {
                            "type": "AdaptiveCard",
                            "body": [
                                {
                                    "type": "TextBlock",
                                    "text": formatted_text,
                                    "wrap": True,
                                }
                            ],
                            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                            "version": "1.4",
                        },
                    }
                ],
            }

            session = self.session or aiohttp.ClientSession()
            should_close = self.session is None

            try:
                async with session.post(
                    self.webhook_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status in (200, 202):
                        logger.info(
                            "Teams message sent via webhook",
                            sender=sender,
                            status=resp.status,
                        )
                        return True
                    else:
                        body = await resp.text()
                        logger.error(
                            "Webhook send failed",
                            status=resp.status,
                            body=body[:200],
                        )
                        return False
            finally:
                if should_close:
                    await session.close()

        except Exception as e:
            logger.error("Error sending via webhook", error=str(e))
            return False

    async def receive_messages(self) -> AsyncIterator[CommonMessage]:
        """
        Teams 메시지를 Common Schema로 변환하여 수신

        Teams는 Webhook 기반으로 메시지를 수신합니다.
        FastAPI 엔드포인트(/api/teams/webhook)에서 메시지를 받아
        큐에 넣는 방식으로 동작합니다.

        Yields:
            CommonMessage: 변환된 메시지
        """
        logger.info("Starting Teams message receiver")

        try:
            while self.is_connected:
                try:
                    message = await asyncio.wait_for(
                        self._message_queue.get(), timeout=1.0
                    )
                    yield message
                except asyncio.TimeoutError:
                    continue

        except asyncio.CancelledError:
            logger.info("Teams message receiver cancelled")
        except Exception as e:
            logger.error("Error in Teams message receiver", error=str(e))

    async def handle_activity(self, activity: Activity):
        """
        Teams Activity 처리 (Webhook 엔드포인트에서 호출)

        봇 자신이 보낸 메시지는 무시하여 무한 루프를 방지합니다.

        Args:
            activity: Teams Activity 객체
        """
        try:
            if activity.type != ActivityTypes.message:
                return

            sender_id = activity.from_property.id if activity.from_property else None

            # 봇 자신의 메시지 무시 (무한 루프 방지)
            # Teams Bot Framework에서 봇이 보낸 메시지도 webhook으로 수신됨
            if sender_id and sender_id == self.bot_app_id:
                logger.debug(
                    "Ignoring bot self-message",
                    bot_app_id=self.bot_app_id,
                    sender_id=sender_id,
                )
                return

            # Activity → 딕셔너리 변환
            activity_dict = {
                "id": activity.id,
                "timestamp": (
                    activity.timestamp.isoformat() if activity.timestamp else None
                ),
                "type": activity.type,
                "text": activity.text or "",
                "from": {
                    "id": sender_id,
                    "name": (
                        activity.from_property.name if activity.from_property else None
                    ),
                },
                "channelId": activity.channel_id,
                "conversation": {
                    "id": (activity.conversation.id if activity.conversation else None),
                    "isGroup": (
                        activity.conversation.is_group
                        if activity.conversation
                        else False
                    ),
                    "name": (
                        activity.conversation.name if activity.conversation else None
                    ),
                },
                "attachments": [
                    {
                        "id": att.id or "",
                        "name": att.name or "unknown",
                        "contentType": att.content_type or "application/octet-stream",
                        "contentUrl": att.content_url or "",
                    }
                    for att in (activity.attachments or [])
                    if att.content_url  # URL 없는 첨부파일(카드 등) 제외
                ],
            }

            # 캐시에 채널 이름이 없으면 Graph API로 조회하여 activity_dict에 주입
            conv_id = activity_dict.get("conversation", {}).get("id", "")
            conv_name = activity_dict.get("conversation", {}).get("name")
            if not conv_name and conv_id and "thread" in conv_id:
                cached = self._channel_name_cache.get(conv_id)
                if not cached:
                    cached = await self._resolve_channel_name(conv_id)
                if cached:
                    activity_dict["channelName"] = cached

            common_msg = self.transform_to_common(activity_dict)
            await self._message_queue.put(common_msg)

            logger.debug(
                "Teams activity queued",
                message_id=common_msg.message_id,
                user=common_msg.user.username,
                text=(common_msg.text[:50] if common_msg.text else ""),
            )

        except Exception as e:
            import traceback

            conv_id = "unknown"
            try:
                conv_id = (
                    activity.conversation.id
                    if activity and activity.conversation
                    else "unknown"
                )
            except Exception:
                pass

            logger.error(
                "Error handling Teams activity",
                error=str(e),
                traceback=traceback.format_exc(),
                activity_type=getattr(activity, "type", "unknown"),
                conversation_id=conv_id,
                sender=(
                    activity.from_property.name
                    if activity and activity.from_property
                    else "unknown"
                ),
                text_preview=((activity.text or "")[:50] if activity else ""),
            )

    async def get_channels(self) -> List[Channel]:
        """
        Teams 채널 및 채팅방(1:1/그룹) 목록 조회

        Returns:
            Channel 객체 리스트 (채널 + 채팅방)
        """
        channels: list[Channel] = []

        try:
            token = await self._get_access_token()
            headers = {"Authorization": f"Bearer {token}"}

            if not self.session:
                self.session = aiohttp.ClientSession()

            # 1) Team 채널 조회 (페이지네이션 지원)
            team_id = self.config.get("team_id")
            if team_id:
                url: Optional[str] = f"{self.graph_base_url}/teams/{team_id}/channels"
                while url:
                    async with self.session.get(url, headers=headers) as resp:
                        if resp.status == 200:
                            result = await resp.json()
                            for tc in result.get("value", []):
                                if tc.get("id"):
                                    ch_id = f"{team_id}:{tc['id']}"
                                    ch_name = tc.get("displayName", "unknown")
                                    self._channel_name_cache[tc["id"]] = ch_name
                                    self._channel_name_cache[ch_id] = ch_name
                                    channels.append(
                                        Channel(
                                            id=ch_id,
                                            name=ch_name,
                                            platform=Platform.TEAMS,
                                            type=ChannelType.CHANNEL,
                                        )
                                    )
                            url = result.get("@odata.nextLink")
                        else:
                            error_text = await resp.text()
                            logger.warning(
                                "Failed to get Teams channels",
                                status=resp.status,
                                error=error_text,
                            )
                            break
                logger.info("Retrieved Teams channels", count=len(channels))
            else:
                logger.warning("Teams team_id not configured — skipping channel list")

            # 2) 채팅방(1:1/그룹) 조회 — Delegated Auth 필요
            #    Graph /chats API는 application-only token을 지원하지 않으므로
            #    OAuth2 Authorization Code Flow로 획득한 delegated token 사용
            try:
                delegated_token = await self._get_delegated_token_if_available()
                if delegated_token:
                    chat_headers = {"Authorization": f"Bearer {delegated_token}"}
                    chat_url: Optional[str] = f"{self.graph_base_url}/chats"
                    params: Optional[dict] = {
                        "$expand": "members",
                        "$top": "50",
                    }

                    # 모든 채팅을 먼저 수집 (lastUpdatedDateTime 포함)
                    raw_chats: list[dict] = []

                    while chat_url:
                        async with self.session.get(
                            chat_url,
                            headers=chat_headers,
                            params=params,
                        ) as resp:
                            if resp.status == 200:
                                result = await resp.json()
                                raw_chats.extend(result.get("value", []))
                                # nextLink에는 이미 params가 포함됨
                                chat_url = result.get("@odata.nextLink")
                                params = None
                            else:
                                error_text = await resp.text()
                                logger.warning(
                                    "Failed to get Teams chats with delegated token",
                                    status=resp.status,
                                    error=error_text[:200],
                                )
                                break

                    # 최신순 정렬 → 같은 멤버 구성의 중복 중 최신만 유지
                    raw_chats.sort(
                        key=lambda c: c.get("lastUpdatedDateTime", ""),
                        reverse=True,
                    )

                    seen_member_sets: dict[frozenset[str], bool] = {}
                    chat_count = 0

                    for chat in raw_chats:
                        chat_id = chat.get("id")
                        if not chat_id:
                            continue

                        chat_type_str = chat.get("chatType", "")
                        if chat_type_str == "oneOnOne":
                            ch_type = ChannelType.DM
                            members = chat.get("members", [])

                            member_ids = frozenset(
                                m.get("userId", m.get("id", ""))
                                for m in members
                                if m.get("userId") or m.get("id")
                            )
                            if member_ids in seen_member_sets:
                                continue
                            seen_member_sets[member_ids] = True

                            name = self._resolve_chat_display_name(
                                members, chat.get("topic")
                            )
                        elif chat_type_str == "group":
                            ch_type = ChannelType.GROUP_DM
                            members = chat.get("members", [])

                            member_ids = frozenset(
                                m.get("userId", m.get("id", ""))
                                for m in members
                                if m.get("userId") or m.get("id")
                            )
                            if member_ids in seen_member_sets:
                                continue
                            seen_member_sets[member_ids] = True

                            name = chat.get("topic") or self._resolve_chat_display_name(
                                members, None
                            )
                        else:
                            continue

                        channels.append(
                            Channel(
                                id=f"chat:{chat_id}",
                                name=name,
                                platform=Platform.TEAMS,
                                type=ch_type,
                            )
                        )
                        chat_count += 1

                    logger.info("Retrieved Teams chats", count=chat_count)
                else:
                    logger.info(
                        "Teams delegated auth not configured — "
                        "chat list unavailable. Connect Microsoft account "
                        "in Provider settings to enable DM/group chat routing."
                    )
            except Exception as e:
                logger.warning("Error fetching Teams chats (non-fatal)", error=str(e))

        except Exception as e:
            logger.error("Error getting Teams channels", error=str(e))

        return channels

    # Delegated 토큰 메모리 캐시 {account_id: (token, expires_at)}
    _delegated_token_cache: dict[int, tuple[str, datetime]] = {}

    async def _get_delegated_token_if_available(self) -> Optional[str]:
        """Delegated access token 반환 (메모리 캐시 + DB 조회)"""
        if not self.account_id:
            return None

        # 캐시에서 먼저 확인 (만료 5분 전까지 재사용)
        cached = self._delegated_token_cache.get(self.account_id)
        if cached:
            token, expires_at = cached
            if expires_at > datetime.now(timezone.utc) + timedelta(minutes=5):
                return token
            # 만료 임박 → 캐시 제거
            del self._delegated_token_cache[self.account_id]

        try:
            from app.db import SessionLocal
            from app.models import Account
            from app.api.auth_microsoft import get_delegated_token

            db = SessionLocal()
            try:
                account = (
                    db.query(Account).filter(Account.id == self.account_id).first()
                )
                if not account:
                    return None
                token = await get_delegated_token(account, db)
                if (
                    token
                    and hasattr(account, "token_expires_at")
                    and account.token_expires_at
                ):
                    self._delegated_token_cache[self.account_id] = (
                        token,
                        account.token_expires_at,
                    )
                elif token:
                    # 만료 시간 모르면 50분 후로 설정 (일반적인 OAuth 토큰 수명 1시간)
                    self._delegated_token_cache[self.account_id] = (
                        token,
                        datetime.now(timezone.utc) + timedelta(minutes=50),
                    )
                return token
            finally:
                db.close()
        except Exception as e:
            logger.warning(
                "Failed to get delegated token",
                account_id=self.account_id,
                error=str(e),
            )
            return None

    def _resolve_chat_display_name(self, members: list[dict], topic: str | None) -> str:
        """채팅방 표시 이름 생성 (멤버 이름 조합)"""
        if topic:
            return topic

        names = []
        for member in members:
            display_name = member.get("displayName")
            if display_name:
                names.append(display_name)

        return ", ".join(names[:4]) if names else "Chat"

    async def get_users(self) -> List[User]:
        """
        Teams 사용자 목록 조회

        Returns:
            User 객체 리스트
        """
        try:
            token = await self._get_access_token()
            team_id = self.config.get("team_id")

            if not team_id:
                logger.warning("Teams team_id not configured")
                return []

            url = f"{self.graph_base_url}/teams/{team_id}/members"
            headers = {"Authorization": f"Bearer {token}"}

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    users = [
                        User(
                            id=tm.get("userId", ""),
                            username=tm.get("email", "unknown"),
                            display_name=tm.get("displayName", "unknown"),
                            platform=Platform.TEAMS,
                        )
                        for tm in result.get("value", [])
                    ]
                    logger.info("Retrieved Teams users", count=len(users))
                    return users
                else:
                    error_text = await resp.text()
                    logger.warning(
                        "Failed to get Teams users",
                        status=resp.status,
                        error=error_text,
                    )
                    return []

        except Exception as e:
            logger.error("Error getting Teams users", error=str(e))
            return []

    def transform_to_common(self, raw_message: Dict[str, Any]) -> CommonMessage:
        """
        Teams Activity → Common Schema 변환

        Args:
            raw_message: Teams Activity 딕셔너리

        Returns:
            CommonMessage: 변환된 메시지
        """
        from_data = raw_message.get("from", {})
        user_id = from_data.get("id", "unknown")
        user_name = from_data.get("name") or user_id

        user = User(
            id=user_id,
            username=user_name,
            display_name=user_name,
            platform=Platform.TEAMS,
        )

        # conversation.id를 채널 ID로 사용
        conversation = raw_message.get("conversation", {})
        conv_id = conversation.get("id") or raw_message.get("channelId", "unknown")
        is_group = conversation.get("isGroup", False)

        # 대화 유형 판별: 채널 vs 채팅
        # Teams 채널 ID는 "19:xxx@thread.tacv2" 또는 "19:xxx@thread.skype" 형식
        if "thread.tacv2" in conv_id or "thread.skype" in conv_id:
            ch_type = ChannelType.CHANNEL
            channel_id = conv_id
        elif is_group:
            ch_type = ChannelType.GROUP_DM
            channel_id = f"chat:{conv_id}"
        else:
            ch_type = ChannelType.DM
            channel_id = f"chat:{conv_id}"

        channel_name = (
            raw_message.get("channelName")
            or conversation.get("name")
            or self._channel_name_cache.get(conv_id)
            or self._channel_name_cache.get(channel_id)
            or conv_id
        )

        channel = Channel(
            id=channel_id,
            name=channel_name,
            platform=Platform.TEAMS,
            type=ch_type,
        )

        # 첨부파일
        attachments = [
            Attachment(
                id=att.get("id", ""),
                name=att.get("name", "unknown"),
                mime_type=att.get("contentType", "application/octet-stream"),
                size=0,
                url=att.get("contentUrl", ""),
            )
            for att in raw_message.get("attachments", [])
            if att.get("contentUrl")
        ]

        message_type = MessageType.FILE if attachments else MessageType.TEXT

        # 타임스탬프
        timestamp_str = raw_message.get("timestamp")
        try:
            timestamp = (
                datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                if timestamp_str
                else datetime.now(timezone.utc)
            )
        except (ValueError, AttributeError):
            timestamp = datetime.now(timezone.utc)

        # 스레드 지원: replyToId가 있으면 thread_id로 매핑
        reply_to_id = raw_message.get("replyToId")
        thread_id = reply_to_id if reply_to_id else None

        return CommonMessage(
            message_id=raw_message.get("id", "unknown"),
            timestamp=timestamp,
            type=message_type,
            platform=Platform.TEAMS,
            user=user,
            channel=channel,
            text=raw_message.get("text", ""),
            attachments=attachments,
            raw_message=raw_message,
            thread_id=thread_id,
        )

    def transform_from_common(
        self,
        message: CommonMessage,
        extra_html: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        """
        Common Schema → Teams 메시지 변환

        contentType을 "html"로 설정하여 굵기·링크 등이 Teams에서 올바르게 렌더링됩니다.

        Args:
            message: CommonMessage 스키마 메시지
            extra_html: 추가로 삽입할 HTML 조각 목록 (파일 링크 등)

        Returns:
            Teams 메시지 딕셔너리 (Graph API body)
        """
        content = message.text or ""

        # Slack → Teams Markdown 변환 (Slack에서 온 경우)
        if message.platform == Platform.SLACK:
            content = convert_slack_to_teams_markdown(content)

        # Markdown → HTML 변환
        html_content = _markdown_to_teams_html(content)

        # 발신자 정보 prefix (Teams는 username/icon 설정 불가)
        if message.user:
            display_name = message.user.display_name or message.user.username
            source_platform = message.platform.value.upper()
            html_content = (
                f"<b>[{source_platform}] {display_name}</b><br><br>{html_content}"
            )

        # 파일 링크 추가
        if extra_html:
            links_html = "<br>".join(extra_html)
            html_content = (
                f"{html_content}<br>{links_html}" if html_content else links_html
            )

        return {
            "body": {
                "content": html_content,
                "contentType": "html",  # 마크다운/HTML 렌더링 활성화
            }
        }
