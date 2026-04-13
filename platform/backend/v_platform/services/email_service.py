"""
Email Service

이메일 발송 서비스 (비밀번호 재설정 등)
"""

import os
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape
import logging

logger = logging.getLogger(__name__)

# SMTP 설정
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@vms-channel-bridge.com")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "v-channel-bridge")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")

# Jinja2 템플릿 환경 설정
template_dir = os.path.join(os.path.dirname(__file__), "..", "templates", "emails")
jinja_env = Environment(
    loader=FileSystemLoader(template_dir)
    if os.path.exists(template_dir)
    else FileSystemLoader("."),
    autoescape=select_autoescape(["html", "xml"]),
)


class EmailService:
    """이메일 발송 서비스"""

    @staticmethod
    async def send_email(
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        이메일 발송

        Args:
            to_email: 수신자 이메일
            subject: 제목
            html_body: HTML 본문
            text_body: 텍스트 본문 (선택)

        Returns:
            bool: 발송 성공 여부
        """
        if not SMTP_USERNAME or not SMTP_PASSWORD:
            logger.warning(
                "SMTP 자격증명이 설정되지 않았습니다. 이메일을 발송하지 않습니다."
            )
            logger.info(f"[DRY RUN] To: {to_email}, Subject: {subject}")
            return False

        try:
            # 이메일 메시지 생성
            message = MIMEMultipart("alternative")
            message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
            message["To"] = to_email
            message["Subject"] = subject

            # 텍스트 및 HTML 본문 추가
            if text_body:
                message.attach(MIMEText(text_body, "plain", "utf-8"))
            message.attach(MIMEText(html_body, "html", "utf-8"))

            # SMTP 서버 연결 및 발송
            # MailHog (포트 1025) 또는 개발 환경에서는 TLS 사용 안 함
            use_tls = SMTP_PORT not in [1025, 1026]

            await aiosmtplib.send(
                message,
                hostname=SMTP_HOST,
                port=SMTP_PORT,
                username=SMTP_USERNAME,
                password=SMTP_PASSWORD,
                start_tls=use_tls,
            )

            logger.info(f"이메일 발송 성공: {to_email}")
            return True

        except Exception as e:
            logger.error(f"이메일 발송 실패: {to_email}, 오류: {str(e)}")
            return False

    @staticmethod
    def render_template(template_name: str, context: dict) -> str:
        """
        Jinja2 템플릿 렌더링

        Args:
            template_name: 템플릿 파일명
            context: 템플릿 변수

        Returns:
            str: 렌더링된 HTML
        """
        try:
            template = jinja_env.get_template(template_name)
            return template.render(**context)
        except Exception as e:
            logger.error(f"템플릿 렌더링 실패: {template_name}, 오류: {str(e)}")
            raise

    @staticmethod
    async def send_password_reset_email(
        to_email: str,
        username: str,
        reset_token: str,
    ) -> bool:
        """
        비밀번호 재설정 이메일 발송

        Args:
            to_email: 수신자 이메일
            username: 사용자 이름
            reset_token: 재설정 토큰

        Returns:
            bool: 발송 성공 여부
        """
        reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"

        # HTML 본문
        html_body = f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>비밀번호 재설정</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f3f3;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f3f3; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- 헤더 -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0078d4 0%, #0066b8 100%); padding: 40px 40px 30px; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">v-channel-bridge</h1>
                            <p style="margin: 8px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">비밀번호 재설정</p>
                        </td>
                    </tr>
                    <!-- 본문 -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 16px; color: #333333; font-size: 16px; line-height: 1.6;">
                                안녕하세요, <strong>{username}</strong>님
                            </p>
                            <p style="margin: 0 0 24px; color: #616161; font-size: 14px; line-height: 1.6;">
                                v-channel-bridge 계정의 비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새로운 비밀번호를 설정해주세요.
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="{reset_link}" style="display: inline-block; padding: 14px 32px; background-color: #0078d4; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">비밀번호 재설정</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 24px 0 0; color: #616161; font-size: 13px; line-height: 1.6;">
                                버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
                                <a href="{reset_link}" style="color: #0078d4; word-break: break-all;">{reset_link}</a>
                            </p>
                            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
                                <p style="margin: 0 0 8px; color: #a0a0a0; font-size: 12px; line-height: 1.6;">
                                    ⚠️ <strong>보안 알림</strong>
                                </p>
                                <ul style="margin: 8px 0 0 20px; padding: 0; color: #616161; font-size: 12px; line-height: 1.6;">
                                    <li>이 링크는 30분 동안만 유효합니다</li>
                                    <li>비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하세요</li>
                                    <li>링크는 1회만 사용 가능합니다</li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                    <!-- 푸터 -->
                    <tr>
                        <td style="background-color: #f8f8f8; padding: 24px 40px; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0; color: #a0a0a0; font-size: 12px; line-height: 1.6;">
                                © 2024 v-channel-bridge. All rights reserved.
                            </p>
                            <p style="margin: 8px 0 0; color: #a0a0a0; font-size: 11px;">
                                이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

        # 텍스트 본문 (HTML을 지원하지 않는 이메일 클라이언트용)
        text_body = f"""
v-channel-bridge 비밀번호 재설정

안녕하세요, {username}님

v-channel-bridge 계정의 비밀번호 재설정을 요청하셨습니다.
아래 링크를 클릭하여 새로운 비밀번호를 설정해주세요:

{reset_link}

보안 알림:
- 이 링크는 30분 동안만 유효합니다
- 비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하세요
- 링크는 1회만 사용 가능합니다

© 2024 v-channel-bridge. All rights reserved.
이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.
"""

        return await EmailService.send_email(
            to_email=to_email,
            subject="[v-channel-bridge] 비밀번호 재설정 요청",
            html_body=html_body,
            text_body=text_body,
        )

    @staticmethod
    async def send_password_changed_email(
        to_email: str,
        username: str,
    ) -> bool:
        """
        비밀번호 변경 완료 알림 이메일 발송

        Args:
            to_email: 수신자 이메일
            username: 사용자 이름

        Returns:
            bool: 발송 성공 여부
        """
        html_body = f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>비밀번호 변경 완료</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f3f3;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f3f3; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #16825d 0%, #0f5c42 100%); padding: 40px 40px 30px; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">v-channel-bridge</h1>
                            <p style="margin: 8px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">비밀번호가 변경되었습니다</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 16px; color: #333333; font-size: 16px; line-height: 1.6;">
                                안녕하세요, <strong>{username}</strong>님
                            </p>
                            <p style="margin: 0 0 24px; color: #616161; font-size: 14px; line-height: 1.6;">
                                v-channel-bridge 계정의 비밀번호가 성공적으로 변경되었습니다.
                            </p>
                            <div style="background-color: #e8f5ef; border-left: 4px solid #16825d; padding: 16px; margin: 24px 0; border-radius: 4px;">
                                <p style="margin: 0; color: #0f5c42; font-size: 14px; font-weight: 500;">
                                    ✓ 변경 완료
                                </p>
                            </div>
                            <p style="margin: 24px 0 0; color: #a0a0a0; font-size: 12px; line-height: 1.6;">
                                이 변경을 요청하지 않으셨다면 즉시 관리자에게 문의하세요.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8f8f8; padding: 24px 40px; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0; color: #a0a0a0; font-size: 12px; line-height: 1.6;">
                                © 2024 v-channel-bridge. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

        text_body = f"""
v-channel-bridge 비밀번호 변경 완료

안녕하세요, {username}님

v-channel-bridge 계정의 비밀번호가 성공적으로 변경되었습니다.

이 변경을 요청하지 않으셨다면 즉시 관리자에게 문의하세요.

© 2024 v-channel-bridge. All rights reserved.
"""

        return await EmailService.send_email(
            to_email=to_email,
            subject="[v-channel-bridge] 비밀번호가 변경되었습니다",
            html_body=html_body,
            text_body=text_body,
        )
