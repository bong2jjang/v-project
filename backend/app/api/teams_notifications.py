"""Graph API Change Notifications 수신 엔드포인트

Teams 채널 메시지를 Graph API Subscription으로 수신합니다.
Bot Framework 없이 Teams → Slack 방향 메시지 브리지를 구현합니다.

Flow:
1. SubscriptionManager가 Teams 채널에 대해 구독 생성 (created,updated,deleted)
2. Graph API가 메시지 생성/수정/삭제 시 이 엔드포인트로 POST
3. changeType별 분기 처리:
   - created: 메시지 조회 → CommonMessage → 큐
   - updated: 메시지 재조회 → 편집/리액션 판별 → 큐
   - deleted: 삭제 알림 메시지 생성 → 큐
4. WebSocketBridge가 라우팅 처리
"""

import re
from datetime import datetime, timezone

import aiohttp
import structlog
from fastapi import APIRouter, Request, Response
from fastapi.responses import PlainTextResponse

from app.schemas.common_message import (
    Channel,
    ChannelType,
    CommonMessage,
    MessageType,
    Platform,
    User,
)
from app.services.websocket_bridge import get_bridge

logger = structlog.get_logger()

router = APIRouter(prefix="/api/teams", tags=["teams-notifications"])

# 중복 알림 방지용 최근 처리된 알림 ID 캐시
_processed_notifications: set[str] = set()

# 삭제 시 원본 텍스트 표시를 위한 메시지 캐시 {message_id: (text, user_name)}
_message_cache: dict[str, tuple[str, str]] = {}

# Graph API 사용자 displayName 캐시 {user_id: display_name}
_user_display_name_cache: dict[str, str] = {}


async def _resolve_user_display_name(user_id: str, teams_provider) -> str:
    """Graph API를 통해 사용자 displayName 조회 (캐시 포함)"""
    if user_id in _user_display_name_cache:
        return _user_display_name_cache[user_id]

    try:
        token = await teams_provider._get_access_token()
        url = f"{teams_provider.graph_base_url}/users/{user_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        session = teams_provider.session
        should_close = False
        if not session:
            session = aiohttp.ClientSession()
            should_close = True

        try:
            async with session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    display_name = data.get("displayName", user_id)
                    _user_display_name_cache[user_id] = display_name

                    # 캐시 크기 제한
                    if len(_user_display_name_cache) > 200:
                        oldest = next(iter(_user_display_name_cache))
                        del _user_display_name_cache[oldest]

                    return display_name
                else:
                    logger.warning(
                        "Failed to resolve user displayName",
                        user_id=user_id,
                        status=resp.status,
                    )
                    return user_id
        finally:
            if should_close:
                await session.close()

    except Exception as e:
        logger.warning(
            "Error resolving user displayName",
            user_id=user_id,
            error=str(e),
        )
        return user_id


@router.post("/notifications")
async def receive_notification(request: Request):
    """Graph API Change Notification 수신

    두 가지 요청을 처리합니다:
    1. Validation: Graph API가 구독 생성 시 validationToken을 보냄 → 그대로 반환
    2. Notification: 메시지 생성/수정/삭제 알림 → 처리 후 브리지로 전달
    """
    # 1. Subscription Validation (구독 생성/갱신 시)
    validation_token = request.query_params.get("validationToken")
    if validation_token:
        logger.info("Graph API subscription validation received")
        return PlainTextResponse(content=validation_token, status_code=200)

    # 2. Notification 처리
    try:
        body = await request.json()
    except Exception:
        logger.warning("Invalid notification body")
        return Response(status_code=400)

    notifications = body.get("value", [])
    if not notifications:
        return Response(status_code=202)

    bridge = get_bridge()
    if not bridge:
        logger.warning("Bridge not initialized, ignoring notification")
        return Response(status_code=202)

    teams_provider = bridge.providers.get("teams")
    if not teams_provider:
        logger.warning("Teams provider not registered, ignoring notification")
        return Response(status_code=202)

    for notification in notifications:
        try:
            await _process_notification(notification, teams_provider)
        except Exception as e:
            logger.error(
                "Error processing notification",
                error=str(e),
                resource=notification.get("resource", ""),
            )

    # Graph API는 202 Accepted를 기대 (30초 내 응답 필수)
    return Response(status_code=202)


async def _process_notification(notification: dict, teams_provider) -> None:
    """개별 알림을 changeType별로 분기 처리"""
    change_type = notification.get("changeType")
    resource = notification.get("resource", "")
    resource_data = notification.get("resourceData", {})
    message_id = resource_data.get("id")

    if not resource:
        logger.debug("Notification missing resource, skipping")
        return

    team_id, channel_id = _parse_resource(resource)
    if not channel_id:
        logger.warning("Could not parse resource", resource=resource)
        return

    if change_type == "created":
        await _process_created(team_id, channel_id, message_id, teams_provider)
    elif change_type == "updated":
        await _process_updated(team_id, channel_id, message_id, teams_provider)
    elif change_type == "deleted":
        await _process_deleted(team_id, channel_id, message_id, teams_provider)
    else:
        logger.debug("Ignoring unknown changeType", change_type=change_type)


# ---------------------------------------------------------------------------
# changeType: created — 새 메시지
# ---------------------------------------------------------------------------


def _make_conv_id(team_id: str | None, channel_id: str) -> str:
    """Redis route key와 일치하는 대화 ID 생성

    팀 채널: "{team_id}:{channel_id}"
    채팅(DM): "chat:{channel_id}"
    """
    if team_id is None:
        return f"chat:{channel_id}"
    return f"{team_id}:{channel_id}"


async def _process_created(
    team_id: str | None,
    channel_id: str,
    message_id: str | None,
    teams_provider,
) -> None:
    """새 메시지 알림 처리: Graph API에서 전체 메시지를 조회하여 큐에 삽입"""
    if not message_id:
        logger.debug("Created notification missing message_id, skipping")
        return

    # 중복 알림 방지
    dedup_key = f"created:{message_id}"
    if dedup_key in _processed_notifications:
        logger.debug("Duplicate notification skipped", message_id=message_id)
        return
    _processed_notifications.add(dedup_key)
    # 메모리 누수 방지
    if len(_processed_notifications) > 200:
        _processed_notifications.clear()

    # 봇이 보낸 메시지 에코 방지 (Delegated Auth로 보낸 메시지)
    if message_id in teams_provider._sent_message_ids:
        logger.debug(
            "Ignoring bot-sent message from Graph notification",
            message_id=message_id,
        )
        teams_provider._sent_message_ids.discard(message_id)
        return

    msg_data = await _fetch_message(team_id, channel_id, message_id, teams_provider)
    if not msg_data:
        return

    if _is_bot_self_message(msg_data, teams_provider):
        return

    activity_dict = _graph_message_to_activity_dict(msg_data, team_id, channel_id)

    # 채널 이름 resolve: 캐시 → Graph API 조회
    conv_id = activity_dict.get("conversation", {}).get("id", "")
    cached_name = teams_provider._channel_name_cache.get(conv_id)
    if not cached_name:
        cached_name = await teams_provider._resolve_channel_name(conv_id)
    if cached_name:
        activity_dict["channelName"] = cached_name

    common_msg = teams_provider.transform_to_common(activity_dict)

    # 삭제 시 원본 텍스트 표시를 위해 캐싱
    _cache_message(message_id, common_msg.text, common_msg.user.display_name)

    await teams_provider._message_queue.put(common_msg)

    logger.info(
        "Teams message queued from Graph notification",
        change_type="created",
        message_id=common_msg.message_id,
        user=common_msg.user.username,
        channel=channel_id[:30],
    )


# ---------------------------------------------------------------------------
# changeType: updated — 메시지 수정 또는 리액션 변경
# ---------------------------------------------------------------------------


async def _process_updated(
    team_id: str | None,
    channel_id: str,
    message_id: str | None,
    teams_provider,
) -> None:
    """메시지 수정 알림 처리

    Graph API updated 알림은 텍스트 편집과 리액션 변경 모두에 발생합니다.
    메시지를 재조회하여 변경 유형을 판별합니다:
    - lastModifiedDateTime != createdDateTime + 텍스트 변경 → 편집 알림
    - reactions 필드 존재 → 리액션 처리 (Phase 3)
    """
    if not message_id:
        logger.debug("Updated notification missing message_id, skipping")
        return

    # 봇이 보낸 메시지의 updated 알림 무시
    if message_id in teams_provider._sent_message_ids:
        logger.debug(
            "Ignoring updated notification for bot-sent message", message_id=message_id
        )
        return

    msg_data = await _fetch_message(team_id, channel_id, message_id, teams_provider)
    if not msg_data:
        return

    if _is_bot_self_message(msg_data, teams_provider):
        return

    # 리액션 변경인지 텍스트 편집인지 판별
    # Graph API 메시지에 lastEditedDateTime이 있으면 텍스트가 편집된 것
    last_edited = msg_data.get("lastEditedDateTime")

    if last_edited:
        # 중복 편집 알림 방지 (같은 편집 시각은 무시, 다른 편집은 허용)
        edit_dedup_key = f"edit:{message_id}:{last_edited}"
        if edit_dedup_key in _processed_notifications:
            logger.debug("Duplicate edit notification skipped", message_id=message_id)
            return
        _processed_notifications.add(edit_dedup_key)
        if len(_processed_notifications) > 200:
            _processed_notifications.clear()

        # 텍스트 편집 → 편집 알림 메시지 생성
        activity_dict = _graph_message_to_activity_dict(msg_data, team_id, channel_id)
        conv_id = activity_dict.get("conversation", {}).get("id", "")
        cached_name = teams_provider._channel_name_cache.get(conv_id)
        if not cached_name:
            cached_name = await teams_provider._resolve_channel_name(conv_id)
        if cached_name:
            activity_dict["channelName"] = cached_name
        common_msg = teams_provider.transform_to_common(activity_dict)
        common_msg.is_edited = True
        common_msg.text = f"{common_msg.text} _(edited)_"
        await teams_provider._message_queue.put(common_msg)

        logger.info(
            "Teams edited message queued",
            message_id=common_msg.message_id,
            user=common_msg.user.username,
            channel=channel_id[:30],
        )
        return

    # 리액션 변경 처리
    reactions = msg_data.get("reactions", [])
    if reactions:
        await _process_reactions(
            msg_data, reactions, team_id, channel_id, teams_provider
        )


async def _process_reactions(
    msg_data: dict,
    reactions: list[dict],
    team_id: str | None,
    channel_id: str,
    teams_provider,
) -> None:
    """리액션 변경 감지 및 CommonMessage 생성

    Teams 리액션 형식:
    {"reactionType": "like", "createdDateTime": "...", "user": {"id": "..."}}
    """
    from app.utils.emoji_mapper import TEAMS_EMOJI_CHAR_TO_SLACK, TEAMS_TO_SLACK_EMOJI

    conv_id = _make_conv_id(team_id, channel_id)
    is_chat = team_id is None
    parent_message_id = msg_data.get("id", "unknown")

    for reaction in reactions:
        reaction_type = reaction.get("reactionType", "")

        # Graph API 리액션의 user 구조: {user: {application, device, user: {id, displayName}}}
        identity_set = reaction.get("user", {})
        user_identity = identity_set.get("user", {}) or {}
        user_id = user_identity.get("id", "unknown")
        display_name = user_identity.get("displayName") or ""

        # displayName이 없으면 Graph API로 조회
        if not display_name and user_id != "unknown":
            display_name = await _resolve_user_display_name(user_id, teams_provider)
        elif not display_name:
            display_name = user_id

        # Slack 이모지로 매핑 (reactionType이 문자열 또는 이모지 문자)
        slack_emoji = (
            TEAMS_TO_SLACK_EMOJI.get(reaction_type)
            or TEAMS_EMOJI_CHAR_TO_SLACK.get(reaction_type)
            or reaction_type
        )

        # 봇 자신의 리액션 무시
        if user_id == teams_provider.bot_app_id:
            continue

        # 중복 리액션 알림 방지
        reaction_dedup_key = f"reaction:{parent_message_id}:{reaction_type}:{user_id}"
        if reaction_dedup_key in _processed_notifications:
            continue
        _processed_notifications.add(reaction_dedup_key)
        if len(_processed_notifications) > 200:
            _processed_notifications.clear()

        channel = Channel(
            id=conv_id,
            name=conv_id,
            platform=Platform.TEAMS,
            type=ChannelType.DM if is_chat else ChannelType.CHANNEL,
        )

        user = User(
            id=user_id,
            username=display_name,
            display_name=display_name,
            platform=Platform.TEAMS,
        )

        common_msg = CommonMessage(
            message_id=f"{parent_message_id}_reaction_{reaction_type}",
            timestamp=datetime.now(timezone.utc),
            type=MessageType.REACTION,
            platform=Platform.TEAMS,
            user=user,
            channel=channel,
            text=f":{slack_emoji}: by @{display_name}",
            thread_id=parent_message_id,
        )

        await teams_provider._message_queue.put(common_msg)

        logger.info(
            "Teams reaction queued",
            reaction=reaction_type,
            user=display_name,
            message_id=parent_message_id,
        )


# ---------------------------------------------------------------------------
# changeType: deleted — 메시지 삭제
# ---------------------------------------------------------------------------


async def _process_deleted(
    team_id: str | None,
    channel_id: str,
    message_id: str | None,
    teams_provider,
) -> None:
    """메시지 삭제 알림 처리

    삭제된 메시지는 Graph API로 조회 불가하므로 캐시된 원본 텍스트를 사용하여
    취소선으로 표시합니다. 캐시에 없으면 일반 삭제 알림을 보냅니다.
    """
    if not message_id:
        logger.debug("Deleted notification missing message_id, skipping")
        return

    conv_id = _make_conv_id(team_id, channel_id)
    is_chat = team_id is None

    # 캐시에서 원본 메시지 조회
    cached = _message_cache.pop(message_id, None)

    if cached:
        original_text, user_name = cached
        delete_text = f"~{original_text}~ _(deleted)_"
        user_display = user_name
    else:
        delete_text = "~메시지가 삭제되었습니다~ _(deleted)_"
        user_display = "System"

    channel = Channel(
        id=conv_id,
        name=conv_id,
        platform=Platform.TEAMS,
        type=ChannelType.DM if is_chat else ChannelType.CHANNEL,
    )

    user = User(
        id="system",
        username=user_display,
        display_name=user_display,
        platform=Platform.TEAMS,
    )

    common_msg = CommonMessage(
        message_id=f"{message_id}_deleted",
        timestamp=datetime.now(timezone.utc),
        type=MessageType.SYSTEM,
        platform=Platform.TEAMS,
        user=user,
        channel=channel,
        text=delete_text,
    )

    await teams_provider._message_queue.put(common_msg)

    logger.info(
        "Teams deleted message notification queued",
        original_message_id=message_id,
        channel=channel_id[:30],
    )


# ---------------------------------------------------------------------------
# 공통 유틸
# ---------------------------------------------------------------------------

_MAX_CACHE_SIZE = 500


def _html_to_markdown(html: str) -> str:
    """Teams HTML 메시지를 Markdown으로 변환 (서식 보존)

    Teams Graph API는 body.contentType="html"로 메시지를 반환합니다.
    단순 태그 제거 대신 Markdown으로 변환하여 서식을 보존합니다.
    """
    text = html

    # <br>, <br/> → 줄바꿈
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)

    # <b>, <strong> → **bold**
    text = re.sub(
        r"<(?:b|strong)>(.*?)</(?:b|strong)>", r"**\1**", text, flags=re.IGNORECASE
    )

    # <i>, <em> → _italic_
    text = re.sub(r"<(?:i|em)>(.*?)</(?:i|em)>", r"_\1_", text, flags=re.IGNORECASE)

    # <strike>, <s>, <del> → ~strikethrough~
    text = re.sub(
        r"<(?:strike|s|del)>(.*?)</(?:strike|s|del)>",
        r"~\1~",
        text,
        flags=re.IGNORECASE,
    )

    # <code> → `code`
    text = re.sub(r"<code>(.*?)</code>", r"`\1`", text, flags=re.IGNORECASE)

    # <pre> → ```code block```
    text = re.sub(
        r"<pre>(.*?)</pre>", r"```\1```", text, flags=re.IGNORECASE | re.DOTALL
    )

    # <a href="url">text</a> → text (url)
    text = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r"\2 (\1)", text)

    # <p> → 줄바꿈
    text = re.sub(r"<p[^>]*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n", text, flags=re.IGNORECASE)

    # 나머지 HTML 태그 제거
    text = re.sub(r"<[^>]+>", "", text)

    # HTML 엔티티
    text = text.replace("&amp;", "&")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = text.replace("&nbsp;", " ")
    text = text.replace("&quot;", '"')

    # 불필요한 공백/줄바꿈 정리
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def _cache_message(message_id: str, text: str, user_name: str) -> None:
    """삭제 알림 시 원본 텍스트 표시를 위해 메시지 캐싱"""
    _message_cache[message_id] = (text, user_name)
    if len(_message_cache) > _MAX_CACHE_SIZE:
        # 가장 오래된 항목 절반 제거
        keys = list(_message_cache.keys())
        for k in keys[: _MAX_CACHE_SIZE // 2]:
            _message_cache.pop(k, None)


async def _fetch_message(
    team_id: str | None,
    channel_id: str,
    message_id: str,
    teams_provider,
) -> dict | None:
    """Graph API로 메시지 전체 조회 (공통 유틸)"""
    try:
        token = await teams_provider._get_access_token()
    except Exception as e:
        logger.error("Failed to get access token for message fetch", error=str(e))
        return None

    if team_id is None:
        url = (
            f"https://graph.microsoft.com/v1.0"
            f"/chats/{channel_id}/messages/{message_id}"
        )
    else:
        url = (
            f"https://graph.microsoft.com/v1.0"
            f"/teams/{team_id}/channels/{channel_id}/messages/{message_id}"
        )
    headers = {"Authorization": f"Bearer {token}"}

    try:
        if not teams_provider.session:
            teams_provider.session = aiohttp.ClientSession()

        async with teams_provider.session.get(
            url, headers=headers, timeout=aiohttp.ClientTimeout(total=5)
        ) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                logger.warning(
                    "Failed to fetch message from Graph API",
                    status=resp.status,
                    error=error_text[:200],
                )
                return None

            return await resp.json()
    except Exception as e:
        logger.error("Error fetching message from Graph API", error=str(e))
        return None


def _is_bot_self_message(msg_data: dict, teams_provider) -> bool:
    """봇 자신의 메시지인지 확인 (무한 루프 방지)"""
    from_data = msg_data.get("from", {})
    app_info = from_data.get("application")
    if app_info and app_info.get("id") == teams_provider.bot_app_id:
        logger.debug("Ignoring bot self-message from Graph notification")
        return True
    return False


def _parse_resource(resource: str) -> tuple[str | None, str | None]:
    """Graph API resource 문자열에서 teamId, channelId 추출

    팀 채널: "teams('abc-123')/channels('19:xxx@thread.tacv2')/messages('1234')"
    채팅(DM): "chats('19:xxx@thread.v2')/messages('1234')"

    Returns:
        (team_id, channel_id) — team_id는 채팅인 경우 None
    """
    # 팀 채널 형식
    team_match = re.search(r"teams\('([^']+)'\)", resource)
    channel_match = re.search(r"channels\('([^']+)'\)", resource)

    if channel_match:
        team_id = team_match.group(1) if team_match else None
        return team_id, channel_match.group(1)

    # 채팅(DM/그룹) 형식
    chat_match = re.search(r"chats\('([^']+)'\)", resource)
    if chat_match:
        return None, chat_match.group(1)

    return None, None


def _graph_message_to_activity_dict(
    msg_data: dict, team_id: str | None, channel_id: str
) -> dict:
    """Graph API 메시지 응답 → transform_to_common() 호환 딕셔너리

    Graph API 메시지 형식과 Bot Framework Activity 형식의 차이를 맞춥니다.
    """
    from_data = msg_data.get("from", {})
    user_info = from_data.get("user") or {}
    app_info = from_data.get("application") or {}

    sender_id = user_info.get("id") or app_info.get("id") or "unknown"
    sender_name = (
        user_info.get("displayName") or app_info.get("displayName") or sender_id
    )

    # body에서 텍스트 추출
    body = msg_data.get("body", {})
    content = body.get("content", "")
    content_type = body.get("contentType", "text")

    # HTML인 경우 Markdown으로 변환 (서식 보존)
    if content_type == "html":
        content = _html_to_markdown(content)

    # 첨부파일
    attachments = []
    for att in msg_data.get("attachments", []):
        if att.get("contentUrl"):
            attachments.append(
                {
                    "id": att.get("id", ""),
                    "name": att.get("name", "unknown"),
                    "contentType": att.get("contentType", "application/octet-stream"),
                    "contentUrl": att.get("contentUrl", ""),
                }
            )

    # 인라인 이미지 (hostedContents) — body HTML의 <img> 태그에서 추출
    body_raw = msg_data.get("body", {})
    body_content_raw = body_raw.get("content", "")
    if body_raw.get("contentType") == "html" and "hostedContents" in body_content_raw:
        msg_id = msg_data.get("id", "")
        if team_id is None:
            graph_base = (
                f"https://graph.microsoft.com/v1.0"
                f"/chats/{channel_id}/messages/{msg_id}"
            )
        else:
            graph_base = (
                f"https://graph.microsoft.com/v1.0"
                f"/teams/{team_id}/channels/{channel_id}/messages/{msg_id}"
            )
        img_pattern = re.compile(
            r'<img\s[^>]*src="([^"]*hostedContents[^"]*)"[^>]*>',
            re.IGNORECASE,
        )
        for i, match in enumerate(img_pattern.finditer(body_content_raw)):
            raw_url = match.group(1)
            # 상대 URL을 절대 URL로 변환
            if raw_url.startswith("http"):
                img_url = raw_url
            else:
                # "../hostedContents/{id}/$value" → 절대 URL
                hc_match = re.search(r"hostedContents/([^/]+)/\$value", raw_url)
                if hc_match:
                    hc_id = hc_match.group(1)
                    img_url = f"{graph_base}/hostedContents/{hc_id}/$value"
                else:
                    img_url = raw_url
            attachments.append(
                {
                    "id": f"hosted_{i}",
                    "name": f"image_{i}.png",
                    "contentType": "image/png",
                    "contentUrl": img_url,
                }
            )

    return {
        "id": msg_data.get("id", "unknown"),
        "timestamp": msg_data.get("createdDateTime"),
        "type": "message",
        "text": content,
        "from": {
            "id": sender_id,
            "name": sender_name,
        },
        "channelId": "msteams",
        "conversation": {
            # Bot Framework activity 형식 유지: transform_to_common이 "chat:" 접두사 추가
            "id": f"{team_id}:{channel_id}" if team_id else channel_id,
            "isGroup": team_id is not None,
            "name": None,
        },
        "attachments": attachments,
        "replyToId": msg_data.get("replyToId"),
    }
