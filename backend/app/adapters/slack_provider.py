"""
Slack Provider: Slack Socket Mode 기반 어댑터

Zowe Chat의 Provider Pattern을 Slack에 적용.
Socket Mode를 사용하여 방화벽 인바운드 설정 없이 실시간 메시지 수신 가능.

작성일: 2026-03-31
"""

import asyncio
import structlog
from typing import AsyncIterator, List, Dict, Any, Optional
from datetime import datetime, timezone

from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
from slack_sdk.errors import SlackApiError

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
from app.utils.message_formatter import (
    convert_teams_to_slack_markdown,
)
from app.utils.attachment_handler import attachment_handler

logger = structlog.get_logger()


class SlackProvider(BasePlatformProvider):
    """
    Slack Socket Mode 제공자

    Slack의 Socket Mode를 사용하여 실시간 메시지 수신 및 전송을 처리합니다.
    BasePlatformProvider 인터페이스를 구현합니다.
    """

    def __init__(
        self, bot_token: str, app_token: str, message_mode: str = "sender_info"
    ):
        """
        SlackProvider 초기화

        Args:
            bot_token: Slack Bot User OAuth Token (xoxb-...)
            app_token: Slack App-Level Token (xapp-...)
            message_mode: 메시지 전송 모드
                - "sender_info" (기본): username/icon_url 사용, 발신자 정보 표시, 편집/삭제 불가
                - "editable": username/icon_url 미사용, 편집/삭제 가능, 발신자 정보 없음
        """
        config = {
            "bot_token": bot_token,
            "app_token": app_token,
            "message_mode": message_mode,
        }
        super().__init__("slack", config)

        self.app = AsyncApp(token=bot_token)
        self.socket_handler: Optional[AsyncSocketModeHandler] = None
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self.last_sent_ts: Optional[str] = None  # 마지막 전송 메시지 timestamp
        self.message_mode = message_mode  # 메시지 전송 모드
        self._message_id_map: Dict[
            str, str
        ] = {}  # source_ts -> sent_ts 매핑 (editable 모드용)
        self.bot_user_id: Optional[str] = None  # 봇 자신의 user ID (연결 시 설정)
        self._channel_name_cache: Dict[str, str] = {}  # channel_id → name 캐시
        self._user_name_cache: Dict[str, str] = {}  # user_id → display_name 캐시
        self._setup_event_handlers()

        logger.info("SlackProvider initialized", message_mode=message_mode)

    def _setup_event_handlers(self):
        """Slack 이벤트 핸들러 설정"""

        @self.app.event("message")
        async def handle_message(event, say):
            """메시지 이벤트 핸들러"""
            try:
                logger.info("📨 Slack message event received", slack_event=event)

                # 봇 자신의 메시지는 무시 (bot_id 또는 user가 봇의 user ID인 경우)
                if event.get("bot_id") or event.get("user") == self.bot_user_id:
                    logger.debug(
                        "Ignoring bot message",
                        bot_id=event.get("bot_id"),
                        user=event.get("user"),
                        bot_user_id=self.bot_user_id,
                    )
                    return

                # 메시지 서브타입 필터링
                subtype = event.get("subtype")

                # message_changed는 별도 처리
                if subtype == "message_changed":
                    await self._handle_message_edited(event)
                    return

                # message_deleted는 별도 처리
                if subtype == "message_deleted":
                    await self._handle_message_deleted(event)
                    return

                # 그 외 서브타입 필터링
                if subtype and subtype not in ["file_share", "thread_broadcast"]:
                    logger.info("Ignoring message subtype", subtype=subtype)
                    return

                # 사용자 정보 조회 (username과 display_name을 정확히 가져오기 위해)
                user_id = event.get("user")
                if user_id and not event.get("user_profile"):
                    try:
                        user_info = await self.app.client.users_info(user=user_id)
                        if user_info.get("ok"):
                            user_data = user_info.get("user", {})
                            event["user_profile"] = user_data.get("profile", {})
                            event["username"] = user_data.get("name", user_id)
                            logger.debug(
                                "Fetched user info",
                                user_id=user_id,
                                username=event["username"],
                            )
                    except SlackApiError as e:
                        logger.warning(
                            "Failed to fetch user info, using defaults",
                            user_id=user_id,
                            error=str(e),
                        )

                # Common Schema로 변환
                common_msg = self.transform_to_common(event)

                # 메시지 큐에 추가
                await self._message_queue.put(common_msg)

                logger.info(
                    "✅ Slack message queued",
                    message_id=common_msg.message_id,
                    channel=common_msg.channel.id,
                    user=common_msg.user.username,
                    display_name=common_msg.user.display_name,
                    text=common_msg.text[:50] if common_msg.text else None,
                )

            except Exception as e:
                import traceback

                logger.error(
                    "Error handling Slack message",
                    error=str(e),
                    error_type=type(e).__name__,
                    traceback=traceback.format_exc(),
                    slack_event=event,
                )

        @self.app.event("file_shared")
        async def handle_file_shared(event, say):
            """
            파일 공유 이벤트 핸들러 (비활성화)

            Note: file_share subtype의 message 이벤트에서 이미 처리하므로
            이 핸들러는 중복 방지를 위해 비활성화됨
            """
            logger.debug(
                "file_shared event received (ignored to prevent duplication)",
                file_id=event.get("file_id"),
                channel=event.get("channel_id"),
            )
            # 중복 전송 방지: message 이벤트(subtype: file_share)에서 이미 처리됨
            return

        @self.app.event("reaction_added")
        async def handle_reaction_added(event, say):
            """리액션 추가 이벤트 핸들러"""
            try:
                logger.info("👍 Slack reaction added event received", slack_event=event)

                # 리액션 정보 추출
                reaction = event.get("reaction", "")
                user_id = event.get("user", "")
                channel = event.get("item", {}).get("channel", "")
                message_ts = event.get("item", {}).get("ts", "")

                # 사용자 정보 조회
                try:
                    user_info = await self.app.client.users_info(user=user_id)
                    if user_info.get("ok"):
                        user_data = user_info.get("user", {})
                        username = user_data.get("name", user_id)
                        display_name = user_data.get("real_name", username)
                    else:
                        username = user_id
                        display_name = user_id
                except Exception:
                    username = user_id
                    display_name = user_id

                # 리액션 메시지 생성 (텍스트 형태로 전송)
                reaction_text = f":{reaction}: by @{display_name}"

                # 리액션 메시지 이벤트 생성
                reaction_event = {
                    "type": "message",
                    "user": user_id,
                    "channel": channel,
                    "ts": message_ts,  # 원본 메시지 ts 사용 (float 변환 가능하도록)
                    "text": reaction_text,
                    "thread_ts": message_ts,  # 원본 메시지의 스레드로 전송
                    "username": username,
                    "user_profile": {"real_name": display_name},
                    "reaction": reaction,
                }

                # Common Schema로 변환
                common_msg = self.transform_to_common(reaction_event)
                common_msg.type = MessageType.REACTION
                # message_id에 reaction 정보 추가
                common_msg.message_id = f"{message_ts}_reaction_{reaction}"

                # 메시지 큐에 추가
                await self._message_queue.put(common_msg)

                logger.info(
                    "✅ Slack reaction queued",
                    reaction=reaction,
                    user=username,
                    channel=channel,
                )

            except Exception as e:
                logger.error(
                    "Error handling Slack reaction", error=str(e), slack_event=event
                )

    async def _handle_message_edited(self, event: Dict[str, Any]):
        """메시지 편집 이벤트 처리"""
        try:
            logger.info("✏️ Slack message edited event received", slack_event=event)

            # 편집된 메시지 정보 추출
            message = event.get("message", {})
            channel = event.get("channel", "")

            # 봇 메시지는 무시
            if message.get("bot_id"):
                return

            # 사용자 정보 조회
            user_id = message.get("user", "")
            if user_id and not message.get("user_profile"):
                try:
                    user_info = await self.app.client.users_info(user=user_id)
                    if user_info.get("ok"):
                        user_data = user_info.get("user", {})
                        message["user_profile"] = user_data.get("profile", {})
                        message["username"] = user_data.get("name", user_id)
                except Exception as e:
                    logger.warning("Failed to fetch user info", error=str(e))

            # 채널 정보 추가
            message["channel"] = channel

            # Common Schema로 변환
            common_msg = self.transform_to_common(message)
            common_msg.is_edited = True
            # Slack 스타일: 메시지 뒤에 작고 회색으로 (edited) 표시
            # Slack에서는 이탤릭이 약간 흐린 느낌을 줌
            common_msg.text = f"{common_msg.text} _(edited)_"

            # 메시지 큐에 추가
            await self._message_queue.put(common_msg)

            logger.info(
                "✅ Edited message queued",
                message_id=common_msg.message_id,
                channel=channel,
                text=common_msg.text[:50] if common_msg.text else None,
            )

        except Exception as e:
            logger.error(
                "Error handling edited message", error=str(e), slack_event=event
            )

    @staticmethod
    def _clean_slack_mrkdwn(text: str) -> str:
        """Slack mrkdwn을 일반 텍스트로 정리

        :emoji: 코드 → 유니코드, <url|label> → label, 멘션 제거 등
        """
        import re

        # :paperclip: 등 자주 쓰이는 이모지 코드 변환
        emoji_map = {
            ":paperclip:": "\U0001f4ce",
            ":file_folder:": "\U0001f4c1",
            ":page_facing_up:": "\U0001f4c4",
            ":camera:": "\U0001f4f7",
            ":movie_camera:": "\U0001f3a5",
        }
        for code, uni in emoji_map.items():
            text = text.replace(code, uni)

        # <url|label> → label
        text = re.sub(r"<([^|>]+)\|([^>]+)>", r"\2", text)
        # <url> (라벨 없는 링크) → url
        text = re.sub(r"<(https?://[^>]+)>", r"\1", text)
        # <@U123> 멘션 제거
        text = re.sub(r"<@[A-Z0-9]+>", "", text)

        return text.strip()

    async def _handle_message_deleted(self, event: Dict[str, Any]):
        """메시지 삭제 이벤트 처리

        Slack의 message_deleted 이벤트에는 previous_message 필드가 포함되어
        원본 메시지의 사용자 정보와 텍스트를 가져올 수 있습니다.
        Teams → Slack 방향의 _process_deleted와 동일한 포맷(취소선 + 원본 발신자)을 사용합니다.

        봇이 전달한 메시지(bridge 메시지)의 삭제는 원본 플랫폼에 전달하지 않습니다.
        """
        try:
            logger.info("Slack message deleted event received", slack_event=event)

            # 삭제된 메시지 정보 추출
            channel = event.get("channel", "")
            deleted_ts = event.get("deleted_ts", "")

            # previous_message에서 원본 사용자/텍스트 추출
            previous = event.get("previous_message", {})
            original_text = previous.get("text", "")
            original_user_id = previous.get("user", "")

            # 봇이 전달한 메시지인 경우 삭제 알림을 전달하지 않음
            # (bridge가 전달한 메시지의 삭제를 원본 플랫폼에 다시 보내면 혼란)
            prev_bot_id = previous.get("bot_id")
            if prev_bot_id or (
                self.bot_user_id and original_user_id == self.bot_user_id
            ):
                logger.debug(
                    "Ignoring delete of bot/bridge message",
                    bot_id=prev_bot_id,
                    user=original_user_id,
                    deleted_ts=deleted_ts,
                )
                return

            # 원본 사용자 정보 조회
            username = original_user_id
            display_name = original_user_id
            avatar_url = None

            if original_user_id:
                # 캐시된 이름이 있으면 사용
                cached_name = self._user_name_cache.get(original_user_id)
                if cached_name:
                    display_name = cached_name
                    username = original_user_id
                else:
                    try:
                        user_info = await self.app.client.users_info(
                            user=original_user_id
                        )
                        if user_info.get("ok"):
                            user_data = user_info.get("user", {})
                            profile = user_data.get("profile", {})
                            username = user_data.get("name", original_user_id)
                            display_name = (
                                profile.get("display_name")
                                or profile.get("real_name")
                                or username
                            )
                            avatar_url = profile.get("image_72")
                            self._user_name_cache[original_user_id] = display_name
                    except Exception as e:
                        logger.warning(
                            "Failed to fetch deleted message user info",
                            user_id=original_user_id,
                            error=str(e),
                        )

            # Slack mrkdwn 정리 (이모지 코드, URL 링크 등)
            clean_text = (
                self._clean_slack_mrkdwn(original_text) if original_text else ""
            )

            # 삭제 알림 텍스트: 원본 텍스트가 있으면 취소선, 없으면 일반 알림
            if clean_text:
                delete_text = f"~{clean_text}~ _(deleted)_"
            else:
                delete_text = "~메시지가 삭제되었습니다~ _(deleted)_"

            deletion_message = {
                "type": "message",
                "user": original_user_id or "system",
                "channel": channel,
                "ts": deleted_ts,
                "text": delete_text,
                "username": username,
                "user_profile": {"real_name": display_name},
            }

            # avatar_url이 있으면 profile에 추가
            if avatar_url:
                deletion_message["user_profile"]["image_72"] = avatar_url

            # Common Schema로 변환
            common_msg = self.transform_to_common(deletion_message)
            common_msg.type = MessageType.SYSTEM
            # message_id에 _deleted 추가 (WebSocketBridge에서 인식용)
            common_msg.message_id = f"{deleted_ts}_deleted"

            # 메시지 큐에 추가
            await self._message_queue.put(common_msg)

            logger.info(
                "Deleted message notification queued",
                channel=channel,
                deleted_ts=deleted_ts,
                user=display_name,
                original_text=clean_text[:50] if clean_text else None,
            )

        except Exception as e:
            logger.error(
                "Error handling deleted message", error=str(e), slack_event=event
            )

    async def connect(self) -> bool:
        """
        Slack Socket Mode 연결

        Returns:
            연결 성공 여부
        """
        try:
            app_token = self.config.get("app_token")
            if not app_token:
                logger.error("Slack app_token not provided")
                return False

            # 봇 인증 정보 가져오기 (bot user ID 확인)
            try:
                auth_result = await self.app.client.auth_test()
                if auth_result.get("ok"):
                    self.bot_user_id = auth_result.get("user_id")
                    logger.info(
                        "Slack bot authenticated",
                        bot_user_id=self.bot_user_id,
                        team=auth_result.get("team"),
                    )
                else:
                    logger.warning("Slack auth.test failed", result=auth_result)
            except Exception as e:
                logger.warning("Failed to get bot user ID", error=str(e))

            self.socket_handler = AsyncSocketModeHandler(self.app, app_token)

            # 비동기로 시작 (논블로킹)
            asyncio.create_task(self.socket_handler.start_async())

            # 연결 대기 (최대 5초)
            await asyncio.sleep(1)

            self.is_connected = True

            # 채널 이름 캐시 초기화 (백그라운드)
            asyncio.create_task(self._preload_channel_names())

            logger.info("Slack Socket Mode connected")

            return True

        except Exception as e:
            logger.error("Failed to connect Slack Socket Mode", error=str(e))
            self.is_connected = False
            return False

    async def _preload_channel_names(self) -> None:
        """봇이 멤버인 채널 이름을 캐시에 로드"""
        try:
            cursor = None
            loaded = 0
            while True:
                kwargs: Dict[str, Any] = {
                    "types": "public_channel,private_channel",
                    "limit": 200,
                }
                if cursor:
                    kwargs["cursor"] = cursor
                result = await self.app.client.conversations_list(**kwargs)
                if not result.get("ok"):
                    break
                for ch in result.get("channels", []):
                    ch_id = ch.get("id")
                    ch_name = ch.get("name")
                    if ch_id and ch_name:
                        self._channel_name_cache[ch_id] = ch_name
                        loaded += 1
                cursor = result.get("response_metadata", {}).get("next_cursor")
                if not cursor:
                    break
            logger.info("Channel name cache loaded", count=loaded)
        except Exception as e:
            logger.warning("Failed to preload channel names", error=str(e))

    async def disconnect(self) -> bool:
        """
        Slack Socket Mode 연결 해제

        Returns:
            연결 해제 성공 여부
        """
        try:
            if self.socket_handler:
                await self.socket_handler.close_async()
                self.socket_handler = None

            self.is_connected = False

            logger.info("Slack Socket Mode disconnected")

            return True

        except Exception as e:
            logger.error("Failed to disconnect Slack Socket Mode", error=str(e))
            return False

    async def upload_file(
        self,
        file_path: str,
        channel_id: str,
        filename: Optional[str] = None,
        initial_comment: Optional[str] = None,
        thread_ts: Optional[str] = None,
    ) -> Optional[str]:
        """
        Slack에 파일 업로드

        Args:
            file_path: 업로드할 파일의 로컬 경로
            channel_id: 업로드할 채널 ID
            filename: 파일명 (None이면 원본 파일명 사용)
            initial_comment: 파일과 함께 보낼 메시지
            thread_ts: 스레드 ID (스레드로 전송 시)

        Returns:
            업로드된 파일 URL, 실패 시 None
        """
        try:
            import os

            if not os.path.exists(file_path):
                logger.error("File not found", file_path=file_path)
                return None

            # 파일명이 지정되지 않으면 원본 파일명 사용
            if not filename:
                filename = os.path.basename(file_path)

            # Slack files.upload API 사용
            with open(file_path, "rb") as file_content:
                result = await self.app.client.files_upload_v2(
                    channel=channel_id,
                    file=file_content,
                    filename=filename,
                    initial_comment=initial_comment,
                    thread_ts=thread_ts,
                )

            if result.get("ok"):
                # 파일 정보에서 URL 추출
                file_info = result.get("file", {})
                file_url = file_info.get("permalink", file_info.get("url_private"))

                logger.info(
                    "File uploaded to Slack",
                    filename=filename,
                    channel=channel_id,
                    url=file_url,
                )
                return file_url
            else:
                logger.error("Slack file upload failed", error=result.get("error"))
                return None

        except Exception as e:
            logger.error("Error uploading file to Slack", error=str(e))
            return None

    async def download_file(
        self,
        file_url: str,
        file_id: str,
        filename: Optional[str] = None,
    ) -> Optional[str]:
        """
        Slack에서 파일 다운로드

        Args:
            file_url: Slack 파일 URL (url_private)
            file_id: Slack 파일 ID
            filename: 원본 파일명 (URL에서 추출 불가 시 fallback)

        Returns:
            다운로드된 로컬 파일 경로, 실패 시 None
        """
        try:
            # Slack 파일은 인증 헤더가 필요
            headers = {"Authorization": f"Bearer {self.config['bot_token']}"}

            # AttachmentHandler를 사용하여 다운로드
            local_path = await attachment_handler.download_file(
                url=file_url,
                headers=headers,
                fallback_filename=filename,
            )

            if local_path:
                logger.info(
                    "File downloaded from Slack",
                    file_id=file_id,
                    local_path=local_path,
                )
                return local_path
            else:
                logger.error("Failed to download file from Slack", file_id=file_id)
                return None

        except Exception as e:
            logger.error("Error downloading file from Slack", error=str(e))
            return None

    async def send_message(self, message: CommonMessage) -> bool:
        """
        Common Schema 메시지를 Slack 메시지로 변환하여 전송

        Args:
            message: CommonMessage 스키마 메시지

        Returns:
            전송 성공 여부

        Note:
            전송된 메시지의 timestamp는 self.last_sent_ts에 저장됩니다
        """
        try:
            # REACTION 타입: Slack reactions.add API로 실제 이모지 추가
            if message.type == MessageType.REACTION:
                if message.thread_id:
                    return await self._add_reaction(message)
                # thread_id 없으면 텍스트로 폴백
                return await self._send_reaction_as_text(message)

            # 첨부 파일이 있으면 병렬 업로드 (텍스트는 나중에 chat_postMessage로 전송)
            if message.attachments:
                upload_targets = [
                    att
                    for att in message.attachments
                    if att.local_path and att.download_status == "downloaded"
                ]

                if upload_targets:

                    async def _upload_one(att):
                        file_url = await self.upload_file(
                            file_path=att.local_path,
                            channel_id=message.channel.id,
                            filename=att.name,
                            initial_comment=None,
                            thread_ts=message.thread_id,
                        )
                        if file_url:
                            att.delivered_url = file_url
                            att.download_status = "uploaded"
                            await attachment_handler.cleanup_file(att.local_path)
                            logger.info(
                                "Attachment uploaded",
                                filename=att.name,
                                url=file_url,
                            )
                        else:
                            att.download_status = "failed"
                            logger.error(
                                "Failed to upload attachment", filename=att.name
                            )

                    await asyncio.gather(*[_upload_one(att) for att in upload_targets])

            # 텍스트 메시지 전송 (파일이 있어도 전송하여 username 표시)
            if message.text or message.attachments:
                slack_msg = self.transform_from_common(message)

                result = await self.app.client.chat_postMessage(**slack_msg)

                if result.get("ok"):
                    # 전송된 메시지 timestamp 저장 (스레드 매핑용)
                    self.last_sent_ts = result.get("ts")

                    # 모드 2: 메시지 ID 매핑 저장 (편집/삭제용)
                    if self.message_mode == "editable" and self.last_sent_ts:
                        self._message_id_map[message.message_id] = self.last_sent_ts
                        logger.debug(
                            "Message ID mapping saved",
                            source_id=message.message_id,
                            sent_ts=self.last_sent_ts,
                        )

                    logger.debug(
                        "Slack message sent",
                        channel=slack_msg.get("channel"),
                        ts=self.last_sent_ts,
                    )
                    return True
                else:
                    self.last_sent_ts = None
                    logger.warning(
                        "Slack message send failed",
                        error=result.get("error", "unknown"),
                    )
                    return False
            else:
                # 텍스트도 첨부파일도 없으면 아무것도 안 함
                self.last_sent_ts = None
                return True

        except SlackApiError as e:
            self.last_sent_ts = None
            logger.error("Slack API error", error=str(e), response=e.response)
            return False
        except Exception as e:
            self.last_sent_ts = None
            logger.error("Error sending Slack message", error=str(e))
            return False

    async def _add_reaction(self, message: CommonMessage) -> bool:
        """Teams에서 온 리액션을 Slack에 실제 이모지로 추가

        message.text 형식: ":emoji: by @username"
        message.thread_id: 리액션 대상 메시지의 원본 ts (thread_mapping 변환 후)
        """
        try:
            # 텍스트에서 이모지 이름 추출: ":+1: by @user" → "+1"
            text = message.text or ""
            if ":" in text:
                parts = text.split(":")
                emoji = parts[1] if len(parts) >= 2 else ""
            else:
                emoji = text.split(" ")[0]

            if not emoji:
                logger.warning(
                    "Could not extract emoji from reaction message", text=text
                )
                return await self._send_reaction_as_text(message)

            await self.app.client.reactions_add(
                channel=message.channel.id,
                name=emoji,
                timestamp=message.thread_id,
            )

            logger.info(
                "Slack reaction added via API",
                emoji=emoji,
                channel=message.channel.id,
                ts=message.thread_id,
            )
            return True

        except SlackApiError as e:
            error_msg = str(e.response.get("error", ""))
            if error_msg in ("already_reacted", "too_many_reactions"):
                logger.debug(
                    "Reaction already exists or limit reached", error=error_msg
                )
                return True
            logger.warning(
                "Failed to add reaction via API, falling back to text",
                error=error_msg,
            )
            return await self._send_reaction_as_text(message)
        except Exception as e:
            logger.warning("Failed to add reaction, falling back to text", error=str(e))
            return await self._send_reaction_as_text(message)

    async def _send_reaction_as_text(self, message: CommonMessage) -> bool:
        """리액션을 텍스트 메시지로 폴백 전송"""
        message.type = MessageType.TEXT
        slack_msg = self.transform_from_common(message)
        try:
            result = await self.app.client.chat_postMessage(**slack_msg)
            return result.get("ok", False)
        except Exception as e:
            logger.error("Failed to send reaction as text", error=str(e))
            return False

    async def receive_messages(self) -> AsyncIterator[CommonMessage]:
        """
        Slack 메시지를 Common Schema로 변환하여 수신

        Yields:
            CommonMessage: 변환된 메시지
        """
        logger.info("Starting Slack message receiver")

        try:
            while self.is_connected:
                try:
                    # 큐에서 메시지 가져오기 (타임아웃 1초)
                    message = await asyncio.wait_for(
                        self._message_queue.get(), timeout=1.0
                    )
                    yield message
                except asyncio.TimeoutError:
                    # 타임아웃은 정상 동작 (계속 루프)
                    continue

        except asyncio.CancelledError:
            logger.info("Slack message receiver cancelled")
        except Exception as e:
            logger.error("Error in Slack message receiver", error=str(e))

    async def _resolve_user_name(self, user_id: str) -> str:
        """DM 상대방의 표시 이름 조회 (캐시 포함)"""
        if not user_id:
            return "Unknown"

        cached = self._user_name_cache.get(user_id)
        if cached:
            return cached

        try:
            result = await self.app.client.users_info(user=user_id)
            if result.get("ok"):
                user = result.get("user", {})
                name = (
                    user.get("real_name")
                    or user.get("profile", {}).get("display_name")
                    or user.get("name", user_id)
                )
                self._user_name_cache[user_id] = name
                return name
        except Exception as e:
            logger.warning("Failed to resolve user name", user_id=user_id, error=str(e))

        return user_id

    async def get_channels(self) -> List[Channel]:
        """
        Slack 채널 및 DM/그룹DM 목록 조회 (페이지네이션 지원)

        DM/그룹DM 스코프(im:read, mpim:read)가 없으면
        채널만이라도 반환하는 graceful fallback 제공.

        Returns:
            Channel 객체 리스트 (채널, DM, 그룹DM 포함)
        """
        # 모든 타입으로 시도 → 실패 시 채널만 fallback
        conv_type_sets = [
            "public_channel,private_channel,im,mpim",
            "public_channel,private_channel",
        ]

        for conv_types in conv_type_sets:
            try:
                channels = await self._fetch_conversations(conv_types)
                if channels is not None:
                    return channels
            except SlackApiError as e:
                err = (
                    getattr(e.response, "data", {}).get("error", "")
                    if hasattr(e, "response")
                    else ""
                )
                if err == "missing_scope" and conv_types != conv_type_sets[-1]:
                    logger.warning(
                        "Slack missing scope for conversation types, falling back",
                        types=conv_types,
                        error=str(e),
                    )
                    continue
                logger.error(
                    "Slack API error getting channels",
                    error=str(e),
                    error_type=type(e).__name__,
                    error_response=getattr(e.response, "data", None)
                    if hasattr(e, "response")
                    else None,
                )
                return []
            except Exception as e:
                logger.error(
                    "Error getting Slack channels",
                    error=str(e) or repr(e),
                    error_type=type(e).__name__,
                )
                return []

        return []

    async def _fetch_conversations(self, conv_types: str) -> Optional[List[Channel]]:
        """지정된 conversation types로 채널 목록 조회"""
        channels: List[Channel] = []
        cursor = None

        while True:
            kwargs = {"types": conv_types, "limit": 200}
            if cursor:
                kwargs["cursor"] = cursor

            result = await self.app.client.conversations_list(**kwargs)

            if not result.get("ok"):
                logger.warning("Failed to get Slack channels", types=conv_types)
                return channels  # 빈 리스트라도 반환 (None이 아님)

            for slack_channel in result.get("channels", []):
                ch_id = slack_channel.get("id", "")

                # 대화 유형 판별
                if slack_channel.get("is_im"):
                    ch_type = ChannelType.DM
                    user_id = slack_channel.get("user", "")
                    name = await self._resolve_user_name(user_id)
                elif slack_channel.get("is_mpim"):
                    ch_type = ChannelType.GROUP_DM
                    name = slack_channel.get("name") or slack_channel.get(
                        "purpose", {}
                    ).get("value", ch_id)
                else:
                    ch_type = ChannelType.CHANNEL
                    name = slack_channel.get("name", "unknown")

                channels.append(
                    Channel(
                        id=ch_id,
                        name=name,
                        platform=Platform.SLACK,
                        type=ch_type,
                    )
                )

            # 다음 페이지 확인
            response_metadata = result.get("response_metadata", {})
            next_cursor = response_metadata.get("next_cursor")
            if not next_cursor:
                break
            cursor = next_cursor

        logger.info("Retrieved Slack channels", count=len(channels), types=conv_types)
        return channels

    async def get_users(self) -> List[User]:
        """
        Slack 사용자 목록 조회

        Returns:
            User 객체 리스트
        """
        try:
            result = await self.app.client.users_list()

            if not result.get("ok"):
                logger.warning("Failed to get Slack users")
                return []

            users = []
            for slack_user in result.get("members", []):
                # 봇 제외
                if slack_user.get("is_bot"):
                    continue

                user = User(
                    id=slack_user.get("id", ""),
                    username=slack_user.get("name", "unknown"),
                    display_name=slack_user.get("real_name", "unknown"),
                    platform=Platform.SLACK,
                    avatar_url=slack_user.get("profile", {}).get("image_72"),
                )
                users.append(user)

            logger.info("Retrieved Slack users", count=len(users))

            return users

        except SlackApiError as e:
            logger.error("Slack API error getting users", error=str(e))
            return []
        except Exception as e:
            logger.error("Error getting Slack users", error=str(e))
            return []

    def transform_to_common(self, raw_message: Dict[str, Any]) -> CommonMessage:
        """
        Slack 메시지 → Common Schema 변환

        Args:
            raw_message: Slack 메시지 이벤트

        Returns:
            CommonMessage: 변환된 메시지
        """
        # 사용자 정보
        user_id = raw_message.get("user", "unknown")
        profile = raw_message.get("user_profile", {})
        user = User(
            id=user_id,
            username=raw_message.get("username", user_id),
            display_name=profile.get("display_name")
            or profile.get("real_name")
            or user_id,
            platform=Platform.SLACK,
            avatar_url=profile.get("image_72"),
        )

        # 채널 정보 (이름: 이벤트 페이로드 → 캐시 → channel_id 순으로 사용)
        channel_id = raw_message.get("channel", "unknown")
        channel_name = (
            raw_message.get("channel_name")
            or self._channel_name_cache.get(channel_id)
            or channel_id
        )

        # 대화 유형 판별 (채널 ID prefix 기반)
        if channel_id.startswith("D"):
            ch_type = ChannelType.DM
        elif channel_id.startswith("G"):
            ch_type = ChannelType.GROUP_DM
        else:
            ch_type = ChannelType.CHANNEL

        channel = Channel(
            id=channel_id,
            name=channel_name,
            platform=Platform.SLACK,
            type=ch_type,
        )

        # 메시지 타입 판별
        message_type = MessageType.TEXT
        if raw_message.get("files"):
            first_file = raw_message["files"][0]
            if first_file.get("mimetype", "").startswith("image/"):
                message_type = MessageType.IMAGE
            else:
                message_type = MessageType.FILE

        # 첨부파일 변환
        attachments = []
        for file_data in raw_message.get("files", []):
            attachment = Attachment(
                id=file_data.get("id", ""),
                name=file_data.get("name", "unknown"),
                mime_type=file_data.get("mimetype", "application/octet-stream"),
                size=file_data.get("size", 0),
                url=file_data.get("url_private", ""),
            )
            attachments.append(attachment)

        # 리액션 변환
        reactions = []
        for reaction in raw_message.get("reactions", []):
            reactions.append(reaction.get("name", ""))

        # 타임스탬프 변환
        ts = raw_message.get("ts", "0")
        timestamp = datetime.fromtimestamp(float(ts), tz=timezone.utc)

        # CommonMessage 생성
        return CommonMessage(
            message_id=ts,
            timestamp=timestamp,
            type=message_type,
            platform=Platform.SLACK,
            user=user,
            channel=channel,
            text=raw_message.get("text", ""),
            attachments=attachments,
            reactions=reactions,
            thread_id=raw_message.get("thread_ts"),
            parent_id=raw_message.get("parent_user_id"),
            raw_message=raw_message,
        )

    def transform_from_common(self, message: CommonMessage) -> Dict[str, Any]:
        """
        Common Schema → Slack 메시지 변환

        Args:
            message: CommonMessage 스키마 메시지

        Returns:
            Slack 메시지 딕셔너리
        """
        # 메시지 텍스트 변환 (Teams → Slack Markdown)
        text = message.text or ""
        if message.platform == Platform.TEAMS:
            # Teams Markdown → Slack Markdown 변환
            text = convert_teams_to_slack_markdown(text)

        slack_msg: Dict[str, Any] = {
            "channel": message.channel.id,
            "text": text,
        }

        # 메시지 모드에 따라 발신자 정보 처리
        if self.message_mode == "sender_info":
            # 모드 1: username/icon_url 사용 (발신자 정보 표시, 편집/삭제 불가)
            if message.user:
                # display_name 또는 username 사용
                display_name = message.user.display_name or message.user.username
                slack_msg["username"] = display_name

                # 프로필 이미지 사용
                if message.user.avatar_url:
                    slack_msg["icon_url"] = message.user.avatar_url
                else:
                    # 기본 이미지가 없으면 이모지 사용
                    slack_msg["icon_emoji"] = ":speech_balloon:"

        elif self.message_mode == "editable":
            # 모드 2: username/icon_url 미사용 (편집/삭제 가능, 발신자 정보는 prefix로)
            if message.user:
                display_name = message.user.display_name or message.user.username
                source_platform = message.platform.value.upper()
                # 발신자 정보를 메시지 앞에 추가
                slack_msg[
                    "text"
                ] = f"**[{source_platform}] {display_name}**\n{slack_msg['text']}"

        # 스레드 지원
        if message.thread_id:
            slack_msg["thread_ts"] = message.thread_id

        # 첨부파일 지원 (Slack Block Kit으로 변환)
        # files.upload로 이미 업로드된 첨부파일은 블록 불필요 (Slack이 자동 표시)
        if message.attachments:
            blocks = []
            for att in message.attachments:
                # 이미 Slack에 업로드된 파일은 블록 생략
                if att.delivered_url:
                    continue
                if att.mime_type.startswith("image/"):
                    # 이미지 블록 — 공개 접근 가능한 URL만 사용
                    img_url = att.url
                    if "graph.microsoft.com" in img_url:
                        continue  # Graph API URL은 Slack이 접근 불가
                    blocks.append(
                        {
                            "type": "image",
                            "image_url": img_url,
                            "alt_text": att.name,
                        }
                    )
                else:
                    # 파일 정보 블록
                    file_url = att.delivered_url or att.url
                    blocks.append(
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": f"📎 *{att.name}*\n<{file_url}|다운로드>",
                            },
                        }
                    )
            if blocks:
                slack_msg["blocks"] = blocks

        return slack_msg
