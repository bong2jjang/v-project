/**
 * v-platform-template App
 *
 * 플랫폼 공통 페이지는 @v-platform/core에서 import합니다.
 * 앱 전용 페이지만 직접 구현하세요.
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
import Dashboard from "./pages/Dashboard";
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
      fetchPermissions();
    } else if (isInitialized && !isAuthenticated) {
      resetPermissions();
    }
  }, [isInitialized, isAuthenticated]);

  return (
    <PlatformProvider config={{
      appName: "v-platform-template",
      appTitle: "v-platform-template",
      appDescription: "플랫폼 템플릿 앱",
      appVersion: "1.0.0",
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

          {/* 대시보드 (앱 전용) */}
          <Route path="/" element={
            <ProtectedRoute permissionKey="dashboard">
              <Layout><Dashboard /></Layout>
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
          <Route path="/custom/*" element={<ProtectedRoute><Layout><CustomIframePage /></Layout></ProtectedRoute>} />

          {/* 앱 전용 라우트 (여기에 추가) */}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TokenExpiryManager />
      </BrowserRouter>
    </ThemeProvider>
    </PlatformProvider>
  );
}

export default App;
