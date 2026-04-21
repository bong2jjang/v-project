/**
 * Inspector — GenUIBuilder 우측 패널의 "속성" 탭 콘텐츠.
 *
 * - `inspectedWidgetId` 를 기준으로 현재 편집 대상 위젯을 결정.
 * - 카탈로그(`WidgetCatalogEntry`) 를 TanStack Query 로 캐시하여 스키마를 얻는다.
 * - 본문은 `<SchemaForm>` 에 위임. 제목/아이콘/닫기는 상위 탭바에서 담당한다.
 */

import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Settings2 } from "lucide-react";

import {
  dashboardsApi,
  type DashboardWidget,
  type WidgetCatalogEntry,
} from "../../../../lib/api/dashboards";
import { useDashboardStore } from "../../../../store/dashboard";
import { resolveIcon } from "../iconMap";
import { SchemaForm } from "./SchemaForm";

interface InspectorProps {
  projectId: string;
}

const catalogKey = (projectId: string) =>
  ["ui-builder", "dashboard", "catalog", projectId] as const;

function InspectorImpl({ projectId }: InspectorProps) {
  const inspectedWidgetId = useDashboardStore((s) => s.inspectedWidgetId);
  const dashboard = useDashboardStore((s) => s.dashboard);

  const widget = useMemo(() => {
    if (!inspectedWidgetId || !dashboard) return null;
    return dashboard.widgets.find((w) => w.id === inspectedWidgetId) ?? null;
  }, [inspectedWidgetId, dashboard]);

  const {
    data: catalog,
    isLoading: catalogLoading,
    error: catalogError,
  } = useQuery({
    queryKey: catalogKey(projectId),
    queryFn: () => dashboardsApi.getCatalog(projectId),
    enabled: Boolean(projectId) && Boolean(inspectedWidgetId),
    staleTime: 5 * 60 * 1000,
  });

  const catalogEntry: WidgetCatalogEntry | null = useMemo(() => {
    if (!widget || !catalog) return null;
    return catalog.find((e) => e.tool === widget.tool) ?? null;
  }, [widget, catalog]);

  return (
    <aside className="h-full w-full flex flex-col bg-surface-canvas min-h-0">
      {widget && catalogEntry && (
        <WidgetHeader widget={widget} catalogEntry={catalogEntry} />
      )}
      <div className="flex-1 min-h-0 flex flex-col">
        {!inspectedWidgetId ? (
          <EmptyState />
        ) : !dashboard ? (
          <StatusBlock icon="loading" message="대시보드 로딩 중…" />
        ) : !widget ? (
          <StatusBlock
            icon="warn"
            message="선택한 위젯을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다."
          />
        ) : catalogLoading ? (
          <StatusBlock icon="loading" message="카탈로그 로딩 중…" />
        ) : catalogError ? (
          <StatusBlock
            icon="warn"
            message={
              catalogError instanceof Error
                ? catalogError.message
                : "카탈로그를 불러오지 못했습니다."
            }
          />
        ) : !catalogEntry ? (
          <StatusBlock
            icon="warn"
            message={`'${widget.tool}' 위젯의 스키마를 찾을 수 없습니다.`}
          />
        ) : (
          <SchemaForm
            widget={widget}
            catalogEntry={catalogEntry}
            projectId={projectId}
          />
        )}
      </div>
    </aside>
  );
}

export const Inspector = memo(InspectorImpl);

interface WidgetHeaderProps {
  widget: DashboardWidget;
  catalogEntry: WidgetCatalogEntry;
}

function WidgetHeader({ widget, catalogEntry }: WidgetHeaderProps) {
  const Icon = resolveIcon(catalogEntry.icon);
  return (
    <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-line bg-surface-chrome">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-button bg-surface-card border border-line text-brand-500 shrink-0">
        <Icon size={12} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] text-content-primary truncate font-medium">
          {catalogEntry.label}
        </div>
        <div className="text-[10px] text-content-tertiary truncate font-mono">
          {widget.tool}
          {widget.component ? ` · ${widget.component}` : ""}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-content-tertiary gap-2">
      <Settings2 size={22} className="opacity-60" />
      <div className="text-[11.5px] text-content-secondary font-medium">
        위젯을 선택하면 여기서 편집할 수 있어요
      </div>
      <div className="text-[10.5px] leading-relaxed">
        캔버스에서 위젯을 클릭하거나, 팔레트에서 추가한 위젯의 설정 버튼을 눌러
        속성을 편집하세요.
      </div>
    </div>
  );
}

interface StatusBlockProps {
  icon: "loading" | "warn";
  message: string;
  action?: { label: string; onClick: () => void };
}

function StatusBlock({ icon, message, action }: StatusBlockProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2">
      {icon === "loading" ? (
        <Loader2
          size={18}
          className="animate-spin text-content-tertiary"
        />
      ) : (
        <AlertTriangle size={18} className="text-status-warning" />
      )}
      <div className="text-[11px] text-content-secondary leading-relaxed">
        {message}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 text-[11px] text-brand-500 hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
