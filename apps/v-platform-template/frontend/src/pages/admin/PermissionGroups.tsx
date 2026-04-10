/**
 * PermissionGroups 페이지 — 역할 그룹 관리
 *
 * 역할 그룹 CRUD, 그룹별 메뉴 권한 설정, 소속 사용자 관리
 */

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Shield,
  Lock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import { usePermissionStore } from "../../store/permission";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import { Modal, ModalFooter } from "../../components/ui/Modal";
import { Card, CardBody } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { AccessLevelRadio } from "../../components/admin/permissions/AccessLevelRadio";
import type {
  PermissionGroup,
  MenuItemResponse,
  AccessLevel,
} from "../../lib/api/types";
import { getRoleDisplayName } from "../../lib/api/types";
import * as groupApi from "../../lib/api/permission-groups";
import * as permissionApi from "../../lib/api/permissions";

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
        actions={
          <Button onClick={openCreateModal} disabled={!canEdit}>
            <Plus className="w-4 h-4 mr-1.5" />
            역할 그룹 추가
          </Button>
        }
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

        {/* 그룹 목록 */}
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
                        <Badge variant="info">{group.member_count}명</Badge>
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
                                {nodes.map((n) => renderGrantRow(n, group, 0))}
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
                    <h4 className="text-sm font-medium text-content-primary mb-2">
                      소속 사용자 ({members.length}명)
                    </h4>
                    {members.length === 0 ? (
                      <p className="text-sm text-content-tertiary py-4 text-center">
                        소속 사용자가 없습니다
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {members.map((m) => (
                          <div
                            key={m.user_id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-surface-raised"
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
      </div>
    </>
  );
}
