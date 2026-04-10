"""
Password Reset Service

비밀번호 재설정 관련 비즈니스 로직
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from v_platform.models.user import User
from v_platform.models.password_reset_token import PasswordResetToken
from v_platform.services.email_service import EmailService
from v_platform.utils.auth import get_password_hash
from v_platform.utils.audit_logger import log_password_reset_request, log_password_reset

logger = logging.getLogger(__name__)


class PasswordResetService:
    """비밀번호 재설정 서비스"""

    @staticmethod
    async def request_reset(
        db: Session,
        email: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> bool:
        """
        비밀번호 재설정 요청

        사용자 이메일로 재설정 토큰을 생성하고 이메일을 발송합니다.
        보안상 사용자가 존재하지 않아도 성공 응답을 반환합니다 (사용자 열거 공격 방지).

        Args:
            db: 데이터베이스 세션
            email: 사용자 이메일
            ip_address: 요청 IP 주소
            user_agent: User Agent

        Returns:
            bool: 항상 True (사용자 열거 방지)
        """
        # 감사 로그 생성 (요청 시점에 기록, 사용자 존재 여부와 무관)
        try:
            log_password_reset_request(
                db=db,
                email=email,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception as log_error:
            logger.error(f"감사 로그 생성 실패: {str(log_error)}")

        try:
            # 사용자 조회
            user = db.query(User).filter(User.email == email).first()

            if not user:
                # 사용자가 없어도 성공 응답 (사용자 열거 공격 방지)
                logger.info(f"비밀번호 재설정 요청: 존재하지 않는 이메일 {email}")
                return True

            if not user.is_active:
                # 비활성 계정도 성공 응답 (사용자 열거 방지)
                logger.warning(f"비밀번호 재설정 요청: 비활성 계정 {email}")
                return True

            # 기존 미사용 토큰 무효화 (선택적)
            old_tokens = (
                db.query(PasswordResetToken)
                .filter(
                    PasswordResetToken.user_id == user.id,
                    PasswordResetToken.is_used == False,  # noqa: E712
                    PasswordResetToken.expires_at > datetime.now(timezone.utc),
                )
                .all()
            )

            for old_token in old_tokens:
                old_token.is_used = True
                old_token.used_at = datetime.now(timezone.utc)

            # 새 토큰 생성 (30분 유효)
            reset_token = PasswordResetToken.create_token(
                user_id=user.id, expiry_minutes=30
            )
            db.add(reset_token)
            db.commit()

            # 이메일 발송
            email_sent = await EmailService.send_password_reset_email(
                to_email=user.email,
                username=user.username,
                reset_token=reset_token.token,
            )

            if email_sent:
                logger.info(
                    f"비밀번호 재설정 이메일 발송 성공: {user.email} (토큰 ID: {reset_token.id})"
                )
            else:
                logger.error(f"비밀번호 재설정 이메일 발송 실패: {user.email}")

            return True

        except Exception as e:
            logger.error(f"비밀번호 재설정 요청 중 오류: {str(e)}")
            db.rollback()
            # 예외가 발생해도 True 반환 (사용자 열거 방지)
            return True

    @staticmethod
    def verify_token(db: Session, token: str) -> Optional[dict]:
        """
        재설정 토큰 검증

        Args:
            db: 데이터베이스 세션
            token: 재설정 토큰

        Returns:
            Optional[dict]: 토큰이 유효하면 {"valid": True, "email": "user@example.com"}
                           토큰이 무효하면 {"valid": False, "email": ""}
        """
        try:
            # 토큰 조회
            reset_token = (
                db.query(PasswordResetToken)
                .filter(PasswordResetToken.token == token)
                .first()
            )

            if not reset_token:
                logger.warning("토큰 검증 실패: 존재하지 않는 토큰")
                return {"valid": False, "email": ""}

            # 토큰 유효성 확인
            if not reset_token.is_valid():
                logger.warning(
                    f"토큰 검증 실패: 만료되었거나 사용된 토큰 (ID: {reset_token.id})"
                )
                return {"valid": False, "email": ""}

            # 사용자 조회
            user = db.query(User).filter(User.id == reset_token.user_id).first()

            if not user or not user.is_active:
                logger.warning(
                    f"토큰 검증 실패: 사용자 없음 또는 비활성 (토큰 ID: {reset_token.id})"
                )
                return {"valid": False, "email": ""}

            logger.info(f"토큰 검증 성공: {user.email} (토큰 ID: {reset_token.id})")
            return {"valid": True, "email": user.email}

        except Exception as e:
            logger.error(f"토큰 검증 중 오류: {str(e)}")
            return {"valid": False, "email": ""}

    @staticmethod
    async def confirm_reset(
        db: Session,
        token: str,
        new_password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[bool, str]:
        """
        비밀번호 재설정 확인

        토큰을 검증하고 비밀번호를 변경한 후 확인 이메일을 발송합니다.

        Args:
            db: 데이터베이스 세션
            token: 재설정 토큰
            new_password: 새 비밀번호 (평문)
            ip_address: 요청 IP 주소
            user_agent: User Agent

        Returns:
            tuple[bool, str]: (성공 여부, 메시지)
        """
        try:
            # 토큰 조회 및 검증
            reset_token = (
                db.query(PasswordResetToken)
                .filter(PasswordResetToken.token == token)
                .first()
            )

            if not reset_token:
                logger.warning("비밀번호 재설정 실패: 존재하지 않는 토큰")
                return False, "Invalid or expired reset token"

            if not reset_token.is_valid():
                logger.warning(
                    f"비밀번호 재설정 실패: 만료되었거나 사용된 토큰 (ID: {reset_token.id})"
                )
                return False, "Invalid or expired reset token"

            # 사용자 조회
            user = db.query(User).filter(User.id == reset_token.user_id).first()

            if not user:
                logger.error(
                    f"비밀번호 재설정 실패: 사용자 없음 (토큰 ID: {reset_token.id})"
                )
                return False, "User not found"

            if not user.is_active:
                logger.warning(f"비밀번호 재설정 실패: 비활성 계정 {user.email}")
                return False, "Account is inactive"

            # 비밀번호 변경
            user.hashed_password = get_password_hash(new_password)
            user.updated_at = datetime.now(timezone.utc)

            # 토큰 사용 처리
            reset_token.mark_as_used()

            db.commit()

            logger.info(f"비밀번호 재설정 성공: {user.email}")

            # 감사 로그 생성
            try:
                log_password_reset(
                    db=db,
                    user=user,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
            except Exception as log_error:
                logger.error(f"감사 로그 생성 실패: {str(log_error)}")

            # 비밀번호 변경 확인 이메일 발송
            email_sent = await EmailService.send_password_changed_email(
                to_email=user.email,
                username=user.username,
            )

            if email_sent:
                logger.info(f"비밀번호 변경 확인 이메일 발송 성공: {user.email}")
            else:
                logger.error(f"비밀번호 변경 확인 이메일 발송 실패: {user.email}")

            return True, "Password reset successfully"

        except Exception as e:
            logger.error(f"비밀번호 재설정 중 오류: {str(e)}")
            db.rollback()
            return False, "An error occurred during password reset"

    @staticmethod
    def cleanup_expired_tokens(db: Session) -> int:
        """
        만료된 토큰 정리 (선택적, 스케줄러에서 주기적으로 호출)

        Args:
            db: 데이터베이스 세션

        Returns:
            int: 삭제된 토큰 수
        """
        try:
            # 만료된 토큰 조회
            expired_tokens = (
                db.query(PasswordResetToken)
                .filter(PasswordResetToken.expires_at < datetime.now(timezone.utc))
                .all()
            )

            count = len(expired_tokens)

            for token in expired_tokens:
                db.delete(token)

            db.commit()

            logger.info(f"만료된 재설정 토큰 {count}개 정리 완료")
            return count

        except Exception as e:
            logger.error(f"만료된 토큰 정리 중 오류: {str(e)}")
            db.rollback()
            return 0
