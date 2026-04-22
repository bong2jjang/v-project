"""ACL (스코프 기반 접근제어) — 설계 §4.3.

평가 규칙 요약:
  1. `User.role == SYSTEM_ADMIN` → 스코프 체크 생략, 전권.
  2. 그 외: UserGroupMembership 으로 사용자가 속한 권한그룹 집합을 구한 뒤,
     그 그룹들의 `itsm_scope_grant` 로우를 union 하여 "사용자 스코프"를 만든다.
  3. 티켓의 `(service_type, customer_id, product_id)` 가 스코프 튜플 중
     하나라도 매칭되면 접근 허용. NULL = 와일드카드(모든 값 매칭).
  4. `scope_level` 은 write ⊇ read. 전이·수정에는 write 필요.

목록 API 에서는 post-filter 대신 `apply_scope_to_query(stmt, scope)` 로
SELECT 문에 직접 WHERE 조건을 주입한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select
from v_platform.models.permission_group import UserGroupMembership
from v_platform.models.user import User, UserRole

from app.models.enums import ScopeLevel
from app.models.loop import LoopTransition
from app.models.scope_grant import ScopeGrant
from app.models.ticket import Ticket


@dataclass
class GrantTuple:
    """사용자 스코프의 단일 엔트리 (permission_group 경유)."""

    service_type: str | None
    customer_id: str | None
    product_id: str | None
    scope_level: str


@dataclass
class UserScope:
    """사용자의 티켓 접근 권한 집합.

    - `is_admin=True` 이면 전권 (SYSTEM_ADMIN).
    - 그 외에는 `grants` 가 허용 튜플 목록.
    """

    is_admin: bool = False
    grants: list[GrantTuple] = field(default_factory=list)

    @property
    def has_any_access(self) -> bool:
        return self.is_admin or bool(self.grants)

    def write_grants(self) -> list[GrantTuple]:
        return [g for g in self.grants if g.scope_level == ScopeLevel.WRITE.value]


# ─── 스코프 계산 ──────────────────────────────────────────────
def get_user_scope(db: Session, user: User) -> UserScope:
    """사용자의 현재 스코프를 계산한다."""
    if user.role == UserRole.SYSTEM_ADMIN:
        return UserScope(is_admin=True)

    group_stmt = select(UserGroupMembership.permission_group_id).where(
        UserGroupMembership.user_id == user.id
    )
    group_ids = [row for row in db.execute(group_stmt).scalars().all()]
    if not group_ids:
        return UserScope()

    grant_stmt = select(ScopeGrant).where(
        ScopeGrant.permission_group_id.in_(group_ids)
    )
    grants = [
        GrantTuple(
            service_type=g.service_type,
            customer_id=g.customer_id,
            product_id=g.product_id,
            scope_level=g.scope_level,
        )
        for g in db.execute(grant_stmt).scalars().all()
    ]
    return UserScope(grants=grants)


# ─── 단일 튜플 매칭 (NULL = 와일드카드) ────────────────────────
def _tuple_matches(
    grant: GrantTuple,
    service_type: str | None,
    customer_id: str | None,
    product_id: str | None,
) -> bool:
    if grant.service_type is not None and grant.service_type != service_type:
        return False
    if grant.customer_id is not None and grant.customer_id != customer_id:
        return False
    if grant.product_id is not None and grant.product_id != product_id:
        return False
    return True


def _level_sufficient(granted: str, required: ScopeLevel) -> bool:
    if required == ScopeLevel.READ:
        return granted in (ScopeLevel.READ.value, ScopeLevel.WRITE.value)
    return granted == ScopeLevel.WRITE.value


# ─── 접근 판정 ────────────────────────────────────────────────
def check_ticket_access(
    scope: UserScope, ticket: Ticket, required: ScopeLevel
) -> bool:
    if scope.is_admin:
        return True
    return any(
        _level_sufficient(g.scope_level, required)
        and _tuple_matches(g, ticket.service_type, ticket.customer_id, ticket.product_id)
        for g in scope.grants
    )


def check_customer_product_access(
    scope: UserScope,
    service_type: str | None,
    customer_id: str | None,
    product_id: str | None,
    required: ScopeLevel,
) -> bool:
    """접수·생성 시점 가드 — 티켓 로우 없이 (service_type, customer, product) 조합만으로 평가."""
    if scope.is_admin:
        return True
    return any(
        _level_sufficient(g.scope_level, required)
        and _tuple_matches(g, service_type, customer_id, product_id)
        for g in scope.grants
    )


# ─── 쿼리 주입 ────────────────────────────────────────────────
def apply_scope_to_query(
    stmt: Select,
    scope: UserScope,
    *,
    required: ScopeLevel = ScopeLevel.READ,
) -> Select:
    """`Ticket` 을 대상으로 하는 SELECT 에 스코프 WHERE 를 주입한다.

    SYSTEM_ADMIN → 변경 없음.
    스코프 없음 → 결과 0건 강제 (`WHERE FALSE`).
    그 외 → 각 grant 를 OR 로 묶은 AND(컬럼 일치) 조건 삽입.
    """
    if scope.is_admin:
        return stmt

    relevant = [g for g in scope.grants if _level_sufficient(g.scope_level, required)]
    if not relevant:
        # 빈 결과 강제
        return stmt.where(Ticket.id.is_(None))

    or_clauses = []
    for g in relevant:
        clauses = []
        if g.service_type is not None:
            clauses.append(Ticket.service_type == g.service_type)
        if g.customer_id is not None:
            clauses.append(Ticket.customer_id == g.customer_id)
        if g.product_id is not None:
            clauses.append(Ticket.product_id == g.product_id)
        or_clauses.append(and_(*clauses) if clauses else Ticket.id.is_not(None))

    return stmt.where(or_(*or_clauses))


# ─── Helper — 권한그룹 리스트 (UI 용) ──────────────────────────
def get_user_group_ids(db: Session, user: User) -> list[int]:
    stmt = select(UserGroupMembership.permission_group_id).where(
        UserGroupMembership.user_id == user.id
    )
    return [int(i) for i in db.execute(stmt).scalars().all()]


def summarize_scope(scope: UserScope) -> dict:
    """`/api/scope-grants/my` 응답용 요약 dict."""
    if scope.is_admin:
        return {"is_admin": True, "grants": []}
    return {
        "is_admin": False,
        "grants": [
            {
                "service_type": g.service_type,
                "customer_id": g.customer_id,
                "product_id": g.product_id,
                "scope_level": g.scope_level,
            }
            for g in scope.grants
        ],
    }


# ─── 전이 편집/삭제/복원 가드 ──────────────────────────────────
def check_transition_edit_access(
    user: User,
    transition: LoopTransition,
    *,
    now: datetime | None = None,
    edit_window_minutes: int = 0,
    allow_when_deleted: bool = False,
) -> None:
    """전이 편집/삭제/복원 공통 가드 (작성자 본인 + 편집창 + 삭제 상태).

    규칙:
      - `User.role == SYSTEM_ADMIN` → 항상 허용.
      - 그 외 → 작성자 본인만 허용(`transition.actor_id == user.id`).
      - `transition.deleted_at` 이 있으면 기본적으로 차단. 복원 호출 시에만
        `allow_when_deleted=True` 로 우회.
      - `edit_window_minutes > 0` 이면 `now - transitioned_at` 이 창을 넘은 경우 차단.
        `== 0` 이면 제한 없음(무기한), `< 0` 이면 편집 전면 금지 모드.

    실패 시 `HTTPException` 을 던진다(403/409/423).
    """
    if user.role == UserRole.SYSTEM_ADMIN:
        return

    if transition.actor_id != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "작성자 본인만 이 전이를 수정/삭제/복원할 수 있습니다."
        )

    if transition.deleted_at is not None and not allow_when_deleted:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "삭제된 이력은 먼저 복원한 뒤에 수정할 수 있습니다.",
        )

    if edit_window_minutes < 0:
        raise HTTPException(
            status.HTTP_423_LOCKED, "현재 편집이 전면 차단되어 있습니다."
        )

    if edit_window_minutes > 0:
        current = now or datetime.now(timezone.utc)
        age_min = (current - transition.transitioned_at).total_seconds() / 60.0
        if age_min > edit_window_minutes:
            raise HTTPException(
                status.HTTP_423_LOCKED,
                f"수정 가능 시간({edit_window_minutes}분)을 초과했습니다.",
            )


__all__ = [
    "GrantTuple",
    "UserScope",
    "get_user_scope",
    "check_ticket_access",
    "check_customer_product_access",
    "check_transition_edit_access",
    "apply_scope_to_query",
    "summarize_scope",
    "get_user_group_ids",
]


# unused marker to avoid linter noise when Iterable not used
_ = Iterable
