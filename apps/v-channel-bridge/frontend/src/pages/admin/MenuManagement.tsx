/**
 * MenuManagement 페이지
 *
 * 메뉴 관리 (system_admin 전용)
 * - 탭 기반 레이아웃 (기본 메뉴 / 관리 메뉴 / 커스텀 메뉴)
 * - 메뉴 그룹 (2차원 계층) 지원
 * - 커스텀 메뉴 CRUD
 * - 활성화/비활성화 토글
 * - 드래그 앤 드롭 순서 변경
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Globe,
  Frame,
  Link,
  Settings2,
  Save,
  RotateCcw,
  FolderOpen,
  FolderClosed,
  ChevronRight,
  ChevronDown,
  Download,
  Upload,
  Copy,
  Check,
  X,
} from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Toggle } from "../../components/ui/Toggle";
import { Alert } from "../../components/ui/Alert";
import { Skeleton, SkeletonMenuRow } from "../../components/ui/Skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/Tabs";
import {
  MenuFormModal,
  type MenuFormData,
} from "../../components/admin/MenuFormModal";
import type { MenuItemResponse } from "../../lib/api/types";
import * as permissionApi from "../../lib/api/permissions";
import { usePermissionStore } from "../../store/permission";

type MenuSection = "basic" | "admin" | "custom";

const ADMIN_KEYS = new Set([
  "users",
  "audit_logs",
  "monitoring",
  "menu_management",
  "permission_management",
]);

function getSection(menu: MenuItemResponse): MenuSection {
  // 서버에서 section 필드가 있으면 그대로 사용
  if (menu.section) return menu.section as MenuSection;
  // 폴백: built_in 메뉴는 permission_key로 판별
  if (menu.menu_type === "built_in") {
    return ADMIN_KEYS.has(menu.permission_key) ? "admin" : "basic";
  }
  return "custom";
}

const SECTION_LABELS: Record<MenuSection, string> = {
  basic: "기본 메뉴",
  admin: "관리 메뉴",
  custom: "커스텀 메뉴",
};

const SECTION_ICONS: Record<MenuSection, React.ReactNode> = {
  basic: <Globe className="w-4 h-4" />,
  admin: <Settings2 className="w-4 h-4" />,
  custom: <Frame className="w-4 h-4" />,
};

function MenuTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "built_in":
      return <Settings2 className="w-4 h-4 text-content-tertiary" />;
    case "custom_iframe":
      return <Frame className="w-4 h-4 text-brand-500" />;
    case "custom_link":
      return <Link className="w-4 h-4 text-status-info" />;
    case "menu_group":
      return <FolderClosed className="w-4 h-4 text-status-warning" />;
    default:
      return <Globe className="w-4 h-4 text-content-tertiary" />;
  }
}

function MenuTypeBadge({ type }: { type: string }) {
  switch (type) {
    case "built_in":
      return <Badge variant="default">기본</Badge>;
    case "custom_iframe":
      return <Badge variant="info">iframe</Badge>;
    case "custom_link":
      return <Badge variant="warning">링크</Badge>;
    case "menu_group":
      return <Badge variant="success">그룹</Badge>;
    default:
      return <Badge variant="default">{type}</Badge>;
  }
}

/** 메뉴 그룹과 하위 메뉴를 트리 구조로 조립 */
interface MenuNode {
  menu: MenuItemResponse;
  children: MenuItemResponse[];
}

function buildMenuTree(menus: MenuItemResponse[]): MenuNode[] {
  const groupMap = new Map<string, MenuItemResponse>();
  const childrenMap = new Map<string, MenuItemResponse[]>();
  const topLevel: MenuItemResponse[] = [];

  // 1단계: 그룹과 일반 메뉴 분리
  for (const m of menus) {
    if (m.menu_type === "menu_group") {
      groupMap.set(m.permission_key, m);
      if (!childrenMap.has(m.permission_key)) {
        childrenMap.set(m.permission_key, []);
      }
    }
  }

  // 2단계: parent_key 매칭
  for (const m of menus) {
    if (m.menu_type === "menu_group") continue;
    if (m.parent_key && groupMap.has(m.parent_key)) {
      childrenMap.get(m.parent_key)!.push(m);
    } else {
      topLevel.push(m);
    }
  }

  // 3단계: 트리 조립 (그룹 + 독립 항목)
  const result: MenuNode[] = [];

  // 모든 항목을 sort_order로 통합 정렬
  const allTopLevel = [...Array.from(groupMap.values()), ...topLevel].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  for (const item of allTopLevel) {
    if (item.menu_type === "menu_group") {
      const children = (childrenMap.get(item.permission_key) || []).sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      result.push({ menu: item, children });
    } else {
      result.push({ menu: item, children: [] });
    }
  }

  return result;
}

export default function MenuManagement() {
  const refreshSidebar = usePermissionStore((s) => s.fetchPermissions);
  const canEdit = usePermissionStore().canWrite("menu_management");
  const [menus, setMenus] = useState<MenuItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MenuSection>("basic");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editMenu, setEditMenu] = useState<MenuItemResponse | null>(null);
  const [createMode, setCreateMode] = useState<"menu" | "group">("menu");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<MenuItemResponse | null>(
    null,
  );

  // JSON import/export
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [jsonMode, setJsonMode] = useState<"export" | "import">("export");
  const [jsonText, setJsonText] = useState("");
  const [jsonImporting, setJsonImporting] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [jsonImportSection, setJsonImportSection] =
    useState<MenuSection>("custom");

  // 그룹 펼침 상태
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fetchMenus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await permissionApi.getAllMenus();
      setMenus(res.menus);
    } catch {
      setError("메뉴 목록을 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  // 활성화/비활성화 토글 (로컬 상태만 변경, 반영 버튼으로 서버 저장)
  const handleToggleActive = (menu: MenuItemResponse) => {
    setLocalMenus((prev) =>
      prev.map((m) =>
        m.id === menu.id ? { ...m, is_active: !m.is_active } : m,
      ),
    );
  };

  // 메뉴 생성/수정
  const handleSubmit = async (data: MenuFormData) => {
    setSaving(true);
    try {
      if (editMenu) {
        // 수정
        const updateData: Record<string, unknown> = {};
        if (data.label !== editMenu.label) updateData.label = data.label;
        if (data.sort_order !== editMenu.sort_order)
          updateData.sort_order = data.sort_order;
        if (editMenu.menu_type !== "built_in") {
          if (data.path !== editMenu.path) updateData.path = data.path;
          if (data.iframe_url !== (editMenu.iframe_url || ""))
            updateData.iframe_url = data.iframe_url;
          if (data.iframe_fullscreen !== (editMenu.iframe_fullscreen ?? false))
            updateData.iframe_fullscreen = data.iframe_fullscreen;
          if (data.open_in_new_tab !== editMenu.open_in_new_tab)
            updateData.open_in_new_tab = data.open_in_new_tab;
          if (data.icon !== (editMenu.icon || "")) updateData.icon = data.icon;
          if (data.is_active !== editMenu.is_active)
            updateData.is_active = data.is_active;
          // parent_key 변경
          const newParentKey = data.parent_key || null;
          if (newParentKey !== (editMenu.parent_key || null))
            updateData.parent_key = newParentKey;
        }
        await permissionApi.updateMenu(editMenu.id, updateData);
        setSuccess(`'${data.label}' 수정 완료`);
      } else {
        // 생성
        const createData: Parameters<typeof permissionApi.createMenu>[0] = {
          permission_key: data.permission_key,
          label: data.label,
          icon: data.icon || undefined,
          path:
            data.menu_type === "menu_group"
              ? `/group/${data.permission_key}`
              : data.path,
          menu_type: data.menu_type,
          iframe_url:
            data.menu_type === "custom_iframe" ? data.iframe_url : undefined,
          iframe_fullscreen:
            data.menu_type === "custom_iframe"
              ? data.iframe_fullscreen
              : undefined,
          open_in_new_tab: data.open_in_new_tab,
          parent_key: data.parent_key || undefined,
          sort_order: data.sort_order,
          section: activeTab,
        };
        await permissionApi.createMenu(createData);
        setSuccess(`'${data.label}' 추가 완료`);
      }
      setModalOpen(false);
      setEditMenu(null);
      await fetchMenus();
      await refreshSidebar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다";
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  };

  // 메뉴 삭제
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await permissionApi.deleteMenu(deleteTarget.id);
      setSuccess(`'${deleteTarget.label}' 삭제 완료`);
      setDeleteTarget(null);
      await fetchMenus();
      await refreshSidebar();
    } catch {
      setError("삭제에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  // ── 로컬 순서 변경 (서버 반영 전까지 로컬 상태만 변경) ───────
  const serverMenusRef = useRef<MenuItemResponse[]>([]);
  const [localMenus, setLocalMenus] = useState<MenuItemResponse[]>([]);
  const [applyingSection, setApplyingSection] = useState<MenuSection | null>(
    null,
  );

  // Drag & Drop state (최상위)
  const [dragItem, setDragItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [dragSection, setDragSection] = useState<MenuSection | null>(null);
  const [dragMenuId, setDragMenuId] = useState<number | null>(null);
  const [dragOverGroupKey, setDragOverGroupKey] = useState<string | null>(null);

  // Drag & Drop state (그룹 내 자식)
  const [dragChildIdx, setDragChildIdx] = useState<number | null>(null);
  const [dragOverChildIdx, setDragOverChildIdx] = useState<number | null>(null);
  const [dragChildGroupKey, setDragChildGroupKey] = useState<string | null>(
    null,
  );

  // menus가 서버에서 갱신되면 로컬 상태도 동기화
  useEffect(() => {
    serverMenusRef.current = menus;
    setLocalMenus(menus);
  }, [menus]);

  // Drag & Drop handlers
  const handleDragStart = (
    e: React.DragEvent,
    idx: number,
    section: MenuSection,
    menuId: number,
  ) => {
    setDragItem(idx);
    setDragSection(section);
    setDragMenuId(menuId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverItem !== idx) setDragOverItem(idx);
    setDragOverGroupKey(null);
  };

  /** 그룹 위에 드래그 시 — 그룹 안으로 이동 표시 */
  const handleDragOverGroup = (
    e: React.DragEvent,
    groupKey: string,
    groupId: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    // 자기 자신(그룹) 위에는 그룹 드롭 비활성
    if (dragMenuId === groupId) return;
    // 드래그 중인 아이템이 menu_group이면 그룹 안으로 넣지 않음
    const dragMenu = localMenus.find((m) => m.id === dragMenuId);
    if (dragMenu?.menu_type === "menu_group") return;
    e.dataTransfer.dropEffect = "move";
    setDragOverGroupKey(groupKey);
    setDragOverItem(null);
  };

  /** 그룹에 드롭 — parent_key 설정 (로컬 상태만 변경, 반영 버튼으로 서버 저장) */
  const handleDropOnGroup = (
    e: React.DragEvent,
    groupKey: string,
    section: MenuSection,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupKey(null);
    if (dragMenuId === null || dragSection !== section) return;

    const dragMenu = localMenus.find((m) => m.id === dragMenuId);
    if (!dragMenu || dragMenu.menu_type === "menu_group") return;
    // 이미 해당 그룹 소속이면 무시
    if (dragMenu.parent_key === groupKey) return;

    // 로컬 상태만 업데이트: parent_key 변경 (반영 버튼 클릭 시 서버 저장)
    setLocalMenus((prev) =>
      prev.map((m) =>
        m.id === dragMenuId ? { ...m, parent_key: groupKey } : m,
      ),
    );
  };

  const handleDrop = (
    e: React.DragEvent,
    dropIdx: number,
    section: MenuSection,
  ) => {
    e.preventDefault();
    setDragOverGroupKey(null);
    if (dragItem === null || dragSection !== section || dragItem === dropIdx)
      return;

    // 탭 내의 최상위 항목만 드래그 (그룹 포함, 그룹 내 children은 별도 처리)
    const sectionMenus = localMenus
      .filter(
        (m) =>
          getSection(m) === section &&
          (!m.parent_key ||
            !localMenus.some(
              (g) =>
                g.menu_type === "menu_group" &&
                g.permission_key === m.parent_key,
            )),
      )
      .sort((a, b) => a.sort_order - b.sort_order);

    const reordered = [...sectionMenus];
    const [removed] = reordered.splice(dragItem, 1);
    reordered.splice(dropIdx, 0, removed);

    const sortOrders = sectionMenus
      .map((m) => m.sort_order)
      .sort((a, b) => a - b);
    const updates = new Map<number, number>();
    reordered.forEach((m, i) => {
      updates.set(m.id, sortOrders[i]);
    });

    setLocalMenus((prev) =>
      prev.map((m) =>
        updates.has(m.id) ? { ...m, sort_order: updates.get(m.id)! } : m,
      ),
    );
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverItem(null);
    setDragSection(null);
    setDragMenuId(null);
    setDragOverGroupKey(null);
  };

  // ── 그룹 내 자식 메뉴 Drag & Drop ───────────────────────────
  const handleChildDragStart = (
    e: React.DragEvent,
    childIdx: number,
    groupKey: string,
    menuId: number,
  ) => {
    setDragChildIdx(childIdx);
    setDragChildGroupKey(groupKey);
    setDragMenuId(menuId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleChildDragOver = (e: React.DragEvent, childIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverChildIdx !== childIdx) setDragOverChildIdx(childIdx);
  };

  const handleChildDrop = (
    e: React.DragEvent,
    dropChildIdx: number,
    groupKey: string,
  ) => {
    e.preventDefault();
    if (
      dragChildIdx === null ||
      dragChildGroupKey !== groupKey ||
      dragChildIdx === dropChildIdx
    )
      return;

    const groupChildren = localMenus
      .filter((m) => m.parent_key === groupKey && m.menu_type !== "menu_group")
      .sort((a, b) => a.sort_order - b.sort_order);

    const reordered = [...groupChildren];
    const [removed] = reordered.splice(dragChildIdx, 1);
    reordered.splice(dropChildIdx, 0, removed);

    const sortOrders = groupChildren
      .map((m) => m.sort_order)
      .sort((a, b) => a - b);
    const updates = new Map<number, number>();
    reordered.forEach((m, i) => {
      updates.set(m.id, sortOrders[i]);
    });

    setLocalMenus((prev) =>
      prev.map((m) =>
        updates.has(m.id) ? { ...m, sort_order: updates.get(m.id)! } : m,
      ),
    );
  };

  const handleChildDragEnd = () => {
    setDragChildIdx(null);
    setDragOverChildIdx(null);
    setDragChildGroupKey(null);
    setDragMenuId(null);
  };

  // 섹션에 변경사항이 있는지 자동 감지 (순서 + 활성 상태 + 그룹 소속)
  const isSectionDirty = (section: MenuSection): boolean => {
    const serverMap = new Map(serverMenusRef.current.map((m) => [m.id, m]));
    return localMenus
      .filter((m) => getSection(m) === section)
      .some((m) => {
        const server = serverMap.get(m.id);
        return (
          server &&
          (server.sort_order !== m.sort_order ||
            server.is_active !== m.is_active ||
            (server.parent_key || null) !== (m.parent_key || null))
        );
      });
  };

  // 섹션별 변경사항 일괄 반영 (순서 + 활성 상태 + 그룹 소속)
  const handleApplyChanges = async (section: MenuSection) => {
    const sectionMenus = localMenus
      .filter((m) => getSection(m) === section)
      .sort((a, b) => a.sort_order - b.sort_order);

    const serverMap = new Map(serverMenusRef.current.map((m) => [m.id, m]));

    setApplyingSection(section);
    try {
      // 순서 변경 반영
      const hasOrderChange = sectionMenus.some(
        (m) => serverMap.get(m.id)?.sort_order !== m.sort_order,
      );
      if (hasOrderChange) {
        await permissionApi.reorderMenus(
          sectionMenus.map((m) => ({ id: m.id, sort_order: m.sort_order })),
        );
      }

      // 활성 상태 변경 반영
      const activeChanges = sectionMenus.filter(
        (m) => serverMap.get(m.id)?.is_active !== m.is_active,
      );
      for (const m of activeChanges) {
        await permissionApi.updateMenu(m.id, { is_active: m.is_active });
      }

      // 그룹 소속(parent_key) 변경 반영
      const parentKeyChanges = sectionMenus.filter(
        (m) =>
          (serverMap.get(m.id)?.parent_key || null) !== (m.parent_key || null),
      );
      for (const m of parentKeyChanges) {
        await permissionApi.updateMenu(m.id, {
          parent_key: m.parent_key || null,
        });
      }

      setSuccess(`${SECTION_LABELS[section]} 변경사항이 반영되었습니다`);
      await fetchMenus();
      await refreshSidebar();
    } catch {
      setError("변경사항 반영에 실패했습니다");
    } finally {
      setApplyingSection(null);
    }
  };

  // 섹션별 변경사항 되돌리기 (순서 + 활성 상태 + 그룹 소속)
  const handleResetChanges = (section: MenuSection) => {
    setLocalMenus((prev) => {
      const serverMap = new Map(serverMenusRef.current.map((m) => [m.id, m]));
      return prev.map((m) => {
        if (getSection(m) === section && serverMap.has(m.id)) {
          const server = serverMap.get(m.id)!;
          return {
            ...m,
            sort_order: server.sort_order,
            is_active: server.is_active,
            parent_key: server.parent_key,
          };
        }
        return m;
      });
    });
  };

  // ── JSON 내보내기/가져오기 ─────────────────────────────────────────

  /** 현재 탭 메뉴를 JSON으로 내보내기 */
  const handleExportJson = (section: MenuSection) => {
    const sectionMenus = localMenus
      .filter((m) => getSection(m) === section)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        permission_key: m.permission_key,
        label: m.label,
        icon: m.icon,
        path: m.path,
        menu_type: m.menu_type,
        iframe_url: m.iframe_url,
        iframe_fullscreen: m.iframe_fullscreen,
        open_in_new_tab: m.open_in_new_tab,
        parent_key: m.parent_key,
        sort_order: m.sort_order,
        section: m.section,
        is_active: m.is_active,
      }));

    setJsonText(JSON.stringify(sectionMenus, null, 2));
    setJsonMode("export");
    setJsonCopied(false);
    setJsonModalOpen(true);
  };

  /** JSON 클립보드 복사 */
  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    } catch {
      /* fallback: select textarea */
    }
  };

  /** JSON 파일 다운로드 */
  const handleDownloadJson = () => {
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menus-${activeTab}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** JSON 가져오기 모달 열기 */
  const openImportJson = () => {
    setJsonText("");
    setJsonMode("import");
    setJsonImportSection(activeTab === "basic" ? "custom" : activeTab);
    setJsonModalOpen(true);
  };

  /** JSON 가져오기 실행 */
  const handleImportJson = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setError("JSON 형식이 올바르지 않습니다");
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      setError("메뉴 배열 형식이 필요합니다 (비어있지 않은 배열)");
      return;
    }

    // 기존 permission_key 목록 (중복 방지)
    const existingKeys = new Set(localMenus.map((m) => m.permission_key));

    // 유효성 검증
    const validMenus: Array<{
      permission_key: string;
      label: string;
      icon?: string;
      path: string;
      menu_type: string;
      iframe_url?: string;
      iframe_fullscreen?: boolean;
      open_in_new_tab?: boolean;
      parent_key?: string;
      sort_order?: number;
      section?: string;
    }> = [];

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;
      if (!m.permission_key || !m.label || !m.path) {
        setError("각 메뉴에는 permission_key, label, path가 필수입니다");
        return;
      }

      // 중복 키 → 자동 suffix
      let key = String(m.permission_key);
      if (existingKeys.has(key)) {
        let suffix = 2;
        while (existingKeys.has(`${key}_${suffix}`)) suffix++;
        key = `${key}_${suffix}`;
      }
      existingKeys.add(key);

      validMenus.push({
        permission_key: key,
        label: String(m.label),
        icon: m.icon ? String(m.icon) : undefined,
        path: String(m.path),
        menu_type: String(m.menu_type || "custom_link"),
        iframe_url: m.iframe_url ? String(m.iframe_url) : undefined,
        iframe_fullscreen: Boolean(m.iframe_fullscreen),
        open_in_new_tab: Boolean(m.open_in_new_tab),
        parent_key: m.parent_key ? String(m.parent_key) : undefined,
        sort_order: typeof m.sort_order === "number" ? m.sort_order : undefined,
        section: jsonImportSection,
      });
    }

    setJsonImporting(true);
    try {
      let created = 0;
      for (const menu of validMenus) {
        await permissionApi.createMenu(menu);
        created++;
      }
      setSuccess(`${created}건의 메뉴가 가져오기 되었습니다`);
      setJsonModalOpen(false);
      await fetchMenus();
      await refreshSidebar();
    } catch {
      setError("메뉴 가져오기 중 오류가 발생했습니다");
    } finally {
      setJsonImporting(false);
    }
  };

  // 섹션별 메뉴 그룹핑 (로컬 상태 기준)
  const grouped: Record<MenuSection, MenuItemResponse[]> = useMemo(() => {
    const result: Record<MenuSection, MenuItemResponse[]> = {
      basic: [],
      admin: [],
      custom: [],
    };
    for (const menu of localMenus) {
      result[getSection(menu)].push(menu);
    }
    for (const key of Object.keys(result) as MenuSection[]) {
      result[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return result;
  }, [localMenus]);

  // 현재 탭에서 사용 가능한 메뉴 그룹 목록
  const availableGroups = useMemo(
    () => grouped[activeTab].filter((m) => m.menu_type === "menu_group"),
    [grouped, activeTab],
  );

  // 메뉴 행 렌더링
  const renderMenuRow = (
    menu: MenuItemResponse,
    idx: number,
    section: MenuSection,
    isChild = false,
    isGroupItem = false,
    childIdx?: number,
    parentGroupKey?: string,
  ) => (
    <div
      key={menu.id}
      draggable={canEdit}
      onDragStart={(e) => {
        if (isChild && childIdx !== undefined && parentGroupKey) {
          handleChildDragStart(e, childIdx, parentGroupKey, menu.id);
        } else if (!isChild) {
          handleDragStart(e, idx, section, menu.id);
        }
      }}
      onDragOver={(e) => {
        if (isChild && childIdx !== undefined) {
          handleChildDragOver(e, childIdx);
        } else if (!isChild) {
          if (isGroupItem && dragMenuId !== null) {
            const src = localMenus.find((m) => m.id === dragMenuId);
            if (src?.menu_type !== "menu_group" && dragMenuId !== menu.id) {
              handleDragOverGroup(e, menu.permission_key, menu.id);
              return;
            }
          }
          handleDragOver(e, idx);
        }
      }}
      onDrop={(e) => {
        if (isChild && childIdx !== undefined && parentGroupKey) {
          handleChildDrop(e, childIdx, parentGroupKey);
        } else if (!isChild) {
          if (isGroupItem && dragOverGroupKey === menu.permission_key) {
            handleDropOnGroup(e, menu.permission_key, section);
          } else {
            handleDrop(e, idx, section);
          }
        }
      }}
      onDragEnd={isChild ? handleChildDragEnd : handleDragEnd}
      className={`flex items-center gap-4 py-3 px-2 rounded-lg transition-colors ${
        dragMenuId === menu.id
          ? "opacity-30"
          : !menu.is_active
            ? "opacity-50"
            : ""
      } ${
        !isChild &&
        dragOverItem === idx &&
        dragSection === section &&
        dragMenuId !== menu.id
          ? "ring-2 ring-brand-500 ring-offset-1"
          : ""
      } ${
        isChild &&
        dragOverChildIdx === childIdx &&
        dragChildGroupKey === parentGroupKey &&
        dragMenuId !== menu.id
          ? "ring-2 ring-brand-500 ring-offset-1"
          : ""
      } ${
        isGroupItem && dragOverGroupKey === menu.permission_key
          ? "ring-2 ring-status-warning ring-offset-1 bg-status-warning/5"
          : ""
      } ${isChild ? "ml-8 border-l-2 border-line pl-4" : ""}`}
    >
      {/* 드래그 핸들 */}
      <div
        className={
          canEdit
            ? "cursor-grab active:cursor-grabbing text-content-tertiary hover:text-content-primary"
            : "text-content-muted cursor-not-allowed"
        }
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* 그룹 펼침/접힘 토글 */}
      {isGroupItem ? (
        <button
          onClick={() => toggleGroup(menu.permission_key)}
          className="p-0.5 text-content-tertiary hover:text-content-primary transition-colors"
        >
          {expandedGroups.has(menu.permission_key) ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      ) : null}

      {/* 아이콘 + 정보 */}
      {isGroupItem ? (
        expandedGroups.has(menu.permission_key) ? (
          <FolderOpen className="w-4 h-4 text-status-warning" />
        ) : (
          <FolderClosed className="w-4 h-4 text-status-warning" />
        )
      ) : (
        <MenuTypeIcon type={menu.menu_type} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-content-primary truncate">
            {menu.label}
          </span>
          <MenuTypeBadge type={menu.menu_type} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-content-tertiary font-mono">
            {menu.path}
          </span>
          <span className="text-xs text-content-tertiary">
            key: {menu.permission_key}
          </span>
          {menu.iframe_url && (
            <span
              className="text-xs text-content-tertiary truncate max-w-[200px]"
              title={menu.iframe_url}
            >
              URL: {menu.iframe_url}
            </span>
          )}
        </div>
      </div>

      {/* 정렬 순서 */}
      <span className="text-xs text-content-tertiary w-8 text-center">
        #{menu.sort_order}
      </span>

      {/* 활성화 토글 */}
      <Toggle
        checked={menu.is_active}
        onChange={() => handleToggleActive(menu)}
        size="sm"
        label={menu.is_active ? "활성" : "비활성"}
        disabled={!canEdit}
      />

      {/* 액션 버튼들 */}
      <div className="flex items-center gap-1">
        {isChild && menu.parent_key && (
          <button
            onClick={() => {
              setLocalMenus((prev) =>
                prev.map((m) =>
                  m.id === menu.id ? { ...m, parent_key: null } : m,
                ),
              );
            }}
            className="text-xs text-content-tertiary hover:text-status-warning px-1.5 py-0.5 hover:bg-surface-raised rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="그룹에서 빼기"
            disabled={!canEdit}
          >
            해제
          </button>
        )}
        <button
          onClick={() => {
            setEditMenu(menu);
            setModalOpen(true);
          }}
          className="p-1.5 text-content-tertiary hover:text-content-primary hover:bg-surface-raised rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="수정"
          disabled={!canEdit}
        >
          <Pencil className="w-4 h-4" />
        </button>
        {menu.menu_type !== "built_in" &&
          !(
            menu.menu_type === "menu_group" &&
            localMenus.some((m) => m.parent_key === menu.permission_key)
          ) && (
            <button
              onClick={() => setDeleteTarget(menu)}
              className="p-1.5 rounded-button transition-colors text-content-tertiary hover:text-status-danger hover:bg-status-danger-light disabled:opacity-50 disabled:cursor-not-allowed"
              title="삭제"
              disabled={!canEdit}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        <ContentHeader title="메뉴 관리" description="시스템 메뉴 구성 관리" />
        <div className="page-container space-y-section-gap">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-lg" />
            ))}
          </div>
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonMenuRow key={i} />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ContentHeader title="메뉴 관리" description="시스템 메뉴 구성 관리" />

      <div className="page-container space-y-section-gap">
        {success && (
          <Alert variant="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as MenuSection)}
        >
          <div className="flex items-center justify-between">
            <TabsList>
              {(["basic", "admin", "custom"] as MenuSection[]).map(
                (section) => (
                  <TabsTrigger
                    key={section}
                    value={section}
                    icon={SECTION_ICONS[section]}
                  >
                    {SECTION_LABELS[section]}
                    <Badge variant="default" className="ml-1.5">
                      {
                        grouped[section].filter(
                          (m) => m.menu_type !== "menu_group",
                        ).length
                      }
                    </Badge>
                  </TabsTrigger>
                ),
              )}
            </TabsList>

            {/* 우측 액션 버튼 */}
            <div className="flex items-center gap-2">
              {isSectionDirty(activeTab) && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={() => handleResetChanges(activeTab)}
                    disabled={!canEdit || applyingSection === activeTab}
                  >
                    되돌리기
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Save className="w-3.5 h-3.5" />}
                    onClick={() => handleApplyChanges(activeTab)}
                    loading={applyingSection === activeTab}
                    disabled={!canEdit}
                  >
                    변경 반영
                  </Button>
                </>
              )}

              {/* JSON 내보내기/가져오기 */}
              {grouped[activeTab].length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => handleExportJson(activeTab)}
                >
                  JSON 내보내기
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                icon={<Upload className="w-3.5 h-3.5" />}
                onClick={openImportJson}
                disabled={!canEdit}
              >
                JSON 가져오기
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={<FolderClosed className="w-3.5 h-3.5" />}
                onClick={() => {
                  setEditMenu(null);
                  setCreateMode("group");
                  setModalOpen(true);
                }}
                disabled={!canEdit}
              >
                메뉴 그룹 추가
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setEditMenu(null);
                  setCreateMode("menu");
                  setModalOpen(true);
                }}
                disabled={!canEdit}
              >
                커스텀 메뉴 추가
              </Button>
            </div>
          </div>

          {(["basic", "admin", "custom"] as MenuSection[]).map((section) => (
            <TabsContent key={section} value={section}>
              {grouped[section].length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-sm text-content-tertiary">
                    {section === "custom"
                      ? "아직 커스텀 메뉴가 없습니다. iframe, 외부 링크 또는 메뉴 그룹을 추가해 보세요."
                      : "메뉴가 없습니다."}
                  </p>
                  {section === "custom" && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Plus className="w-4 h-4" />}
                        onClick={() => {
                          setEditMenu(null);
                          setCreateMode("menu");
                          setModalOpen(true);
                        }}
                        disabled={!canEdit}
                      >
                        커스텀 메뉴 추가
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<FolderClosed className="w-4 h-4" />}
                        onClick={() => {
                          setEditMenu(null);
                          setCreateMode("group");
                          setModalOpen(true);
                        }}
                        disabled={!canEdit}
                      >
                        메뉴 그룹 추가
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {buildMenuTree(grouped[section]).map((node, idx) => (
                    <div key={node.menu.id}>
                      {/* 최상위 항목 또는 그룹 헤더 */}
                      {renderMenuRow(
                        node.menu,
                        idx,
                        section,
                        false,
                        node.menu.menu_type === "menu_group",
                      )}
                      {/* 그룹 하위 메뉴 */}
                      {node.menu.menu_type === "menu_group" &&
                        expandedGroups.has(node.menu.permission_key) &&
                        node.children.map((child, childIdx) =>
                          renderMenuRow(
                            child,
                            idx,
                            section,
                            true,
                            false,
                            childIdx,
                            node.menu.permission_key,
                          ),
                        )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* 메뉴 추가/수정 모달 */}
      <MenuFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditMenu(null);
        }}
        onSubmit={handleSubmit}
        editMenu={editMenu}
        availableGroups={availableGroups}
        loading={saving}
        createMode={createMode}
      />

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-modal overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="relative bg-surface-card rounded-modal shadow-modal border border-line max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-heading-md text-content-primary mb-2">
                메뉴 삭제
              </h3>
              <p className="text-sm text-content-secondary mb-4">
                '{deleteTarget.label}' 메뉴를 삭제하시겠습니까?
                <br />
                {deleteTarget.menu_type === "menu_group" ? (
                  <>하위 메뉴는 최상위로 이동됩니다.</>
                ) : (
                  <>관련 권한 설정도 함께 삭제됩니다.</>
                )}
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDeleteTarget(null)}
                >
                  취소
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  loading={saving}
                >
                  삭제
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON 내보내기/가져오기 모달 */}
      {jsonModalOpen && (
        <div className="fixed inset-0 z-modal overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setJsonModalOpen(false)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="relative bg-surface-card rounded-modal shadow-modal border border-line max-w-2xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-heading-md text-content-primary">
                  {jsonMode === "export"
                    ? `메뉴 JSON 내보내기 — ${SECTION_LABELS[activeTab]}`
                    : "메뉴 JSON 가져오기"}
                </h3>
                <button
                  onClick={() => setJsonModalOpen(false)}
                  className="p-1 text-content-tertiary hover:text-content-primary rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {jsonMode === "export" ? (
                <>
                  <p className="text-sm text-content-secondary mb-3">
                    이 JSON 데이터를 복사하거나 다운로드하여 다른 환경에서
                    가져오기할 수 있습니다.
                  </p>
                  <textarea
                    readOnly
                    value={jsonText}
                    className="w-full h-72 px-3 py-2 bg-surface-sunken border border-line rounded-lg text-sm text-content-primary font-mono resize-none focus:outline-none"
                  />
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={
                        jsonCopied ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )
                      }
                      onClick={handleCopyJson}
                    >
                      {jsonCopied ? "복사됨" : "클립보드 복사"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Download className="w-3.5 h-3.5" />}
                      onClick={handleDownloadJson}
                    >
                      파일 다운로드
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-content-secondary mb-3">
                    내보내기한 JSON 데이터를 붙여넣거나 파일에서 불러오세요.
                    중복된 permission_key는 자동으로 접미사가 추가됩니다.
                  </p>

                  {/* 가져올 섹션 선택 */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-content-secondary">
                      등록할 섹션:
                    </span>
                    {(["basic", "admin", "custom"] as MenuSection[]).map(
                      (sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setJsonImportSection(sec)}
                          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                            jsonImportSection === sec
                              ? "bg-brand-600 text-white"
                              : "bg-surface-raised text-content-secondary hover:text-content-primary"
                          }`}
                        >
                          {SECTION_LABELS[sec]}
                        </button>
                      ),
                    )}
                  </div>

                  {/* 파일 불러오기 */}
                  <div className="mb-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>파일에서 불러오기</span>
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setJsonText((ev.target?.result as string) || "");
                          };
                          reader.readAsText(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder={`[
  {
    "permission_key": "custom_my_menu",
    "label": "내 메뉴",
    "path": "/custom/my-menu",
    "menu_type": "custom_link",
    "icon": "globe",
    "is_active": true
  }
]`}
                    className="w-full h-72 px-3 py-2 bg-surface-card border border-line rounded-lg text-sm text-content-primary font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 placeholder:text-content-tertiary"
                  />
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setJsonModalOpen(false)}
                    >
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Upload className="w-3.5 h-3.5" />}
                      onClick={handleImportJson}
                      loading={jsonImporting}
                      disabled={!jsonText.trim()}
                    >
                      가져오기 (
                      {jsonImportSection === "basic"
                        ? "기본"
                        : jsonImportSection === "admin"
                          ? "관리"
                          : "커스텀"}{" "}
                      메뉴로)
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
