/**
 * 모니터링 서비스 관련 타입 정의
 */

export type ServiceStatus = "healthy" | "warning" | "error" | "unknown";

export type ServiceCategory =
  | "metrics"
  | "logs"
  | "visualization"
  | "container";

export interface MonitoringService {
  id: string;
  name: string;
  icon: string;
  category: ServiceCategory;
  description: string;
  url: string;
  port: number;
  healthEndpoint?: string;
  hasUI: boolean;
  status: ServiceStatus;
  responseTimeMs?: number;
  error?: string;
  features: string[];
  uptime?: string;
}

export interface ServiceHealthResponse {
  service_id: string;
  status: ServiceStatus;
  response_time_ms?: number;
  error?: string;
}

export interface UsageGuide {
  serviceId: string;
  title: string;
  steps: string[];
  queries?: {
    title: string;
    query: string;
    description: string;
  }[];
}
