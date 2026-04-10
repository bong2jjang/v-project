/**
 * Providers API 클라이언트
 *
 * Provider (Slack/Teams) 관리 API
 */

import { apiClient } from "./client";

export interface ValidationError {
  field: string;
  message: string;
  timestamp?: string;
}

// ─── Feature 관련 타입 ───────────────────────────────────────────────────────

export type PermissionStatus =
  | "granted"
  | "missing"
  | "partial"
  | "unknown"
  | "not_applicable";

export interface FeaturePermissionStatus {
  feature_id: string;
  feature_name: string;
  category: string;
  status: PermissionStatus;
  missing_scopes: string[];
  note?: string | null;
}

export interface FeaturePlatformSupport {
  supported: boolean;
  implemented: boolean;
  required_scopes: string[];
  required_permissions: string[];
  reason?: string | null;
}

export interface FeatureCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  category_label: string;
  is_core: boolean;
  platform_support: Record<string, FeaturePlatformSupport>;
}

export interface FeatureCatalogResponse {
  features: FeatureCatalogItem[];
  category_labels: Record<string, string>;
}

// ─── Provider 타입 ───────────────────────────────────────────────────────────

export interface ProviderResponse {
  id: number;
  name: string;
  platform: "slack" | "teams";
  enabled: boolean;
  is_valid: boolean;
  validation_errors?: Array<ValidationError> | string;
  is_connected?: boolean;

  // Slack (마스킹됨)
  token?: string;
  app_token?: string;

  // Teams (마스킹됨)
  tenant_id?: string;
  app_id?: string;
  team_id?: string;

  // 공통 설정
  prefix_messages_with_nick?: boolean | null;
  edit_suffix?: string | null;
  edit_disable?: boolean | null;
  use_username?: boolean | null;
  no_send_join_part?: boolean | null; // Slack only
  use_api?: boolean | null; // Slack only
  debug?: boolean | null;

  // 기능 설정 (null = 전체 활성화)
  enabled_features?: string[] | null;

  // Teams Delegated Auth
  has_delegated_auth?: boolean;
  ms_user_id?: string | null;

  created_at: string;
  updated_at: string;
}

export interface ProviderCreateRequest {
  name: string;
  platform: "slack" | "teams";
  enabled?: boolean;
  enabled_features?: string[] | null;

  // Slack
  token?: string;
  app_token?: string;

  // Teams
  tenant_id?: string;
  app_id?: string;
  app_password?: string;
  team_id?: string;

  // 공통 설정
  prefix_messages_with_nick?: boolean;
  edit_suffix?: string;
  edit_disable?: boolean;
  use_username?: boolean;
  no_send_join_part?: boolean;
  use_api?: boolean;
  debug?: boolean;
}

export interface ProviderUpdateRequest {
  name?: string;
  enabled?: boolean;
  enabled_features?: string[] | null;

  // Slack
  token?: string;
  app_token?: string;

  // Teams
  tenant_id?: string;
  app_id?: string;
  app_password?: string;
  team_id?: string;

  // 공통 설정
  prefix_messages_with_nick?: boolean;
  edit_suffix?: string;
  edit_disable?: boolean;
  use_username?: boolean;
  no_send_join_part?: boolean;
  use_api?: boolean;
  debug?: boolean;
}

export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  feature_permissions?: FeaturePermissionStatus[];
}

/**
 * Providers API 클라이언트
 */
export const providersApi = {
  /**
   * Provider 목록 조회
   */
  async getProviders(): Promise<ProviderResponse[]> {
    const response = await apiClient.get<{ accounts: ProviderResponse[] }>(
      "/api/accounts-db",
    );
    return response.data.accounts || [];
  },

  /**
   * Provider 상세 조회
   */
  async getProvider(id: number): Promise<ProviderResponse> {
    const response = await apiClient.get<ProviderResponse>(
      `/api/accounts-db/${id}`,
    );
    return response.data;
  },

  /**
   * Provider 추가
   */
  async createProvider(data: ProviderCreateRequest): Promise<ProviderResponse> {
    const requestBody: Record<string, unknown> = {
      name: data.name,
      platform: data.platform,
      enabled: data.enabled ?? true,
    };

    if (data.enabled_features !== undefined) {
      requestBody.enabled_features = data.enabled_features;
    }

    if (data.platform === "slack") {
      requestBody.slack = {
        token: data.token,
        app_token: data.app_token,
        prefix_messages_with_nick: data.prefix_messages_with_nick,
        edit_suffix: data.edit_suffix,
        edit_disable: data.edit_disable,
        use_username: data.use_username,
        no_send_join_part: data.no_send_join_part,
        use_api: data.use_api,
        debug: data.debug,
      };
    } else if (data.platform === "teams") {
      requestBody.teams = {
        tenant_id: data.tenant_id,
        app_id: data.app_id,
        app_password: data.app_password,
        team_id: data.team_id,
        prefix_messages_with_nick: data.prefix_messages_with_nick,
        edit_suffix: data.edit_suffix,
        edit_disable: data.edit_disable,
        use_username: data.use_username,
      };
    }

    const response = await apiClient.post<ProviderResponse>(
      "/api/accounts-db",
      requestBody,
    );
    return response.data;
  },

  /**
   * Provider 수정
   */
  async updateProvider(
    id: number,
    data: ProviderUpdateRequest,
  ): Promise<ProviderResponse> {
    const requestBody: Record<string, unknown> = {};

    if (data.name !== undefined) requestBody.name = data.name;
    if (data.enabled !== undefined) requestBody.enabled = data.enabled;
    if (data.enabled_features !== undefined)
      requestBody.enabled_features = data.enabled_features;

    // Slack 필드 + 공통 설정
    if (
      data.token !== undefined ||
      data.app_token !== undefined ||
      data.prefix_messages_with_nick !== undefined ||
      data.edit_suffix !== undefined ||
      data.edit_disable !== undefined ||
      data.use_username !== undefined ||
      data.no_send_join_part !== undefined ||
      data.use_api !== undefined ||
      data.debug !== undefined
    ) {
      requestBody.slack = {
        token: data.token,
        app_token: data.app_token,
        prefix_messages_with_nick: data.prefix_messages_with_nick,
        edit_suffix: data.edit_suffix,
        edit_disable: data.edit_disable,
        use_username: data.use_username,
        no_send_join_part: data.no_send_join_part,
        use_api: data.use_api,
        debug: data.debug,
      };
    }

    // Teams 필드 + 공통 설정
    if (
      data.tenant_id !== undefined ||
      data.app_id !== undefined ||
      data.app_password !== undefined ||
      data.team_id !== undefined ||
      data.prefix_messages_with_nick !== undefined ||
      data.edit_suffix !== undefined ||
      data.edit_disable !== undefined ||
      data.use_username !== undefined
    ) {
      requestBody.teams = {
        tenant_id: data.tenant_id,
        app_id: data.app_id,
        app_password: data.app_password,
        team_id: data.team_id,
        prefix_messages_with_nick: data.prefix_messages_with_nick,
        edit_suffix: data.edit_suffix,
        edit_disable: data.edit_disable,
        use_username: data.use_username,
      };
    }

    const response = await apiClient.put<ProviderResponse>(
      `/api/accounts-db/${id}`,
      requestBody,
    );
    return response.data;
  },

  /**
   * Provider 삭제
   */
  async deleteProvider(id: number): Promise<void> {
    await apiClient.delete(`/api/accounts-db/${id}`);
  },

  /**
   * 연결 테스트
   */
  async testConnection(id: number): Promise<ConnectionTestResponse> {
    const response = await apiClient.post<ConnectionTestResponse>(
      `/api/accounts-db/${id}/test`,
    );
    return response.data;
  },

  /**
   * 기능 카탈로그 조회
   */
  async getFeatureCatalog(): Promise<FeatureCatalogResponse> {
    const response = await apiClient.get<FeatureCatalogResponse>(
      "/api/accounts-db/features/catalog",
    );
    return response.data;
  },

  /**
   * Microsoft Delegated Auth 상태 조회
   */
  async getMicrosoftAuthStatus(accountId: number): Promise<{
    account_id: number;
    has_delegated_auth: boolean;
    ms_user_id: string | null;
    token_expires_at: string | null;
  }> {
    const response = await apiClient.get(
      `/api/auth/microsoft/${accountId}/status`,
    );
    return response.data;
  },

  /**
   * Microsoft Delegated Auth 연결 해제
   */
  async disconnectMicrosoftAuth(
    accountId: number,
  ): Promise<{ message: string }> {
    const response = await apiClient.post(
      `/api/auth/microsoft/${accountId}/disconnect`,
    );
    return response.data;
  },
};
