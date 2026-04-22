/**
 * 모니터링 서비스 API 클라이언트
 */

import { apiClient } from "./client";
import type { ServiceHealthResponse } from "../types/monitoring";

export const monitoringApi = {
  async checkAllServices(): Promise<ServiceHealthResponse[]> {
    const response = await apiClient.get<ServiceHealthResponse[]>(
      "/api/monitoring/health",
    );
    return response.data;
  },

  async checkServiceHealth(serviceId: string): Promise<ServiceHealthResponse> {
    const response = await apiClient.get<ServiceHealthResponse>(
      `/api/monitoring/health/${serviceId}`,
    );
    return response.data;
  },
};
