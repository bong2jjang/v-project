/**
 * PermissionGroups 페이지 — 역할 그룹 관리
 *
 * 역할 그룹 CRUD, 그룹별 메뉴 권한 설정, 소속 사용자 관리
 * 탭 1: 역할 그룹 기준 — 그룹을 선택하여 소속 사용자 관리
 * 탭 2: 사용자 기준 — 사용자를 선택하여 소속 그룹 관리
 */

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Shield,
  Lock,
  ChevronDown,
  ChevronRight,
  UserPlus,
  User as UserIcon,
  X,
  Search,
  Check,
  RefreshCw,
} from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import { usePermissionStore } from "../../stores/permission";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import { Modal, ModalFooter } from "../../components/ui/Modal";
import { Card, CardBody } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/Tabs";
import { AccessLevelRadio } from "../../components/admin/permissions/AccessLevelRadio";
import type {
  PermissionGroup,
  MenuItemResponse,
  AccessLevel,
  User,
} from "../../api/types";
import { getRoleDisplayName, isAdminRole } from "../../api/types";
import * as groupApi from "../../api/permission-groups";
import * as permissionApi from "../../api/permissions";
import * as usersApi from "../../api/users";

interface MenuTreeNode {
  menu: MenuItemResponse;
  children: MenuTreeNode[];
}

function buildSectionTree(menus: MenuItemResponse[]): {
  basic: MenuTreeNode[];
  admin: MenuTreeNode[];
  custom: MenuTreeNode[];
} {
  // 그룹 permission_key → section 매핑 (자식 메뉴가 그룹과 같은 섹션에 배치되도록)
  const groupSectionMap = new Map<string, string>();
  for (const m of menus) {
    if (m.menu_type === "menu_group") {
      groupSectionMap.set(m.permission_key, m.section ?? "custom");
    }
  }

  const bySection: Record<string, MenuItemResponse[]> = {
    basic: [],
    admin: [],
    custom: [],
  };
  for (const m of menus) {
    // 자식 메뉴는 부모 그룹의 섹션에 배치 (orphan 방지)
    const section =
      m.parent_key && groupSectionMap.has(m.parent_key)
        ? groupSectionMap.get(m.parent_key)!
        : (m.section ?? "custom");
    (bySection[section] ?? bySection.custom).push(m);
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
      if (!item.parent_key)
        roots.push({
          menu: item,
          children: childMap.get(item.permission_key) ?? [],
        });
    }
    return roots.sort((a, b) => a.menu.sort_order - b.menu.sort_order);
  }
  return {
    basic: toTree(bySection.basic),
    admin: toTree(bySection.admin),
    custom: toTree(bySection.custom),
  };
}

const SECTION_LABELS: Record<string, string> = {
  basic: "기본 메뉴",
  admin: "관리 메뉴",
  custom: "커스텀 메뉴",
};

export default function PermissionGroups() {
  const canEdit = usePermissionStore().canWrite("permission_groups");
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [menus, setMenus] = useState<MenuItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 그룹 생성/수정 모달
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(
    null,
  );
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // 권한 편집 패널 (확장/축소)
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const [grantChanges, setGrantChanges] = useState<Map<number, AccessLevel>>(
    new Map(),
  );
  const [grantSaving, setGrantSaving] = useState(false);

  // 소속 사용자 패널
  const [membersGroupId, setMembersGroupId] = useState<number | null>(null);
  const [members, setMembers] = useState<
    Array<{
      user_id: number;
      email: string;
      username: string;
      role: string;
    }>
  >([]);

  // 사용자 추가 모달
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [addMemberGroupId, setAddMemberGroupId] = useState<number | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<
    Array<{ id: number; username: string; email: string; role: string }>
  >([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberAdding, setMemberAdding] = useState<number | null>(null);

  // 사용자 기준 탭 상태
  const [userTabUsers, setUserTabUsers] = useState<User[]>([]);
  const [userTabTotal, setUserTabTotal] = useState(0);
  const [userTabPage, setUserTabPage] = useState(1);
  const [userTabPerPage] = useState(20);
  const [userTabSearch, setUserTabSearch] = useState("");
  const [userTabRoleFilter, setUserTabRoleFilter] = useState("");
  const [userTabLoading, setUserTabLoading] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [userGroups, setUserGroups] = useState<
    Array<{
      id: number;
      name: string;
      description: string | null;
      is_default: boolean;
      assigned_at: string;
    }>
  >([]);
  const [userGroupsLoading, setUserGroupsLoading] = useState(false);
  const [addGroupModalOpen, setAddGroupModalOpen] = useState(false);
  const [groupToggling, setGroupToggling] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, menusRes] = await Promise.all([
        groupApi.getGroups(),
        permissionApi.getAllMenus(),
      ]);
      setGroups(groupsRes);
      setMenus(menusRes.menus);
    } catch {
      setError("데이터를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    setEditingGroup(null);
    setFormName("");
    setFormDesc("");
    setFormSubmitting(false);
    setFormModalOpen(true);
  };

  const openEditModal = (group: PermissionGroup) => {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDesc(group.description ?? "");
    setFormSubmitting(false);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async () => {
    if (!formName.trim()) return;
    setFormSubmitting(true);
    try {
      if (editingGroup) {
        await groupApi.updateGroup(editingGroup.id, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
        });
        setSuccess("역할 그룹이 수정되었습니다");
      } else {
        await groupApi.createGroup({
          name: formName.trim(),
          description: formDesc.trim() || undefined,
        });
        setSuccess("역할 그룹이 생성되었습니다");
      }
      setFormModalOpen(false);
      fetchData();
    } catch {
      setError("저장에 실패했습니다");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (group: PermissionGroup) => {
    if (group.is_default) return;
    if (!confirm(`"${group.name}" 역할 그룹을 삭제하시겠습니까?`)) return;
    try {
      await groupApi.deleteGroup(group.id);
      setSuccess("역할 그룹이 삭제되었습니다");
      fetchData();
    } catch {
      setError("삭제에 실패했습니다");
    }
  };

  // 권한 편집 토글
  const toggleGrantEditor = async (groupId: number) => {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
      setGrantChanges(new Map());
      return;
    }
    setExpandedGroupId(groupId);
    setGrantChanges(new Map());
    setMembersGroupId(null);
  };

  const getGrantLevel = (
    group: PermissionGroup,
    menuId: number,
  ): AccessLevel => {
    if (grantChanges.has(menuId)) return grantChanges.get(menuId)!;
    const g = group.grants.find((g) => g.menu_item_id === menuId);
    return g?.access_level ?? "none";
  };

  const handleGrantChange = (
    group: PermissionGroup,
    menuId: number,
    level: AccessLevel,
  ) => {
    setGrantChanges((prev) => {
      const next = new Map(prev);
      const original =
        group.grants.find((g) => g.menu_item_id === menuId)?.access_level ??
        "none";
      if (level === original) next.delete(menuId);
      else next.set(menuId, level);
      return next;
    });
  };

  const handleGrantSave = async (group: PermissionGroup) => {
    setGrantSaving(true);
    try {
      const grantableMenus = menus.filter((m) => m.menu_type !== "menu_group");
      const grants = grantableMenus
        .map((m) => ({
          menu_item_id: m.id,
          access_level: grantChanges.has(m.id)
            ? grantChanges.get(m.id)!
            : (group.grants.find((g) => g.menu_item_id === m.id)
                ?.access_level ?? "none"),
        }))
        .filter((g) => g.access_level !== "none");
      await groupApi.setGroupGrants(group.id, grants);
      setSuccess("역할 그룹 권한이 저장되었습니다");
      setGrantChanges(new Map());
      fetchData();
    } catch {
      setError("저장에 실패했습니다");
    } finally {
      setGrantSaving(false);
    }
  };

  // 소속 사용자 보기
  const toggleMembers = async (groupId: number) => {
    if (membersGroupId === groupId) {
      setMembersGroupId(null);
      return;
    }
    setExpandedGroupId(null);
    setMembersGroupId(groupId);
    try {
      const res = await groupApi.getGroupMembers(groupId);
      setMembers(res.members);
    } catch {
      setError("소속 사용자를 불러올 수 없습니다");
    }
  };

  // 사용자 추가 모달 열기
  const openAddMemberModal = async (groupId: number) => {
    setAddMemberGroupId(groupId);
    setMemberSearchQuery("");
    setMemberSearchResults([]);
    setAddMemberModalOpen(true);
    // 초기 목록 로드
    try {
      const res = await groupApi.searchUsersForGroup("", groupId, 20);
      setMemberSearchResults(res.users);
    } catch {
      // 무시
    }
  };

  // 사용자 검색
  const handleMemberSearch = async (query: string) => {
    setMemberSearchQuery(query);
    if (!addMemberGroupId) return;
    setMemberSearching(true);
    try {
      const res = await groupApi.searchUsersForGroup(
        query,
        addMemberGroupId,
        20,
      );
      setMemberSearchResults(res.users);
    } catch {
      // 검색 실패 시 무시
    } finally {
      setMemberSearching(false);
    }
  };

  // 사용자 추가
  const handleAddMember = async (userId: number) => {
    if (!addMemberGroupId) return;
    setMemberAdding(userId);
    try {
      await groupApi.addGroupMember(addMemberGroupId, userId);
      // 검색 결과에서 제거
      setMemberSearchResults((prev) => prev.filter((u) => u.id !== userId));
      // 소속 사용자 목록 갱신
      if (membersGroupId === addMemberGroupId) {
        const res = await groupApi.getGroupMembers(addMemberGroupId);
        setMembers(res.members);
      }
      fetchData(); // member_count 갱신
      setSuccess("사용자가 그룹에 추가되었습니다");
    } catch {
      setError("사용자 추가에 실패했습니다");
    } finally {
      setMemberAdding(null);
    }
  };

  // 사용자 제거
  const handleRemoveMember = async (groupId: number, userId: number) => {
    if (!confirm("이 사용자를 그룹에서 제거하시겠습니까?")) return;
    try {
      await groupApi.removeGroupMember(groupId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      fetchData(); // member_count 갱신
      setSuccess("사용자가 그룹에서 제거되었습니다");
    } catch {
      setError("사용자 제거에 실패했습니다");
    }
  };

  // ── 사용자 기준 탭 핸들러 ──

  const loadUserTab = useCallback(async () => {
    setUserTabLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: userTabPage,
        per_page: userTabPerPage,
      };
      if (userTabSearch) params.search = userTabSearch;
      if (userTabRoleFilter) params.role = userTabRoleFilter;
      const res = await usersApi.getUsers(
        params as Parameters<typeof usersApi.getUsers>[0],
      );
      setUserTabUsers(res.users);
      setUserTabTotal(res.total);
    } catch {
      setError("사용자 목록을 불러올 수 없습니다");
    } finally {
      setUserTabLoading(false);
    }
  }, [userTabPage, userTabSearch, userTabRoleFilter, userTabPerPage]);

  const [userTabInitialized, setUserTabInitialized] = useState(true);

  const initUserTab = useCallback(() => {
    if (!userTabInitialized) {
      setUserTabInitialized(true);
    }
  }, [userTabInitialized]);

  useEffect(() => {
    if (userTabInitialized) {
      loadUserTab();
    }
  }, [userTabInitialized, loadUserTab]);

  const toggleUserRow = async (userId: number) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    setUserGroupsLoading(true);
    try {
      const res = await groupApi.getUserGroups(userId);
      setUserGroups(res.groups);
    } catch {
      setError("사용자의 소속 그룹을 불러올 수 없습니다");
    } finally {
      setUserGroupsLoading(false);
    }
  };

  const refreshUserGroups = async () => {
    if (!expandedUserId) return;
    try {
      const res = await groupApi.getUserGroups(expandedUserId);
      setUserGroups(res.groups);
    } catch {
      // 무시
    }
  };

  const handleAddGroupToUser = async (groupId: number) => {
    if (!expandedUserId) return;
    setGroupToggling(groupId);
    try {
      await groupApi.addGroupMember(groupId, expandedUserId);
      await refreshUserGroups();
      fetchData(); // member_count 갱신
      setSuccess("사용자가 그룹에 추가되었습니다");
    } catch {
      setError("그룹 추가에 실패했습니다");
    } finally {
      setGroupToggling(null);
    }
  };

  const handleRemoveGroupFromUser = async (groupId: number) => {
    if (!expandedUserId) return;
    if (!confirm("이 사용자를 해당 그룹에서 제거하시겠습니까?")) return;
    setGroupToggling(groupId);
    try {
      await groupApi.removeGroupMember(groupId, expandedUserId);
      await refreshUserGroups();
      fetchData(); // member_count 갱신
      setSuccess("사용자가 그룹에서 제거되었습니다");
    } catch {
      setError("그룹 제거에 실패했습니다");
    } finally {
      setGroupToggling(null);
    }
  };

  // 사용자에게 할당 가능한 그룹 (아직 소속되지 않은 그룹)
  const availableGroupsForUser = groups.filter(
    (g) => !userGroups.some((ug) => ug.id === g.id),
  );

  const userTabTotalPages = Math.ceil(userTabTotal / userTabPerPage);
  const expandedUser = userTabUsers.find((u) => u.id === expandedUserId);

  const tree = buildSectionTree(menus);

  function renderGrantRow(
    node: MenuTreeNode,
    group: PermissionGroup,
    depth: number,
  ) {
    if (node.menu.menu_type === "menu_group") {
      return (
        <div key={node.menu.id}>
          <div
            className="flex items-center gap-2 py-1.5 text-sm font-medium text-content-secondary"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            📁 {node.menu.label}
          </div>
          {node.children.map((c) => renderGrantRow(c, group, depth + 1))}
        </div>
      );
    }

    const level = getGrantLevel(group, node.menu.id);
    const isChanged = grantChanges.has(node.menu.id);

    return (
      <div
        key={node.menu.id}
        className={`flex items-center justify-between py-1.5 px-3 rounded ${
          isChanged ? "bg-brand-50/50 dark:bg-brand-900/10" : ""
        } ${!node.menu.is_active ? "opacity-50" : ""}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <span className="text-sm text-content-primary">
          {node.menu.label}
          {!node.menu.is_active && (
            <span className="ml-1.5 text-[10px] text-content-tertiary">
              (비활성)
            </span>
          )}
        </span>
        <AccessLevelRadio
          value={level}
          onChange={(l) => handleGrantChange(group, node.menu.id, l)}
          disabled={!canEdit}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <ContentHeader
          title="역할 그룹"
          description="역할 그룹 관리 및 메뉴 권한 템플릿 설정"
        />
        <div className="page-container space-y-section-gap">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <ContentHeader
        title="역할 그룹"
        description="역할 그룹 관리 및 메뉴 권한 템플릿 설정"
      />

      <div className="page-container space-y-section-gap">
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

        <Tabs
          defaultValue="users"
          onValueChange={(v) => {
            if (v === "users") initUserTab();
          }}
        >
          <TabsList>
            <TabsTrigger
              value="users"
              icon={<UserIcon className="w-4 h-4" />}
            >
              사용자 기준
            </TabsTrigger>
            <TabsTrigger
              value="groups"
              icon={<Shield className="w-4 h-4" />}
            >
              역할 그룹 기준
            </TabsTrigger>
          </TabsList>

          {/* ── 탭 1: 역할 그룹 기준 ── */}
          <TabsContent value="groups">
            <div className="flex justify-end mb-4">
              <Button onClick={openCreateModal} disabled={!canEdit}>
                <Plus className="w-4 h-4 mr-1.5" />
                역할 그룹 추가
              </Button>
            </div>

            <div className="space-y-3">
              {groups.map((group) => (
                <Card key={group.id}>
                  <CardBody>
                    {/* 그룹 헤더 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950">
                          <Shield className="w-5 h-5 text-brand-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-content-primary">
                              {group.name}
                            </span>
                            {group.is_default && (
                              <Badge variant="default">
                                <Lock className="w-3 h-3 mr-0.5" />
                                기본
                              </Badge>
                            )}
                            <Badge variant="info">
                              {group.member_count}명
                            </Badge>
                          </div>
                          {group.description && (
                            <p className="text-xs text-content-tertiary mt-0.5">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleMembers(group.id)}
                        >
                          <Users className="w-3.5 h-3.5 mr-1" />
                          소속 사용자
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleGrantEditor(group.id)}
                        >
                          {expandedGroupId === group.id ? (
                            <ChevronDown className="w-3.5 h-3.5 mr-1" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 mr-1" />
                          )}
                          권한 설정
                        </Button>
                        {!group.is_default && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditModal(group)}
                              disabled={!canEdit}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(group)}
                              disabled={!canEdit}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 권한 편집 패널 */}
                    {expandedGroupId === group.id && (
                      <div className="mt-4 border-t border-line pt-4">
                        <div className="space-y-1">
                          {(["basic", "admin", "custom"] as const).map(
                            (section) => {
                              const nodes = tree[section];
                              if (nodes.length === 0) return null;
                              return (
                                <div key={section} className="mb-3">
                                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-content-tertiary px-3 mb-1">
                                    {SECTION_LABELS[section]}
                                  </h4>
                                  <div className="border-t border-line pt-1">
                                    {nodes.map((n) =>
                                      renderGrantRow(n, group, 0),
                                    )}
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-line">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setGrantChanges(new Map())}
                            disabled={!canEdit || grantChanges.size === 0}
                          >
                            초기화
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleGrantSave(group)}
                            loading={grantSaving}
                            disabled={!canEdit || grantChanges.size === 0}
                          >
                            권한 저장
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* 소속 사용자 패널 */}
                    {membersGroupId === group.id && (
                      <div className="mt-4 border-t border-line pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-content-primary">
                            소속 사용자 ({members.length}명)
                          </h4>
                          {canEdit && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openAddMemberModal(group.id)}
                            >
                              <UserPlus className="w-3.5 h-3.5 mr-1" />
                              사용자 추가
                            </Button>
                          )}
                        </div>
                        {members.length === 0 ? (
                          <p className="text-sm text-content-tertiary py-4 text-center">
                            소속 사용자가 없습니다
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {members.map((m) => (
                              <div
                                key={m.user_id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-surface-raised group"
                              >
                                <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center flex-shrink-0">
                                  {m.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium text-content-primary truncate">
                                      {m.username}
                                    </span>
                                    <Badge
                                      variant={
                                        m.role === "system_admin" ||
                                        m.role === "org_admin"
                                          ? "warning"
                                          : "info"
                                      }
                                    >
                                      {getRoleDisplayName(m.role)}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-content-tertiary truncate">
                                    {m.email}
                                  </div>
                                </div>
                                {canEdit && (
                                  <button
                                    onClick={() =>
                                      handleRemoveMember(group.id, m.user_id)
                                    }
                                    className="p-1 rounded text-content-tertiary hover:text-status-error hover:bg-status-error/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                    title="그룹에서 제거"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}

              {groups.length === 0 && (
                <Card>
                  <CardBody>
                    <div className="text-center py-8 text-content-tertiary">
                      <Shield className="w-10 h-10 mx-auto mb-2" />
                      <p>등록된 역할 그룹이 없습니다</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={openCreateModal}
                        disabled={!canEdit}
                      >
                        첫 역할 그룹 추가
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── 탭 2: 사용자 기준 ── */}
          <TabsContent value="users">
            {/* 검색 및 필터 */}
            <div className="bg-surface-card rounded-lg shadow-sm border border-line p-4 space-y-3 mb-4">
              {/* Row 1: 역할 필터 탭 + 새로고침 */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-1 bg-surface-base rounded-lg p-1">
                  {[
                    { key: "", label: "전체" },
                    { key: "system_admin", label: "시스템 관리자" },
                    { key: "org_admin", label: "조직 관리자" },
                    { key: "user", label: "일반 사용자" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setUserTabRoleFilter(tab.key);
                        setUserTabPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        userTabRoleFilter === tab.key
                          ? "bg-surface-card shadow-sm text-content-primary border border-line"
                          : "text-content-secondary hover:text-content-primary"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadUserTab}
                  disabled={userTabLoading}
                  icon={
                    <RefreshCw
                      className={`w-4 h-4 ${userTabLoading ? "animate-spin" : ""}`}
                    />
                  }
                >
                  새로고침
                </Button>
              </div>
              {/* Row 2: 검색 */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
                  <Input
                    type="text"
                    placeholder="이메일 또는 사용자명 검색"
                    value={userTabSearch}
                    onChange={(e) => {
                      setUserTabSearch(e.target.value);
                      setUserTabPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* 사용자 테이블 */}
            <div className="bg-surface-card rounded-lg shadow-sm border border-line overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-line">
                  <thead className="bg-surface-raised">
                    <tr>
                      <th className="w-8 px-4 py-3" />
                      <th className="px-6 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                        사용자
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                        이메일
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                        역할
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                        소속 그룹
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface-card divide-y divide-line">
                    {userTabLoading ? (
                      <>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-4 py-4">
                              <div className="w-4 h-4 bg-surface-raised rounded" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-surface-raised" />
                                <div className="ml-3 h-4 w-20 bg-surface-raised rounded" />
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-36 bg-surface-raised rounded" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-5 w-16 bg-surface-raised rounded-full" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-1">
                                <div className="h-5 w-12 bg-surface-raised rounded-full" />
                                <div className="h-5 w-12 bg-surface-raised rounded-full" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    ) : userTabUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <Users className="w-10 h-10 mx-auto text-content-tertiary mb-2" />
                          <p className="text-content-secondary text-sm">
                            {userTabSearch || userTabRoleFilter
                              ? "검색 조건에 맞는 사용자가 없습니다."
                              : "등록된 사용자가 없습니다."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      userTabUsers.map((user) => (
                        <Fragment key={user.id}>
                          <tr
                            className={`cursor-pointer transition-colors ${
                              expandedUserId === user.id
                                ? "bg-brand-50/50 dark:bg-brand-950/20"
                                : "hover:bg-surface-raised"
                            }`}
                            onClick={() => toggleUserRow(user.id)}
                          >
                            <td className="px-4 py-4">
                              {expandedUserId === user.id ? (
                                <ChevronDown className="w-4 h-4 text-content-tertiary" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-content-tertiary" />
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-content-inverse text-xs font-medium flex-shrink-0">
                                  {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="ml-3">
                                  <span className="text-sm font-medium text-content-primary">
                                    {user.username}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-content-secondary">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                variant={
                                  isAdminRole(user.role) ? "warning" : "success"
                                }
                              >
                                {getRoleDisplayName(user.role)}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {user.groups && user.groups.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {user.groups.map((g) => (
                                    <Badge key={g.id} variant="default">
                                      <Shield className="w-3 h-3 mr-0.5" />
                                      {g.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-content-tertiary">
                                  -
                                </span>
                              )}
                            </td>
                          </tr>
                          {/* 확장 패널: 그룹 관리 */}
                          {expandedUserId === user.id && (
                            <tr key={`${user.id}-groups`}>
                              <td
                                colSpan={5}
                                className="px-6 py-4 bg-surface-base border-b border-line"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-medium text-content-primary">
                                    <span className="text-brand-600">
                                      {user.username}
                                    </span>
                                    님의 소속 그룹
                                  </h4>
                                  {canEdit && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAddGroupModalOpen(true);
                                      }}
                                      disabled={
                                        availableGroupsForUser.length === 0
                                      }
                                    >
                                      <Plus className="w-3.5 h-3.5 mr-1" />
                                      그룹 추가
                                    </Button>
                                  )}
                                </div>
                                {userGroupsLoading ? (
                                  <div className="flex gap-2">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                      <Skeleton
                                        key={i}
                                        className="h-10 w-32 rounded-lg"
                                      />
                                    ))}
                                  </div>
                                ) : userGroups.length === 0 ? (
                                  <p className="text-sm text-content-tertiary py-2">
                                    소속된 역할 그룹이 없습니다
                                  </p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {userGroups.map((ug) => (
                                      <div
                                        key={ug.id}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-card border border-line group"
                                      >
                                        <Shield className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                                        <span className="text-sm font-medium text-content-primary">
                                          {ug.name}
                                        </span>
                                        {ug.is_default && (
                                          <Badge variant="default">
                                            <Lock className="w-3 h-3" />
                                          </Badge>
                                        )}
                                        {canEdit && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveGroupFromUser(ug.id);
                                            }}
                                            disabled={groupToggling !== null}
                                            className="p-0.5 rounded text-content-tertiary hover:text-status-error hover:bg-status-error/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                            title="그룹에서 제거"
                                          >
                                            {groupToggling === ug.id ? (
                                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <X className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {userTabTotalPages > 1 && (
                <div className="bg-surface-raised px-4 py-3 flex items-center justify-between border-t border-line">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <Button
                      variant="secondary"
                      onClick={() => setUserTabPage(userTabPage - 1)}
                      disabled={userTabPage === 1}
                    >
                      이전
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setUserTabPage(userTabPage + 1)}
                      disabled={userTabPage === userTabTotalPages}
                    >
                      다음
                    </Button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-content-secondary">
                        전체{" "}
                        <span className="font-medium">{userTabTotal}</span>명 중{" "}
                        <span className="font-medium">
                          {(userTabPage - 1) * userTabPerPage + 1}
                        </span>
                        -{" "}
                        <span className="font-medium">
                          {Math.min(userTabPage * userTabPerPage, userTabTotal)}
                        </span>
                        명 표시
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setUserTabPage(1)}
                        disabled={userTabPage === 1}
                      >
                        처음
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setUserTabPage(userTabPage - 1)}
                        disabled={userTabPage === 1}
                      >
                        이전
                      </Button>
                      <span className="px-4 py-2 text-sm text-content-primary">
                        {userTabPage} / {userTabTotalPages}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => setUserTabPage(userTabPage + 1)}
                        disabled={userTabPage === userTabTotalPages}
                      >
                        다음
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setUserTabPage(userTabTotalPages)}
                        disabled={userTabPage === userTabTotalPages}
                      >
                        마지막
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* 그룹 생성/수정 모달 */}
        <Modal
          isOpen={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          title={editingGroup ? "역할 그룹 수정" : "새 역할 그룹 추가"}
          footer={
            <ModalFooter
              onCancel={() => setFormModalOpen(false)}
              onConfirm={handleFormSubmit}
              confirmText={editingGroup ? "저장" : "생성"}
              cancelText="취소"
              confirmVariant="primary"
              loading={formSubmitting}
              disabled={!formName.trim()}
            />
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                역할 그룹명 <span className="text-status-error">*</span>
              </label>
              <Input
                type="text"
                placeholder="예: 운영팀"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                설명
              </label>
              <Textarea
                placeholder="역할 그룹 설명 (선택사항)"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </Modal>

        {/* 그룹 기준 탭: 사용자 추가 모달 */}
        <Modal
          isOpen={addMemberModalOpen}
          onClose={() => setAddMemberModalOpen(false)}
          title="사용자 추가"
        >
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
              <Input
                type="text"
                placeholder="이름 또는 이메일로 검색"
                value={memberSearchQuery}
                onChange={(e) => handleMemberSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {memberSearching ? (
                <div className="py-8 text-center text-sm text-content-tertiary">
                  검색 중...
                </div>
              ) : memberSearchResults.length === 0 ? (
                <div className="py-8 text-center text-sm text-content-tertiary">
                  {memberSearchQuery
                    ? "검색 결과가 없습니다"
                    : "사용자 이름이나 이메일을 입력하세요"}
                </div>
              ) : (
                memberSearchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-raised transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center flex-shrink-0">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-content-primary truncate">
                          {user.username}
                        </span>
                        <Badge
                          variant={
                            user.role === "system_admin" ||
                            user.role === "org_admin"
                              ? "warning"
                              : "info"
                          }
                        >
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </div>
                      <div className="text-xs text-content-tertiary truncate">
                        {user.email}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAddMember(user.id)}
                      loading={memberAdding === user.id}
                      disabled={memberAdding !== null}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      추가
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>

        {/* 사용자 기준 탭: 그룹 추가 모달 */}
        <Modal
          isOpen={addGroupModalOpen}
          onClose={() => setAddGroupModalOpen(false)}
          title={`${expandedUser?.username ?? "사용자"}에게 그룹 추가`}
        >
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {availableGroupsForUser.length === 0 ? (
              <div className="py-8 text-center text-sm text-content-tertiary">
                추가 가능한 그룹이 없습니다
              </div>
            ) : (
              availableGroupsForUser.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-raised transition-colors"
                >
                  <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-950">
                    <Shield className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-content-primary">
                        {group.name}
                      </span>
                      {group.is_default && (
                        <Badge variant="default">
                          <Lock className="w-3 h-3 mr-0.5" />
                          기본
                        </Badge>
                      )}
                      <Badge variant="info">{group.member_count}명</Badge>
                    </div>
                    {group.description && (
                      <p className="text-xs text-content-tertiary mt-0.5">
                        {group.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      handleAddGroupToUser(group.id);
                      setAddGroupModalOpen(false);
                    }}
                    loading={groupToggling === group.id}
                    disabled={groupToggling !== null}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    추가
                  </Button>
                </div>
              ))
            )}
          </div>
        </Modal>
      </div>
    </>
  );
}
