/**
 * DashboardCanvas — react-grid-layout 기반 드래그/리사이즈 캔버스 (P3.2).
 *
 * - 초기 로드: TanStack Query 로 GET /api/projects/:id/dashboard → zustand 동기화.
 * - 외부 드래그: ChatPane 의 PIN_DRAG_MIME 페이로드를 drop 하면 pinWidget.
 * - 내부 드래그/리사이즈: GridLayout 의 onLayoutChange 를 300ms 디바운스한 뒤
 *   dashboardsApi.updateLayout 로 bulk 저장. 낙관적 업데이트는 zustand 에 반영.
 * - 삭제: 각 위젯 헤더의 휴지통 버튼(`cancel` 대상) → deleteWidget.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import {
  Columns2,
  Columns3,
  Loader2,
  Pin,
  Rows,
  Settings2,
  Trash2,
  Undo2,
} from "lucide-react";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import {
  PIN_DRAG_MIME,
  dashboardsApi,
  type DashboardDetail,
  type DashboardWidget,
  type PinDragPayload,
  type WidgetCreateRequest,
  type WidgetLayoutItem,
} from "../../../lib/api/dashboards";
import type { UiCallRecord } from "../../../lib/api/ui-builder";
import { useDashboardStore } from "../../../store/dashboard";
import { GenUiRenderer } from "../gen-ui/GenUiRenderer";
import { UiActionScopeProvider } from "../gen-ui/UiActionScope";

type ReflowStrategy = "stack" | "2col" | "3col";
const RESET_H = 4;
const DELETE_UNDO_MS = 6000;

interface DashboardCanvasProps {
  projectId: string;
}

const dashboardKey = (projectId: string) =>
  ["ui-builder", "dashboard", projectId] as const;

const ResponsiveGrid = WidthProvider(GridLayout);
const DRAG_CANCEL_SELECTOR = ".widget-no-drag";
const LAYOUT_SAVE_DEBOUNCE_MS = 300;

export function DashboardCanvas({ projectId }: DashboardCanvasProps) {
  const setDashboard = useDashboardStore((s) => s.setDashboard);
  const setProjectId = useDashboardStore((s) => s.setProjectId);
  const replaceWidgets = useDashboardStore((s) => s.replaceWidgets);
  const dashboard = useDashboardStore((s) => s.dashboard);
  const selectedWidgetIds = useDashboardStore((s) => s.selectedWidgetIds);
  const toggleSelection = useDashboardStore((s) => s.toggleSelection);
  const inspectedWidgetId = useDashboardStore((s) => s.inspectedWidgetId);
  const setInspectedWidgetId = useDashboardStore(
    (s) => s.setInspectedWidgetId,
  );

  const [isDragOver, setIsDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<DashboardWidget | null>(null);

  const queryClient = useQueryClient();
  const saveTimerRef = useRef<number | null>(null);
  const pendingLayoutRef = useRef<WidgetLayoutItem[] | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: dashboardKey(projectId),
    queryFn: () => dashboardsApi.getDashboard(projectId),
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    setProjectId(projectId);
    return () => {
      setProjectId(null);
    };
  }, [projectId, setProjectId]);

  useEffect(() => {
    if (data) setDashboard(data);
  }, [data, setDashboard]);

  const pinMutation = useMutation({
    mutationFn: (payload: PinDragPayload) =>
      dashboardsApi.pinWidget(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKey(projectId) });
    },
    onError: (err) => {
      setDropError(
        err instanceof Error ? err.message : "위젯 고정에 실패했습니다.",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (widgetId: string) =>
      dashboardsApi.deleteWidget(projectId, widgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKey(projectId) });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (body: WidgetCreateRequest) =>
      dashboardsApi.pinWidget(projectId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKey(projectId) });
    },
    onError: (err) => {
      setDropError(
        err instanceof Error ? err.message : "위젯 복원에 실패했습니다.",
      );
    },
  });

  const scheduleUndoClear = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      undoTimerRef.current = null;
      setPendingUndo(null);
    }, DELETE_UNDO_MS);
  }, []);

  const handleDelete = useCallback(
    (widget: DashboardWidget) => {
      setPendingUndo(widget);
      scheduleUndoClear();
      deleteMutation.mutate(widget.id);
    },
    [deleteMutation, scheduleUndoClear],
  );

  const handleUndoDelete = useCallback(() => {
    const w = pendingUndo;
    if (!w) return;
    setPendingUndo(null);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    restoreMutation.mutate({
      call_id: w.call_id,
      tool: w.tool,
      component: w.component,
      props: w.props,
      source_message_id: w.source_message_id ?? null,
      source_call_id: w.source_call_id ?? null,
      grid_x: w.grid_x,
      grid_y: w.grid_y,
      grid_w: w.grid_w,
      grid_h: w.grid_h,
    });
  }, [pendingUndo, restoreMutation]);

  const layoutMutation = useMutation({
    mutationFn: (items: WidgetLayoutItem[]) =>
      dashboardsApi.updateLayout(projectId, items),
    onSuccess: (widgets) => {
      replaceWidgets(widgets);
      queryClient.setQueryData(
        dashboardKey(projectId),
        (old: DashboardDetail | undefined) =>
          old ? { ...old, widgets } : old,
      );
    },
  });

  const current: DashboardDetail | null = dashboard ?? data ?? null;
  const widgets = current?.widgets ?? [];
  const cols = current?.layout_cols ?? 12;
  const rowHeight = current?.row_height ?? 80;

  const applyReflow = useCallback(
    (strategy: ReflowStrategy) => {
      if (widgets.length === 0) return;
      const colCount = strategy === "stack" ? 1 : strategy === "2col" ? 2 : 3;
      const w = Math.floor(12 / colCount);
      const items: WidgetLayoutItem[] = widgets.map((widget, idx) => ({
        id: widget.id,
        grid_x: (idx % colCount) * w,
        grid_y: Math.floor(idx / colCount) * RESET_H,
        grid_w: w,
        grid_h: RESET_H,
      }));
      replaceWidgets(
        widgets.map((widget, idx) => ({
          ...widget,
          grid_x: (idx % colCount) * w,
          grid_y: Math.floor(idx / colCount) * RESET_H,
          grid_w: w,
          grid_h: RESET_H,
        })),
      );
      layoutMutation.mutate(items);
    },
    [widgets, replaceWidgets, layoutMutation],
  );

  const layout: Layout[] = useMemo(
    () =>
      widgets.map((w) => ({
        i: w.id,
        x: w.grid_x,
        y: w.grid_y,
        w: w.grid_w,
        h: w.grid_h,
        minW: 2,
        minH: 2,
      })),
    [widgets],
  );

  const scheduleLayoutSave = useCallback(
    (items: WidgetLayoutItem[]) => {
      pendingLayoutRef.current = items;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        const next = pendingLayoutRef.current;
        pendingLayoutRef.current = null;
        if (next) layoutMutation.mutate(next);
      }, LAYOUT_SAVE_DEBOUNCE_MS);
    },
    [layoutMutation],
  );

  const handleLayoutChange = useCallback(
    (next: Layout[]) => {
      if (!current || widgets.length === 0) return;
      const byId = new Map(widgets.map((w) => [w.id, w]));
      let changed = false;
      const items: WidgetLayoutItem[] = [];
      for (const item of next) {
        const w = byId.get(item.i);
        if (!w) continue;
        if (
          w.grid_x !== item.x ||
          w.grid_y !== item.y ||
          w.grid_w !== item.w ||
          w.grid_h !== item.h
        ) {
          changed = true;
        }
        items.push({
          id: w.id,
          grid_x: item.x,
          grid_y: item.y,
          grid_w: item.w,
          grid_h: item.h,
        });
      }
      if (!changed) return;

      replaceWidgets(
        widgets.map((w) => {
          const item = next.find((n) => n.i === w.id);
          return item
            ? {
                ...w,
                grid_x: item.x,
                grid_y: item.y,
                grid_w: item.w,
                grid_h: item.h,
              }
            : w;
        }),
      );
      scheduleLayoutSave(items);
    },
    [current, widgets, replaceWidgets, scheduleLayoutSave],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(PIN_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropError(null);
    const raw = e.dataTransfer.getData(PIN_DRAG_MIME);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as PinDragPayload;
      pinMutation.mutate(payload);
    } catch {
      setDropError("드래그 페이로드를 읽을 수 없습니다.");
    }
  };

  if (isLoading && !dashboard) {
    return (
      <div className="h-full flex items-center justify-center text-content-tertiary">
        <Loader2 size={16} className="animate-spin mr-1.5" />
        <span className="text-[12px]">대시보드 불러오는 중…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-status-danger text-[12px] font-mono px-4 text-center">
        대시보드 로드 실패: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex-1 min-h-0 overflow-auto p-4 transition-colors ${
          isDragOver
            ? "bg-brand-500/5 ring-2 ring-inset ring-brand-500/40"
            : "bg-surface-page"
        }`}
      >
        {dropError && (
          <div className="mb-2 text-[11px] text-status-danger bg-status-danger-light border border-status-danger-border rounded-button px-2 py-1.5 font-mono">
            {dropError}
          </div>
        )}

        {widgets.length > 0 && (
          <ReflowToolbar
            onApply={applyReflow}
            disabled={layoutMutation.isPending}
          />
        )}

        {widgets.length === 0 ? (
          <EmptyState isDragOver={isDragOver} projectId={projectId} />
        ) : (
          <ResponsiveGrid
            className="layout"
            layout={layout}
            cols={cols}
            rowHeight={rowHeight}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            draggableCancel={DRAG_CANCEL_SELECTOR}
            onLayoutChange={handleLayoutChange}
            compactType="vertical"
            isBounded
          >
            {widgets.map((w) => (
              <div key={w.id}>
                <UiActionScopeProvider
                  value={{ kind: "widget", widgetId: w.id, projectId }}
                >
                  <WidgetTile
                    widget={asCall(w)}
                    selected={selectedWidgetIds.includes(w.id)}
                    inspecting={inspectedWidgetId === w.id}
                    onToggleSelect={() => toggleSelection(w.id)}
                    onInspect={() =>
                      setInspectedWidgetId(
                        inspectedWidgetId === w.id ? null : w.id,
                      )
                    }
                    onRemove={() => handleDelete(w)}
                    removing={deleteMutation.isPending}
                  />
                </UiActionScopeProvider>
              </div>
            ))}
          </ResponsiveGrid>
        )}

        {(pinMutation.isPending || layoutMutation.isPending) && (
          <div className="absolute top-2 right-3 inline-flex items-center gap-1.5 rounded-button bg-surface-card border border-line px-2 py-1 text-[11px] text-content-secondary shadow-card">
            <Loader2 size={11} className="animate-spin" />
            {pinMutation.isPending ? "고정 중…" : "레이아웃 저장 중…"}
          </div>
        )}

        {pendingUndo && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-button bg-surface-chrome border border-line px-3 py-1.5 text-[12px] text-content-primary shadow-card">
            <span>위젯이 삭제되었습니다.</span>
            <button
              type="button"
              onClick={handleUndoDelete}
              disabled={restoreMutation.isPending}
              className="inline-flex items-center gap-1 rounded-button bg-brand-500 text-white px-2 py-0.5 text-[11px] hover:opacity-90 disabled:opacity-50"
            >
              <Undo2 size={11} /> 실행 취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ReflowToolbarProps {
  onApply: (strategy: ReflowStrategy) => void;
  disabled: boolean;
}

function ReflowToolbar({ onApply, disabled }: ReflowToolbarProps) {
  const buttons: Array<{
    key: ReflowStrategy;
    label: string;
    Icon: typeof Rows;
  }> = [
    { key: "stack", label: "1열", Icon: Rows },
    { key: "2col", label: "2열", Icon: Columns2 },
    { key: "3col", label: "3열", Icon: Columns3 },
  ];
  return (
    <div className="mb-2 flex items-center gap-1 text-[11px] text-content-tertiary">
      <span>정렬:</span>
      {buttons.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onApply(key)}
          disabled={disabled}
          title={`${label}로 재배치`}
          className="inline-flex items-center gap-1 rounded-button border border-line bg-surface-card px-1.5 py-0.5 hover:border-brand-500 hover:text-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon size={11} /> {label}
        </button>
      ))}
    </div>
  );
}

const EMPTY_SUGGESTIONS = [
  "애플(AAPL) 6개월 주가 차트 추가",
  "삼성전자 1년 주가 차트 추가",
  "달러/원 환율 3개월 추이 추가",
];

interface EmptyStateProps {
  isDragOver: boolean;
  projectId: string;
}

function EmptyState({ isDragOver, projectId: _projectId }: EmptyStateProps) {
  const setPendingChatPrompt = useDashboardStore(
    (s) => s.setPendingChatPrompt,
  );

  return (
    <div
      className={`h-full min-h-[240px] flex flex-col items-center justify-center text-center rounded-input border border-dashed px-4 ${
        isDragOver
          ? "border-brand-500 text-brand-500"
          : "border-line-heavy text-content-tertiary"
      }`}
    >
      <Pin size={22} className="mb-2" />
      <div className="text-[12.5px] font-medium text-content-primary">
        채팅 카드를 드래그하거나, 아래 예시로 시작하세요
      </div>
      <div className="text-[11px] mt-1">
        📌 아이콘 드래그 또는 우측 채팅 패널에 자연어 입력.
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {EMPTY_SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => setPendingChatPrompt(text)}
            className="inline-flex items-center rounded-button border border-line bg-surface-card px-2 py-1 text-[11px] text-content-secondary hover:border-brand-500 hover:text-brand-500"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

interface WidgetTileProps {
  widget: {
    widgetId: string;
    call: UiCallRecord;
  };
  selected: boolean;
  inspecting: boolean;
  onToggleSelect: () => void;
  onInspect: () => void;
  onRemove: () => void;
  removing: boolean;
}

function WidgetTile({
  widget,
  selected,
  inspecting,
  onToggleSelect,
  onInspect,
  onRemove,
  removing,
}: WidgetTileProps) {
  return (
    <div
      className={`h-full w-full relative group rounded-input border bg-surface-card shadow-card overflow-hidden flex flex-col transition-colors ${
        selected
          ? "border-brand-500 ring-1 ring-brand-500/50"
          : "border-line"
      }`}
    >
      <div className="flex items-center justify-between h-7 px-2 bg-[var(--color-surface-chrome)] border-b border-line text-[10.5px] font-mono text-content-tertiary shrink-0 cursor-move">
        <span className="truncate">
          <span className="text-brand-500">{widget.call.tool}</span>
          {widget.call.component && (
            <span className="text-content-tertiary"> · {widget.call.component}</span>
          )}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onInspect}
            onMouseDown={(e) => e.stopPropagation()}
            title={inspecting ? "Inspector 닫기" : "속성 편집"}
            aria-label="속성 편집"
            aria-pressed={inspecting}
            className={`widget-no-drag inline-flex items-center justify-center p-0.5 rounded-button transition-all ${
              inspecting
                ? "text-brand-500 opacity-100"
                : "text-content-tertiary opacity-0 group-hover:opacity-100 hover:text-brand-500 hover:bg-surface-overlay"
            }`}
          >
            <Settings2 size={12} />
          </button>
          <button
            type="button"
            onClick={onToggleSelect}
            onMouseDown={(e) => e.stopPropagation()}
            title={selected ? "채팅 포커스 해제" : "채팅에서 이 위젯 포커스"}
            aria-label="포커스 토글"
            aria-pressed={selected}
            className={`widget-no-drag inline-flex items-center justify-center p-0.5 rounded-button transition-all ${
              selected
                ? "text-brand-500 opacity-100"
                : "text-content-tertiary opacity-0 group-hover:opacity-100 hover:text-brand-500 hover:bg-surface-overlay"
            }`}
          >
            <Pin size={12} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={removing}
            title="고정 해제"
            aria-label="고정 해제"
            className="widget-no-drag opacity-0 group-hover:opacity-100 inline-flex items-center justify-center p-0.5 rounded-button text-content-tertiary hover:text-status-danger hover:bg-surface-overlay transition-all disabled:opacity-40"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="widget-no-drag flex-1 min-h-0 overflow-auto p-2">
        <GenUiRenderer call={widget.call} />
      </div>
    </div>
  );
}

function asCall(w: DashboardDetail["widgets"][number]): {
  widgetId: string;
  call: UiCallRecord;
} {
  return {
    widgetId: w.id,
    call: {
      call_id: w.call_id,
      tool: w.tool,
      status: "ok",
      component: w.component,
      props: w.props,
    } as UiCallRecord,
  };
}
