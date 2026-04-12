"""
Redis 캐싱 서비스

중앙 집중식 캐싱 관리 및 WebSocket 상태 공유
"""

import os
import json
import logging
from typing import Optional, Any
from redis import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


class CacheService:
    """Redis 기반 캐싱 서비스"""

    def __init__(self):
        self.redis_url = os.getenv(
            "REDIS_URL", "redis://:redispassword@127.0.0.1:6379/0"
        )
        self.client: Optional[Redis] = None
        self._connect()

    def _connect(self):
        """Redis 연결"""
        try:
            self.client = Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
            )
            # 연결 테스트
            self.client.ping()
            logger.info(f"Redis connected: {self.redis_url}")
        except RedisError as e:
            logger.error(f"Redis connection failed: {e}")
            self.client = None

    def is_available(self) -> bool:
        """Redis 사용 가능 여부"""
        if not self.client:
            return False
        try:
            self.client.ping()
            return True
        except RedisError:
            return False

    def get(self, key: str) -> Optional[Any]:
        """
        캐시에서 값 가져오기

        Args:
            key: 캐시 키

        Returns:
            캐시된 값 (JSON 역직렬화) 또는 None
        """
        if not self.is_available():
            return None

        try:
            value = self.client.get(key)
            if value is None:
                return None

            # JSON 역직렬화 시도
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                # JSON이 아닌 경우 원본 문자열 반환
                return value

        except RedisError as e:
            logger.error(f"Redis GET error for key '{key}': {e}")
            return None

    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """
        캐시에 값 저장

        Args:
            key: 캐시 키
            value: 저장할 값 (자동으로 JSON 직렬화)
            ttl: Time To Live (초 단위), None이면 영구 저장

        Returns:
            성공 여부
        """
        if not self.is_available():
            return False

        try:
            # JSON 직렬화
            if not isinstance(value, str):
                value = json.dumps(value, ensure_ascii=False)

            if ttl:
                self.client.setex(key, ttl, value)
            else:
                self.client.set(key, value)

            return True

        except (RedisError, TypeError, ValueError) as e:
            logger.error(f"Redis SET error for key '{key}': {e}")
            return False

    def delete(self, key: str) -> bool:
        """
        캐시에서 값 삭제

        Args:
            key: 캐시 키

        Returns:
            성공 여부
        """
        if not self.is_available():
            return False

        try:
            self.client.delete(key)
            return True
        except RedisError as e:
            logger.error(f"Redis DELETE error for key '{key}': {e}")
            return False

    def exists(self, key: str) -> bool:
        """
        캐시 키 존재 여부 확인

        Args:
            key: 캐시 키

        Returns:
            존재 여부
        """
        if not self.is_available():
            return False

        try:
            return bool(self.client.exists(key))
        except RedisError as e:
            logger.error(f"Redis EXISTS error for key '{key}': {e}")
            return False

    def flush_pattern(self, pattern: str) -> int:
        """
        패턴과 일치하는 모든 캐시 삭제

        Args:
            pattern: 검색 패턴 (예: "stats:*")

        Returns:
            삭제된 키 개수
        """
        if not self.is_available():
            return 0

        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except RedisError as e:
            logger.error(f"Redis FLUSH_PATTERN error for pattern '{pattern}': {e}")
            return 0

    def get_ttl(self, key: str) -> Optional[int]:
        """
        캐시 키의 남은 TTL 조회

        Args:
            key: 캐시 키

        Returns:
            남은 TTL (초), -1이면 영구, -2이면 존재하지 않음, None이면 에러
        """
        if not self.is_available():
            return None

        try:
            return self.client.ttl(key)
        except RedisError as e:
            logger.error(f"Redis TTL error for key '{key}': {e}")
            return None

    def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """
        캐시 값 증가 (카운터)

        Args:
            key: 캐시 키
            amount: 증가량 (기본 1)

        Returns:
            증가 후 값 또는 None
        """
        if not self.is_available():
            return None

        try:
            return self.client.incrby(key, amount)
        except RedisError as e:
            logger.error(f"Redis INCREMENT error for key '{key}': {e}")
            return None

    def get_info(self) -> dict:
        """
        Redis 서버 정보 조회

        Returns:
            서버 정보 딕셔너리
        """
        if not self.is_available():
            return {"available": False, "error": "Redis not connected"}

        try:
            info = self.client.info()
            return {
                "available": True,
                "version": info.get("redis_version"),
                "used_memory": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "uptime_seconds": info.get("uptime_in_seconds"),
            }
        except RedisError as e:
            logger.error(f"Redis INFO error: {e}")
            return {"available": False, "error": str(e)}


# 전역 캐시 서비스 인스턴스
cache_service = CacheService()
