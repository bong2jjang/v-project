/**
 * v-ui-builder App
 *
 * AI UI Builder — 대화로 UI를 만들고 Sandpack 미리보기.
 * 플랫폼 공통 페이지는 @v-platform/core 에서 import.
 */

import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

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
  SettingsPage,
  CustomIframePage,
  MenuManagementPage,
  PermissionMatrixPage,
  PermissionGroupsPage,
  OrganizationsPage,
} from "@v-platform/core/pages";

import Layout from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./hooks/useTheme";
import { PlatformProvider } from "@v-platform/core/providers/PlatformProvider";
import { TokenExpiryManager } from "./components/auth/TokenExpiryManager";
import { useAuthStore } from "./store/auth";
import { usePermissionStore } from "./store/permission";
import { useSystemSettingsStore } from "./store/systemSettings";
import { useNotifications } from "./hooks/useNotifications";

import Dashboard from "./pages/Dashboard";
import Builder from "./pages/Builder";
import Help from "./pages/Help";

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
      fetchPermissions().then(() => {
        // v-ui-builder 에서는 "dashboard" 메뉴를 "Sandpack 프로젝트"로 오버라이드.
        // 플랫폼 공용 menu_items 레코드(app_id=NULL)를 건드리지 않고 클라이언트에서만 치환.
        const current = usePermissionStore.getState().menus;
        const patched = current.map((m) =>
          m.permission_key === "dashboard"
            ? { ...m, label: "Sandpack 프로젝트", icon: "boxes" }
            : m,
        );
        usePermissionStore.setState({ menus: patched });
      });
    } else if (isInitialized && !isAuthenticated) {
      resetPermissions();
    }
  }, [isInitialized, isAuthenticated]);

  return (
    <PlatformProvider config={{
      appName: "v-ui-builder",
      appTitle: "AI UI Builder",
      appDescription: "대화로 UI를 만들고 즉시 미리보기",
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

          {/* 대시보드 */}
          <Route path="/" element={
            <ProtectedRoute permissionKey="dashboard">
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          } />

          {/* Builder — 3-pane IDE */}
          <Route path="/builder/:projectId" element={
            <ProtectedRoute permissionKey="dashboard">
              <Layout><Builder /></Layout>
            </ProtectedRoute>
          } />

          {/* 플랫폼 공통 페이지 */}
          <Route path="/settings" element={<ProtectedRoute permissionKey="settings"><Layout><SettingsPage /></Layout></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute permissionKey="help"><Layout><Help /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
          <Route path="/password-change" element={<ProtectedRoute><Layout><PasswordChangePage /></Layout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute permissionKey="users"><Layout><UserManagementPage /></Layout></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute permissionKey="audit_logs"><Layout><AuditLogsPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/menus" element={<ProtectedRoute permissionKey="menu_management"><Layout><MenuManagementPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/permissions" element={<ProtectedRoute permissionKey="permission_management"><Layout><PermissionMatrixPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/permission-groups" element={<ProtectedRoute permissionKey="permission_groups"><Layout><PermissionGroupsPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/organizations" element={<ProtectedRoute permissionKey="organizations"><Layout><OrganizationsPage /></Layout></ProtectedRoute>} />
          <Route path="/custom/:menuId" element={<ProtectedRoute><Layout><CustomIframePage /></Layout></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TokenExpiryManager />
      </BrowserRouter>
    </ThemeProvider>
    </PlatformProvider>
  );
}

export default App;
