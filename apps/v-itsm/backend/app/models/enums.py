"""v-itsm 도메인 공용 Enum.

Python 레벨에서만 사용한다. DB 컬럼은 설계 문서 §4.1 기준으로 VARCHAR 로 저장한다
(Enum 값 확장 시 마이그레이션 부담을 피하기 위함).
"""

from __future__ import annotations

from enum import Enum


class LoopStage(str, Enum):
    INTAKE = "intake"
    ANALYZE = "analyze"
    EXECUTE = "execute"
    VERIFY = "verify"
    ANSWER = "answer"
    CLOSED = "closed"


class LoopAction(str, Enum):
    ADVANCE = "advance"
    REJECT = "reject"
    ON_HOLD = "on_hold"
    RESUME = "resume"
    ROLLBACK = "rollback"
    REOPEN = "reopen"


class Priority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class SLAKind(str, Enum):
    RESPONSE = "response"
    RESOLUTION = "resolution"


class ChannelSource(str, Enum):
    SLACK = "slack"
    TEAMS = "teams"
    EMAIL = "email"
    WEB = "web"
    PHONE = "phone"


class AssignmentRole(str, Enum):
    PRIMARY = "primary"
    REVIEWER = "reviewer"
    WATCHER = "watcher"


class AISuggestionKind(str, Enum):
    CLASSIFY = "classify"
    DRAFT_REPLY = "draft_reply"
    SIMILAR = "similar"
    SUMMARY = "summary"


class RequestServiceType(str, Enum):
    ON_PREMISE = "on_premise"
    SAAS = "saas"
    INTERNAL = "internal"
    PARTNER = "partner"


class ScopeLevel(str, Enum):
    READ = "read"
    WRITE = "write"


class CustomerStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ContractStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
