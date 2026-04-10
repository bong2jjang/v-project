"""
Token/Password 암호화 유틸리티

DB에 저장되는 민감한 정보(Token, Password)를 암호화/복호화합니다.
cryptography 라이브러리의 Fernet (대칭키 암호화) 사용.

작성일: 2026-04-02
"""

import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


def get_encryption_key() -> bytes:
    """
    환경 변수에서 암호화 키 가져오기

    Returns:
        암호화 키 (bytes)

    Raises:
        ValueError: ENCRYPTION_KEY 환경 변수가 없을 때
    """
    key = os.getenv("ENCRYPTION_KEY")

    if not key:
        # 개발 환경: 경고 출력 후 기본 키 생성
        print(
            "WARNING: ENCRYPTION_KEY not set. Using auto-generated key. "
            "This is INSECURE for production!"
        )
        # Fernet 키는 URL-safe base64-encoded 32-byte key
        key = Fernet.generate_key().decode()
        os.environ["ENCRYPTION_KEY"] = key

    return key.encode()


# Fernet 인스턴스 생성 (싱글톤)
_fernet: Optional[Fernet] = None


def get_fernet() -> Fernet:
    """Fernet 인스턴스 반환 (싱글톤)"""
    global _fernet
    if _fernet is None:
        _fernet = Fernet(get_encryption_key())
    return _fernet


def encrypt(value: str) -> str:
    """
    문자열 암호화

    Args:
        value: 암호화할 문자열 (평문)

    Returns:
        암호화된 문자열 (base64 인코딩)

    Example:
        >>> encrypted = encrypt("xoxb-my-secret-token")
        >>> encrypted
        'gAAAAABl...'
    """
    if not value:
        return ""

    fernet = get_fernet()
    encrypted_bytes = fernet.encrypt(value.encode())
    return encrypted_bytes.decode()


def decrypt(encrypted_value: str) -> str:
    """
    문자열 복호화

    Args:
        encrypted_value: 암호화된 문자열

    Returns:
        복호화된 문자열 (평문)

    Raises:
        InvalidToken: 잘못된 암호화 데이터이거나 키가 다른 경우

    Example:
        >>> decrypted = decrypt('gAAAAABl...')
        >>> decrypted
        'xoxb-my-secret-token'
    """
    if not encrypted_value:
        return ""

    try:
        fernet = get_fernet()
        decrypted_bytes = fernet.decrypt(encrypted_value.encode())
        return decrypted_bytes.decode()
    except InvalidToken as e:
        # 복호화 실패 - 키가 잘못되었거나 데이터가 손상됨
        raise ValueError("Failed to decrypt: invalid token or key") from e


def is_encrypted(value: str) -> bool:
    """
    문자열이 암호화되어 있는지 확인

    Args:
        value: 확인할 문자열

    Returns:
        암호화 여부

    Note:
        Fernet 암호화된 값은 항상 "gAAAAAB"로 시작합니다.
        완벽한 검증은 아니지만 빠른 체크에 유용합니다.
    """
    if not value:
        return False

    # Fernet 토큰은 base64 인코딩되어 있고 특정 패턴으로 시작
    return value.startswith("gAAAAAB")
