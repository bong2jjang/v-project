/**
 * Persistent Notifications API
 */

import { apiClient } from "./client";

export interface PersistentNotification {
  id: number;
  title: string;
  message: string;
  severity: "critical" | "error" | "warning" | "info" | "success";
  category: string;
  scope: "global" | "app" | "role" | "user";
  app_id: string | null;
  target_role: string | null;
  target_user_id: number | null;
  source: string | null;
  link: string | null;
  is_active: boolean;
  is_system: boolean;
  delivery_type: "toast" | "announcement" | "both";
  expires_at: string | null;
  created_by: number | null;
  created_at: string;
  is_read: boolean;
}

export interface NotificationListResponse {
  notifications: PersistentNotification[];
  total: number;
  unread_count: number;
}

export interface NotificationCreate {
  title: string;
  message: string;
  severity?: string;
  category?: string;
  scope?: string;
  target_role?: string;
  target_user_id?: number;
  link?: string;
  expires_at?: string;
  delivery_type?: "toast" | "announcement" | "both";
}

export interface NotificationUpdate {
  title?: string;
  message?: string;
  severity?: string;
  scope?: string;
  target_role?: string;
  target_user_id?: number;
  is_active?: boolean;
  expires_at?: string;
  link?: string;
  delivery_type?: "toast" | "announcement" | "both";
}

const BASE = "/api/notifications-v2";

export async function listNotifications(params?: {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
  admin_view?: boolean;
}): Promise<NotificationListResponse> {
  const resp = await apiClient.get<NotificationListResponse>(BASE, { params });
  return resp.data;
}

export async function createNotification(
  data: NotificationCreate,
): Promise<PersistentNotification> {
  const resp = await apiClient.post<PersistentNotification>(BASE, data);
  return resp.data;
}

export async function updateNotification(
  id: number,
  data: NotificationUpdate,
): Promise<PersistentNotification> {
  const resp = await apiClient.put<PersistentNotification>(`${BASE}/${id}`, data);
  return resp.data;
}

export async function markRead(id: number): Promise<void> {
  await apiClient.post(`${BASE}/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await apiClient.post(`${BASE}/read-all`);
}

export async function deleteNotification(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function listAnnouncements(): Promise<PersistentNotification[]> {
  const resp = await apiClient.get<PersistentNotification[]>(
    `${BASE}/announcements`,
  );
  return resp.data;
}

export interface SystemNotificationStatus {
  id: number;
  title: string;
  category: string;
  scope: string;
  is_active: boolean;
}

export async function getSystemNotificationStatus(): Promise<
  SystemNotificationStatus[]
> {
  const resp = await apiClient.get<SystemNotificationStatus[]>(
    `${BASE}/system-status`,
  );
  return resp.data;
}

/** 이미지 파일 업로드 → 마크다운용 URL 반환 */
export async function uploadNotificationImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await apiClient.post<{ url: string }>(
    "/api/uploads/image",
    formData,
  );
  return resp.data.url;
}
