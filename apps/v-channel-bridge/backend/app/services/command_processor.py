"""
Command Processor: 커맨드 해석 및 실행

Zowe Chat의 Command Processor 개념 구현.

지원 커맨드:
    - /vms <action>: VMS 시스템 제어
    - /bridge <action>: 브리지 제어
    - /route <action>: 라우팅 룰 관리
    - /help: 도움말
    - /status: 시스템 상태

작성일: 2026-03-31
"""

import structlog
from typing import Optional, List
from datetime import datetime, timezone

from app.schemas.common_message import CommonMessage, MessageType, Platform, User

logger = structlog.get_logger()


class CommandProcessor:
    """
    Zowe Chat의 Command Processor 개념 구현

    메시지가 커맨드인지 확인하고, 적절한 핸들러로 전달하여 처리합니다.
    """

    def __init__(self, bridge=None):
        """
        CommandProcessor 초기화

        Args:
            bridge: WebSocketBridge 인스턴스 (순환 참조 방지를 위해 선택적)
        """
        self.bridge = bridge
        self.commands = {
            "/vms": self._handle_vms_command,
            "/bridge": self._handle_bridge_command,
            "/route": self._handle_route_command,
            "/help": self._handle_help_command,
            "/status": self._handle_status_command,
        }

        logger.info("CommandProcessor initialized")

    async def process(self, message: CommonMessage) -> Optional[CommonMessage]:
        """
        메시지가 커맨드인지 확인하고 처리

        Args:
            message: CommonMessage 스키마 메시지

        Returns:
            응답 메시지 (없으면 None)
        """
        if not message.is_command():
            return None

        command, args = message.parse_command()

        logger.info(
            "Processing command",
            command=command,
            args=args,
            user=message.user.username,
            platform=message.platform.value,
        )

        handler = self.commands.get(command)
        if not handler:
            return self._create_error_response(
                message,
                f"❌ 알 수 없는 커맨드: `{command}`\n\n사용 가능한 커맨드는 `/help`를 입력하세요.",
            )

        try:
            return await handler(message, args)
        except Exception as e:
            logger.error("Error processing command", command=command, error=str(e))
            return self._create_error_response(
                message, f"❌ 커맨드 처리 중 오류 발생: {str(e)}"
            )

    async def _handle_vms_command(
        self, message: CommonMessage, args: List[str]
    ) -> CommonMessage:
        """
        VMS 관련 커맨드 처리

        사용법:
            /vms status: VMS 서버 상태 조회
            /vms info: VMS 시스템 정보
            /vms restart: VMS 서버 재시작 (관리자만)
        """
        if not args:
            return self._create_response(
                message,
                "📋 **VMS 커맨드 사용법**\n\n"
                "• `/vms status` - VMS 서버 상태 조회\n"
                "• `/vms info` - VMS 시스템 정보\n"
                "• `/vms restart` - VMS 서버 재시작 (관리자)",
            )

        action = args[0].lower()

        if action == "status":
            # VMS 서버 상태 조회
            if self.bridge:
                status = self.bridge.get_status()
                is_running = status.get("is_running", False)
                providers_count = len(status.get("providers", []))

                return self._create_response(
                    message,
                    f"✅ **VMS 서버 상태**\n\n"
                    f"• 상태: {'🟢 정상 작동 중' if is_running else '🔴 중지됨'}\n"
                    f"• 연결된 Provider: {providers_count}개\n"
                    f"• 활성 태스크: {status.get('active_tasks', 0)}개",
                )
            else:
                return self._create_response(
                    message, "⚠️ 브리지가 초기화되지 않았습니다."
                )

        elif action == "info":
            # VMS 시스템 정보
            info_text = (
                "📊 **VMS Channel Bridge 정보**\n\n"
                "• 버전: v1.1.0 (Light-Zowe)\n"
                "• 아키텍처: Provider Pattern\n"
                "• 메시지 스키마: VMS-Message-Schema\n"
                "• 라우팅 엔진: Redis 기반 동적 라우팅\n"
                "• 지원 플랫폼: Slack, Microsoft Teams\n\n"
                "🔗 더 많은 정보: `/help`"
            )
            return self._create_response(message, info_text)

        elif action == "restart":
            # VMS 서버 재시작 (관리자만)
            # TODO: 권한 확인 로직 추가
            return self._create_response(
                message,
                "🔄 VMS 서버 재시작은 관리자 권한이 필요합니다.\n\n"
                "관리자 권한이 있다면 웹 대시보드를 통해 재시작할 수 있습니다.",
            )

        else:
            return self._create_error_response(
                message,
                f"❌ 알 수 없는 VMS 액션: `{action}`\n\n사용법: `/vms <status|info|restart>`",
            )

    async def _handle_bridge_command(
        self, message: CommonMessage, args: List[str]
    ) -> CommonMessage:
        """
        브리지 관련 커맨드 처리

        사용법:
            /bridge list: 활성 브리지 목록
            /bridge status: 브리지 상태
        """
        if not args:
            return self._create_response(
                message,
                "🌉 **브리지 커맨드 사용법**\n\n"
                "• `/bridge list` - 활성 Provider 목록\n"
                "• `/bridge status` - 브리지 상태",
            )

        action = args[0].lower()

        if action == "list":
            # 활성 Provider 목록
            if self.bridge:
                status = self.bridge.get_status()
                providers = status.get("providers", [])

                if not providers:
                    return self._create_response(
                        message, "📭 연결된 Provider가 없습니다."
                    )

                provider_list = "\n".join(
                    [
                        f"• **{p['platform']}**: "
                        f"{'🟢 연결됨' if p['connected'] else '🔴 연결 끊김'}"
                        for p in providers
                    ]
                )

                return self._create_response(
                    message, f"🌉 **활성 Provider 목록**\n\n{provider_list}"
                )
            else:
                return self._create_response(
                    message, "⚠️ 브리지가 초기화되지 않았습니다."
                )

        elif action == "status":
            # 브리지 상태
            if self.bridge:
                status = self.bridge.get_status()
                is_running = status.get("is_running", False)

                return self._create_response(
                    message,
                    f"🌉 **브리지 상태**\n\n"
                    f"• 실행 중: {'✅ 예' if is_running else '❌ 아니오'}\n"
                    f"• Provider 수: {len(status.get('providers', []))}개\n"
                    f"• 활성 태스크: {status.get('active_tasks', 0)}개",
                )
            else:
                return self._create_response(
                    message, "⚠️ 브리지가 초기화되지 않았습니다."
                )

        else:
            return self._create_error_response(
                message,
                f"❌ 알 수 없는 브리지 액션: `{action}`\n\n"
                "사용법: `/bridge <list|status>`",
            )

    async def _handle_route_command(
        self, message: CommonMessage, args: List[str]
    ) -> CommonMessage:
        """
        라우팅 룰 관리 커맨드 처리

        사용법:
            /route list: 모든 라우팅 룰 조회
            /route add <source> <target>: 라우팅 룰 추가
            /route remove <source> <target>: 라우팅 룰 제거
        """
        if not args:
            return self._create_response(
                message,
                "🛣️ **라우팅 커맨드 사용법**\n\n"
                "• `/route list` - 모든 라우팅 룰 조회\n"
                "• `/route add <source> <target>` - 라우팅 룰 추가\n"
                "• `/route remove <source> <target>` - 라우팅 룰 제거",
            )

        action = args[0].lower()

        if action == "list":
            # 모든 라우팅 룰 조회
            if self.bridge and self.bridge.route_manager:
                routes = await self.bridge.route_manager.get_all_routes()

                if not routes:
                    return self._create_response(
                        message, "📭 등록된 라우팅 룰이 없습니다."
                    )

                route_list = []
                for route in routes:
                    source = route["source"]
                    targets = route["targets"]

                    target_str = ", ".join(
                        [f"{t['platform']}:{t['channel_name']}" for t in targets]
                    )

                    route_list.append(
                        f"• `{source['platform']}:{source['channel_id']}` → {target_str}"
                    )

                return self._create_response(
                    message,
                    f"🛣️ **라우팅 룰 목록** ({len(routes)}개)\n\n"
                    + "\n".join(route_list),
                )
            else:
                return self._create_response(
                    message, "⚠️ 라우팅 관리자가 초기화되지 않았습니다."
                )

        elif action in ["add", "remove"]:
            # 라우팅 룰 추가/제거는 관리자 권한 필요
            return self._create_response(
                message,
                f"🔒 라우팅 룰 {action}는 웹 대시보드를 통해 수행할 수 있습니다.\n\n"
                "관리자 권한이 필요합니다.",
            )

        else:
            return self._create_error_response(
                message,
                f"❌ 알 수 없는 라우팅 액션: `{action}`\n\n"
                "사용법: `/route <list|add|remove>`",
            )

    async def _handle_help_command(
        self, message: CommonMessage, args: List[str]
    ) -> CommonMessage:
        """도움말 커맨드 처리"""
        help_text = (
            "❓ **VMS Channel Bridge 커맨드 도움말**\n\n"
            "**시스템 관리**\n"
            "• `/vms status` - VMS 서버 상태 조회\n"
            "• `/vms info` - 시스템 정보\n"
            "• `/status` - 간단한 상태 조회\n\n"
            "**브리지 관리**\n"
            "• `/bridge list` - 연결된 Provider 목록\n"
            "• `/bridge status` - 브리지 상태\n\n"
            "**라우팅 관리**\n"
            "• `/route list` - 라우팅 룰 목록\n\n"
            "**기타**\n"
            "• `/help` - 이 도움말 표시\n\n"
            "🔗 더 자세한 정보는 웹 대시보드를 참고하세요."
        )
        return self._create_response(message, help_text)

    async def _handle_status_command(
        self, message: CommonMessage, args: List[str]
    ) -> CommonMessage:
        """간단한 상태 조회 커맨드 처리"""
        if self.bridge:
            status = self.bridge.get_status()
            providers_count = len(status.get("providers", []))

            return self._create_response(
                message,
                f"✅ VMS Channel Bridge 작동 중\n"
                f"🌉 {providers_count}개 Provider 연결됨",
            )
        else:
            return self._create_response(message, "⚠️ 브리지가 초기화되지 않았습니다.")

    def _create_response(self, original: CommonMessage, text: str) -> CommonMessage:
        """
        응답 메시지 생성

        Args:
            original: 원본 메시지
            text: 응답 텍스트

        Returns:
            응답 메시지
        """
        return CommonMessage(
            message_id=f"cmd-resp-{original.message_id}",
            timestamp=datetime.now(timezone.utc),
            type=MessageType.SYSTEM,
            platform=original.platform,
            user=User(
                id="vms-bot",
                username="vms-bot",
                display_name="VMS Channel Bridge",
                platform=Platform.VMS,
            ),
            channel=original.channel,
            text=text,
            thread_id=original.thread_id,
            parent_id=original.message_id,
        )

    def _create_error_response(
        self, original: CommonMessage, text: str
    ) -> CommonMessage:
        """
        에러 응답 메시지 생성

        Args:
            original: 원본 메시지
            text: 에러 메시지

        Returns:
            에러 응답 메시지
        """
        return self._create_response(original, text)
