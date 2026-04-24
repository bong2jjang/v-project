import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

// 플랫폼 페이지 — @v-platform/core에서 제공
import {
  AuditLogsPage,
  CustomIframePage,
  ForbiddenPage,
  ForgotPasswordPage,
  LoginPage,
  MenuManagementPage,
  MonitoringPage,
  OrganizationsPage,
  PasswordChangePage,
  PermissionGroupsPage,
  PermissionMatrixPage,
  ProfilePage,
  RegisterPage,
  ResetPasswordPage,
  SettingsPage,
  SSOCallbackPage,
  UserManagementPage,
} from "@v-platform/core/pages";

// 플랫폼 Provider / 공통 컴포넌트
import Layout from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./hooks/useTheme";
import { PlatformProvider } from "@v-platform/core/providers/PlatformProvider";
import { TokenExpiryManager } from "./components/auth/TokenExpiryManager";
import { useAuthStore } from "./store/auth";
import { usePermissionStore } from "./store/permission";
import { useSystemSettingsStore } from "./store/systemSettings";
import { useNotifications } from "./hooks/useNotifications";

// 워크스페이스 컴포넌트 (v0.7 — 전역 WS 컨텍스트)
import { WorkspaceLayout } from "./components/workspace/WorkspaceLayout";
import { WorkspaceGate } from "./components/workspace/WorkspaceGate";
import { useWorkspaceStore } from "./stores/workspace";

// 앱 전용 페이지 — 플랫폼 공통
import Help from "./pages/Help";
import MyNotificationPref from "./pages/me/MyNotificationPref";
import MyWork from "./pages/MyWork";
import AdminAllWork from "./pages/admin/AllWork";

// 앱 전용 페이지 — WS 어드민
import Customers from "./pages/admin/Customers";
import Products from "./pages/admin/Products";
import SlaTiers from "./pages/admin/SlaTiers";
import Contracts from "./pages/admin/Contracts";
import ScopeGrants from "./pages/admin/ScopeGrants";
import SlaPolicies from "./pages/admin/SlaPolicies";
import SlaNotificationPolicies from "./pages/admin/SlaNotificationPolicies";
import Scheduler from "./pages/admin/Scheduler";
import Integrations from "./pages/admin/Integrations";
import NotificationLogs from "./pages/admin/NotificationLogs";

// 앱 전용 페이지 — 워크스페이스 스코프
import Kanban from "./pages/Kanban";
import SlaMonitor from "./pages/SlaMonitor";
import Kpi from "./pages/Kpi";
import TicketsIndex from "./pages/tickets/Index";
import TicketNew from "./pages/tickets/New";
import TicketDetail from "./pages/tickets/Detail";

// 워크스페이스 목록 / WS별 설정·멤버
import WorkspacesList from "./pages/WorkspacesList";
import WsSettings from "./pages/ws/WsSettings";
import WsMembers from "./pages/ws/WsMembers";

/**
 * v0.7 레거시 호환 — `/ws/:wid/*` 경로 진입 시 해당 WS 로 전환 후 평탄 경로로 리다이렉트.
 * 북마크·외부 링크 보호용. 새 UI 에서는 평탄 경로(`/kanban`, `/tickets/:id` 등)만 사용.
 */
function LegacyWsRedirect({ to }: { to: string }) {
  const { wid } = useParams<{ wid: string }>();
  const { currentWorkspaceId, myWorkspaces, switchWorkspace, initialized } =
    useWorkspaceStore();

  useEffect(() => {
    if (!wid || !initialized) return;
    if (wid === currentWorkspaceId) return;
    const hasAccess = myWorkspaces.some((w) => w.id === wid);
    if (!hasAccess) return;
    void switchWorkspace(wid);
  }, [wid, initialized, currentWorkspaceId, myWorkspaces]);

  if (!initialized) return null;
  if (!wid || !myWorkspaces.some((w) => w.id === wid)) {
    return <Navigate to="/workspaces" replace />;
  }
  return <Navigate to={to} replace />;
}

/** 레거시 `/ws/:wid/tickets/:id` → `/tickets/:id` (wid 전환 후) */
function LegacyWsTicketRedirect() {
  const { wid, id } = useParams<{ wid: string; id: string }>();
  const { currentWorkspaceId, myWorkspaces, switchWorkspace, initialized } =
    useWorkspaceStore();

  useEffect(() => {
    if (!wid || !initialized) return;
    if (wid === currentWorkspaceId) return;
    const hasAccess = myWorkspaces.some((w) => w.id === wid);
    if (!hasAccess) return;
    void switchWorkspace(wid);
  }, [wid, initialized, currentWorkspaceId, myWorkspaces]);

  if (!initialized) return null;
  if (!wid || !myWorkspaces.some((w) => w.id === wid)) {
    return <Navigate to="/workspaces" replace />;
  }
  return <Navigate to={`/tickets/${id}`} replace />;
}

function App() {
  const { loadUserFromStorage, isAuthenticated, isInitialized } = useAuthStore();
  const { fetchSettings } = useSystemSettingsStore();
  const { fetchPermissions, reset: resetPermissions } = usePermissionStore();
  const { loadDefault, clear: clearWorkspace } = useWorkspaceStore();
  useNotifications();

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      fetchSettings();
      fetchPermissions();
      loadDefault();
    } else if (isInitialized && !isAuthenticated) {
      resetPermissions();
      clearWorkspace();
    }
  }, [isInitialized, isAuthenticated]);

  return (
    <PlatformProvider
      config={{
        appName: "v-itsm",
        appTitle: "v-itsm",
        appDescription: "업무 루프 관리 시스템 (ITSM)",
        appVersion: "0.1.0",
        brandName: "VMS",
      }}
    >
      <ThemeProvider>
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            {/* ── 공개 라우트 ───────────────────────────────── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/forbidden" element={<ForbiddenPage />} />
            <Route path="/sso/callback" element={<SSOCallbackPage />} />

            {/* ── 기본 진입점 ───────────────────────────────── */}
            <Route
              path="/"
              element={<ProtectedRoute><Navigate to="/kanban" replace /></ProtectedRoute>}
            />

            {/* ── 워크스페이스 목록 ─────────────────────────── */}
            <Route
              path="/workspaces"
              element={<ProtectedRoute><WorkspacesList /></ProtectedRoute>}
            />

            {/* ── 워크스페이스 스코프 라우트 (평탄 URL, 전역 WS 컨텍스트) ── */}
            <Route
              element={<ProtectedRoute><WorkspaceGate /></ProtectedRoute>}
            >
              {/* 운영 화면 */}
              <Route path="/kanban" element={<WorkspaceLayout><Kanban /></WorkspaceLayout>} />
              <Route path="/tickets" element={<WorkspaceLayout><TicketsIndex /></WorkspaceLayout>} />
              <Route path="/tickets/new" element={<WorkspaceLayout><TicketNew /></WorkspaceLayout>} />
              <Route path="/tickets/:id" element={<WorkspaceLayout><TicketDetail /></WorkspaceLayout>} />
              <Route path="/sla" element={<WorkspaceLayout><SlaMonitor /></WorkspaceLayout>} />
              <Route path="/kpi" element={<WorkspaceLayout><Kpi /></WorkspaceLayout>} />

              {/* WS 설정·멤버 */}
              <Route path="/settings/workspace" element={<WorkspaceLayout><WsSettings /></WorkspaceLayout>} />
              <Route path="/members" element={<WorkspaceLayout><WsMembers /></WorkspaceLayout>} />

              {/* WS 어드민 */}
              <Route path="/admin/customers" element={<WorkspaceLayout><Customers /></WorkspaceLayout>} />
              <Route path="/admin/products" element={<WorkspaceLayout><Products /></WorkspaceLayout>} />
              <Route path="/admin/sla-tiers" element={<WorkspaceLayout><SlaTiers /></WorkspaceLayout>} />
              <Route path="/admin/contracts" element={<WorkspaceLayout><Contracts /></WorkspaceLayout>} />
              <Route path="/admin/scope-grants" element={<WorkspaceLayout><ScopeGrants /></WorkspaceLayout>} />
              <Route path="/admin/sla-policies" element={<WorkspaceLayout><SlaPolicies /></WorkspaceLayout>} />
              <Route path="/admin/sla-notification-policies" element={<WorkspaceLayout><SlaNotificationPolicies /></WorkspaceLayout>} />
              <Route path="/admin/scheduler" element={<WorkspaceLayout><Scheduler /></WorkspaceLayout>} />
              <Route path="/admin/integrations" element={<WorkspaceLayout><Integrations /></WorkspaceLayout>} />
              <Route path="/admin/notification-logs" element={<WorkspaceLayout><NotificationLogs /></WorkspaceLayout>} />
            </Route>

            {/* ── 플랫폼 공통 페이지 (WS 비의존) ──────────── */}
            <Route path="/settings" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />
            <Route path="/help" element={<ProtectedRoute><Layout><Help /></Layout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
            <Route path="/password-change" element={<ProtectedRoute><Layout><PasswordChangePage /></Layout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Layout><UserManagementPage /></Layout></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute><Layout><AuditLogsPage /></Layout></ProtectedRoute>} />
            <Route path="/monitoring" element={<ProtectedRoute><Layout><MonitoringPage /></Layout></ProtectedRoute>} />
            <Route path="/me/notification-pref" element={<ProtectedRoute><Layout><MyNotificationPref /></Layout></ProtectedRoute>} />
            <Route path="/my-work" element={<ProtectedRoute><Layout><MyWork /></Layout></ProtectedRoute>} />
            <Route path="/admin/all-work" element={<ProtectedRoute><Layout><AdminAllWork /></Layout></ProtectedRoute>} />
            <Route path="/custom/*" element={<ProtectedRoute><Layout><CustomIframePage /></Layout></ProtectedRoute>} />

            {/* 플랫폼 글로벌 어드민 */}
            <Route path="/admin/menus" element={<ProtectedRoute><Layout><MenuManagementPage /></Layout></ProtectedRoute>} />
            <Route path="/admin/permissions" element={<ProtectedRoute><Layout><PermissionMatrixPage /></Layout></ProtectedRoute>} />
            <Route path="/admin/permission-groups" element={<ProtectedRoute><Layout><PermissionGroupsPage /></Layout></ProtectedRoute>} />
            <Route path="/admin/organizations" element={<ProtectedRoute><Layout><OrganizationsPage /></Layout></ProtectedRoute>} />

            {/* ── v0.6 호환 리다이렉트: /ws/:wid/* → 평탄 경로 ── */}
            <Route path="/ws/:wid" element={<ProtectedRoute><LegacyWsRedirect to="/kanban" /></ProtectedRoute>} />
            <Route path="/ws/:wid/kanban" element={<ProtectedRoute><LegacyWsRedirect to="/kanban" /></ProtectedRoute>} />
            <Route path="/ws/:wid/tickets" element={<ProtectedRoute><LegacyWsRedirect to="/tickets" /></ProtectedRoute>} />
            <Route path="/ws/:wid/tickets/new" element={<ProtectedRoute><LegacyWsRedirect to="/tickets/new" /></ProtectedRoute>} />
            <Route path="/ws/:wid/tickets/:id" element={<ProtectedRoute><LegacyWsTicketRedirect /></ProtectedRoute>} />
            <Route path="/ws/:wid/sla" element={<ProtectedRoute><LegacyWsRedirect to="/sla" /></ProtectedRoute>} />
            <Route path="/ws/:wid/kpi" element={<ProtectedRoute><LegacyWsRedirect to="/kpi" /></ProtectedRoute>} />
            <Route path="/ws/:wid/settings" element={<ProtectedRoute><LegacyWsRedirect to="/settings/workspace" /></ProtectedRoute>} />
            <Route path="/ws/:wid/members" element={<ProtectedRoute><LegacyWsRedirect to="/members" /></ProtectedRoute>} />
            <Route path="/ws/:wid/admin/customers" element={<ProtectedRoute><LegacyWsRedirect to="/admin/customers" /></ProtectedRoute>} />
            <Route path="/ws/:wid/admin/products" element={<ProtectedRoute><LegacyWsRedirect to="/admin/products" /></ProtectedRoute>} />
            <Route path="/ws/:wid/admin/sla-tiers" element={<ProtectedRoute><LegacyWsRedirect to="/admin/sla-tiers" /></ProtectedRoute>} />
            <Route path="/ws/:wid/admin/contracts" element={<ProtectedRoute><LegacyWsRedirect to="/admin/contracts" /></ProtectedRoute>} />
            <Route path="/ws/:wid/admin/scope-grants" element={<ProtectedRoute><LegacyWsRedirect to="/admin/scope-grants" /></ProtectedRoute>} />
            <Route path="/ws/:wid/admin/sla-policies" element={<ProtectedRoute><LegacyWsRedirect to="/admin/sla-policies" /></ProtectedRoute>} />
            <Route path="/ws/:wid/admin/sla-notification-policies" element={<ProtectedRoute><LegacyWsRedirect to="/admin/sla-notification-policies" /></ProtectedRoute>} />
            <Route path="/ws/:wid/admin/scheduler" element={<ProtectedRoute><LegacyWsRedirect to="/admin/scheduler" /></ProtectedRoute>} />
            <Route path="/ws/:wid/admin/integrations" element={<ProtectedRoute><LegacyWsRedirect to="/admin/integrations" /></ProtectedRoute>} />
            <Route path="/ws/:wid/admin/notification-logs" element={<ProtectedRoute><LegacyWsRedirect to="/admin/notification-logs" /></ProtectedRoute>} />

            {/* ── 404 catch-all ──────────────────────────── */}
            <Route path="*" element={<Navigate to="/workspaces" replace />} />
          </Routes>
          <TokenExpiryManager />
        </BrowserRouter>
      </ThemeProvider>
    </PlatformProvider>
  );
}

export default App;
