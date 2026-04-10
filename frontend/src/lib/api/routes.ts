/**
 * Routes API 클라이언트
 *
 * Route 관리 API
 */

export interface ChannelInfo {
  id: string;
  name: string;
  type: string;
}

export interface RouteTarget {
  platform: string;
  channel_id: string;
  channel_name?: string;
  message_mode?: string; // "sender_info" or "editable"
  is_bidirectional?: boolean; // 양방향 라우트 여부
  is_enabled?: boolean; // 활성/비활성 여부
}

export interface RouteResponse {
  source: {
    platform: string;
    channel_id: string;
    channel_name?: string;
  };
  targets: RouteTarget[];
}

export interface RouteCreateRequest {
  source_platform: string;
  source_channel: string;
  target_platform: string;
  target_channel: string;
  target_channel_name?: string;
  source_channel_name?: string;
  message_mode?: string; // "sender_info" or "editable"
  is_bidirectional?: boolean; // 양방향 라우트 여부 (기본값: true)
  is_enabled?: boolean; // 활성/비활성 (기본값: true)
}

/**
 * Routes API 클라이언트
 */
export const routesApi = {
  /**
   * 라우트 목록 조회
   */
  async getRoutes(): Promise<RouteResponse[]> {
    const response = await fetch("/api/bridge/routes", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch routes");
    }

    return await response.json();
  },

  /**
   * 라우트 추가
   */
  async addRoute(route: RouteCreateRequest): Promise<void> {
    const response = await fetch("/api/bridge/routes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(route),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to add route");
    }
  },

  /**
   * 라우트 삭제
   */
  async deleteRoute(route: RouteCreateRequest): Promise<void> {
    const response = await fetch("/api/bridge/routes", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(route),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete route");
    }
  },

  /**
   * 라우트 활성/비활성 토글
   */
  async toggleRoute(params: {
    source_platform: string;
    source_channel: string;
    target_platform: string;
    target_channel: string;
    is_enabled: boolean;
  }): Promise<void> {
    const response = await fetch("/api/bridge/routes/toggle", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to toggle route");
    }
  },

  /**
   * 특정 플랫폼의 채널 목록 조회
   */
  async getChannels(platform: string): Promise<ChannelInfo[]> {
    const response = await fetch(`/api/bridge/channels/${platform}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Provider '${platform}' not found or not connected`);
      }
      if (response.status === 503) {
        const error = await response.json();
        throw new Error(error.detail || "Bridge or provider not available");
      }
      throw new Error("Failed to fetch channels");
    }

    return await response.json();
  },
};
