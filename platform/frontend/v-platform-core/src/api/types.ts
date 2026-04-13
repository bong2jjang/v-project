/**
 * API 타입 정의
 *
 * Backend Pydantic 모델과 일치하는 TypeScript 인터페이스
 */

// ============================================================
// 메시지 브리지 타입
// ============================================================

export interface BridgeStatus {
  is_running: boolean;
  providers: Array<{
    platform: string;
    connected: boolean;
  }>;
  active_tasks: number;
}

export interface BridgeRouteConfig {
  source_platform: string;
  source_channel: string;
  target_platform: string;
  target_channel: string;
  target_channel_name?: string;
  source_channel_name?: string;
}

export interface BridgeControlResponse {
  status: string;
  message: string;
}

export interface BridgeLogsResponse {
  logs: string[];
}

// ============================================================
// Config 타입
// ============================================================

export interface GeneralConfig {
  MediaServerUpload?: string;
  MediaDownloadSize?: number;
  [key: string]: unknown; // extra fields allowed
}

export interface SlackConfig {
  Token: string;
  UseAPI?: boolean;
  [key: string]: unknown; // extra fields allowed
}

export interface TeamsConfig {
  TenantID: string;
  AppID: string;
  AppPassword: string;
  [key: string]: unknown; // extra fields allowed
}

// Platform 타입 정의
export type Platform = "slack" | "teams" | "unknown";

export interface PlatformConfig {
  label: string;
  icon: string;
  accountPrefix: string;
  channelPlaceholder: string;
  channelHelper: string;
  color: string;
  bgColor: string;
}

export interface PlatformGuide {
  accountNameExample: string;
  accountNameHelper: string;
  channelExample: string;
  channelSteps: string[];
}

export interface GatewayInOutConfig {
  account: string; // format: "protocol.name"
  channel: string;
}

export interface GatewayConfig {
  name: string;
  enable?: boolean;
  inout: GatewayInOutConfig[];
  is_valid?: boolean;
  validation_errors?: string | null;
}

export interface BridgeConfig {
  general?: GeneralConfig;
  slack?: Record<string, SlackConfig>;
  teams?: Record<string, TeamsConfig>;
  gateway?: GatewayConfig[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BackupInfo {
  path: string;
  timestamp: string; // ISO 8601
}

export interface BackupListResponse {
  backups: BackupInfo[];
}

export interface RestoreRequest {
  backup_path: string;
}

// ============================================================
// API 공통 타입
// ============================================================

export interface ApiErrorDetail {
  error: string;
  message: string;
  errors?: string[];
  warnings?: string[];
}

export interface ApiError {
  detail: ApiErrorDetail | string;
}

export interface MessageResponse {
  message: string;
  backup_path?: string;
}

// ============================================================
// 유틸리티 타입
// ============================================================

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// ============================================================
// 인증 타입
// ============================================================

export type UserRole = "system_admin" | "org_admin" | "admin" | "user";

/**
 * 관리자 역할 여부 확인 (system_admin 또는 org_admin)
 */
export function isAdminRole(role?: UserRole | string): boolean {
  return role === "system_admin" || role === "org_admin" || role === "admin";
}

/**
 * 시스템 관리자 여부 확인
 */
export function isSystemAdmin(role?: UserRole | string): boolean {
  return role === "system_admin";
}

/**
 * 역할 표시 이름
 */
export function getRoleDisplayName(role?: UserRole | string): string {
  switch (role) {
    case "system_admin":
      return "시스템 관리자";
    case "org_admin":
      return "조직 관리자";
    case "admin":
      return "관리자";
    case "user":
      return "일반 사용자";
    default:
      return "일반 사용자";
  }
}

// ============================================================
// RBAC 메뉴/권한 타입
// ============================================================

export type AccessLevel = "none" | "read" | "write";

export interface MenuItemResponse {
  id: number;
  permission_key: string;
  label: string;
  icon: string | null;
  path: string;
  menu_type: "built_in" | "custom_iframe" | "custom_link" | "menu_group";
  iframe_url: string | null;
  iframe_fullscreen: boolean;
  open_in_new_tab: boolean;
  parent_key: string | null;
  sort_order: number;
  section: "basic" | "admin" | "custom";
  is_active: boolean;
  access_level?: AccessLevel;
}

export interface MyMenusResponse {
  menus: MenuItemResponse[];
}

export interface MyPermissionsResponse {
  role: string;
  permissions: Record<string, AccessLevel>;
}

export interface PermissionMatrixResponse {
  menus: MenuItemResponse[];
  users: Array<{
    user: User;
    permissions: Record<number, AccessLevel>;
  }>;
}

export interface PermissionGrant {
  menu_item_id: number;
  access_level: AccessLevel;
}

export interface Company {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}

export interface Department {
  id: number;
  company_id: number;
  name: string;
  code: string | null;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
  children?: Department[];
}

export interface PermissionGroupGrant {
  id: number;
  menu_item_id: number;
  permission_key: string | null;
  menu_label: string | null;
  access_level: AccessLevel;
}

export interface PermissionGroup {
  id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  grants: PermissionGroupGrant[];
}

export interface GroupBrief {
  id: number;
  name: string;
  is_default?: boolean;
}

export interface CompanyBrief {
  id: number;
  name: string;
  code: string;
}

export interface DepartmentBrief {
  id: number;
  name: string;
  code: string | null;
}

export interface EffectivePermission {
  menu_item_id: number;
  permission_key: string;
  access_level: AccessLevel;
  source: "personal" | "group" | "mixed";
  group_names?: string[];
}

export interface User {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  auth_method?: string;
  sso_provider?: string | null;
  start_page?: string;
  theme?: string;
  color_preset?: string;
  company_id?: number | null;
  department_id?: number | null;
  company?: CompanyBrief | null;
  department?: DepartmentBrief | null;
  groups?: GroupBrief[];
}

export interface SSOProviderInfo {
  name: string;
  display_name: string;
  icon: string;
  login_url: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
  device_name?: string;
  device_fingerprint?: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: User;
  csrf_token?: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface UserUpdate {
  username?: string;
  email?: string;
  is_active?: boolean;
  company_id?: number | null;
  department_id?: number | null;
}

export interface UserUpdateMe {
  username?: string;
  start_page?: string;
  theme?: string;
  color_preset?: string;
}

export interface UserPasswordChange {
  current_password: string;
  new_password: string;
}

export interface AdminUserCreate {
  email: string;
  username: string;
  password: string;
  role: UserRole;
  is_active: boolean;
  company_id?: number | null;
  department_id?: number | null;
}

export interface UserRoleUpdate {
  role: UserRole;
}

export interface DeviceInfo {
  id: number;
  device_name: string;
  device_fingerprint: string | null;
  ip_address: string | null;
  last_used_at: string | null;
  created_at: string | null;
  expires_at: string | null;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetVerifyResponse {
  valid: boolean;
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

// ============================================================
// 조직도 트리 타입
// ============================================================

export interface OrgUserBrief {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface OrgDeptNode {
  id: number;
  name: string;
  code: string | null;
  users: OrgUserBrief[];
  children: OrgDeptNode[];
}

export interface OrgCompanyNode {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  departments: OrgDeptNode[];
  unassigned_users: OrgUserBrief[];
}

export interface OrgTreeResponse {
  companies: OrgCompanyNode[];
  unassigned_users: OrgUserBrief[];
  total_users: number;
}

// ============================================================
// Audit Log 타입
// ============================================================

export interface AuditLog {
  id: number;
  timestamp: string;
  user_id: number | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  description: string | null;
  details: string | null;
  status: string;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  app_id: string | null;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
