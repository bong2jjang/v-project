"""
Permission Service

RBAC 권한 조회·부여·위임 검증 로직
유효 권한 = MAX(그룹 권한들, 개인 오버라이드)
"""

import logging
from sqlalchemy import or_
from sqlalchemy.orm import Session

from v_platform.models.user import User, UserRole
from v_platform.models.menu_item import MenuItem
from v_platform.models.user_permission import UserPermission, ACCESS_LEVEL_ORDER
from v_platform.models.permission_group import (
    PermissionGroupGrant,
    UserGroupMembership,
    PermissionGroup,
)

logger = logging.getLogger(__name__)


def _max_access(*levels: str) -> str:
    """여러 access_level 중 최고 수준 반환"""
    best = 0
    for level in levels:
        best = max(best, ACCESS_LEVEL_ORDER.get(level, 0))
    for name, order in ACCESS_LEVEL_ORDER.items():
        if order == best:
            return name
    return "none"


class PermissionService:
    """권한 관리 서비스"""

    @staticmethod
    def check_permission(
        db: Session,
        user: User,
        permission_key: str,
        required_level: str = "read",
    ) -> bool:
        """
        사용자의 특정 메뉴 권한 확인

        Args:
            db: DB 세션
            user: 사용자
            permission_key: 메뉴 permission_key
            required_level: 필요한 권한 수준 ("read" | "write")

        Returns:
            권한 보유 여부
        """
        # system_admin → 무조건 패스
        if user.role == UserRole.SYSTEM_ADMIN:
            return True

        # 메뉴 조회
        menu = (
            db.query(MenuItem)
            .filter(
                MenuItem.permission_key == permission_key,
                MenuItem.is_active.is_(True),
            )
            .first()
        )
        if not menu:
            return False

        effective = PermissionService.get_effective_permission(db, user.id, menu.id)
        user_level = ACCESS_LEVEL_ORDER.get(effective, 0)
        required = ACCESS_LEVEL_ORDER.get(required_level, 0)
        return user_level >= required

    @staticmethod
    def _filter_shared_overridden(
        menus: list[MenuItem],
        db: Session | None = None,
        app_id: str | None = None,
    ) -> list[MenuItem]:
        """공통(app_id=NULL) 메뉴를 두 가지 규칙으로 숨긴다:
        1) 같은 permission_key 에 app-specific entry 가 있으면 공통 entry 제거
           (app 이 공통 메뉴를 자신의 키로 오버라이드한 경우)
        2) app-specific 'hide_shared' 마커 행 (menu_type='hide_shared', is_active=False)
           의 permission_key 와 일치하는 공통 entry 제거
           (app 이 공통 메뉴를 아예 표시하지 않으려는 경우 — 예: v-ui-builder 가
           공통 '대시보드' 를 숨기고 자신만의 페이지를 노출)
        """
        overridden = {m.permission_key for m in menus if m.app_id is not None}

        if db is not None and app_id is not None:
            hide_rows = (
                db.query(MenuItem.permission_key)
                .filter(
                    MenuItem.app_id == app_id,
                    MenuItem.menu_type == "hide_shared",
                )
                .all()
            )
            overridden |= {r[0] for r in hide_rows}

        return [m for m in menus if not (m.app_id is None and m.permission_key in overridden)]

    @staticmethod
    def get_user_permissions(
        db: Session, user: User, app_id: str | None = None
    ) -> dict[str, str]:
        """
        사용자의 전체 유효 권한 맵 반환 (그룹 + 개인 MAX)

        Args:
            app_id: 앱 ID (None이면 공통 메뉴만, 값이 있으면 공통 + 해당 앱 메뉴)

        Returns:
            { permission_key: access_level } 딕셔너리
        """
        app_filter = or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id)

        if user.role == UserRole.SYSTEM_ADMIN:
            menus = (
                db.query(MenuItem)
                .filter(MenuItem.is_active.is_(True), app_filter)
                .all()
            )
            menus = PermissionService._filter_shared_overridden(menus, db, app_id)
            return {m.permission_key: "write" for m in menus}

        effective = PermissionService.get_effective_permissions_for_user(db, user.id)
        menus = (
            db.query(MenuItem).filter(MenuItem.is_active.is_(True), app_filter).all()
        )
        menus = PermissionService._filter_shared_overridden(menus, db, app_id)
        result = {}
        for menu in menus:
            info = effective.get(menu.id)
            if info:
                result[menu.permission_key] = info["level"]
        return result

    @staticmethod
    def get_accessible_menus(
        db: Session, user: User, app_id: str | None = None
    ) -> list[dict]:
        """
        사용자가 접근 가능한 메뉴 목록 (권한 필터링 + 정렬)

        Args:
            db: DB 세션
            user: 사용자
            app_id: 앱 ID (None이면 플랫폼 공통 메뉴만, 값이 있으면 공통 + 해당 앱 메뉴)

        Returns:
            메뉴 딕셔너리 리스트 (access_level 포함)
        """
        app_filter = or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id)

        if user.role == UserRole.SYSTEM_ADMIN:
            menus = (
                db.query(MenuItem)
                .filter(MenuItem.is_active.is_(True), app_filter)
                .order_by(MenuItem.sort_order)
                .all()
            )
            menus = PermissionService._filter_shared_overridden(menus, db, app_id)
            return [{**m.to_dict(), "access_level": "write"} for m in menus]

        effective = PermissionService.get_effective_permissions_for_user(db, user.id)
        menus = (
            db.query(MenuItem)
            .filter(MenuItem.is_active.is_(True), app_filter)
            .order_by(MenuItem.sort_order)
            .all()
        )
        menus = PermissionService._filter_shared_overridden(menus, db, app_id)

        # 1차: 권한이 있는 메뉴 수집
        result = []
        included_ids: set[int] = set()
        for menu in menus:
            info = effective.get(menu.id)
            if info and info["level"] in ("read", "write"):
                result.append({**menu.to_dict(), "access_level": info["level"]})
                included_ids.add(menu.id)

        # 2차: 자식이 포함된 menu_group 부모를 자동 포함
        # (menu_group은 컨테이너이므로 별도 권한 없이 자식 존재 시 표시)
        child_parent_keys = {m["parent_key"] for m in result if m.get("parent_key")}
        for menu in menus:
            if (
                menu.menu_type == "menu_group"
                and menu.id not in included_ids
                and menu.permission_key in child_parent_keys
            ):
                # 자식 중 최고 권한을 부모에 부여
                child_levels = [
                    m["access_level"]
                    for m in result
                    if m.get("parent_key") == menu.permission_key
                ]
                best_level = _max_access(*child_levels) if child_levels else "read"
                result.append({**menu.to_dict(), "access_level": best_level})
                included_ids.add(menu.id)

        # 3차: menu_group에 권한이 있지만 자식이 결과에 없는 경우
        # → 자식을 "read" 권한으로 자동 포함 (그룹이 빈 상태로 사라지는 것 방지)
        included_group_keys = {
            m["permission_key"] for m in result if m.get("menu_type") == "menu_group"
        }
        children_parent_keys = {m["parent_key"] for m in result if m.get("parent_key")}
        orphan_groups = included_group_keys - children_parent_keys

        for menu in menus:
            if (
                menu.id not in included_ids
                and menu.parent_key
                and menu.parent_key in orphan_groups
            ):
                result.append({**menu.to_dict(), "access_level": "read"})
                included_ids.add(menu.id)

        # sort_order 기준 재정렬
        result.sort(key=lambda m: m.get("sort_order", 0))
        return result

    @staticmethod
    def get_permissions_for_user(
        db: Session, target_user_id: int, app_id: str | None = None
    ) -> list[dict]:
        """
        특정 사용자의 권한 상세 목록 (관리용, 현재 앱 범위만)
        """
        app_filter = or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id)
        rows = (
            db.query(UserPermission, MenuItem)
            .join(MenuItem)
            .filter(UserPermission.user_id == target_user_id, app_filter)
            .order_by(MenuItem.sort_order)
            .all()
        )
        return [
            {
                **perm.to_dict(),
                "menu_label": menu.label,
                "menu_path": menu.path,
                "menu_type": menu.menu_type,
            }
            for perm, menu in rows
        ]

    @staticmethod
    def set_user_permissions(
        db: Session,
        target_user_id: int,
        grants: list[dict],
        current_user: User,
        app_id: str | None = None,
    ) -> list[dict]:
        """
        사용자 권한 일괄 설정 (위임 검증 포함)

        Args:
            db: DB 세션
            target_user_id: 대상 사용자 ID
            grants: [{"menu_item_id": int, "access_level": str}, ...]
            current_user: 권한 부여자
            app_id: 앱 ID (현재 앱 범위의 메뉴만 허용)

        Returns:
            업데이트된 권한 목록

        Raises:
            ValueError: 위임 규칙 위반
            PermissionError: 권한 부족
        """
        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            raise ValueError("대상 사용자를 찾을 수 없습니다")

        # 현재 앱 범위의 메뉴 ID 집합 (검증용)
        app_filter = or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id)
        app_menu_ids = {m.id for m in db.query(MenuItem.id).filter(app_filter).all()}

        # 메뉴 범위 검증
        for grant in grants:
            if grant["menu_item_id"] not in app_menu_ids:
                raise ValueError(
                    f"메뉴 ID {grant['menu_item_id']}은(는) 현재 앱에서 접근할 수 없습니다"
                )

        # system_admin → 모든 사용자에게 모든 권한 부여 가능
        if current_user.role == UserRole.SYSTEM_ADMIN:
            return PermissionService._apply_permissions(
                db, target_user_id, grants, current_user.id
            )

        # org_admin → user에게만, 자신의 권한 범위 내에서만
        if current_user.role == UserRole.ORG_ADMIN:
            if target_user.role != UserRole.USER:
                raise PermissionError(
                    "운영관리자는 일반사용자에게만 권한을 부여할 수 있습니다"
                )

            my_perms = PermissionService.get_user_permissions(
                db, current_user, app_id=app_id
            )
            for grant in grants:
                menu = (
                    db.query(MenuItem)
                    .filter(MenuItem.id == grant["menu_item_id"])
                    .first()
                )
                if not menu:
                    continue

                my_level = ACCESS_LEVEL_ORDER.get(
                    my_perms.get(menu.permission_key, "none"), 0
                )
                grant_level = ACCESS_LEVEL_ORDER.get(grant["access_level"], 0)

                if grant_level > my_level:
                    raise PermissionError(
                        f"자신의 권한({my_perms.get(menu.permission_key, 'none')})을 "
                        f"초과하여 '{menu.label}'에 "
                        f"'{grant['access_level']}' 권한을 부여할 수 없습니다"
                    )

            return PermissionService._apply_permissions(
                db, target_user_id, grants, current_user.id
            )

        raise PermissionError("권한 부여 권한이 없습니다")

    @staticmethod
    def _apply_permissions(
        db: Session,
        target_user_id: int,
        grants: list[dict],
        granted_by: int,
    ) -> list[dict]:
        """실제 권한 적용 (upsert)"""
        results = []
        for grant in grants:
            menu_item_id = grant["menu_item_id"]
            access_level = grant["access_level"]

            existing = (
                db.query(UserPermission)
                .filter(
                    UserPermission.user_id == target_user_id,
                    UserPermission.menu_item_id == menu_item_id,
                )
                .first()
            )

            if existing:
                existing.access_level = access_level
                existing.granted_by = granted_by
                results.append(existing.to_dict())
            else:
                perm = UserPermission(
                    user_id=target_user_id,
                    menu_item_id=menu_item_id,
                    access_level=access_level,
                    granted_by=granted_by,
                )
                db.add(perm)
                db.flush()
                results.append(perm.to_dict())

        db.commit()
        return results

    @staticmethod
    def get_permission_matrix(
        db: Session,
        requester: User,
        app_id: str | None = None,
    ) -> dict:
        """
        전체 권한 매트릭스 조회

        Returns:
            {
                "menus": [...],
                "users": [
                    {"user": {...}, "permissions": {menu_item_id: access_level}}
                ]
            }
        """
        app_filter = or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id)
        menus = (
            db.query(MenuItem)
            .filter(MenuItem.is_active.is_(True), app_filter)
            .order_by(MenuItem.sort_order)
            .all()
        )

        # 대상 사용자 결정
        if requester.role == UserRole.SYSTEM_ADMIN:
            users = (
                db.query(User)
                .filter(User.is_active.is_(True))
                .order_by(User.role, User.username)
                .all()
            )
        elif requester.role == UserRole.ORG_ADMIN:
            # org_admin은 일반 사용자만 관리
            users = (
                db.query(User)
                .filter(
                    User.is_active.is_(True),
                    User.role == UserRole.USER,
                )
                .order_by(User.username)
                .all()
            )
        else:
            return {"menus": [], "users": []}

        # 현재 앱 범위의 메뉴에 해당하는 permission만 로드
        menu_ids = {m.id for m in menus}
        all_perms = (
            db.query(UserPermission)
            .filter(UserPermission.menu_item_id.in_(menu_ids))
            .all()
            if menu_ids
            else []
        )
        perm_map: dict[int, dict[int, str]] = {}
        for p in all_perms:
            perm_map.setdefault(p.user_id, {})[p.menu_item_id] = p.access_level

        user_list = []
        for u in users:
            user_perms = perm_map.get(u.id, {})
            user_list.append(
                {
                    "user": u.to_dict(),
                    "permissions": {m.id: user_perms.get(m.id, "none") for m in menus},
                }
            )

        return {
            "menus": [m.to_dict() for m in menus],
            "users": user_list,
        }

    # ── 유효 권한 계산 (그룹 + 개인 MAX) ──────────────────────────────

    @staticmethod
    def get_effective_permission(db: Session, user_id: int, menu_item_id: int) -> str:
        """
        특정 사용자의 특정 메뉴에 대한 유효 권한 계산
        = MAX(모든 그룹 권한, 개인 오버라이드)
        """
        levels: list[str] = []

        # 그룹 권한 수집
        group_grants = (
            db.query(PermissionGroupGrant.access_level)
            .join(
                UserGroupMembership,
                UserGroupMembership.permission_group_id
                == PermissionGroupGrant.permission_group_id,
            )
            .join(
                PermissionGroup,
                PermissionGroup.id == PermissionGroupGrant.permission_group_id,
            )
            .filter(
                UserGroupMembership.user_id == user_id,
                PermissionGroupGrant.menu_item_id == menu_item_id,
                PermissionGroup.is_active.is_(True),
            )
            .all()
        )
        levels.extend(g.access_level for g in group_grants)

        # 개인 권한
        personal = (
            db.query(UserPermission)
            .filter(
                UserPermission.user_id == user_id,
                UserPermission.menu_item_id == menu_item_id,
            )
            .first()
        )
        if personal:
            levels.append(personal.access_level)

        if not levels:
            return "none"
        return _max_access(*levels)

    @staticmethod
    def get_effective_permissions_for_user(
        db: Session, user_id: int
    ) -> dict[int, dict]:
        """
        사용자의 전체 메뉴 유효 권한 맵

        Returns:
            {
                menu_item_id: {
                    "level": "read"|"write"|"none",
                    "source": "personal"|"group"|"mixed",
                    "group_names": ["운영자", ...]
                }
            }
        """
        # 1) 그룹 권한 수집
        group_rows = (
            db.query(
                PermissionGroupGrant.menu_item_id,
                PermissionGroupGrant.access_level,
                PermissionGroup.name,
            )
            .join(
                UserGroupMembership,
                UserGroupMembership.permission_group_id
                == PermissionGroupGrant.permission_group_id,
            )
            .join(
                PermissionGroup,
                PermissionGroup.id == PermissionGroupGrant.permission_group_id,
            )
            .filter(
                UserGroupMembership.user_id == user_id,
                PermissionGroup.is_active.is_(True),
            )
            .all()
        )

        # menu_item_id → { "level": max_group_level, "group_names": [...] }
        group_map: dict[int, dict] = {}
        for menu_id, level, group_name in group_rows:
            if menu_id not in group_map:
                group_map[menu_id] = {"level": level, "group_names": [group_name]}
            else:
                group_map[menu_id]["level"] = _max_access(
                    group_map[menu_id]["level"], level
                )
                if group_name not in group_map[menu_id]["group_names"]:
                    group_map[menu_id]["group_names"].append(group_name)

        # 2) 개인 권한 수집
        personal_rows = (
            db.query(UserPermission).filter(UserPermission.user_id == user_id).all()
        )
        personal_map = {p.menu_item_id: p.access_level for p in personal_rows}

        # 3) 병합: MAX(group, personal)
        all_menu_ids = set(group_map.keys()) | set(personal_map.keys())
        result: dict[int, dict] = {}

        for mid in all_menu_ids:
            g_info = group_map.get(mid)
            p_level = personal_map.get(mid)

            g_level = g_info["level"] if g_info else "none"
            p_level_str = p_level if p_level else "none"

            effective = _max_access(g_level, p_level_str)

            # 출처 결정
            has_group = g_info and ACCESS_LEVEL_ORDER.get(g_level, 0) > 0
            has_personal = p_level and ACCESS_LEVEL_ORDER.get(p_level_str, 0) > 0

            if has_group and has_personal:
                source = "mixed"
            elif has_group:
                source = "group"
            else:
                source = "personal"

            result[mid] = {
                "level": effective,
                "source": source,
                "group_names": g_info["group_names"] if g_info else [],
            }

        return result

    @staticmethod
    def get_users_by_menu(db: Session, menu_item_id: int) -> list[dict]:
        """
        특정 메뉴에 대한 모든 사용자의 유효 권한 조회

        Returns:
            [{ "user": {...}, "access_level": str, "source": str, "group_names": [...] }]
        """
        users = (
            db.query(User)
            .filter(User.is_active.is_(True))
            .order_by(User.username)
            .all()
        )

        result = []
        for user in users:
            user_dict = user.to_dict()
            base = {
                "user_id": user.id,
                "email": user_dict["email"],
                "username": user_dict["username"],
                "role": user_dict["role"],
            }

            if user.role == UserRole.SYSTEM_ADMIN:
                result.append(
                    {
                        **base,
                        "access_level": "write",
                        "source": "role",
                        "group_names": [],
                    }
                )
                continue

            effective = PermissionService.get_effective_permissions_for_user(
                db, user.id
            )
            info = effective.get(
                menu_item_id,
                {
                    "level": "none",
                    "source": "personal",
                    "group_names": [],
                },
            )
            result.append(
                {
                    **base,
                    "access_level": info["level"],
                    "source": info["source"],
                    "group_names": info.get("group_names", []),
                }
            )

        return result

    @staticmethod
    def get_effective_matrix(
        db: Session, requester: User, app_id: str | None = None
    ) -> dict:
        """
        유효 권한 매트릭스 (그룹+개인 통합) — 각 셀에 source 포함

        Returns:
            {
                "menus": [...],
                "users": [{
                    "user": {...},
                    "permissions": {
                        menu_item_id: {
                            "level": str, "source": str, "group_names": [...]
                        }
                    }
                }]
            }
        """
        app_filter = or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id)
        menus = (
            db.query(MenuItem)
            .filter(MenuItem.is_active.is_(True), app_filter)
            .order_by(MenuItem.sort_order)
            .all()
        )

        if requester.role == UserRole.SYSTEM_ADMIN:
            users = (
                db.query(User)
                .filter(User.is_active.is_(True))
                .order_by(User.role, User.username)
                .all()
            )
        elif requester.role == UserRole.ORG_ADMIN:
            users = (
                db.query(User)
                .filter(
                    User.is_active.is_(True),
                    User.role == UserRole.USER,
                )
                .order_by(User.username)
                .all()
            )
        else:
            return {"menus": [], "users": []}

        user_list = []
        for u in users:
            if u.role == UserRole.SYSTEM_ADMIN:
                perms = {
                    m.id: {
                        "level": "write",
                        "source": "system_admin",
                        "group_names": [],
                    }
                    for m in menus
                }
            else:
                effective = PermissionService.get_effective_permissions_for_user(
                    db, u.id
                )
                perms = {}
                for m in menus:
                    info = effective.get(
                        m.id,
                        {
                            "level": "none",
                            "source": "personal",
                            "group_names": [],
                        },
                    )
                    perms[m.id] = info

            user_list.append(
                {
                    "user": u.to_dict(),
                    "permissions": perms,
                }
            )

        return {
            "menus": [m.to_dict() for m in menus],
            "users": user_list,
        }

    @staticmethod
    def apply_group_template(
        db: Session,
        group_id: int,
        user_ids: list[int],
        current_user: User,
        app_id: str | None = None,
    ) -> None:
        """그룹 소속에 사용자 일괄 추가"""
        group = (
            db.query(PermissionGroup)
            .filter(
                PermissionGroup.id == group_id,
                or_(PermissionGroup.app_id.is_(None), PermissionGroup.app_id == app_id),
            )
            .first()
        )
        if not group:
            raise ValueError("권한 그룹을 찾을 수 없습니다")

        for uid in user_ids:
            user = db.query(User).filter(User.id == uid).first()
            if not user:
                continue

            # org_admin 위임 검증
            if current_user.role == UserRole.ORG_ADMIN:
                if user.role != UserRole.USER:
                    raise PermissionError(
                        f"운영관리자는 일반사용자에게만 그룹을 할당할 수 있습니다 (대상: {user.email})"
                    )

            existing = (
                db.query(UserGroupMembership)
                .filter(
                    UserGroupMembership.user_id == uid,
                    UserGroupMembership.permission_group_id == group_id,
                )
                .first()
            )
            if not existing:
                membership = UserGroupMembership(
                    user_id=uid,
                    permission_group_id=group_id,
                    assigned_by=current_user.id,
                )
                db.add(membership)

        db.commit()

    # ── 역할 ↔ 기본 그룹 자동 동기화 ─────────────────────────────
    ROLE_GROUP_MAP: dict[str, str] = {
        "system_admin": "(system_admin)",
        "org_admin": "(org_admin)",
        "user": "(user)",
    }

    @staticmethod
    def sync_default_group_for_user(
        db: Session, user: User, *, assigned_by_id: int | None = None
    ) -> None:
        """사용자의 역할에 맞는 기본 권한 그룹을 자동 할당하고,
        역할과 일치하지 않는 다른 기본 그룹 멤버십은 제거한다."""
        role_key = user.role.value if isinstance(user.role, UserRole) else user.role

        default_groups = (
            db.query(PermissionGroup).filter(PermissionGroup.is_default.is_(True)).all()
        )

        target_group: PermissionGroup | None = None
        for g in default_groups:
            marker = PermissionService.ROLE_GROUP_MAP.get(role_key)
            if marker and g.description and marker in g.description:
                target_group = g
                break

        # 다른 기본 그룹 멤버십 제거
        for g in default_groups:
            if target_group and g.id == target_group.id:
                continue
            db.query(UserGroupMembership).filter(
                UserGroupMembership.user_id == user.id,
                UserGroupMembership.permission_group_id == g.id,
            ).delete()

        # 대상 그룹 멤버십 추가
        if target_group:
            existing = (
                db.query(UserGroupMembership)
                .filter(
                    UserGroupMembership.user_id == user.id,
                    UserGroupMembership.permission_group_id == target_group.id,
                )
                .first()
            )
            if not existing:
                db.add(
                    UserGroupMembership(
                        user_id=user.id,
                        permission_group_id=target_group.id,
                        assigned_by=assigned_by_id,
                    )
                )

        db.commit()
