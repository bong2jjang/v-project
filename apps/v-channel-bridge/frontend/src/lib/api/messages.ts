/**
 * Messages API Client
 *
 * 메시지 히스토리 API
 */

import { apiClient } from "./client";

// Types
export interface AttachmentDetail {
  name?: string;
  size?: number;
  type?: string;
  url?: string;
}

export interface Message {
  id: number;
  message_id?: string;
  text: string;
  gateway: string;
  source: {
    account: string;
    channel: string;
    channel_name?: string;
    user?: string;
    user_name?: string;
    display_name?: string;
  };
  destination: {
    account: string;
    channel: string;
    channel_name?: string;
  };
  protocol?: string;
  timestamp: string;
  created_at: string;
  has_attachment: boolean;
  attachment_count: number;
  attachment_details?: AttachmentDetail[];
  message_type: string;
  message_format?: string;
  // Delivery Status (added 2026-04-03)
  status?: "pending" | "sent" | "failed" | "retrying";
  error_message?: string;
  retry_count?: number;
  delivered_at?: string;
}

export interface MessageSearchParams {
  q?: string;
  gateway?: string;
  route?: string;
  channel?: string;
  src_channel?: string[];
  dst_channel?: string[];
  user?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
  sort?: "timestamp_asc" | "timestamp_desc";
}

export interface MessageSearchResponse {
  messages: Message[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface MessageStats {
  total_messages: number;
  by_gateway: Record<string, number>;
  by_channel: Record<string, number>;
  by_hour: Record<string, number>;
  by_day: Record<string, number>;
  // 확장 필드 (2026-04-05 추가)
  by_status?: Record<string, number>;
  by_platform?: Record<string, number>;
  by_direction?: Record<string, number>;
  with_attachment?: number;
  success_rate?: number | null;
}

export type MessageStatsResponse = MessageStats;

export interface FilterOptions {
  gateways: string[];
  channels: string[];
  channel_labels?: Record<string, string>;
  src_channels?: string[];
  src_channel_labels?: Record<string, string>;
  dst_channels?: string[];
  dst_channel_labels?: Record<string, string>;
  users: string[];
  user_labels?: Record<string, string>;
  routes?: string[];
}

// API Functions

/**
 * 메시지 검색
 */
export async function searchMessages(
  params: MessageSearchParams = {},
): Promise<MessageSearchResponse> {
  const response = await apiClient.get("/api/messages", { params });
  return response.data;
}

/**
 * 메시지 상세 조회
 */
export async function getMessage(id: number): Promise<Message> {
  const response = await apiClient.get(`/api/messages/${id}`);
  return response.data;
}

/**
 * 메시지 통계 조회
 */
export async function getMessageStats(
  params: {
    from_date?: string;
    to_date?: string;
  } = {},
): Promise<MessageStats> {
  const response = await apiClient.get("/api/messages/stats/summary", {
    params,
  });
  return response.data;
}

/**
 * CSV Export
 */
export async function exportMessagesCSV(
  params: MessageSearchParams = {},
): Promise<Blob> {
  const response = await apiClient.post("/api/messages/export/csv", null, {
    params,
    responseType: "blob",
  });
  return response.data;
}

/**
 * JSON Export
 */
export async function exportMessagesJSON(
  params: MessageSearchParams = {},
): Promise<Blob> {
  const response = await apiClient.post("/api/messages/export/json", null, {
    params,
    responseType: "blob",
  });
  return response.data;
}

/**
 * 필터 옵션 조회 (고급 필터링용)
 */
export async function getFilterOptions(): Promise<FilterOptions> {
  const response = await apiClient.get("/api/messages/filters/options");
  return response.data;
}

/**
 * 테스트 데이터 생성 (개발용)
 */
export async function generateTestData(
  count: number = 100,
): Promise<{ message: string }> {
  const response = await apiClient.post("/api/messages/test-data", null, {
    params: { count },
  });
  return response.data;
}

/**
 * 메시지 삭제 (관리자 전용)
 */
export async function deleteMessage(id: number): Promise<{ message: string }> {
  const response = await apiClient.delete(`/api/messages/${id}`);
  return response.data;
}

/**
 * 모든 메시지 삭제 (관리자 전용)
 */
export async function deleteAllMessages(): Promise<{
  message: string;
  deleted_count: number;
}> {
  const response = await apiClient.delete("/api/messages");
  return response.data;
}

/**
 * 조건에 맞는 메시지 삭제 (관리자 전용)
 */
export async function deleteMessagesByFilters(params: {
  gateway?: string[];
  channel?: string[];
  user?: string;
  from_date?: string;
  to_date?: string;
}): Promise<{
  message: string;
  deleted_count: number;
}> {
  const response = await apiClient.post(
    "/api/messages/delete-by-filters",
    null,
    {
      params,
    },
  );
  return response.data;
}

/**
 * 조건에 맞는 메시지 수 조회 (관리자 전용)
 */
export async function countMessagesByFilters(params: {
  gateway?: string[];
  channel?: string[];
  user?: string;
  from_date?: string;
  to_date?: string;
}): Promise<{ count: number }> {
  const response = await apiClient.get("/api/messages/count-by-filters", {
    params,
  });
  return response.data;
}
