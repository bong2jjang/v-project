import { apiClient, get } from "./client";
import type {
  UserNotificationPref,
  UserNotificationPrefUpdateInput,
} from "./itsmTypes";

export async function getMyNotificationPref(): Promise<UserNotificationPref> {
  return get<UserNotificationPref>(`/api/me/notification-pref`);
}

export async function updateMyNotificationPref(
  data: UserNotificationPrefUpdateInput,
): Promise<UserNotificationPref> {
  const response = await apiClient.patch<UserNotificationPref>(
    `/api/me/notification-pref`,
    data,
  );
  return response.data;
}
