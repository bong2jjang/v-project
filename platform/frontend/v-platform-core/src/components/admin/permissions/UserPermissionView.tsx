/**
 * UserPermissionView — 사용자별 뷰
 *
 * 개별 사용자 또는 역할 그룹을 선택 → 전체 메뉴 권한 보기 + 일괄 변경
 */

import { useState, useEffect, useCallback } from "react";
import { Save, RotateCcw, Users, User as UserIcon, Info } from "lucide-react";
import { Button } from "../../ui/Button";
import { Select } from "../../ui/Select";
import { Alert } from "../../ui/Alert";
import { Input } from "../../ui/Input";
import { Tooltip } from "../../ui/Tooltip";
import { AccessLevelRadio } from "./AccessLevelRadio";
import { PermissionSourceBadge } from "./PermissionSourceBadge";
import type {
  AccessLevel,
  MenuItemResponse,
  User,
  PermissionGroup,
  EffectivePermission,
} from "../../../api/types";
import * as usersApi from "../../../api/users";
import * as permissionApi from "../../../api/permissions";
import * as groupApi from "../../../api/permission-groups";

interface UserPermissionViewProps {
  menus: MenuItemResponse[];
  users: User[];
  readOnly?: boolean;
}

type TargetType = "individual" | "group";

const SECTION_LABELS: Record<string, string> = {
  basic: "기본 메뉴",
  admin: "관리 메뉴",
  custom: "커스텀 메뉴",
};

interface MenuTreeNode {
  menu: MenuItemResponse;
  children: MenuTreeNode[];
}

function buildMenuTree(menus: MenuItemResponse[]): {
  basic: MenuTreeNode[];
  admin: MenuTreeNode[];
  custom: MenuTreeNode[];
} {
  const bySection: Record<string, MenuItemResponse[]> = {
    basic: [],
    admin: [],
    custom: [],
  };

  for (const m of menus) {
    if (m.is_active) {
      (bySection[m.section] ?? bySection.custom).push(m);
    }
  }

  function toTree(items: MenuItemResponse[]): MenuTreeNode[] {
    const roots: MenuTreeNode[] = [];
    const childMap = new Map<string, MenuTreeNode[]>();

    for (const item of items) {
      if (item.parent_key) {
        const arr = childMap.get(item.parent_key) ?? [];
        arr.push({ menu: item, children: [] });
        childMap.set(item.parent_key, arr);
      }
    }

    for (const item of items) {
      if (!item.parent_key) {
        roots.push({
          menu: item,
          children: childMap.get(item.permission_key) ?? [],
        });
      }
    }

    return roots.sort((a, b) => a.menu.sort_order - b.menu.sort_order);
  }

  return {
    basic: toTree(bySection.basic),
    admin: toTree(bySection.admin),
    custom: toTree(bySection.custom),
  };
}

export function UserPermissionView({
  menus,
  users,
  readOnly,
}: UserPermissionViewProps) {
  const [targetType, setTargetType] = useState<TargetType>("individual");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [groups, setGroups] = useState<PermissionGroup[]>([]);

  // 현재 대상의 유효 권한
  const [permissions, setPermissions] = useState<
    Map<number, EffectivePermission>
  >(new Map());
  // 로컬 변경사항
  const [changes, setChanges] = useState<Map<number, AccessLevel>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isDirty = changes.size > 0;

  // 그룹 목록 로드
  useEffect(() => {
    groupApi
      .getGroups()
      .then(setGroups)
      .catch(() => {});
  }, []);

  // 사용자 선택 시 유효 권한 로드
  const loadUserPermissions = useCallback(async (userId: number) => {
    try {
      const res = await usersApi.getUserEffectivePermissions(userId);
      const map = new Map<number, EffectivePermission>();
      for (const p of res.effective_permissions) {
        map.set(p.menu_item_id, p);
      }
      setPermissions(map);
      setChanges(new Map());
    } catch {
      setError("권한 정보를 불러올 수 없습니다");
    }
  }, []);

  // 그룹 선택 시 그룹 grants 로드
  const loadGroupPermissions = useCallback(async (groupId: number) => {
    try {
      const group = await groupApi.getGroup(groupId);
      const map = new Map<number, EffectivePermission>();
      for (const g of group.grants) {
        map.set(g.menu_item_id, {
          menu_item_id: g.menu_item_id,
          permission_key: g.permission_key ?? "",
          access_level: g.access_level,
          source: "group",
          group_names: [group.name],
        });
      }
      setPermissions(map);
      setChanges(new Map());
    } catch {
      setError("그룹 권한 정보를 불러올 수 없습니다");
    }
  }, []);

  useEffect(() => {
    if (targetType === "individual" && selectedUserId) {
      loadUserPermissions(selectedUserId);
    } else if (targetType === "group" && selectedGroupId) {
      loadGroupPermissions(selectedGroupId);
    }
  }, [
    targetType,
    selectedUserId,
    selectedGroupId,
    loadUserPermissions,
    loadGroupPermissions,
  ]);

  const getLevel = (menuId: number): AccessLevel => {
    if (changes.has(menuId)) return changes.get(menuId)!;
    return permissions.get(menuId)?.access_level ?? "none";
  };

  const getSource = (
    menuId: number,
  ): {
    source: "personal" | "group" | "mixed";
    groupNames?: string[];
  } | null => {
    const p = permissions.get(menuId);
    if (!p) return null;
    return { source: p.source, groupNames: p.group_names };
  };

  const handleChange = (menuId: number, level: AccessLevel) => {
    setChanges((prev) => {
      const next = new Map(prev);
      const original = permissions.get(menuId)?.access_level ?? "none";
      if (level === original) {
        next.delete(menuId);
      } else {
        next.set(menuId, level);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const grants = Array.from(changes.entries()).map(([menuId, level]) => ({
        menu_item_id: menuId,
        access_level: level,
      }));

      if (targetType === "individual" && selectedUserId) {
        await permissionApi.setUserPermissions(selectedUserId, grants);
        setSuccess("권한이 저장되었습니다");
        await loadUserPermissions(selectedUserId);
      } else if (targetType === "group" && selectedGroupId) {
        // 그룹 수정: 기존 grants + 변경사항 병합
        const allGrants = menus
          .filter((m) => m.is_active && m.menu_type !== "menu_group")
          .map((m) => ({
            menu_item_id: m.id,
            access_level: changes.has(m.id)
              ? changes.get(m.id)!
              : (permissions.get(m.id)?.access_level ?? "none"),
          }))
          .filter((g) => g.access_level !== "none");
        await groupApi.setGroupGrants(selectedGroupId, allGrants);
        setSuccess("그룹 권한이 저장되었습니다");
        await loadGroupPermissions(selectedGroupId);
      }
    } catch {
      setError("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setChanges(new Map());
  };

  const filteredUsers = userSearch
    ? users.filter(
        (u) =>
          u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(userSearch.toLowerCase()),
      )
    : users;

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const tree = buildMenuTree(menus);
  const hasTarget =
    (targetType === "individual" && selectedUserId) ||
    (targetType === "group" && selectedGroupId);

  function renderMenuRow(node: MenuTreeNode, depth: number) {
    const isGroup = node.menu.menu_type === "menu_group";

    if (isGroup) {
      return (
        <div key={node.menu.id}>
          <div
            className="flex items-center gap-2 py-1.5 text-sm font-medium text-content-secondary"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            <span>📁</span>
            <span>{node.menu.label}</span>
          </div>
          {node.children.map((child) => renderMenuRow(child, depth + 1))}
        </div>
      );
    }

    const level = getLevel(node.menu.id);
    const sourceInfo = getSource(node.menu.id);
    const isChanged = changes.has(node.menu.id);

    return (
      <div
        key={node.menu.id}
        className={`flex items-center justify-between py-2 px-3 rounded-md transition-colors ${
          isChanged
            ? "bg-brand-50/50 dark:bg-brand-900/10"
            : "hover:bg-surface-raised"
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-content-primary truncate">
            {node.menu.label}
          </span>
          {sourceInfo && targetType === "individual" && (
            <PermissionSourceBadge
              source={sourceInfo.source}
              groupNames={sourceInfo.groupNames}
            />
          )}
        </div>
        <AccessLevelRadio
          value={level}
          onChange={(l) => handleChange(node.menu.id, l)}
          disabled={readOnly}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 대상 선택 */}
      <div className="bg-surface-card border border-line rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={targetType === "individual"}
              onChange={() => {
                setTargetType("individual");
                setChanges(new Map());
              }}
              className="text-brand-600"
            />
            <UserIcon className="w-4 h-4 text-content-secondary" />
            <span className="text-sm font-medium">개별 사용자</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={targetType === "group"}
              onChange={() => {
                setTargetType("group");
                setChanges(new Map());
              }}
              className="text-brand-600"
            />
            <Users className="w-4 h-4 text-content-secondary" />
            <span className="text-sm font-medium">역할 그룹</span>
          </label>
        </div>

        {targetType === "individual" && (
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="사용자 검색 (이메일, 이름)"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <Select
              value={selectedUserId?.toString() ?? ""}
              onChange={(e) =>
                setSelectedUserId(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            >
              <option value="">사용자를 선택하세요</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </Select>
          </div>
        )}

        {targetType === "group" && (
          <div>
            <Select
              value={selectedGroupId?.toString() ?? ""}
              onChange={(e) =>
                setSelectedGroupId(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            >
              <option value="">그룹을 선택하세요</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.is_default ? "(기본)" : ""}
                </option>
              ))}
            </Select>
            {selectedGroup && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-content-secondary">
                <Info className="w-3.5 h-3.5" />
                <span>
                  소속 인원: {selectedGroup.member_count}명
                  {selectedGroup.is_default && " · 기본 그룹 (삭제 불가)"}
                </span>
              </div>
            )}
            {targetType === "group" && selectedGroupId && (
              <Alert variant="info" className="mt-2">
                그룹 권한 변경은 그룹 정의 자체를 수정합니다. 소속 인원 전원에게
                적용됩니다.
              </Alert>
            )}
          </div>
        )}
      </div>

      {/* 권한 목록 */}
      {hasTarget && (
        <div className="bg-surface-card border border-line rounded-lg">
          <div className="p-4 space-y-1">
            {(["basic", "admin", "custom"] as const).map((section) => {
              const nodes = tree[section];
              if (nodes.length === 0) return null;

              return (
                <div key={section} className="mb-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-content-tertiary px-3 mb-1">
                    {SECTION_LABELS[section]}
                  </h4>
                  <div className="border-t border-line pt-1">
                    {nodes.map((node) => renderMenuRow(node, 0))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 범례 + 액션 */}
          <div className="border-t border-line px-4 py-3 flex items-center justify-between">
            {targetType === "individual" && (
              <div className="flex items-center gap-3 text-xs text-content-tertiary">
                <span>유효 권한 출처:</span>
                <Tooltip content="개인적으로 설정된 권한">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    개인
                  </span>
                </Tooltip>
                <Tooltip content="그룹에서 상속된 권한">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    그룹
                  </span>
                </Tooltip>
              </div>
            )}
            {targetType === "group" && <div />}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={handleReset}
                disabled={!isDirty}
              >
                초기화
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Save className="w-3.5 h-3.5" />}
                onClick={handleSave}
                loading={saving}
                disabled={readOnly || !isDirty}
              >
                변경 반영
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
    </div>
  );
}
