/**
 * Organizations 페이지 — 회사·부서 관리
 *
 * 부서 트리: 인라인 추가/수정/삭제 + 드래그&드랍 (재배치/부모 변경)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  FolderTree,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Check,
  X,
  Undo2,
  Save,
  ChevronsUpDown,
  ChevronsDownUp,
  Download,
  Upload,
  Copy,
  Check as CheckIcon,
  Code2,
  List,
} from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import { usePermissionStore } from "../../stores/permission";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import { Modal, ModalFooter } from "../../components/ui/Modal";
import { Card, CardBody } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import type { Company, Department } from "../../api/types";
import * as orgApi from "../../api/organizations";

// ── 드래그&드랍 타입 ────────────────────────────────────────────────

interface DropTargetInfo {
  id: number;
  position: "before" | "child" | "after";
}

// ── 헬퍼 ────────────────────────────────────────────────────────────

/** flat → tree (같은 parent_id 끼리 sort_order 순) */
function buildDeptTree(
  depts: Department[],
  parentId: number | null = null,
): Department[] {
  return depts
    .filter((d) => d.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** targetId 가 ancestorId 의 하위 노드인지 재귀 확인 */
function isDescendantOf(
  allDepts: Department[],
  ancestorId: number,
  targetId: number,
): boolean {
  const children = allDepts.filter((d) => d.parent_id === ancestorId);
  for (const child of children) {
    if (child.id === targetId) return true;
    if (isDescendantOf(allDepts, child.id, targetId)) return true;
  }
  return false;
}

// ── 인라인 폼 (컴포넌트 외부 정의 — IME 안정성) ───────────────────────

function InlineForm({
  depth,
  name,
  code,
  onNameChange,
  onCodeChange,
  onSubmit,
  onCancel,
  submitting,
  icon,
}: {
  depth: number;
  name: string;
  code: string;
  onNameChange: (v: string) => void;
  onCodeChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-1.5 py-1.5 px-3 bg-surface-raised/50 rounded"
      style={{ paddingLeft: `${depth * 24 + 36}px` }}
    >
      {icon ?? (
        <FolderTree className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
      )}
      <input
        type="text"
        className="h-7 text-sm px-2 w-32 border border-line-heavy rounded bg-surface-base focus:outline-none focus:ring-1 focus:ring-brand-500"
        placeholder="부서명"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <input
        type="text"
        className="h-7 text-sm px-2 w-20 border border-line-heavy rounded bg-surface-base focus:outline-none focus:ring-1 focus:ring-brand-500"
        placeholder="코드"
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        onClick={onSubmit}
        disabled={submitting || !name.trim()}
        className="p-1 text-status-success hover:bg-surface-sunken rounded disabled:opacity-50"
        title="저장 (Enter)"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="p-1 text-status-error hover:bg-surface-sunken rounded"
        title="취소 (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function InlineEditRow({
  name,
  code,
  onNameChange,
  onCodeChange,
  onSubmit,
  onCancel,
  submitting,
}: {
  name: string;
  code: string;
  onNameChange: (v: string) => void;
  onCodeChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <input
        type="text"
        className="h-7 text-sm px-2 w-32 border border-line-heavy rounded bg-surface-base focus:outline-none focus:ring-1 focus:ring-brand-500"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <input
        type="text"
        className="h-7 text-sm px-2 w-20 border border-line-heavy rounded bg-surface-base focus:outline-none focus:ring-1 focus:ring-brand-500"
        placeholder="코드"
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        onClick={onSubmit}
        disabled={submitting || !name.trim()}
        className="p-1 text-status-success hover:bg-surface-sunken rounded disabled:opacity-50"
        title="저장 (Enter)"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="p-1 text-status-error hover:bg-surface-sunken rounded"
        title="취소 (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────

export default function Organizations() {
  const canEdit = usePermissionStore().canWrite("organizations");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 회사 모달
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [companySubmitting, setCompanySubmitting] = useState(false);

  // 부서 관련
  const [expandedCompanyId, setExpandedCompanyId] = useState<number | null>(
    null,
  );
  const [departments, setDepartments] = useState<Department[]>([]);
  const [originalDepartments, setOriginalDepartments] = useState<Department[]>(
    [],
  );
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [applyingDrag, setApplyingDrag] = useState(false);

  // 인라인 추가
  const [inlineAddParentId, setInlineAddParentId] = useState<
    number | "root" | null
  >(null);
  const [inlineAddName, setInlineAddName] = useState("");
  const [inlineAddCode, setInlineAddCode] = useState("");
  const [inlineAddSubmitting, setInlineAddSubmitting] = useState(false);

  // 인라인 수정
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineEditName, setInlineEditName] = useState("");
  const [inlineEditCode, setInlineEditCode] = useState("");
  const [inlineEditSubmitting, setInlineEditSubmitting] = useState(false);

  // 트리 접힘
  const [collapsedDepts, setCollapsedDepts] = useState<Set<number>>(new Set());

  // JSON 편집 탭
  const [deptViewMode, setDeptViewMode] = useState<"tree" | "json">("tree");
  const [jsonText, setJsonText] = useState("");
  const [jsonSaving, setJsonSaving] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  // 드래그&드랍
  const dragDeptRef = useRef<Department | null>(null);
  const [dragDeptId, setDragDeptId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetInfo | null>(null);

  // ── 드래그 변경 감지 ────────────────────────────────────────────────

  const hasPendingDragChanges =
    departments.length > 0 &&
    departments.some((d) => {
      const orig = originalDepartments.find((o) => o.id === d.id);
      return (
        orig &&
        (orig.parent_id !== d.parent_id || orig.sort_order !== d.sort_order)
      );
    });

  const revertDragChanges = () => {
    setDepartments(originalDepartments.map((d) => ({ ...d })));
  };

  const applyDragChanges = async () => {
    if (!expandedCompanyId) return;
    setApplyingDrag(true);
    try {
      const updates: Promise<unknown>[] = [];
      for (const dept of departments) {
        const orig = originalDepartments.find((o) => o.id === dept.id);
        if (
          orig &&
          (orig.parent_id !== dept.parent_id ||
            orig.sort_order !== dept.sort_order)
        ) {
          updates.push(
            orgApi.updateDepartment(dept.id, {
              parent_id: dept.parent_id,
              sort_order: dept.sort_order,
            }),
          );
        }
      }
      await Promise.all(updates);
      setSuccess(`${updates.length}건의 부서 변경이 반영되었습니다`);
      reloadDepartments(expandedCompanyId);
    } catch {
      setError("부서 변경 반영에 실패했습니다");
    } finally {
      setApplyingDrag(false);
    }
  };

  // ── 회사 CRUD ──────────────────────────────────────────────────────

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.getCompanies();
      setCompanies(res);
    } catch {
      setError("회사 목록을 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // 첫 회사의 부서를 자동으로 펼치기
  useEffect(() => {
    if (companies.length > 0 && expandedCompanyId === null && !deptsLoading) {
      toggleDepartments(companies[0].id);
    }
  }, [companies]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateCompany = () => {
    setEditingCompany(null);
    setCompanyName("");
    setCompanyCode("");
    setCompanySubmitting(false);
    setCompanyModalOpen(true);
  };

  const openEditCompany = (company: Company) => {
    setEditingCompany(company);
    setCompanyName(company.name);
    setCompanyCode(company.code);
    setCompanySubmitting(false);
    setCompanyModalOpen(true);
  };

  const handleCompanySubmit = async () => {
    if (!companyName.trim() || !companyCode.trim()) return;
    setCompanySubmitting(true);
    try {
      if (editingCompany) {
        await orgApi.updateCompany(editingCompany.id, {
          name: companyName.trim(),
          code: companyCode.trim(),
        });
        setSuccess("회사 정보가 수정되었습니다");
      } else {
        await orgApi.createCompany({
          name: companyName.trim(),
          code: companyCode.trim(),
        });
        setSuccess("회사가 생성되었습니다");
      }
      setCompanyModalOpen(false);
      fetchCompanies();
    } catch {
      setError("저장에 실패했습니다");
    } finally {
      setCompanySubmitting(false);
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (!confirm(`"${company.name}" 회사를 삭제하시겠습니까?`)) return;
    try {
      await orgApi.deleteCompany(company.id);
      setSuccess("회사가 삭제되었습니다");
      if (expandedCompanyId === company.id) setExpandedCompanyId(null);
      fetchCompanies();
    } catch {
      setError("삭제에 실패했습니다");
    }
  };

  // ── 부서 목록 로드 ─────────────────────────────────────────────────

  const toggleDepartments = async (companyId: number) => {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null);
      return;
    }
    setExpandedCompanyId(companyId);
    setDeptsLoading(true);
    try {
      const res = await orgApi.getDepartments(companyId);
      setDepartments(res);
      setOriginalDepartments(res.map((d) => ({ ...d })));
    } catch {
      setError("부서 목록을 불러올 수 없습니다");
    } finally {
      setDeptsLoading(false);
    }
  };

  const reloadDepartments = async (companyId: number) => {
    try {
      const res = await orgApi.getDepartments(companyId);
      setDepartments(res);
      setOriginalDepartments(res.map((d) => ({ ...d })));
    } catch {
      /* ignore */
    }
  };

  // ── 부서 삭제 ──────────────────────────────────────────────────────

  const handleDeleteDept = async (dept: Department) => {
    const children = departments.filter((d) => d.parent_id === dept.id);
    const msg = children.length
      ? `"${dept.name}" 부서 및 하위 ${children.length}개 부서를 삭제하시겠습니까?`
      : `"${dept.name}" 부서를 삭제하시겠습니까?`;
    if (!confirm(msg)) return;
    try {
      await orgApi.deleteDepartment(dept.id);
      setSuccess("부서가 삭제되었습니다");
      if (expandedCompanyId) reloadDepartments(expandedCompanyId);
    } catch {
      setError("삭제에 실패했습니다");
    }
  };

  // ── 인라인 추가 ────────────────────────────────────────────────────

  const startInlineAdd = (parentId: number | "root") => {
    cancelInlineEdit();
    setInlineAddParentId(parentId);
    setInlineAddName("");
    setInlineAddCode("");
    // 부모 노드 펼치기
    if (typeof parentId === "number") {
      setCollapsedDepts((prev) => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
  };

  const cancelInlineAdd = () => {
    setInlineAddParentId(null);
    setInlineAddName("");
    setInlineAddCode("");
  };

  const submitInlineAdd = async () => {
    if (!inlineAddName.trim() || !expandedCompanyId) return;
    setInlineAddSubmitting(true);
    try {
      await orgApi.createDepartment(expandedCompanyId, {
        name: inlineAddName.trim(),
        code: inlineAddCode.trim() || undefined,
        parent_id:
          inlineAddParentId === "root"
            ? undefined
            : (inlineAddParentId ?? undefined),
      });
      setSuccess("부서가 생성되었습니다");
      cancelInlineAdd();
      reloadDepartments(expandedCompanyId);
    } catch {
      setError("부서 생성에 실패했습니다");
    } finally {
      setInlineAddSubmitting(false);
    }
  };

  // ── 인라인 수정 ────────────────────────────────────────────────────

  const startInlineEdit = (dept: Department) => {
    cancelInlineAdd();
    setInlineEditId(dept.id);
    setInlineEditName(dept.name);
    setInlineEditCode(dept.code ?? "");
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
  };

  const submitInlineEdit = async () => {
    if (!inlineEditId || !inlineEditName.trim() || !expandedCompanyId) return;
    setInlineEditSubmitting(true);
    try {
      await orgApi.updateDepartment(inlineEditId, {
        name: inlineEditName.trim(),
        code: inlineEditCode.trim() || undefined,
      });
      setSuccess("부서 정보가 수정되었습니다");
      cancelInlineEdit();
      reloadDepartments(expandedCompanyId);
    } catch {
      setError("부서 수정에 실패했습니다");
    } finally {
      setInlineEditSubmitting(false);
    }
  };

  // ── JSON 내보내기/가져오기 ────────────────────────────────────────

  /** 부서 목록 → JSON 문자열 (코드 기반 parent 참조, code 없으면 name fallback) */
  const deptsToJson = (depts: Department[]): string => {
    // code가 있으면 code, 없으면 name을 식별 키로 사용
    const keyMap = new Map(depts.map((d) => [d.id, d.code || d.name]));
    const nameMap = new Map(depts.map((d) => [d.id, d.name]));
    const exported = depts
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((d) => ({
        name: d.name,
        code: d.code || "",
        parent_code: d.parent_id ? (keyMap.get(d.parent_id) ?? null) : null,
        parent_name: d.parent_id ? (nameMap.get(d.parent_id) ?? null) : null,
        sort_order: d.sort_order,
        is_active: d.is_active,
      }));
    return JSON.stringify(exported, null, 2);
  };

  const switchToJsonView = () => {
    setJsonText(deptsToJson(departments));
    setDeptViewMode("json");
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonText || deptsToJson(departments));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const company = companies.find((c) => c.id === expandedCompanyId);
    const text = deptViewMode === "json" ? jsonText : deptsToJson(departments);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `departments-${company?.code || "org"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (text: string) => {
    if (!expandedCompanyId) return;
    let items: Array<{
      name: string;
      code?: string;
      parent_code?: string | null;
      parent_name?: string | null;
      sort_order?: number;
      is_active?: boolean;
    }>;
    try {
      items = JSON.parse(text);
      if (!Array.isArray(items)) throw new Error("배열이 아닙니다");
    } catch {
      setError("JSON 파싱 실패: 올바른 JSON 배열을 입력하세요");
      return;
    }

    // 유효성 검사
    for (const item of items) {
      if (!item.name?.trim()) {
        setError("JSON 오류: name 필드는 필수입니다");
        return;
      }
    }

    setJsonSaving(true);
    try {
      // 부모 없는 것(root) → 부모 있는 것 순서로 생성
      // 코드 → ID 매핑을 위해 단계적 처리
      const codeToId = new Map<string, number>();
      // 기존 부서의 코드 → ID 매핑
      for (const d of departments) {
        if (d.code) codeToId.set(d.code, d.id);
      }

      // name → ID 매핑 (parent_name fallback용)
      const nameToId = new Map<string, number>();
      for (const d of departments) {
        nameToId.set(d.name, d.id);
      }

      const hasParent = (i: (typeof items)[0]) =>
        !!(i.parent_code || i.parent_name);
      const roots = items.filter((i) => !hasParent(i));
      const children = items.filter((i) => hasParent(i));
      let created = 0;

      for (const item of roots) {
        const res = await orgApi.createDepartment(expandedCompanyId, {
          name: item.name.trim(),
          code: item.code?.trim() || undefined,
          sort_order: item.sort_order ?? 0,
        });
        const key = item.code?.trim() || item.name.trim();
        codeToId.set(key, res.id);
        nameToId.set(item.name.trim(), res.id);
        created++;
      }

      // 최대 5 depth 까지 반복 처리
      let pending = [...children];
      for (let round = 0; round < 5 && pending.length > 0; round++) {
        const nextPending: typeof pending = [];
        for (const item of pending) {
          // parent_code로 찾고, 실패하면 parent_name으로 fallback
          let parentId: number | undefined;
          if (item.parent_code) {
            parentId = codeToId.get(item.parent_code);
            if (!parentId) parentId = nameToId.get(item.parent_code);
          }
          if (!parentId && item.parent_name) {
            parentId = nameToId.get(item.parent_name);
          }
          if (!parentId) {
            nextPending.push(item);
            continue;
          }
          const res = await orgApi.createDepartment(expandedCompanyId, {
            name: item.name.trim(),
            code: item.code?.trim() || undefined,
            parent_id: parentId,
            sort_order: item.sort_order ?? 0,
          });
          const key = item.code?.trim() || item.name.trim();
          codeToId.set(key, res.id);
          nameToId.set(item.name.trim(), res.id);
          created++;
        }
        pending = nextPending;
      }

      setSuccess(`${created}개 부서가 가져오기되었습니다`);
      reloadDepartments(expandedCompanyId);
      setDeptViewMode("tree");
    } catch {
      setError("부서 가져오기 중 오류가 발생했습니다");
    } finally {
      setJsonSaving(false);
    }
  };

  const handleJsonSave = () => handleImportJson(jsonText);

  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        if (deptViewMode === "json") {
          setJsonText(text);
        } else {
          handleImportJson(text);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── 트리 접힘 토글 ─────────────────────────────────────────────────

  const toggleCollapse = (deptId: number) => {
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  // ── 드래그&드랍 핸들러 ──────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, dept: Department) => {
    dragDeptRef.current = dept;
    setDragDeptId(dept.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dept.id.toString());
  };

  const handleDragEnd = () => {
    dragDeptRef.current = null;
    setDragDeptId(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, targetDept: Department) => {
    e.preventDefault();
    const dragDept = dragDeptRef.current;
    if (!dragDept || dragDept.id === targetDept.id) return;
    if (isDescendantOf(departments, dragDept.id, targetDept.id)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;

    let position: DropTargetInfo["position"];
    if (y < h * 0.25) position = "before";
    else if (y > h * 0.75) position = "after";
    else position = "child";

    setDropTarget((prev) => {
      if (prev?.id === targetDept.id && prev?.position === position)
        return prev;
      return { id: targetDept.id, position };
    });
  };

  const handleDragLeave = (targetId: number) => {
    setDropTarget((prev) => (prev?.id === targetId ? null : prev));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragDept = dragDeptRef.current;
    if (!dragDept || !dropTarget) {
      handleDragEnd();
      return;
    }

    const targetDept = departments.find((d) => d.id === dropTarget.id);
    if (!targetDept) {
      handleDragEnd();
      return;
    }

    const { position } = dropTarget;
    let newParentId: number | null;
    let siblings: Department[];

    if (position === "child") {
      newParentId = targetDept.id;
      siblings = departments
        .filter((d) => d.parent_id === targetDept.id && d.id !== dragDept.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      siblings.push({ ...dragDept, parent_id: newParentId });
    } else {
      newParentId = targetDept.parent_id;
      siblings = departments
        .filter((d) => d.parent_id === newParentId && d.id !== dragDept.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const targetIdx = siblings.findIndex((d) => d.id === targetDept.id);
      const insertIdx = position === "before" ? targetIdx : targetIdx + 1;
      siblings.splice(insertIdx, 0, { ...dragDept, parent_id: newParentId });
    }

    // 로컬 상태만 갱신 (서버 반영은 "변경 반영" 버튼에서)
    setDepartments((prev) => {
      const next = prev.map((d) => ({ ...d }));
      siblings.forEach((s, idx) => {
        const found = next.find((n) => n.id === s.id);
        if (found) {
          found.sort_order = idx * 10;
          if (found.id === dragDept.id) {
            found.parent_id = newParentId;
          }
        }
      });
      return next;
    });

    if (typeof newParentId === "number") {
      setCollapsedDepts((prev) => {
        const next = new Set(prev);
        next.delete(newParentId as number);
        return next;
      });
    }

    handleDragEnd();
  };

  // ── 부서 트리 렌더링 ───────────────────────────────────────────────

  function renderDeptTree(
    depts: Department[],
    allDepts: Department[],
    depth: number,
  ) {
    return depts.map((dept) => {
      const children = buildDeptTree(allDepts, dept.id);
      const hasChildren = children.length > 0;
      const isCollapsed = collapsedDepts.has(dept.id);
      const isEditing = inlineEditId === dept.id;
      const isDragging = dragDeptId === dept.id;
      const isDropBefore =
        dropTarget?.id === dept.id && dropTarget.position === "before";
      const isDropChild =
        dropTarget?.id === dept.id && dropTarget.position === "child";
      const isDropAfter =
        dropTarget?.id === dept.id && dropTarget.position === "after";
      const showInlineAdd = inlineAddParentId === dept.id;

      return (
        <div key={dept.id} className={isDragging ? "opacity-30" : ""}>
          {/* ── 드랍 인디케이터: before ── */}
          {isDropBefore && (
            <div
              className="h-0.5 bg-brand-500 rounded-full"
              style={{ marginLeft: `${depth * 24 + 36}px`, marginRight: 12 }}
            />
          )}

          {/* ── 부서 노드 행 ── */}
          <div
            draggable={canEdit && !isEditing}
            onDragStart={(e) => handleDragStart(e, dept)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, dept)}
            onDragLeave={() => handleDragLeave(dept.id)}
            onDrop={handleDrop}
            className={`flex items-center justify-between py-1.5 px-3 rounded transition-colors group
              ${isDropChild ? "ring-2 ring-brand-500 ring-inset bg-brand-50 dark:bg-brand-950/20" : "hover:bg-surface-raised"}`}
            style={{ paddingLeft: `${depth * 24 + 12}px` }}
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {/* 드래그 핸들 */}
              <GripVertical
                className={`w-3.5 h-3.5 flex-shrink-0 ${canEdit ? "text-content-tertiary opacity-0 group-hover:opacity-100 cursor-grab" : "text-content-muted cursor-not-allowed"}`}
              />

              {/* 접힘/펼침 */}
              {hasChildren ? (
                <button
                  onClick={() => toggleCollapse(dept.id)}
                  className="p-0.5 hover:bg-surface-sunken rounded"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-content-tertiary" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-content-tertiary" />
                  )}
                </button>
              ) : (
                <span className="w-[18px] flex-shrink-0" />
              )}

              <FolderTree className="w-3.5 h-3.5 text-content-tertiary flex-shrink-0" />

              {isEditing ? (
                /* ── 인라인 수정 모드 ── */
                <InlineEditRow
                  name={inlineEditName}
                  code={inlineEditCode}
                  onNameChange={setInlineEditName}
                  onCodeChange={setInlineEditCode}
                  onSubmit={submitInlineEdit}
                  onCancel={cancelInlineEdit}
                  submitting={inlineEditSubmitting}
                />
              ) : (
                /* ── 표시 모드 ── */
                <>
                  <span className="text-sm text-content-primary truncate">
                    {dept.name}
                  </span>
                  {dept.code && (
                    <span className="text-xs text-content-tertiary">
                      ({dept.code})
                    </span>
                  )}
                  {!dept.is_active && <Badge variant="danger">비활성</Badge>}
                </>
              )}
            </div>

            {/* ── 액션 버튼 ── */}
            {!isEditing && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => startInlineAdd(dept.id)}
                  title="하위 부서 추가"
                  className="p-1 text-content-tertiary hover:text-brand-600 hover:bg-surface-sunken rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canEdit}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => startInlineEdit(dept)}
                  title="수정"
                  className="p-1 text-content-tertiary hover:text-brand-600 hover:bg-surface-sunken rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canEdit}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteDept(dept)}
                  title="삭제"
                  className="p-1 text-content-tertiary hover:text-status-error hover:bg-surface-sunken rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canEdit}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* ── 드랍 인디케이터: after (자식 없거나 접힌 경우) ── */}
          {isDropAfter && (!hasChildren || isCollapsed) && (
            <div
              className="h-0.5 bg-brand-500 rounded-full"
              style={{ marginLeft: `${depth * 24 + 36}px`, marginRight: 12 }}
            />
          )}

          {/* ── 하위 부서 ── */}
          {!isCollapsed &&
            hasChildren &&
            renderDeptTree(children, allDepts, depth + 1)}

          {/* ── 드랍 인디케이터: after (자식이 펼쳐진 경우, 자식 아래에) ── */}
          {isDropAfter && hasChildren && !isCollapsed && (
            <div
              className="h-0.5 bg-brand-500 rounded-full"
              style={{ marginLeft: `${depth * 24 + 36}px`, marginRight: 12 }}
            />
          )}

          {/* ── 인라인 하위 부서 추가 폼 ── */}
          {showInlineAdd && (
            <InlineForm
              depth={depth + 1}
              name={inlineAddName}
              code={inlineAddCode}
              onNameChange={setInlineAddName}
              onCodeChange={setInlineAddCode}
              onSubmit={submitInlineAdd}
              onCancel={cancelInlineAdd}
              submitting={inlineAddSubmitting}
            />
          )}
        </div>
      );
    });
  }

  // ── 렌더링 ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <ContentHeader
          title="조직 관리"
          description="회사 및 부서 조직 구조를 관리합니다"
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
        title="조직 관리"
        description="회사 및 부서 조직 구조를 관리합니다"
        actions={
          <Button onClick={openCreateCompany} disabled={!canEdit}>
            <Plus className="w-4 h-4 mr-1.5" />
            회사 추가
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

        {/* 회사 목록 */}
        <div className="space-y-3">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950">
                      <Building2 className="w-5 h-5 text-brand-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-content-primary">
                          {company.name}
                        </span>
                        <Badge variant="default">{company.code}</Badge>
                        {!company.is_active && (
                          <Badge variant="danger">비활성</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toggleDepartments(company.id)}
                    >
                      {expandedCompanyId === company.id ? (
                        <ChevronDown className="w-3.5 h-3.5 mr-1" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 mr-1" />
                      )}
                      부서
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditCompany(company)}
                      disabled={!canEdit}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteCompany(company)}
                      disabled={!canEdit}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* 부서 트리 / JSON 편집 */}
                {expandedCompanyId === company.id && (
                  <div className="mt-4 border-t border-line pt-4">
                    {/* 헤더: 뷰 모드 탭 + 액션 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {/* 뷰 모드 탭 */}
                        <div className="flex items-center gap-1 bg-surface-raised rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => setDeptViewMode("tree")}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
                              deptViewMode === "tree"
                                ? "bg-surface-card text-content-primary shadow-sm font-medium"
                                : "text-content-tertiary hover:text-content-secondary"
                            }`}
                          >
                            <List className="w-3 h-3" />
                            트리
                          </button>
                          <button
                            type="button"
                            onClick={switchToJsonView}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
                              deptViewMode === "json"
                                ? "bg-surface-card text-content-primary shadow-sm font-medium"
                                : "text-content-tertiary hover:text-content-secondary"
                            }`}
                          >
                            <Code2 className="w-3 h-3" />
                            JSON
                          </button>
                        </div>
                        {deptViewMode === "tree" && (
                          <span className="text-xs text-content-tertiary">
                            드래그하여 순서 변경 · 노드 위에 드랍하여 하위로
                            이동
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* 트리 모드 전용 버튼 */}
                        {deptViewMode === "tree" && (
                          <>
                            {hasPendingDragChanges && (
                              <>
                                <span className="text-xs text-status-warning font-medium">
                                  미반영 변경 있음
                                </span>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={revertDragChanges}
                                  disabled={!canEdit}
                                >
                                  <Undo2 className="w-3.5 h-3.5 mr-1" />
                                  되돌리기
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={applyDragChanges}
                                  disabled={!canEdit || applyingDrag}
                                >
                                  <Save className="w-3.5 h-3.5 mr-1" />
                                  {applyingDrag ? "반영 중…" : "변경 반영"}
                                </Button>
                              </>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const allCollapsed =
                                  collapsedDepts.size === departments.length &&
                                  departments.length > 0;
                                setCollapsedDepts(
                                  allCollapsed
                                    ? new Set()
                                    : new Set(departments.map((d) => d.id)),
                                );
                              }}
                              title={
                                collapsedDepts.size === departments.length &&
                                departments.length > 0
                                  ? "전체 펼치기"
                                  : "전체 접기"
                              }
                            >
                              {collapsedDepts.size === departments.length &&
                              departments.length > 0 ? (
                                <ChevronsUpDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronsDownUp className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </>
                        )}
                        {/* JSON 내보내기/가져오기 (JSON 탭에서만 표시) */}
                        {deptViewMode === "json" && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleCopyJson}
                              title="JSON 복사"
                            >
                              {jsonCopied ? (
                                <CheckIcon className="w-3.5 h-3.5 text-status-success" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleDownloadJson}
                              title="JSON 내려받기"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => jsonFileInputRef.current?.click()}
                              title="JSON 올리기"
                              disabled={!canEdit}
                            >
                              <Upload className="w-3.5 h-3.5" />
                            </Button>
                            <input
                              ref={jsonFileInputRef}
                              type="file"
                              accept=".json"
                              className="hidden"
                              onChange={handleJsonFileUpload}
                            />
                          </>
                        )}
                        {deptViewMode === "tree" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => startInlineAdd("root")}
                            disabled={!canEdit}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            부서 추가
                          </Button>
                        )}
                      </div>
                    </div>

                    {deptsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full rounded" />
                        <Skeleton className="h-8 w-full rounded" />
                      </div>
                    ) : deptViewMode === "tree" ? (
                      <div className="space-y-0.5">
                        {/* 루트 인라인 추가 */}
                        {inlineAddParentId === "root" && (
                          <InlineForm
                            depth={0}
                            name={inlineAddName}
                            code={inlineAddCode}
                            onNameChange={setInlineAddName}
                            onCodeChange={setInlineAddCode}
                            onSubmit={submitInlineAdd}
                            onCancel={cancelInlineAdd}
                            submitting={inlineAddSubmitting}
                          />
                        )}

                        {departments.length === 0 &&
                        inlineAddParentId !== "root" ? (
                          <p className="text-sm text-content-tertiary text-center py-4">
                            등록된 부서가 없습니다
                          </p>
                        ) : (
                          renderDeptTree(
                            buildDeptTree(departments, null),
                            departments,
                            0,
                          )
                        )}
                      </div>
                    ) : (
                      /* JSON 편집 뷰 */
                      <div className="space-y-3">
                        <textarea
                          value={jsonText}
                          onChange={(e) => setJsonText(e.target.value)}
                          rows={16}
                          spellCheck={false}
                          className="w-full font-mono text-xs bg-surface-base border border-line rounded-lg p-3 text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-y"
                          placeholder='[\n  { "name": "개발부", "code": "DEV", "parent_code": null, "sort_order": 0 }\n]'
                          readOnly={!canEdit}
                        />
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-content-tertiary">
                            JSON 배열 형식 · parent_code로 상위 부서 참조 · 저장
                            시 새 부서로 추가됩니다
                          </p>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleJsonSave}
                            disabled={
                              !canEdit || jsonSaving || !jsonText.trim()
                            }
                          >
                            <Save className="w-3.5 h-3.5 mr-1" />
                            {jsonSaving ? "저장 중…" : "JSON 가져오기"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}

          {companies.length === 0 && (
            <Card>
              <CardBody>
                <div className="text-center py-8 text-content-tertiary">
                  <Building2 className="w-10 h-10 mx-auto mb-2" />
                  <p>등록된 회사가 없습니다</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={openCreateCompany}
                    disabled={!canEdit}
                  >
                    첫 회사 추가
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* 회사 생성/수정 모달 */}
        <Modal
          isOpen={companyModalOpen}
          onClose={() => setCompanyModalOpen(false)}
          title={editingCompany ? "회사 수정" : "새 회사 추가"}
          footer={
            <ModalFooter
              onCancel={() => setCompanyModalOpen(false)}
              onConfirm={handleCompanySubmit}
              confirmText={editingCompany ? "저장" : "생성"}
              cancelText="취소"
              confirmVariant="primary"
              loading={companySubmitting}
              disabled={!companyName.trim() || !companyCode.trim()}
            />
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                회사명 <span className="text-status-error">*</span>
              </label>
              <Input
                type="text"
                placeholder="예: VMS Korea"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                코드 <span className="text-status-error">*</span>
              </label>
              <Input
                type="text"
                placeholder="예: VMS-KR"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
              />
              <p className="mt-1 text-xs text-content-tertiary">
                고유한 회사 식별 코드 (영문, 숫자, 하이픈)
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}
