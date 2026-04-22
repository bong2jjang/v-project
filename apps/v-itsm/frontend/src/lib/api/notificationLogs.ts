import { get, post } from "./client";
import type {
  NotificationLog,
  NotificationLogFilter,
  NotificationLogListResponse,
  NotificationLogRetryResult,
} from "./itsmTypes";

function toQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export async function listNotificationLogs(
  filter: NotificationLogFilter = {},
): Promise<NotificationLogListResponse> {
  return get<NotificationLogListResponse>(
    `/api/admin/notification-logs${toQuery(filter)}`,
  );
}

export async function getNotificationLog(id: string): Promise<NotificationLog> {
  return get<NotificationLog>(`/api/admin/notification-logs/${id}`);
}

export async function retryNotificationLog(
  id: string,
): Promise<NotificationLogRetryResult> {
  return post<NotificationLogRetryResult>(
    `/api/admin/notification-logs/${id}/retry`,
    {},
  );
}
