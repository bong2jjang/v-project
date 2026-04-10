/**
 * 모니터링 서비스 API 클라이언트
 */

import { apiClient } from "./client";
import type { ServiceHealthResponse } from "@/types/monitoring";

export const monitoringApi = {
  /**
   * 모든 모니터링 서비스의 Health 상태 확인
   */
  async checkAllServices(): Promise<ServiceHealthResponse[]> {
    const response = await apiClient.get<ServiceHealthResponse[]>(
      "/api/monitoring/health",
    );
    return response.data;
  },

  /**
   * 특정 모니터링 서비스의 Health 상태 확인
   */
  async checkServiceHealth(serviceId: string): Promise<ServiceHealthResponse> {
    const response = await apiClient.get<ServiceHealthResponse>(
      `/api/monitoring/health/${serviceId}`,
    );
    return response.data;
  },
};
