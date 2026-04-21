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

  /** Inspector 에서 편집 중인 단일 위젯 ID (null = Inspector 닫힘). */
  inspectedWidgetId: string | null;

  /** EmptyState suggestion chip 클릭 시 ChatPane(scope="dashboard") 이 자동 전송할 프롬프트. */
  pendingChatPrompt: string | null;

  /** 최근 삭제된 위젯 스택(LIFO). Ctrl+Z / 툴바 Undo 버튼이 pop 후 복원 mutation 호출. */
  undoStack: DashboardWidget[];

  /**
   * 프리뷰 제안별 수락/거절 상태. ChatPane 이 같은 메시지의 프리뷰 카드 버튼
   * 비활성화용으로 참조. 기본값은 "pending" (없으면 UI 가 pending 으로 간주).
   */
  proposalStatus: Record<string, "pending" | "accepted" | "dismissed">;

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

  setInspectedWidgetId: (id: string | null) => void;

  setPendingChatPrompt: (prompt: string | null) => void;

  pushDeletedWidget: (widget: DashboardWidget) => void;
  popDeletedWidget: () => DashboardWidget | null;
  clearUndoStack: () => void;

  markProposal: (
    proposalId: string,
    status: "pending" | "accepted" | "dismissed",
  ) => void;

  reset: () => void;
}

const UNDO_STACK_MAX = 20;

export const useDashboardStore = create<DashboardState>((set, get) => ({
  projectId: null,
  dashboard: null,
  isLoading: false,
  error: null,
  selectedWidgetIds: [],
  inspectedWidgetId: null,
  pendingChatPrompt: null,
  undoStack: [],
  proposalStatus: {},

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
        inspectedWidgetId:
          s.inspectedWidgetId === widgetId ? null : s.inspectedWidgetId,
      };
    }),

  replaceWidgets: (widgets) =>
    set((s) => {
      const next = s.dashboard ? { ...s.dashboard, widgets } : s.dashboard;
      const alive = new Set(widgets.map((w) => w.id));
      return {
        dashboard: next,
        selectedWidgetIds: s.selectedWidgetIds.filter((id) => alive.has(id)),
        inspectedWidgetId:
          s.inspectedWidgetId && !alive.has(s.inspectedWidgetId)
            ? null
            : s.inspectedWidgetId,
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

  setInspectedWidgetId: (id) => set({ inspectedWidgetId: id }),

  setPendingChatPrompt: (prompt) => set({ pendingChatPrompt: prompt }),

  pushDeletedWidget: (widget) =>
    set((s) => {
      const next = [...s.undoStack, widget];
      if (next.length > UNDO_STACK_MAX) next.splice(0, next.length - UNDO_STACK_MAX);
      return { undoStack: next };
    }),

  popDeletedWidget: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    const last = undoStack[undoStack.length - 1];
    set({ undoStack: undoStack.slice(0, -1) });
    return last;
  },

  clearUndoStack: () => set({ undoStack: [] }),

  markProposal: (proposalId, status) =>
    set((s) => ({
      proposalStatus: { ...s.proposalStatus, [proposalId]: status },
    })),

  reset: () =>
    set({
      projectId: null,
      dashboard: null,
      isLoading: false,
      error: null,
      selectedWidgetIds: [],
      inspectedWidgetId: null,
      pendingChatPrompt: null,
      undoStack: [],
      proposalStatus: {},
    }),
}));
