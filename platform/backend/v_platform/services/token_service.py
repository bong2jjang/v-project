"""
Token Service

Refresh Token 및 Access Token 관리 서비스
"""

import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from v_platform.models.refresh_token import RefreshToken
from v_platform.models.user import User
import os

# JWT 설정
# NOTE: SECRET_KEY는 utils/auth.py와 동일한 환경변수를 사용해야 합니다
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"

# Token 만료 시간
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
REFRESH_TOKEN_REMEMBER_DAYS = 30


class TokenService:
    """Token 관리 서비스"""

    @staticmethod
    def create_access_token(
        user_id: int, email: str, role: str
    ) -> Tuple[str, datetime]:
        """
        Access Token 생성

        Args:
            user_id: 사용자 ID
            email: 이메일
            role: 역할

        Returns:
            (access_token, expires_at)
        """
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

        payload = {
            "user_id": user_id,
            "email": email,
            "role": role,
            "exp": int(expires_at.timestamp()),  # Unix timestamp
            "iat": int(now.timestamp()),  # Unix timestamp
            "jti": secrets.token_urlsafe(16),
        }

        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token, expires_at

    @staticmethod
    def verify_access_token(token: str) -> dict:
        """
        Access Token 검증

        Args:
            token: Access Token

        Returns:
            Decoded payload

        Raises:
            JWTError: 토큰 검증 실패
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError as e:
            raise ValueError(f"Invalid token: {str(e)}")

    @staticmethod
    def create_refresh_token(
        db: Session,
        user_id: int,
        device_fingerprint: Optional[str],
        device_name: Optional[str],
        ip_address: Optional[str],
        remember_me: bool = False,
        app_id: Optional[str] = None,
    ) -> str:
        """
        Refresh Token 생성 및 DB 저장

        Args:
            db: Database session
            user_id: 사용자 ID
            device_fingerprint: 디바이스 핑거프린트
            device_name: 디바이스 이름
            ip_address: IP 주소
            remember_me: 로그인 유지 여부
            app_id: 로그인 출처 앱 (표시용)

        Returns:
            Refresh Token
        """
        # 토큰 생성 (64 바이트 랜덤)
        token = secrets.token_urlsafe(64)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        # 만료 시간 계산
        expire_days = (
            REFRESH_TOKEN_REMEMBER_DAYS if remember_me else REFRESH_TOKEN_EXPIRE_DAYS
        )
        expires_at = datetime.now(timezone.utc) + timedelta(days=expire_days)

        # DB 저장
        refresh_token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            device_fingerprint=device_fingerprint,
            device_name=device_name,
            ip_address=ip_address,
            expires_at=expires_at,
            app_id=app_id,
        )

        db.add(refresh_token)
        db.commit()
        db.refresh(refresh_token)

        return token

    @staticmethod
    def verify_refresh_token(db: Session, token: str) -> RefreshToken:
        """
        Refresh Token 검증

        Args:
            db: Database session
            token: Refresh Token

        Returns:
            RefreshToken 객체

        Raises:
            ValueError: 토큰 검증 실패
        """
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        # DB에서 토큰 조회
        db_token = db.query(RefreshToken).filter_by(token_hash=token_hash).first()

        if not db_token:
            raise ValueError("Invalid refresh token")

        # 무효화 여부 확인
        if db_token.is_revoked:
            # 재사용 공격 감지! 사용자의 모든 토큰 무효화
            TokenService.revoke_all_tokens(db, db_token.user_id)
            raise ValueError("Token reuse detected - all tokens revoked")

        # 만료 여부 확인 (timezone 처리)
        expires_at = db_token.expires_at
        if expires_at.tzinfo is None:
            # Naive datetime은 UTC로 가정
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if datetime.now(timezone.utc) > expires_at:
            raise ValueError("Refresh token expired")

        # 마지막 사용 시간 업데이트
        db_token.last_used_at = datetime.now(timezone.utc)
        db.commit()

        return db_token

    @staticmethod
    def refresh_tokens(
        db: Session, old_refresh_token: str, ip_address: Optional[str]
    ) -> Tuple[str, str]:
        """
        Access Token 및 Refresh Token 갱신

        Args:
            db: Database session
            old_refresh_token: 기존 Refresh Token
            ip_address: IP 주소

        Returns:
            (new_access_token, new_refresh_token)

        Raises:
            ValueError: 토큰 갱신 실패
        """
        # 1. 기존 토큰 검증
        db_token = TokenService.verify_refresh_token(db, old_refresh_token)

        # 2. 사용자 조회
        user = db.query(User).filter_by(id=db_token.user_id).first()
        if not user or not user.is_active:
            raise ValueError("User not found or inactive")

        # 3. 기존 토큰 무효화 (Token Rotation)
        db_token.is_revoked = True
        db.commit()

        # 4. 새 Access Token 생성
        new_access_token, _ = TokenService.create_access_token(
            user_id=user.id, email=user.email, role=user.role.value
        )

        # 5. 새 Refresh Token 생성
        remember_me = (
            db_token.expires_at - db_token.created_at
        ).days >= REFRESH_TOKEN_REMEMBER_DAYS
        new_refresh_token = TokenService.create_refresh_token(
            db=db,
            user_id=user.id,
            device_fingerprint=db_token.device_fingerprint,
            device_name=db_token.device_name,
            ip_address=ip_address or db_token.ip_address,
            remember_me=remember_me,
            app_id=db_token.app_id,
        )

        return new_access_token, new_refresh_token

    @staticmethod
    def revoke_token(db: Session, token: str) -> None:
        """
        특정 Refresh Token 무효화

        Args:
            db: Database session
            token: Refresh Token
        """
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        db_token = db.query(RefreshToken).filter_by(token_hash=token_hash).first()
        if db_token:
            db_token.is_revoked = True
            db.commit()

    @staticmethod
    def revoke_all_tokens(db: Session, user_id: int) -> int:
        """
        사용자의 모든 Refresh Token 무효화

        Args:
            db: Database session
            user_id: 사용자 ID

        Returns:
            무효화된 토큰 개수
        """
        count = (
            db.query(RefreshToken)
            .filter_by(user_id=user_id, is_revoked=False)
            .update({"is_revoked": True})
        )

        db.commit()
        return count

    @staticmethod
    def get_active_devices(db: Session, user_id: int) -> list[dict]:
        """
        사용자의 활성 디바이스 목록 조회

        Args:
            db: Database session
            user_id: 사용자 ID

        Returns:
            활성 디바이스 목록
        """
        # Timezone-aware 비교를 위해 현재 시각 (UTC)
        now_utc = datetime.now(timezone.utc)

        tokens = (
            db.query(RefreshToken)
            .filter_by(user_id=user_id, is_revoked=False)
            .order_by(RefreshToken.last_used_at.desc())
            .all()
        )

        # 만료되지 않은 토큰만 필터 (timezone 처리)
        active_tokens = []
        for token in tokens:
            expires_at = token.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > now_utc:
                active_tokens.append(token)

        tokens = active_tokens

        devices = []
        for token in tokens:
            devices.append(
                {
                    "id": token.id,
                    "device_name": token.device_name or "Unknown Device",
                    "device_fingerprint": token.device_fingerprint,
                    "ip_address": token.ip_address,
                    "app_id": token.app_id,
                    "last_used_at": token.last_used_at.isoformat()
                    if token.last_used_at
                    else None,
                    "created_at": token.created_at.isoformat()
                    if token.created_at
                    else None,
                    "expires_at": token.expires_at.isoformat()
                    if token.expires_at
                    else None,
                }
            )

        return devices

    @staticmethod
    def revoke_device(db: Session, user_id: int, device_id: int) -> bool:
        """
        특정 디바이스의 토큰 무효화

        Args:
            db: Database session
            user_id: 사용자 ID
            device_id: 디바이스(토큰) ID

        Returns:
            성공 여부
        """
        token = db.query(RefreshToken).filter_by(id=device_id, user_id=user_id).first()

        if not token:
            return False

        token.is_revoked = True
        db.commit()
        return True

    @staticmethod
    def cleanup_expired_tokens(db: Session) -> int:
        """
        만료된 토큰 정리 (배치 작업용)

        Args:
            db: Database session

        Returns:
            삭제된 토큰 개수
        """
        # Timezone-aware 비교를 위해 현재 시각 (UTC)
        now_utc = datetime.now(timezone.utc)

        # 모든 토큰 가져오기
        tokens = db.query(RefreshToken).all()
        count = 0

        for token in tokens:
            expires_at = token.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if expires_at < now_utc:
                db.delete(token)
                count += 1

        db.commit()
        return count
