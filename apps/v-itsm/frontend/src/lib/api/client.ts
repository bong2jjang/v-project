import { apiClient } from "@v-platform/core/api/client";
export * from "@v-platform/core/api/client";

// ── 워크스페이스 prefix 인터셉터 ──────────────────────────────────────────────

let _currentWorkspaceId: string | null = null;

/** workspace store가 호출 — 현재 WS id를 인터셉터에 등록 */
export function setCurrentWorkspaceId(id: string | null): void {
  _currentWorkspaceId = id;
}

// 워크스페이스 prefix 삽입 제외 경로
const WS_EXEMPT = [
  "/api/ws/",
  "/api/workspaces",
  "/api/admin",
  "/api/my-work",
  "/api/auth",
  "/api/users",
  "/api/permissions",
  "/api/permission-groups",
  "/api/audit",
  "/api/health",
  "/api/notifications",
  "/api/uploads",
  "/api/monitoring",
  "/api/system-settings",
  "/api/menus",
  "/api/organizations",
  "/api/oauth",
  "/api/sso",
];

// 플랫폼 클라이언트 인스턴스에 WS prefix 인터셉터 추가
// (앱 초기화 시 한 번만 등록됨)
apiClient.interceptors.request.use((config) => {
  const url = config.url ?? "";
  const wid = _currentWorkspaceId;

  if (
    wid &&
    url.startsWith("/api/") &&
    !WS_EXEMPT.some((p) => url.startsWith(p))
  ) {
    // /api/tickets → /api/ws/{wid}/tickets
    config.url = `/api/ws/${wid}${url.slice(4)}`;
  }

  return config;
});
