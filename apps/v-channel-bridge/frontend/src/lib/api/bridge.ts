/**
 * Bridge API - 메시지 브리지
 *
 * 자체 메시지 브리지 API 클라이언트
 * apiClient(axios)를 사용하여 인증 토큰 자동 첨부
 */

import { get, post, del } from "./client";

export interface BridgeStatus {
  is_running: boolean;
  providers: ProviderStatus[];
  active_tasks: number;
  // Runtime fields from WebSocket status updates
  running?: boolean;
  pid?: number;
  uptime?: string;
  version?: string;
  container_status?: string;
  last_restart?: string;
}

export interface ProviderStatus {
  platform: string;
  connected: boolean;
  config: Record<string, any>;
}

export interface RouteConfig {
  source_platform: string;
  source_channel: string;
  target_platform: string;
  target_channel: string;
  target_channel_name?: string;
}

export interface Route {
  source: {
    platform: string;
    channel_id: string;
  };
  targets: Array<{
    platform: string;
    channel_id: string;
    channel_name: string;
  }>;
}

export interface CommandResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface ChannelValidationResult {
  valid: boolean;
  channel?: {
    id: string;
    name: string;
    type: string;
  };
  error?: string;
}

/**
 * Bridge API 클라이언트
 */
export const bridgeApi = {
  /**
   * 브리지 상태 조회
   */
  async getStatus(): Promise<BridgeStatus> {
    return get<BridgeStatus>("/api/bridge/status");
  },

  /**
   * Provider 목록 조회
   */
  async getProviders(): Promise<ProviderStatus[]> {
    return get<ProviderStatus[]>("/api/bridge/providers");
  },

  /**
   * 라우팅 룰 목록 조회
   */
  async getRoutes(): Promise<Route[]> {
    return get<Route[]>("/api/bridge/routes");
  },

  /**
   * 라우팅 룰 추가
   */
  async addRoute(route: RouteConfig): Promise<void> {
    await post<void>("/api/bridge/routes", route);
  },

  /**
   * 라우팅 룰 제거
   */
  async removeRoute(route: RouteConfig): Promise<void> {
    await del<void>("/api/bridge/routes", { data: route });
  },

  /**
   * 커맨드 실행
   */
  async sendCommand(command: string): Promise<CommandResponse> {
    return post<CommandResponse>("/api/bridge/command", { command });
  },

  /**
   * 브리지 시작
   */
  async start(): Promise<void> {
    await post<void>("/api/bridge/start");
  },

  /**
   * 브리지 중지
   */
  async stop(): Promise<void> {
    await post<void>("/api/bridge/stop");
  },

  /**
   * 브리지 재시작 (시작 + 중지)
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  },

  /**
   * 브리지 로그 조회
   */
  async getLogs(lines: number = 100): Promise<{ logs: string[] }> {
    return get<{ logs: string[] }>(`/api/bridge/logs?lines=${lines}`);
  },

  /**
   * 채널 ID 유효성 검증
   */
  async validateChannel(
    platform: string,
    channelId: string,
  ): Promise<ChannelValidationResult> {
    return get<ChannelValidationResult>(
      `/api/bridge/channels/${platform}/validate/${encodeURIComponent(channelId)}`,
    );
  },
};

/**
 * Named exports for convenience
 */
export const restart = bridgeApi.restart.bind(bridgeApi);
export const getLogs = bridgeApi.getLogs.bind(bridgeApi);
