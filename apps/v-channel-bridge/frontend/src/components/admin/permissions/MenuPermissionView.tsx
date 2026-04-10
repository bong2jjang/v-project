/**
 * MenuPermissionView — 메뉴별 뷰
 *
 * 특정 메뉴 선택 → 해당 메뉴에 대한 모든 사용자 권한 일괄 관리
 */

import { useState, useEffect, useCallback } from "react";
import { Save, RotateCcw, Check } from "lucide-react";
import { Button } from "../../ui/Button";
import { Select } from "../../ui/Select";
import { Input } from "../../ui/Input";
import { Alert } from "../../ui/Alert";
import { Badge } from "../../ui/Badge";
import { PermissionSourceBadge } from "./PermissionSourceBadge";
import { AccessLevelRadio } from "./AccessLevelRadio";
import { MenuTreeSelector } from "./MenuTreeSelector";
import type { AccessLevel, MenuItemResponse } from "../../../lib/api/types";
import { getRoleDisplayName } from "../../../lib/api/types";
import * as permissionApi from "../../../lib/api/permissions";

interface MenuPermissionViewProps {
  menus: MenuItemResponse[];
  readOnly?: boolean;
}

interface MenuUserPermission {
  user_id: number;
  email: string;
  username: string;
  role: string;
  access_level: AccessLevel;
  source: string;
  group_names?: string[];
}

export function MenuPermissionView({
  menus,
  readOnly,
}: MenuPermissionViewProps) {
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [menuUsers, setMenuUsers] = useState<MenuUserPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 필터
  const [searchFilter, setSearchFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");

  // 체크박스
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(
    new Set(),
  );
  // 일괄 적용 레벨
  const [bulkLevel, setBulkLevel] = useState<AccessLevel>("read");

  // 로컬 변경사항: userId → AccessLevel
  const [changes, setChanges] = useState<Map<number, AccessLevel>>(new Map());

  const isDirty = changes.size > 0;

  const selectedMenu = menus.find((m) => m.id === selectedMenuId);

  const loadMenuPermissions = useCallback(async (menuId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await permissionApi.getPermissionsByMenu(menuId);
      setMenuUsers(res.users);
      setChanges(new Map());
      setSelectedUserIds(new Set());
    } catch {
      setError("권한 정보를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMenuId) {
      loadMenuPermissions(selectedMenuId);
    }
  }, [selectedMenuId, loadMenuPermissions]);

  const getLevel = (userId: number): AccessLevel => {
    if (changes.has(userId)) return changes.get(userId)!;
    const u = menuUsers.find((u) => u.user_id === userId);
    return u?.access_level ?? "none";
  };

  const handleChange = (userId: number, level: AccessLevel) => {
    setChanges((prev) => {
      const next = new Map(prev);
      const original =
        menuUsers.find((u) => u.user_id === userId)?.access_level ?? "none";
      if (level === original) {
        next.delete(userId);
      } else {
        next.set(userId, level);
      }
      return next;
    });
  };

  const handleBulkApply = () => {
    if (selectedUserIds.size === 0) return;
    setChanges((prev) => {
      const next = new Map(prev);
      for (const uid of selectedUserIds) {
        const original =
          menuUsers.find((u) => u.user_id === uid)?.access_level ?? "none";
        if (bulkLevel === original) {
          next.delete(uid);
        } else {
          next.set(uid, bulkLevel);
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!isDirty || !selectedMenuId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // 각 사용자별로 개인 권한 설정
      const promises = Array.from(changes.entries()).map(([userId, level]) =>
        permissionApi.setUserPermissions(userId, [
          { menu_item_id: selectedMenuId, access_level: level },
        ]),
      );
      await Promise.all(promises);
      setSuccess(`${changes.size}명의 권한이 저장되었습니다`);
      await loadMenuPermissions(selectedMenuId);
    } catch {
      setError("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setChanges(new Map());
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.user_id)));
    }
  };

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // 필터 적용
  const filteredUsers = menuUsers.filter((u) => {
    if (
      searchFilter &&
      !u.username.toLowerCase().includes(searchFilter.toLowerCase()) &&
      !u.email.toLowerCase().includes(searchFilter.toLowerCase())
    ) {
      return false;
    }
    if (roleFilter && u.role !== roleFilter) return false;
    if (levelFilter) {
      const effectiveLevel = getLevel(u.user_id);
      if (effectiveLevel !== levelFilter) return false;
    }
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      {/* 좌측: 메뉴 트리 */}
      <div className="bg-surface-card border border-line rounded-lg p-3 max-h-[calc(100vh-280px)] overflow-y-auto">
        <h3 className="text-sm font-medium text-content-primary mb-3">
          메뉴 선택
        </h3>
        <MenuTreeSelector
          menus={menus}
          selectedMenuId={selectedMenuId}
          onSelect={setSelectedMenuId}
        />
      </div>

      {/* 우측: 사용자 권한 테이블 */}
      <div className="bg-surface-card border border-line rounded-lg overflow-hidden">
        {!selectedMenuId ? (
          <div className="flex items-center justify-center h-64 text-content-tertiary text-sm">
            좌측에서 메뉴를 선택하세요
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64 text-content-tertiary text-sm">
            로딩 중...
          </div>
        ) : (
          <>
            {/* 메뉴 헤더 */}
            <div className="border-b border-line px-4 py-3 bg-surface-raised">
              <h3 className="text-sm font-medium text-content-primary">
                📋 &ldquo;{selectedMenu?.label}&rdquo; 권한 현황
              </h3>
            </div>

            {/* 필터 */}
            <div className="border-b border-line px-4 py-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-40">
                  <Input
                    type="text"
                    placeholder="검색"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="w-36">
                  <Select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="text-sm"
                  >
                    <option value="">모든 역할</option>
                    <option value="system_admin">시스템 관리자</option>
                    <option value="org_admin">조직 관리자</option>
                    <option value="user">일반 사용자</option>
                  </Select>
                </div>
                <div className="w-32">
                  <Select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="text-sm"
                  >
                    <option value="">모든 권한</option>
                    <option value="none">없음</option>
                    <option value="read">읽기</option>
                    <option value="write">쓰기</option>
                  </Select>
                </div>
                {selectedUserIds.size > 0 && (
                  <>
                    <div className="w-px h-7 bg-line mx-1" />
                    <div className="w-28">
                      <Select
                        value={bulkLevel}
                        onChange={(e) =>
                          setBulkLevel(e.target.value as AccessLevel)
                        }
                        className="text-sm"
                      >
                        <option value="none">없음</option>
                        <option value="read">읽기</option>
                        <option value="write">쓰기</option>
                      </Select>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleBulkApply}
                      disabled={readOnly}
                      className="h-[38px] text-sm"
                    >
                      일괄 적용 ({selectedUserIds.size}명)
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-raised">
                    <th className="px-3 py-2 text-left w-10">
                      <input
                        type="checkbox"
                        checked={
                          filteredUsers.length > 0 &&
                          selectedUserIds.size === filteredUsers.length
                        }
                        onChange={toggleSelectAll}
                        disabled={readOnly}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-content-secondary">
                      사용자
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-content-secondary">
                      이메일
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-content-secondary">
                      역할
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-content-secondary">
                      유효 권한
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-content-secondary">
                      출처
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredUsers.map((u) => {
                    const level = getLevel(u.user_id);
                    const isChanged = changes.has(u.user_id);
                    const isSA = u.role === "system_admin";

                    return (
                      <tr
                        key={u.user_id}
                        className={`transition-colors ${
                          isChanged
                            ? "bg-brand-50/50 dark:bg-brand-900/10"
                            : "hover:bg-surface-raised"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.has(u.user_id)}
                            onChange={() => toggleUser(u.user_id)}
                            disabled={readOnly || isSA}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center flex-shrink-0">
                              {(u.username ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-content-primary">
                              {u.username ?? u.email ?? "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-content-secondary">
                          {u.email}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              isSA
                                ? "danger"
                                : u.role === "org_admin"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {getRoleDisplayName(u.role)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isSA ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                              <Check className="w-3.5 h-3.5" />
                              ALL
                            </span>
                          ) : (
                            <AccessLevelRadio
                              value={level}
                              onChange={(l) => handleChange(u.user_id, l)}
                              disabled={readOnly}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {!isSA && u.source && (
                            <PermissionSourceBadge
                              source={
                                u.source as "personal" | "group" | "mixed"
                              }
                              groupNames={u.group_names}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-content-tertiary"
                      >
                        {menuUsers.length === 0
                          ? "사용자 데이터가 없습니다"
                          : "필터 조건에 맞는 사용자가 없습니다"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 하단 체크 + 저장 */}
            <div className="border-t border-line px-4 py-3 flex items-center justify-between">
              <div className="text-xs text-content-tertiary">
                {selectedUserIds.size > 0 && (
                  <span>{selectedUserIds.size}명 선택됨</span>
                )}
              </div>
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
          </>
        )}
      </div>

      {error && (
        <div className="lg:col-span-2">
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}
      {success && (
        <div className="lg:col-span-2">
          <Alert variant="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </div>
      )}
    </div>
  );
}
