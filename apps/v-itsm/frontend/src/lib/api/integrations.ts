import { apiClient, get, post } from "./client";
import type {
  IntegrationSettings,
  IntegrationSettingsUpdateInput,
  IntegrationTestResult,
  IntegrationChannel,
} from "./itsmTypes";

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  return get<IntegrationSettings>(`/api/integrations`);
}

export async function updateIntegrationSettings(
  data: IntegrationSettingsUpdateInput,
): Promise<IntegrationSettings> {
  const response = await apiClient.patch<IntegrationSettings>(
    `/api/integrations`,
    data,
  );
  return response.data;
}

export async function testIntegration(
  channel: IntegrationChannel,
): Promise<IntegrationTestResult> {
  return post<IntegrationTestResult>(`/api/integrations/test/${channel}`, {});
}
