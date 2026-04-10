"""Feature Checker 서비스

플랫폼별 봇 권한을 실제 API 호출로 검증합니다.
"""

import logging
from typing import Optional

from app.schemas.feature_catalog import (
    FEATURE_CATALOG,
    FeaturePermissionStatus,
    PermissionStatus,
)

logger = logging.getLogger(__name__)


class SlackFeatureChecker:
    """Slack 봇의 기능별 권한 검증

    `auth.test` 응답 헤더의 `x-oauth-scopes`로 실제 부여된 스코프를 파악하고
    각 Feature에 필요한 스코프 보유 여부를 반환합니다.
    """

    def __init__(self, client):
        """
        Args:
            client: slack_sdk.WebClient 인스턴스
        """
        self._client = client

    async def get_raw_scopes(self) -> set[str]:
        """auth.test 호출로 실제 부여된 OAuth 스코프 집합 반환"""
        try:
            response = self._client.auth_test()
            # x-oauth-scopes 헤더에 콤마 구분으로 부여된 스코프 목록이 있음
            scopes_header: str = ""
            if hasattr(response, "headers") and response.headers:
                scopes_header = response.headers.get("x-oauth-scopes", "")

            raw = {s.strip() for s in scopes_header.split(",") if s.strip()}

            # 헤더 파싱 실패 시 API 프로빙으로 fallback
            if not raw:
                raw = await self._probe_scopes()

            return raw
        except Exception as e:
            logger.warning("Failed to get Slack raw scopes via auth.test: %s", e)
            return await self._probe_scopes()

    async def _probe_scopes(self) -> set[str]:
        """API 실제 호출로 스코프 추론 (헤더 미지원 시 fallback)"""
        from slack_sdk.errors import SlackApiError

        confirmed: set[str] = set()

        # chat:write — xoxb- token이면 있다고 간주
        if self._client.token and self._client.token.startswith("xoxb-"):
            confirmed.add("chat:write")

        probes: list[tuple[str, callable]] = [
            (
                "channels:read",
                lambda: self._client.conversations_list(
                    types="public_channel", limit=1
                ),
            ),
            (
                "groups:read",
                lambda: self._client.conversations_list(
                    types="private_channel", limit=1
                ),
            ),
            (
                "im:read",
                lambda: self._client.conversations_list(types="im", limit=1),
            ),
            (
                "mpim:read",
                lambda: self._client.conversations_list(types="mpim", limit=1),
            ),
            (
                "channels:history",
                lambda: self._client.conversations_history(channel="DUMMY", limit=1),
            ),
            ("users:read", lambda: self._client.users_list(limit=1)),
            ("files:read", lambda: self._client.files_list(count=1)),
            (
                "reactions:read",
                lambda: self._client.reactions_get(channel="DUMMY", timestamp="0"),
            ),
        ]

        for scope, call in probes:
            try:
                result = call()
                if result.get("ok"):
                    confirmed.add(scope)
            except SlackApiError as e:
                err = e.response.get("error", "")
                # missing_scope가 아닌 다른 에러(channel_not_found 등)면 권한은 있는 것
                if err != "missing_scope" and err != "invalid_auth":
                    confirmed.add(scope)
            except Exception:
                pass

        return confirmed

    def check_features(
        self, raw_scopes: set[str], platform: str = "slack"
    ) -> list[FeaturePermissionStatus]:
        """Feature 카탈로그를 기준으로 각 기능의 권한 상태 반환"""
        results: list[FeaturePermissionStatus] = []

        for feature in FEATURE_CATALOG:
            support = feature["platform_support"].get(platform)
            if not support:
                continue

            if not support.get("supported", False):
                results.append(
                    FeaturePermissionStatus(
                        feature_id=feature["id"],
                        feature_name=feature["name"],
                        category=feature["category"],
                        status="not_applicable",
                        note=support.get("reason"),
                    )
                )
                continue

            required: list[str] = support.get("required_scopes", [])
            if not required:
                # 스코프 불필요 → granted
                results.append(
                    FeaturePermissionStatus(
                        feature_id=feature["id"],
                        feature_name=feature["name"],
                        category=feature["category"],
                        status="granted",
                    )
                )
                continue

            missing = [s for s in required if s not in raw_scopes]
            status: PermissionStatus
            if not missing:
                status = "granted"
            elif len(missing) < len(required):
                status = "partial"
            else:
                status = "missing"

            note = None
            if missing:
                note = f"Slack App OAuth 설정에서 추가 필요: {', '.join(missing)}"

            results.append(
                FeaturePermissionStatus(
                    feature_id=feature["id"],
                    feature_name=feature["name"],
                    category=feature["category"],
                    status=status,
                    missing_scopes=missing,
                    note=note,
                )
            )

        return results


class TeamsFeatureChecker:
    """Teams 봇의 기능별 권한 검증

    Microsoft Graph API 소규모 호출로 각 Permission 보유 여부를 확인합니다.
    team_id가 없으면 URL 생성이 불가한 항목은 "unknown"으로 처리합니다.
    """

    GRAPH_BASE = "https://graph.microsoft.com/v1.0"

    def __init__(self, access_token: str, team_id: Optional[str] = None):
        """
        Args:
            access_token: Graph API 액세스 토큰
            team_id: Teams Team ID (없으면 채널 관련 검증 생략)
        """
        self._token = access_token
        self._team_id = team_id

    async def check_features(
        self, platform: str = "teams"
    ) -> list[FeaturePermissionStatus]:
        """Feature 카탈로그를 기준으로 각 기능의 권한 상태 반환"""
        import aiohttp

        results: list[FeaturePermissionStatus] = []

        async with aiohttp.ClientSession() as session:
            for feature in FEATURE_CATALOG:
                support = feature["platform_support"].get(platform)
                if not support:
                    continue

                if not support.get("supported", False):
                    results.append(
                        FeaturePermissionStatus(
                            feature_id=feature["id"],
                            feature_name=feature["name"],
                            category=feature["category"],
                            status="not_applicable",
                            note=support.get("reason"),
                        )
                    )
                    continue

                status, note = await self._probe_feature(
                    session, feature["id"], support
                )
                missing = (
                    support.get("required_permissions", [])
                    if status == "missing"
                    else []
                )

                results.append(
                    FeaturePermissionStatus(
                        feature_id=feature["id"],
                        feature_name=feature["name"],
                        category=feature["category"],
                        status=status,
                        missing_scopes=missing,
                        note=note,
                    )
                )

        return results

    async def _probe_feature(
        self, session, feature_id: str, support: dict
    ) -> tuple[PermissionStatus, Optional[str]]:
        """기능별로 적절한 Graph API를 호출하여 권한 확인"""
        import aiohttp

        headers = {"Authorization": f"Bearer {self._token}"}

        # team_id가 없으면 채널/메시지 관련 기능은 unknown
        if not self._team_id:
            if feature_id in (
                "send_message",
                "receive_message",
                "send_file",
                "receive_file",
                "forward_reaction",
                "forward_edit",
                "forward_delete",
                "thread_reply",
                "list_channels",
            ):
                return "unknown", "team_id 미설정 — 계정에 Team ID 설정 필요"

        try:
            # receive_message는 ChannelMessage.Read.All을 직접 검증
            if feature_id == "receive_message":
                return await self._probe_receive_message(session, headers, support)

            url = self._probe_url(feature_id)
            if not url:
                # list_conversations는 delegated auth 필요 — 별도 안내
                if feature_id == "list_conversations":
                    return (
                        "not_applicable",
                        "Microsoft 계정 연결 필요 (Provider 설정에서 연결)",
                    )
                return "unknown", None

            async with session.get(
                url, headers=headers, timeout=aiohttp.ClientTimeout(total=8)
            ) as resp:
                if resp.status in (200, 201):
                    return "granted", None
                elif resp.status == 403:
                    perms = support.get("required_permissions", [])
                    note = (
                        f"Azure App에서 권한 추가 필요: {', '.join(perms)}"
                        if perms
                        else None
                    )
                    return "missing", note
                elif resp.status == 401:
                    return "missing", "인증 실패 — 토큰/자격증명 확인 필요"
                else:
                    return "unknown", f"HTTP {resp.status}"
        except Exception as e:
            logger.warning("Teams feature probe failed for %s: %s", feature_id, e)
            return "unknown", None

    async def _probe_receive_message(
        self, session, headers: dict, support: dict
    ) -> tuple[PermissionStatus, Optional[str]]:
        """receive_message 전용 프로브 — 채널 메시지 읽기 권한(ChannelMessage.Read.All) 직접 검증

        1단계: 채널 목록 조회로 첫 번째 채널 ID 획득
        2단계: 해당 채널의 메시지를 읽어 ChannelMessage.Read.All 권한 확인
        """
        import aiohttp

        tid = self._team_id
        base = self.GRAPH_BASE
        timeout = aiohttp.ClientTimeout(total=8)

        # 1단계: 채널 목록에서 첫 번째 채널 ID 획득
        channels_url = f"{base}/teams/{tid}/channels"
        try:
            async with session.get(
                channels_url, headers=headers, timeout=timeout
            ) as resp:
                if resp.status == 403:
                    perms = support.get("required_permissions", [])
                    return (
                        "missing",
                        f"Azure App에서 권한 추가 필요: {', '.join(perms)}",
                    )
                if resp.status == 401:
                    return "missing", "인증 실패 — 토큰/자격증명 확인 필요"
                if resp.status != 200:
                    return "unknown", f"채널 목록 조회 실패 (HTTP {resp.status})"

                data = await resp.json()
                channels = data.get("value", [])
                if not channels:
                    return (
                        "unknown",
                        "채널이 없어 메시지 읽기 권한을 확인할 수 없습니다",
                    )
                channel_id = channels[0]["id"]
        except Exception as e:
            logger.warning("receive_message probe step 1 failed: %s", e)
            return "unknown", None

        # 2단계: 채널 메시지 읽기 시도 (ChannelMessage.Read.All 필요)
        messages_url = f"{base}/teams/{tid}/channels/{channel_id}/messages?$top=1"
        try:
            async with session.get(
                messages_url, headers=headers, timeout=timeout
            ) as resp:
                if resp.status == 200:
                    return "granted", None
                elif resp.status == 403:
                    perms = support.get("required_permissions", [])
                    note = (
                        f"Azure App에서 권한 추가 필요: {', '.join(perms)}"
                        if perms
                        else "ChannelMessage.Read.All 권한이 필요합니다"
                    )
                    return "missing", note
                elif resp.status == 401:
                    return "missing", "인증 실패 — 토큰/자격증명 확인 필요"
                else:
                    return "unknown", f"메시지 읽기 확인 실패 (HTTP {resp.status})"
        except Exception as e:
            logger.warning("receive_message probe step 2 failed: %s", e)
            return "unknown", None

    def _probe_url(self, feature_id: str) -> Optional[str]:
        """Feature ID에 맞는 최소 Graph API URL 반환"""
        tid = self._team_id
        base = self.GRAPH_BASE

        mapping: dict[str, Optional[str]] = {
            "send_message": f"{base}/teams/{tid}/channels" if tid else None,
            # receive_message는 _probe_receive_message()에서 2단계로 직접 검증
            "send_file": f"{base}/groups/{tid}/drive/root/children?$top=1"
            if tid
            else None,
            "receive_file": f"{base}/groups/{tid}/drive/root/children?$top=1"
            if tid
            else None,
            # forward_reaction/edit/delete — Graph API Change Notifications 기반
            # ChannelMessage.Read.All 권한으로 동작, 채널 메시지 접근 가능 여부로 검증
            "forward_reaction": f"{base}/teams/{tid}/channels" if tid else None,
            "forward_edit": f"{base}/teams/{tid}/channels" if tid else None,
            "forward_delete": f"{base}/teams/{tid}/channels" if tid else None,
            "thread_reply": f"{base}/teams/{tid}/channels" if tid else None,
            "list_channels": f"{base}/teams/{tid}/channels" if tid else None,
            "list_conversations": None,  # app-only 토큰에서 /chats 미지원
            # /me는 client_credentials에서 사용 불가
            # 발신자 이름은 Bot Framework activity에서 제공되므로 팀 정보 접근으로 대체
            "user_display_name": f"{base}/teams/{tid}" if tid else None,
        }
        return mapping.get(feature_id)
