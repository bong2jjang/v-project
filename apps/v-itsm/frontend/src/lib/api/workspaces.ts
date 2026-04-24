import { get, post, put, del } from "./client";

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type WsRole = "ws_admin" | "ws_member" | "ws_viewer";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  is_default: boolean;
  my_role: WsRole;
  is_my_default: boolean;
  ticket_count: number;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  settings: Record<string, unknown>;
  is_default: boolean;
  created_by: number | null;
  created_at: string;
  archived_at: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: number;
  email: string;
  username: string;
  role: WsRole;
  is_default: boolean;
  joined_at: string;
}

export interface WorkspaceSwitchResult {
  current_workspace_id: string;
  workspace: Workspace;
}

export interface WorkspaceCreate {
  name: string;
  slug: string;
  description?: string;
  icon_url?: string;
  settings?: Record<string, unknown>;
  is_default?: boolean;
}

export interface WorkspaceUpdate {
  name?: string;
  slug?: string;
  description?: string;
  icon_url?: string;
  settings?: Record<string, unknown>;
}

export interface WorkspaceMemberAdd {
  user_id: number;
  role?: WsRole;
  is_default?: boolean;
}

// ── API 함수 ──────────────────────────────────────────────────────────────────

export const fetchMyWorkspaces = (): Promise<WorkspaceSummary[]> =>
  get("/api/workspaces/me");

export const createWorkspace = (payload: WorkspaceCreate): Promise<Workspace> =>
  post("/api/admin/workspaces", payload);

export const fetchDefaultWorkspace = (): Promise<WorkspaceSummary> =>
  get("/api/workspaces/me/default");

export const switchWorkspaceApi = (id: string): Promise<WorkspaceSwitchResult> =>
  post(`/api/workspaces/${id}/switch`);

export const fetchWorkspace = (id: string): Promise<Workspace> =>
  get(`/api/workspaces/${id}`);

export const fetchWorkspaceMembers = (id: string): Promise<WorkspaceMember[]> =>
  get(`/api/workspaces/${id}/members`);

export const addWorkspaceMember = (
  id: string,
  payload: WorkspaceMemberAdd,
): Promise<WorkspaceMember> => post(`/api/workspaces/${id}/members`, payload);

export const updateMemberRole = (
  workspaceId: string,
  userId: number,
  role: WsRole,
): Promise<WorkspaceMember> =>
  put(`/api/workspaces/${workspaceId}/members/${userId}/role`, { role });

export const removeWorkspaceMember = (
  workspaceId: string,
  userId: number,
): Promise<void> =>
  del(`/api/workspaces/${workspaceId}/members/${userId}`);
