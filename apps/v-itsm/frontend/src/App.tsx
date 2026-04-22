/**
 * v-itsm App — 업무 루프 관리 시스템 (ITSM 기반)
 *
 * 플랫폼 공통 페이지는 @v-platform/core에서 import합니다.
 * 앱 전용 페이지(티켓/루프/SLA/KPI)는 직접 구현합니다.
 */

import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// 플랫폼 페이지 — @v-platform/core에서 제공
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  SSOCallbackPage,
  ForbiddenPage,
  ProfilePage,
  PasswordChangePage,
  UserManagementPage,
  AuditLogsPage,
  MonitoringPage,
  SettingsPage,
  CustomIframePage,
  MenuManagementPage,
  PermissionMatrixPage,
  PermissionGroupsPage,
  OrganizationsPage,
} from "@v-platform/core/pages";

// 플랫폼 컴포넌트
import Layout from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./hooks/useTheme";
import { PlatformProvider } from "@v-platform/core/providers/PlatformProvider";
import { TokenExpiryManager } from "./components/auth/TokenExpiryManager";
import { useAuthStore } from "./store/auth";
import { usePermissionStore } from "./store/permission";
import { useSystemSettingsStore } from "./store/systemSettings";
import { useNotifications } from "./hooks/useNotifications";

// 앱 전용 페이지
import Help from "./pages/Help";
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
import MyNotificationPref from "./pages/me/MyNotificationPref";
import TicketsIndex from "./pages/tickets/Index";
import TicketNew from "./pages/tickets/New";
import TicketDetail from "./pages/tickets/Detail";
import Kanban from "./pages/Kanban";
import SlaMonitor from "./pages/SlaMonitor";
import Kpi from "./pages/Kpi";

function App() {
  const { loadUserFromStorage, isAuthenticated, isInitialized } =
    useAuthStore();
  const { fetchSettings } = useSystemSettingsStore();
  const { fetchPermissions, reset: resetPermissions } = usePermissionStore();
  useNotifications();

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      fetchSettings();
      fetchPermissions();
    } else if (isInitialized && !isAuthenticated) {
      resetPermissions();
    }
  }, [isInitialized, isAuthenticated]);

  return (
    <PlatformProvider config={{
      appName: "v-itsm",
      appTitle: "v-itsm",
      appDescription: "업무 루프 관리 시스템 (ITSM)",
      appVersion: "0.1.0",
      brandName: "VMS",
    }}>
    <ThemeProvider>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          {/* 공개 라우트 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="/sso/callback" element={<SSOCallbackPage />} />

          {/* 기본 진입점: Loop 칸반으로 리다이렉트 */}
          <Route path="/" element={<Navigate to="/kanban" replace />} />

          {/* 플랫폼 공통 페이지 */}
          <Route path="/settings" element={<ProtectedRoute permissionKey="settings"><Layout><SettingsPage /></Layout></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute permissionKey="help"><Layout><Help /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
          <Route path="/password-change" element={<ProtectedRoute><Layout><PasswordChangePage /></Layout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute permissionKey="users"><Layout><UserManagementPage /></Layout></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute permissionKey="audit_logs"><Layout><AuditLogsPage /></Layout></ProtectedRoute>} />
          <Route path="/monitoring" element={<ProtectedRoute permissionKey="monitoring"><Layout><MonitoringPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/menus" element={<ProtectedRoute permissionKey="menu_management"><Layout><MenuManagementPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/permissions" element={<ProtectedRoute permissionKey="permission_management"><Layout><PermissionMatrixPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/permission-groups" element={<ProtectedRoute permissionKey="permission_groups"><Layout><PermissionGroupsPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/organizations" element={<ProtectedRoute permissionKey="organizations"><Layout><OrganizationsPage /></Layout></ProtectedRoute>} />
          <Route path="/custom/*" element={<ProtectedRoute><Layout><CustomIframePage /></Layout></ProtectedRoute>} />

          {/* 앱 전용 라우트 (여기에 추가) */}
          <Route path="/admin/customers" element={<ProtectedRoute><Layout><Customers /></Layout></ProtectedRoute>} />
          <Route path="/admin/products" element={<ProtectedRoute><Layout><Products /></Layout></ProtectedRoute>} />
          <Route path="/admin/sla-tiers" element={<ProtectedRoute><Layout><SlaTiers /></Layout></ProtectedRoute>} />
          <Route path="/admin/contracts" element={<ProtectedRoute><Layout><Contracts /></Layout></ProtectedRoute>} />
          <Route path="/admin/scope-grants" element={<ProtectedRoute><Layout><ScopeGrants /></Layout></ProtectedRoute>} />
          <Route path="/admin/sla-policies" element={<ProtectedRoute><Layout><SlaPolicies /></Layout></ProtectedRoute>} />
          <Route path="/admin/sla-notification-policies" element={<ProtectedRoute><Layout><SlaNotificationPolicies /></Layout></ProtectedRoute>} />
          <Route path="/admin/scheduler" element={<ProtectedRoute><Layout><Scheduler /></Layout></ProtectedRoute>} />
          <Route path="/admin/integrations" element={<ProtectedRoute><Layout><Integrations /></Layout></ProtectedRoute>} />
          <Route path="/admin/notification-logs" element={<ProtectedRoute><Layout><NotificationLogs /></Layout></ProtectedRoute>} />
          <Route path="/me/notification-pref" element={<ProtectedRoute><Layout><MyNotificationPref /></Layout></ProtectedRoute>} />

          {/* 운영 화면 */}
          <Route path="/tickets" element={<ProtectedRoute permissionKey="itsm_tickets"><Layout><TicketsIndex /></Layout></ProtectedRoute>} />
          <Route path="/tickets/new" element={<ProtectedRoute permissionKey="itsm_tickets"><Layout><TicketNew /></Layout></ProtectedRoute>} />
          <Route path="/tickets/:id" element={<ProtectedRoute permissionKey="itsm_tickets"><Layout><TicketDetail /></Layout></ProtectedRoute>} />
          <Route path="/kanban" element={<ProtectedRoute permissionKey="itsm_kanban"><Layout><Kanban /></Layout></ProtectedRoute>} />
          <Route path="/sla" element={<ProtectedRoute permissionKey="itsm_sla_monitor"><Layout><SlaMonitor /></Layout></ProtectedRoute>} />
          <Route path="/kpi" element={<ProtectedRoute permissionKey="itsm_kpi"><Layout><Kpi /></Layout></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/kanban" replace />} />
        </Routes>
        <TokenExpiryManager />
      </BrowserRouter>
    </ThemeProvider>
    </PlatformProvider>
  );
}

export default App;
