/**
 * @v-platform/core — Reusable platform framework for v-project apps
 *
 * Re-exports all platform components, hooks, stores, and utilities.
 */

// ── Provider ──
export { PlatformProvider, usePlatformConfig } from './providers/PlatformProvider';
export type { PlatformConfig } from './providers/PlatformProvider';

// ── Components ──
export { default as ProtectedRoute } from './components/ProtectedRoute';
export { default as RoleBasedRoute } from './components/RoleBasedRoute';
export { default as Layout } from './components/Layout';
export { default as HelpButton } from './components/HelpButton';

// Layout
export * from './components/layout';

// UI Kit
export * from './components/ui';

// ── Stores ──
export { useAuthStore } from './stores/auth';
export { usePermissionStore } from './stores/permission';
export { useNotificationStore } from './stores/notification';
export { useSystemSettingsStore } from './stores/systemSettings';
export { useSessionSettingsStore } from './stores/sessionSettings';

// ── Hooks ──
export { useTheme } from './hooks/useTheme';
export { default as useTokenExpiry } from './hooks/useTokenExpiry';
export { useActivityDetection } from './hooks/useActivityDetection';
export { default as useIdleTimeout } from './hooks/useIdleTimeout';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export { useSidebar, SidebarProvider } from './hooks/useSidebar';
export { useTabSync } from './hooks/useTabSync';
export { useApiErrorHandler } from './hooks/useApiErrorHandler';
export { useWebSocket } from './hooks/useWebSocket';
export { useNotifications } from './hooks/useNotifications';
export { useBrowserNotification } from './hooks/useBrowserNotification';

// ── API ──
export { default as apiClient } from './api/client';
export * as authApi from './api/auth';
export * as usersApi from './api/users';
export * as permissionsApi from './api/permissions';
export * as organizationsApi from './api/organizations';
export * as permissionGroupsApi from './api/permission-groups';
export * as auditLogsApi from './api/auditLogs';
export * as systemSettingsApi from './api/systemSettings';

// ── Types ──
export type * from './api/types';

// ── Lib ──
export * from './lib/navigation';
export { resolveStartPage } from './lib/resolveStartPage';

// ── Pages ──
export * from './pages';
