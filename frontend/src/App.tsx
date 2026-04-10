import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Channels from "./pages/Channels";
import Messages from "./pages/Messages";
import Statistics from "./pages/Statistics";
import Settings from "./pages/Settings";
import Integrations from "./pages/Integrations";
import Help from "./pages/Help";
import Profile from "./pages/Profile";
import PasswordChange from "./pages/PasswordChange";
import UserManagement from "./pages/UserManagement";
import AuditLogs from "./pages/AuditLogs";
import Monitoring from "./pages/Monitoring";
import MenuManagement from "./pages/admin/MenuManagement";
import PermissionMatrix from "./pages/admin/PermissionMatrix";
import PermissionGroups from "./pages/admin/PermissionGroups";
import Organizations from "./pages/admin/Organizations";
import CustomIframe from "./pages/CustomIframe";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Forbidden from "./pages/Forbidden";
import SSOCallback from "./pages/SSOCallback";
import Layout from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./hooks/useTheme";
import { TourProvider } from "./components/tour/TourProvider";
import { TokenExpiryManager } from "./components/auth/TokenExpiryManager";
import { useAuthStore } from "./store/auth";
import { usePermissionStore } from "./store/permission";
import { useSystemSettingsStore } from "./store/systemSettings";
import { useNotifications } from "./hooks/useNotifications";

function App() {
  const { loadUserFromStorage, isAuthenticated, isInitialized } =
    useAuthStore();
  const { fetchSettings } = useSystemSettingsStore();
  const { fetchPermissions, reset: resetPermissions } = usePermissionStore();

  // 실시간 알림 WebSocket 연결
  useNotifications();

  // 앱 시작 시 로컬 스토리지에서 사용자 정보 로드
  useEffect(() => {
    loadUserFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 인증된 사용자만 시스템 설정 + 권한 로드
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      fetchSettings();
      fetchPermissions();
    } else if (isInitialized && !isAuthenticated) {
      resetPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isAuthenticated]);

  return (
    <ThemeProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <TourProvider>
          <Routes>
            {/* 공개 라우트 */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/forbidden" element={<Forbidden />} />
            <Route path="/sso/callback" element={<SSOCallback />} />

            {/* 인증 필요 페이지 (RBAC 권한 기반) */}
            <Route
              path="/"
              element={
                <ProtectedRoute permissionKey="dashboard">
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/channels"
              element={
                <ProtectedRoute permissionKey="channels">
                  <Layout>
                    <Channels />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute permissionKey="messages">
                  <Layout>
                    <Messages />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/statistics"
              element={
                <ProtectedRoute permissionKey="statistics">
                  <Layout>
                    <Statistics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations"
              element={
                <ProtectedRoute permissionKey="integrations">
                  <Layout>
                    <Integrations />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute permissionKey="settings">
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/help"
              element={
                <ProtectedRoute permissionKey="help">
                  <Layout>
                    <Help />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/password-change"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PasswordChange />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* 관리자 페이지 (RBAC 권한 기반) */}
            <Route
              path="/users"
              element={
                <ProtectedRoute permissionKey="users">
                  <Layout>
                    <UserManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute permissionKey="audit_logs">
                  <Layout>
                    <AuditLogs />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitoring"
              element={
                <ProtectedRoute permissionKey="monitoring">
                  <Layout>
                    <Monitoring />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/menus"
              element={
                <ProtectedRoute permissionKey="menu_management">
                  <Layout>
                    <MenuManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/permissions"
              element={
                <ProtectedRoute permissionKey="permission_management">
                  <Layout>
                    <PermissionMatrix />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/permission-groups"
              element={
                <ProtectedRoute permissionKey="permission_groups">
                  <Layout>
                    <PermissionGroups />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/organizations"
              element={
                <ProtectedRoute permissionKey="organizations">
                  <Layout>
                    <Organizations />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* 커스텀 iframe 메뉴 (동적 라우트) */}
            <Route
              path="/custom/:menuId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CustomIframe />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* 404 - 루트로 리다이렉트 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* 토큰 만료 관리 (전역) */}
          <TokenExpiryManager />
        </TourProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
