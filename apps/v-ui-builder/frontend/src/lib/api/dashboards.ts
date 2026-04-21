/**
 * v-ui-builder Dashboard API — 프로젝트당 1 캔버스 + 위젯(Pin) CRUD.
 *
 * Vite proxy(`/api` → ui-builder-backend:8000) 기준 상대 경로.
 */

import { get, post, put, del, apiClient } from "@v-platform/core/api/client";

import type { Message } from "./ui-builder";

export type WidgetSource = "chat" | "pin-drag" | "manual";

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  call_id: string;
  tool: string;
  component: string;
  props: Record<string, unknown>;
  source_message_id: string | null;
  source_call_id: string | null;
  source: WidgetSource;
  category: string | null;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardDetail {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  layout_cols: number;
  row_height: number;
  created_at: string;
  updated_at: string;
  widgets: DashboardWidget[];
}

export interface WidgetCreateRequest {
  call_id: string;
  tool: string;
  component: string;
  props: Record<string, unknown>;
  source_message_id?: string | null;
  source_call_id?: string | null;
  grid_x?: number;
  grid_y?: number;
  grid_w?: number;
  grid_h?: number;
}

export interface WidgetLayoutItem {
  id: string;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
}

export interface WidgetCatalogEntry {
  tool: string;
  label: string;
  description: string;
  category: string;
  icon: string | null;
  component: string;
  default_grid: { w: number; h: number };
  default_args: Record<string, unknown>;
  schema: Record<string, unknown>;
  order: number;
}

export interface WidgetManualCreateRequest {
  tool: string;
  props?: Record<string, unknown> | null;
  grid_x?: number | null;
  grid_y?: number | null;
  grid_w?: number | null;
  grid_h?: number | null;
}

export interface WidgetUpdateRequest {
  props?: Record<string, unknown> | null;
  grid_x?: number | null;
  grid_y?: number | null;
  grid_w?: number | null;
  grid_h?: number | null;
  expected_updated_at?: string | null;
}

export interface WidgetConflictBody {
  detail: string;
  code: "widget_conflict";
}

export const dashboardsApi = {
  getDashboard: (projectId: string) =>
    get<DashboardDetail>(`/api/projects/${projectId}/dashboard`),

  listDashboardMessages: (projectId: string) =>
    get<Message[]>(`/api/projects/${projectId}/dashboard/messages`),

  pinWidget: (projectId: string, body: WidgetCreateRequest) =>
    post<DashboardWidget>(
      `/api/projects/${projectId}/dashboard/widgets`,
      body,
    ),

  deleteWidget: (projectId: string, widgetId: string) =>
    del<void>(`/api/projects/${projectId}/dashboard/widgets/${widgetId}`),

  updateLayout: (projectId: string, items: WidgetLayoutItem[]) =>
    put<DashboardWidget[]>(
      `/api/projects/${projectId}/dashboard/widgets/layout`,
      { items },
    ),

  getCatalog: (projectId: string) =>
    get<WidgetCatalogEntry[]>(
      `/api/projects/${projectId}/dashboard/widgets/catalog`,
    ),

  createManualWidget: (projectId: string, body: WidgetManualCreateRequest) =>
    post<DashboardWidget>(
      `/api/projects/${projectId}/dashboard/widgets/manual`,
      body,
    ),

  updateWidget: (
    projectId: string,
    widgetId: string,
    body: WidgetUpdateRequest,
  ) =>
    apiClient
      .patch<DashboardWidget>(
        `/api/projects/${projectId}/dashboard/widgets/${widgetId}`,
        body,
      )
      .then((r) => r.data),
};

/** Pin 드래그 MIME (ChatPane → DashboardCanvas). */
export const PIN_DRAG_MIME = "application/x-v-ui-builder-pin";

export interface PinDragPayload {
  call_id: string;
  tool: string;
  component: string;
  props: Record<string, unknown>;
  source_message_id?: string | null;
}

/** 대시보드 채팅 SSE 요청 바디 (P3.4). */
export interface DashboardChatRequestBody {
  prompt: string;
  selected_widget_ids?: string[];
  model?: string;
}

/** 서버가 방출하는 대시보드 op SSE 이벤트 이름. */
export type DashboardOpSseEvent =
  | "dashboard_widget_added"
  | "dashboard_widget_updated"
  | "dashboard_widget_removed"
  | "dashboard_widget_proposed"
  | "dashboard_layout_changed"
  | "dashboard_op_error";

/**
 * 위젯 추가/수정 프리뷰 제안.
 *
 * 백엔드 `dashboard_add_widget` / `dashboard_update_widget` 도구가 DB 반영 대신
 * 이 스펙을 SSE `dashboard_widget_proposed` 로 흘려준다. ChatPane 은 프리뷰 카드로
 * 렌더하고, 사용자가 "캔버스에 추가/반영" 버튼을 눌러야 실제로 `pinWidget` /
 * `updateWidget` 이 호출돼 대시보드에 반영된다.
 */
export interface WidgetProposalAdd {
  proposal_id: string;
  kind: "add";
  call_id: string;
  tool: string;
  component: string;
  props: Record<string, unknown>;
  grid: {
    x: number | null;
    y: number | null;
    w: number | null;
    h: number | null;
  };
}

export interface WidgetProposalUpdate {
  proposal_id: string;
  kind: "update";
  widget_id: string;
  tool: string;
  component: string | null;
  next_props: Record<string, unknown> | null;
  next_grid: {
    x: number | null;
    y: number | null;
    w: number | null;
    h: number | null;
  } | null;
}

export type WidgetProposal = WidgetProposalAdd | WidgetProposalUpdate;
