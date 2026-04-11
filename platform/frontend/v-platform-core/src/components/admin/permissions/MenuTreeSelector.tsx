/**
 * MenuTreeSelector — 메뉴별 뷰에서 메뉴를 섹션·그룹 트리로 표시
 */

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { MenuItemResponse } from "../../../api/types";

interface MenuTreeNode {
  menu: MenuItemResponse;
  children: MenuTreeNode[];
}

interface MenuTreeSelectorProps {
  menus: MenuItemResponse[];
  selectedMenuId: number | null;
  onSelect: (menuId: number) => void;
}

/** 메뉴를 섹션별로 분류 후 parent_key 기반 트리 구성 */
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

    // 그룹의 자식 수집
    for (const item of items) {
      if (item.parent_key) {
        const arr = childMap.get(item.parent_key) ?? [];
        arr.push({ menu: item, children: [] });
        childMap.set(item.parent_key, arr);
      }
    }

    // 루트 노드 구성
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

const SECTION_LABELS: Record<string, string> = {
  basic: "기본 메뉴",
  admin: "관리 메뉴",
  custom: "커스텀 메뉴",
};

export function MenuTreeSelector({
  menus,
  selectedMenuId,
  onSelect,
}: MenuTreeSelectorProps) {
  const tree = buildMenuTree(menus);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  function renderNode(node: MenuTreeNode, depth: number) {
    const isGroup = node.menu.menu_type === "menu_group";
    const isExpanded = expanded.has(node.menu.permission_key);
    const isSelected = selectedMenuId === node.menu.id;

    if (isGroup) {
      return (
        <div key={node.menu.id}>
          <button
            onClick={() => toggleExpand(node.menu.permission_key)}
            className="w-full flex items-center gap-2 py-1.5 text-sm font-medium text-content-secondary hover:bg-surface-raised rounded-md transition-colors"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span>📁</span>
            <span className="truncate">{node.menu.label}</span>
          </button>
          {isExpanded &&
            node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    return (
      <button
        key={node.menu.id}
        onClick={() => onSelect(node.menu.id)}
        className={`
          w-full flex items-center gap-2 py-2 px-3 text-sm rounded-md transition-colors
          ${isSelected ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 font-medium" : "text-content-primary hover:bg-surface-raised"}
        `}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <span className="truncate">{node.menu.label}</span>
      </button>
    );
  }

  return (
    <div className="space-y-1">
      {(["basic", "admin", "custom"] as const).map((section) => {
        const nodes = tree[section];
        if (nodes.length === 0) return null;

        return (
          <div key={section} className="mb-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-content-tertiary px-3 mb-1">
              {SECTION_LABELS[section]}
            </h4>
            <div className="border-t border-line pt-1">
              {nodes.map((node) => renderNode(node, 0))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
