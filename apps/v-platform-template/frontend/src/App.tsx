/**
 * v-platform-template App
 *
 * 플랫폼 공통 페이지만 포함된 템플릿입니다.
 * 앱 전용 페이지는 아래 라우트에 추가하세요.
 */

import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// 공통 페이지
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import Profile from "./pages/Profile";
import PasswordChange from "./pages/PasswordChange";
import UserManagement from "./pages/UserManagement";
import AuditLogs from "./pages/AuditLogs";
import CustomIframe from "./pages/CustomIframe";

// 인증 페이지
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Forbidden from "./pages/Forbidden";
import SSOCallback from "./pages/SSOCallback";

// 관리자 페이지
import MenuManagement from "./pages/admin/MenuManagement";
import PermissionMatrix from "./pages/admin/PermissionMatrix";
import PermissionGroups from "./pages/admin/PermissionGroups";
import Organizations from "./pages/admin/Organizations";

// 플랫폼 컴포넌트
import Layout from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./hooks/useTheme";
import { TokenExpiryManager } from "./components/auth/TokenExpiryManager";
import { useAuthStore } from "./store/auth";
import { usePermissionStore } from "./store/permission";
import { useSystemSettingsStore } from "./store/systemSettings";

function App() {
  const { loadUserFromStorage, isAuthenticated, isInitialized } =
    useAuthStore();
  const { fetchSettings } = useSystemSettingsStore();
  const { fetchPermissions, reset: resetPermissions } = usePermissionStore();

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
    <ThemeProvider>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          {/* ── 공개 라우트 ── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/forbidden" element={<Forbidden />} />
          <Route path="/sso/callback" element={<SSOCallback />} />

          {/* ── 대시보드 ── */}
          <Route
            path="/"
            element={
              <ProtectedRoute permissionKey="dashboard">
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            }
          />

          {/* ── 설정/프로필 ── */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute permissionKey="settings">
                <Layout><Settings /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute permissionKey="help">
                <Layout><Help /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout><Profile /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/password-change"
            element={
              <ProtectedRoute>
                <Layout><PasswordChange /></Layout>
              </ProtectedRoute>
            }
          />

          {/* ── 관리자: 사용자/권한/감사 ── */}
          <Route
            path="/users"
            element={
              <ProtectedRoute permissionKey="users">
                <Layout><UserManagement /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute permissionKey="audit_logs">
                <Layout><AuditLogs /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/menus"
            element={
              <ProtectedRoute permissionKey="menu_management">
                <Layout><MenuManagement /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/permissions"
            element={
              <ProtectedRoute permissionKey="permission_management">
                <Layout><PermissionMatrix /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/permission-groups"
            element={
              <ProtectedRoute permissionKey="permission_groups">
                <Layout><PermissionGroups /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/organizations"
            element={
              <ProtectedRoute permissionKey="organizations">
                <Layout><Organizations /></Layout>
              </ProtectedRoute>
            }
          />

          {/* ── 커스텀 iframe 메뉴 ── */}
          <Route
            path="/custom/:menuId"
            element={
              <ProtectedRoute>
                <Layout><CustomIframe /></Layout>
              </ProtectedRoute>
            }
          />

          {/* ── 앱 전용 라우트 (여기에 추가) ── */}
          {/* <Route path="/my-feature" element={...} /> */}

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <TokenExpiryManager />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
