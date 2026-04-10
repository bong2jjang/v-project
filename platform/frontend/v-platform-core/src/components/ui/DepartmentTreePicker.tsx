/**
 * DepartmentTreePicker 컴포넌트
 *
 * 부서를 트리 구조로 보여주는 드롭다운 선택기
 * flat 배열(parent_id)을 트리로 변환하여 계층 표시
 * Portal + fixed 포지셔닝으로 모달 내에서도 잘리지 않음
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, FolderTree, X } from "lucide-react";
import type { Department } from "../../lib/api/types";

interface DepartmentTreePickerProps {
  departments: Department[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
}

function buildTree(
  depts: Department[],
  parentId: number | null = null,
): Department[] {
  return depts
    .filter((d) => d.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function DepartmentTreePicker({
  departments,
  value,
  onChange,
  placeholder = "선택 안 함",
}: DepartmentTreePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const selectedDept = departments.find((d) => d.id === value);

  // 드롭다운 위치 계산 (트리거 버튼 기준)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = 260; // max-h-[260px]

    const openAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  // 열릴 때 위치 계산 + 스크롤/리사이즈 시 재계산
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // 선택된 값의 조상 노드 자동 펼침
  useEffect(() => {
    if (!value) return;
    const parents = new Set<number>();
    let current = departments.find((d) => d.id === value);
    while (current?.parent_id) {
      parents.add(current.parent_id);
      current = departments.find((d) => d.id === current!.parent_id);
    }
    if (parents.size > 0) {
      setExpanded((prev) => new Set([...prev, ...parents]));
    }
  }, [value, departments]);

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (id: number | null) => {
    onChange(id);
    setIsOpen(false);
  };

  /** 부서 경로 (예: "사업부 > 개발팀") */
  function getDeptPath(deptId: number): string {
    const parts: string[] = [];
    let current: Department | undefined = departments.find(
      (d) => d.id === deptId,
    );
    while (current) {
      parts.unshift(current.name);
      current = current.parent_id
        ? departments.find((d) => d.id === current!.parent_id)
        : undefined;
    }
    return parts.join(" > ");
  }

  function renderTree(parentId: number | null, depth: number) {
    const nodes = buildTree(departments, parentId);
    if (nodes.length === 0) return null;

    return nodes.map((dept) => {
      const hasChildren =
        departments.filter((d) => d.parent_id === dept.id).length > 0;
      const isExpanded = expanded.has(dept.id);
      const isSelected = dept.id === value;

      return (
        <div key={dept.id}>
          <div
            className={`flex items-center gap-1.5 py-1.5 px-2 cursor-pointer rounded transition-colors
              ${isSelected ? "bg-brand-50 dark:bg-brand-950/30 text-brand-600" : "hover:bg-surface-raised text-content-primary"}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => handleSelect(dept.id)}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(dept.id, e)}
                className="p-0.5 hover:bg-surface-sunken rounded flex-shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-content-tertiary" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-content-tertiary" />
                )}
              </button>
            ) : (
              <span className="w-4 flex-shrink-0" />
            )}
            <FolderTree className="w-3.5 h-3.5 text-content-tertiary flex-shrink-0" />
            <span className="text-sm truncate">{dept.name}</span>
            {dept.code && (
              <span className="text-xs text-content-tertiary flex-shrink-0">
                ({dept.code})
              </span>
            )}
          </div>
          {hasChildren && isExpanded && renderTree(dept.id, depth + 1)}
        </div>
      );
    });
  }

  return (
    <div className="relative">
      {/* 트리거 버튼 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-line-heavy rounded-input shadow-sm text-body-base bg-surface-base hover:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
      >
        <span
          className={`truncate text-left ${selectedDept ? "text-content-primary" : "text-content-tertiary"}`}
        >
          {selectedDept ? getDeptPath(selectedDept.id) : placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {selectedDept && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              className="p-0.5 hover:bg-surface-sunken rounded text-content-tertiary hover:text-content-primary"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-content-tertiary transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* 드롭다운 — Portal로 body에 렌더링하여 모달 overflow 클리핑 방지 */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="max-h-[260px] overflow-auto bg-surface-card border border-line rounded-lg shadow-lg py-1"
          >
            {/* "선택 안 함" */}
            <div
              className={`flex items-center gap-1.5 py-1.5 px-3 cursor-pointer rounded transition-colors mx-1
              ${value === null ? "bg-brand-50 dark:bg-brand-950/30 text-brand-600" : "hover:bg-surface-raised text-content-tertiary"}`}
              onClick={() => handleSelect(null)}
            >
              <span className="text-sm">{placeholder}</span>
            </div>

            {departments.length === 0 ? (
              <div className="px-3 py-2 text-sm text-content-tertiary text-center">
                부서가 없습니다
              </div>
            ) : (
              <div className="mx-1">{renderTree(null, 0)}</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
