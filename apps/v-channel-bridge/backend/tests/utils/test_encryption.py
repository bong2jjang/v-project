"""
Token/Password 암호화 유틸리티 테스트

작성일: 2026-04-02
"""

import os
import pytest

from app.utils.encryption import (
    decrypt,
    encrypt,
    get_encryption_key,
    get_fernet,
    is_encrypted,
)


class TestEncryption:
    """암호화 유틸리티 테스트"""

    def test_get_encryption_key_from_env(self):
        """환경 변수에서 암호화 키 가져오기"""
        # 기존 키 백업
        original_key = os.getenv("ENCRYPTION_KEY")

        try:
            # 테스트 키 설정
            test_key = "test_key_12345678901234567890123="
            os.environ["ENCRYPTION_KEY"] = test_key

            # 키 가져오기
            key = get_encryption_key()
            assert key == test_key.encode()

        finally:
            # 원래 키로 복원
            if original_key:
                os.environ["ENCRYPTION_KEY"] = original_key
            else:
                os.environ.pop("ENCRYPTION_KEY", None)

    def test_get_encryption_key_auto_generate(self):
        """키가 없을 때 자동 생성"""
        # 기존 키 백업
        original_key = os.getenv("ENCRYPTION_KEY")

        try:
            # 키 제거
            os.environ.pop("ENCRYPTION_KEY", None)

            # 키 가져오기 (자동 생성되어야 함)
            key = get_encryption_key()
            assert key is not None
            assert len(key) > 0

        finally:
            # 원래 키로 복원
            if original_key:
                os.environ["ENCRYPTION_KEY"] = original_key

    def test_encrypt_decrypt(self):
        """암호화 및 복호화"""
        original_text = "xoxb-test-secret-token-12345"

        # 암호화
        encrypted = encrypt(original_text)
        assert encrypted != original_text
        assert len(encrypted) > 0

        # 복호화
        decrypted = decrypt(encrypted)
        assert decrypted == original_text

    def test_encrypt_empty_string(self):
        """빈 문자열 암호화"""
        encrypted = encrypt("")
        assert encrypted == ""

    def test_decrypt_empty_string(self):
        """빈 문자열 복호화"""
        decrypted = decrypt("")
        assert decrypted == ""

    def test_encrypt_none_value(self):
        """None 값 암호화"""
        encrypted = encrypt(None)
        assert encrypted == ""

    def test_decrypt_invalid_token(self):
        """잘못된 토큰 복호화"""
        with pytest.raises(ValueError, match="Failed to decrypt"):
            decrypt("invalid_encrypted_data")

    def test_is_encrypted_with_encrypted_value(self):
        """암호화된 값 확인"""
        original_text = "xoxb-test-token"
        encrypted = encrypt(original_text)

        assert is_encrypted(encrypted) is True

    def test_is_encrypted_with_plain_value(self):
        """평문 값 확인"""
        plain_text = "xoxb-plain-token"

        assert is_encrypted(plain_text) is False

    def test_is_encrypted_with_empty_string(self):
        """빈 문자열 확인"""
        assert is_encrypted("") is False

    def test_is_encrypted_with_none(self):
        """None 값 확인"""
        assert is_encrypted(None) is False

    def test_get_fernet_singleton(self):
        """Fernet 인스턴스 싱글톤 확인"""
        fernet1 = get_fernet()
        fernet2 = get_fernet()

        # 같은 인스턴스여야 함
        assert fernet1 is fernet2

    def test_encrypt_decrypt_korean(self):
        """한글 암호화/복호화"""
        original_text = "테스트 암호화 데이터"

        encrypted = encrypt(original_text)
        assert encrypted != original_text

        decrypted = decrypt(encrypted)
        assert decrypted == original_text

    def test_encrypt_decrypt_special_chars(self):
        """특수문자 암호화/복호화"""
        original_text = "token!@#$%^&*()_+-=[]{}|;:',.<>?/"

        encrypted = encrypt(original_text)
        assert encrypted != original_text

        decrypted = decrypt(encrypted)
        assert decrypted == original_text

    def test_encrypt_decrypt_long_text(self):
        """긴 텍스트 암호화/복호화"""
        original_text = "x" * 1000  # 1000자

        encrypted = encrypt(original_text)
        assert encrypted != original_text

        decrypted = decrypt(encrypted)
        assert decrypted == original_text
