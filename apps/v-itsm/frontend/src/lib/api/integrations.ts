import { apiClient, get, post } from "./client";
import type {
  IntegrationSettings,
  IntegrationSettingsUpdateInput,
  IntegrationTestResult,
  IntegrationChannel,
} from "./itsmTypes";

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  return get<IntegrationSettings>(`/api/admin/integrations`);
}

export async function updateIntegrationSettings(
  data: IntegrationSettingsUpdateInput,
): Promise<IntegrationSettings> {
  const response = await apiClient.patch<IntegrationSettings>(
    `/api/admin/integrations`,
    data,
  );
  return response.data;
}

export async function testIntegration(
  channel: IntegrationChannel,
): Promise<IntegrationTestResult> {
  return post<IntegrationTestResult>(`/api/admin/integrations/test/${channel}`, {});
}
