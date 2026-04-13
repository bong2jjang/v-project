/**
 * v-platform-portal App
 *
 * 플랫폼 기반 통합 포탈: 앱 런처, SSO 통합 로그인, 사이트맵
 * 플랫폼 공통 페이지(Login, Settings, UserManagement 등)를 모두 포함합니다.
 */

import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// 플랫폼 페이지
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

// 포탈 전용 페이지
import Portal from "./pages/Portal";
import HelpPage from "./pages/Help";
import AppManagement from "./pages/admin/AppManagement";

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
      appName: "v-platform-portal",
      appTitle: "v-platform-portal",
      appDescription: "통합 관리 플랫폼",
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

          {/* 포탈 메인 (대시보드 위치) */}
          <Route path="/" element={
            <ProtectedRoute permissionKey="dashboard">
              <Layout><Portal /></Layout>
            </ProtectedRoute>
          } />

          {/* 플랫폼 공통 페이지 */}
          <Route path="/settings" element={<ProtectedRoute permissionKey="settings"><Layout><SettingsPage /></Layout></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute permissionKey="help"><Layout><HelpPage /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
          <Route path="/password-change" element={<ProtectedRoute><Layout><PasswordChangePage /></Layout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute permissionKey="users"><Layout><UserManagementPage /></Layout></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute permissionKey="audit_logs"><Layout><AuditLogsPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/menus" element={<ProtectedRoute permissionKey="menu_management"><Layout><MenuManagementPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/permissions" element={<ProtectedRoute permissionKey="permission_management"><Layout><PermissionMatrixPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/permission-groups" element={<ProtectedRoute permissionKey="permission_groups"><Layout><PermissionGroupsPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/organizations" element={<ProtectedRoute permissionKey="organizations"><Layout><OrganizationsPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/apps" element={<ProtectedRoute permissionKey="app_management"><Layout><AppManagement /></Layout></ProtectedRoute>} />
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
