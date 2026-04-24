import { create } from "zustand";
import { setCurrentWorkspaceId } from "../lib/api/client";
import {
  fetchDefaultWorkspace,
  fetchMyWorkspaces,
  switchWorkspaceApi,
} from "../lib/api/workspaces";
import type { WorkspaceSummary } from "../lib/api/workspaces";

interface WorkspaceState {
  currentWorkspaceId: string | null;
  currentWorkspace: WorkspaceSummary | null;
  myWorkspaces: WorkspaceSummary[];
  isLoading: boolean;
  /** loadDefault 완료 여부 — WorkspaceRoute에서 초기화 전/후 구분용 */
  initialized: boolean;

  /** 앱 부트스트랩 — Default WS 조회 후 상태 초기화 */
  loadDefault: () => Promise<void>;
  /** WS 전환 — POST /api/workspaces/{id}/switch + 상태 갱신 */
  switchWorkspace: (workspaceId: string) => Promise<void>;
  /** 내 WS 목록 갱신 */
  refreshMyWorkspaces: () => Promise<void>;
  /** 로그아웃 시 초기화 */
  clear: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentWorkspaceId: null,
  currentWorkspace: null,
  myWorkspaces: [],
  isLoading: false,
  initialized: false,

  loadDefault: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });

    const [defaultResult, listResult] = await Promise.allSettled([
      fetchDefaultWorkspace(),
      fetchMyWorkspaces(),
    ]);

    const defaultWs =
      defaultResult.status === "fulfilled" ? defaultResult.value : null;
    const list =
      listResult.status === "fulfilled" ? listResult.value : [];

    const wid = defaultWs?.id ?? null;
    setCurrentWorkspaceId(wid);

    set({
      currentWorkspaceId: wid,
      currentWorkspace: defaultWs,
      myWorkspaces: list,
      isLoading: false,
      initialized: true,
    });
  },

  switchWorkspace: async (workspaceId: string) => {
    const result = await switchWorkspaceApi(workspaceId);
    const wid = result.current_workspace_id;
    setCurrentWorkspaceId(wid);

    const found = get().myWorkspaces.find((w) => w.id === wid) ?? null;
    set({ currentWorkspaceId: wid, currentWorkspace: found });
  },

  refreshMyWorkspaces: async () => {
    const list = await fetchMyWorkspaces();
    set({ myWorkspaces: list });
  },

  clear: () => {
    setCurrentWorkspaceId(null);
    set({ currentWorkspaceId: null, currentWorkspace: null, myWorkspaces: [], initialized: false });
  },
}));
