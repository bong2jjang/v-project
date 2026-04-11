/**
 * @v-platform/core/pages — Platform pre-built pages
 *
 * Apps import these pages instead of copying them.
 * Branding (app name, description) comes from PlatformConfig.
 */

// Auth pages
export { default as LoginPage } from './Login';
export { default as RegisterPage } from './Register';
export { default as ForgotPasswordPage } from './ForgotPassword';
export { default as ResetPasswordPage } from './ResetPassword';
export { default as SSOCallbackPage } from './SSOCallback';
export { default as ForbiddenPage } from './Forbidden';

// Profile pages
export { default as ProfilePage } from './Profile';
export { default as PasswordChangePage } from './PasswordChange';

// Admin pages
export { default as UserManagementPage } from './UserManagement';
export { default as AuditLogsPage } from './AuditLogs';
export { default as SettingsPage } from './Settings';
export { default as HelpPage } from './Help';
export { default as CustomIframePage } from './CustomIframe';

// Admin management pages
export { default as MenuManagementPage } from './admin/MenuManagement';
export { default as PermissionMatrixPage } from './admin/PermissionMatrix';
export { default as PermissionGroupsPage } from './admin/PermissionGroups';
export { default as OrganizationsPage } from './admin/Organizations';
export { default as NotificationManagementPage } from './admin/NotificationManagement';
