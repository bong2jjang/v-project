/**
 * WidgetPalette — GenUIBuilder 좌측 도킹 팔레트.
 *
 * - GET /widgets/catalog 로 받은 엔트리를 `category` 기준 아코디언으로 묶어 노출.
 * - 클릭 시 POST /widgets/manual 을 호출하여 대시보드에 바로 추가. 드래그도 지원(옵션).
 * - 카탈로그는 한 번 fetch 후 TanStack Query 가 캐싱(`staleTime` 길게 유지).
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";

import {
  dashboardsApi,
  type WidgetCatalogEntry,
} from "../../../lib/api/dashboards";
import { resolveIcon } from "./iconMap";

const CATEGORY_LABELS: Record<string, string> = {
  layout: "레이아웃",
  kpi: "KPI",
  chart: "차트",
  table: "테이블",
  feedback: "알림",
};

const CATEGORY_ORDER = ["layout", "kpi", "chart", "table", "feedback"];

interface WidgetPaletteProps {
  projectId: string;
}

const catalogKey = (projectId: string) =>
  ["ui-builder", "dashboard", "catalog", projectId] as const;

const dashboardKey = (projectId: string) =>
  ["ui-builder", "dashboard", projectId] as const;

export function WidgetPalette({ projectId }: WidgetPaletteProps) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pendingTool, setPendingTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: catalogKey(projectId),
    queryFn: () => dashboardsApi.getCatalog(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (tool: string) =>
      dashboardsApi.createManualWidget(projectId, { tool }),
    onMutate: (tool) => {
      setPendingTool(tool);
      setError(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKey(projectId) });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "위젯 추가에 실패했습니다.");
    },
    onSettled: () => {
      setPendingTool(null);
    },
  });

  const grouped = useMemo(() => {
    const byCat = new Map<string, WidgetCatalogEntry[]>();
    for (const entry of data ?? []) {
      const list = byCat.get(entry.category) ?? [];
      list.push(entry);
      byCat.set(entry.category, list);
    }
    const cats = Array.from(byCat.keys()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return cats.map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      entries: (byCat.get(cat) ?? []).slice().sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label);
      }),
    }));
  }, [data]);

  const toggle = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="h-full flex flex-col bg-surface-chrome border-r border-line min-w-0">
      <div className="h-9 flex items-center justify-between px-3 border-b border-line shrink-0">
        <span className="text-[11.5px] font-semibold text-content-primary">
          위젯 팔레트
        </span>
        {createMutation.isPending && (
          <Loader2 size={11} className="animate-spin text-content-tertiary" />
        )}
      </div>

      {error && (
        <div className="m-2 text-[10.5px] text-status-danger bg-status-danger-light border border-status-danger-border rounded-button px-2 py-1 font-mono">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto py-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-20 text-content-tertiary text-[11px]">
            <Loader2 size={12} className="animate-spin mr-1.5" />
            카탈로그 로딩 중…
          </div>
        ) : loadError ? (
          <div className="px-3 py-2 text-[11px] text-status-danger">
            카탈로그 로드 실패:{" "}
            {loadError instanceof Error ? loadError.message : String(loadError)}
          </div>
        ) : grouped.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-content-tertiary text-center">
            사용 가능한 위젯이 없습니다.
          </div>
        ) : (
          grouped.map(({ category, label, entries }) => {
            const isCollapsed = collapsed[category] ?? false;
            return (
              <div key={category} className="mb-0.5">
                <button
                  type="button"
                  onClick={() => toggle(category)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-content-tertiary hover:text-content-secondary"
                >
                  {isCollapsed ? (
                    <ChevronRight size={11} />
                  ) : (
                    <ChevronDown size={11} />
                  )}
                  <span>{label}</span>
                  <span className="ml-auto font-normal normal-case text-[10px] text-content-tertiary">
                    {entries.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="flex flex-col">
                    {entries.map((entry) => (
                      <PaletteItem
                        key={entry.tool}
                        entry={entry}
                        disabled={createMutation.isPending}
                        pending={pendingTool === entry.tool}
                        onAdd={() => createMutation.mutate(entry.tool)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface PaletteItemProps {
  entry: WidgetCatalogEntry;
  disabled: boolean;
  pending: boolean;
  onAdd: () => void;
}

function PaletteItem({ entry, disabled, pending, onAdd }: PaletteItemProps) {
  const Icon = resolveIcon(entry.icon);
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      title={entry.description}
      className="group w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-overlay disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-button bg-surface-card border border-line text-content-secondary group-hover:text-brand-500 group-hover:border-brand-500/40 shrink-0">
        <Icon size={12} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] text-content-primary truncate">
          {entry.label}
        </span>
        <span className="block text-[10px] text-content-tertiary truncate">
          {entry.description}
        </span>
      </span>
      <span className="shrink-0 text-content-tertiary opacity-0 group-hover:opacity-100">
        {pending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
      </span>
    </button>
  );
}
