/**
 * Dashboard 캔버스 상태 — 위젯 목록과 레이아웃(그리드 좌표)을 보관.
 *
 * P3.1 에서는 읽기 + Pin 드롭 + 삭제만 다룬다. 드래그/리사이즈 bulk 저장은
 * P3.2 에서 `dashboardsApi.updateLayout` 과 함께 도입.
 */

import { create } from "zustand";

import type {
  DashboardDetail,
  DashboardWidget,
} from "../lib/api/dashboards";

interface DashboardState {
  projectId: string | null;
  dashboard: DashboardDetail | null;
  isLoading: boolean;
  error: string | null;

  /** 대시보드 채팅에서 "포커스된" 위젯 ID. LLM 에 상세 props 를 전달할 대상. */
  selectedWidgetIds: string[];

  /** EmptyState suggestion chip 클릭 시 ChatPane(scope="dashboard") 이 자동 전송할 프롬프트. */
  pendingChatPrompt: string | null;

  setProjectId: (projectId: string | null) => void;
  setDashboard: (dashboard: DashboardDetail | null) => void;
  setLoading: (value: boolean) => void;
  setError: (msg: string | null) => void;

  upsertWidget: (widget: DashboardWidget) => void;
  removeWidget: (widgetId: string) => void;
  replaceWidgets: (widgets: DashboardWidget[]) => void;

  toggleSelection: (widgetId: string) => void;
  clearSelection: () => void;
  setSelection: (ids: string[]) => void;

  setPendingChatPrompt: (prompt: string | null) => void;

  reset: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  projectId: null,
  dashboard: null,
  isLoading: false,
  error: null,
  selectedWidgetIds: [],
  pendingChatPrompt: null,

  setProjectId: (projectId) => set({ projectId }),
  setDashboard: (dashboard) => set({ dashboard, error: null }),
  setLoading: (value) => set({ isLoading: value }),
  setError: (msg) => set({ error: msg }),

  upsertWidget: (widget) =>
    set((s) => {
      if (!s.dashboard) return s;
      const idx = s.dashboard.widgets.findIndex((w) => w.id === widget.id);
      const widgets =
        idx >= 0
          ? s.dashboard.widgets.map((w) => (w.id === widget.id ? widget : w))
          : [...s.dashboard.widgets, widget];
      return { dashboard: { ...s.dashboard, widgets } };
    }),

  removeWidget: (widgetId) =>
    set((s) => {
      if (!s.dashboard) return s;
      return {
        dashboard: {
          ...s.dashboard,
          widgets: s.dashboard.widgets.filter((w) => w.id !== widgetId),
        },
        selectedWidgetIds: s.selectedWidgetIds.filter((id) => id !== widgetId),
      };
    }),

  replaceWidgets: (widgets) =>
    set((s) => {
      const next = s.dashboard ? { ...s.dashboard, widgets } : s.dashboard;
      const alive = new Set(widgets.map((w) => w.id));
      return {
        dashboard: next,
        selectedWidgetIds: s.selectedWidgetIds.filter((id) => alive.has(id)),
      };
    }),

  toggleSelection: (widgetId) =>
    set((s) => {
      const has = s.selectedWidgetIds.includes(widgetId);
      return {
        selectedWidgetIds: has
          ? s.selectedWidgetIds.filter((id) => id !== widgetId)
          : [...s.selectedWidgetIds, widgetId],
      };
    }),

  clearSelection: () => set({ selectedWidgetIds: [] }),
  setSelection: (ids) => set({ selectedWidgetIds: ids }),

  setPendingChatPrompt: (prompt) => set({ pendingChatPrompt: prompt }),

  reset: () =>
    set({
      projectId: null,
      dashboard: null,
      isLoading: false,
      error: null,
      selectedWidgetIds: [],
      pendingChatPrompt: null,
    }),
}));
