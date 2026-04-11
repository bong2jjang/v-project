/**
 * v-platform-portal App
 *
 * 통합 포탈: 앱 런처, SSO 통합 로그인, 사이트맵
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
} from "@v-platform/core/pages";

import { PlatformProvider } from "@v-platform/core/providers/PlatformProvider";
import { ThemeProvider } from "@v-platform/core/hooks/useTheme";
import { useAuthStore } from "@v-platform/core/stores/auth";

import Portal from "./pages/Portal";

function AppContent() {
  const { loadUserFromStorage, isAuthenticated, isInitialized } =
    useAuthStore();

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        {/* 인증 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/sso/callback" element={<SSOCallbackPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />

        {/* 포탈 메인 */}
        <Route
          path="/"
          element={isAuthenticated ? <Portal /> : <Navigate to="/login" />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <PlatformProvider
      config={{
        appName: "v-platform-portal",
        appTitle: "v-platform Portal",
        appDescription: "통합 앱 포탈",
      }}
    >
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </PlatformProvider>
  );
}

export default App;
