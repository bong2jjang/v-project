/**
 * Gateway Test API
 *
 * Gateway 테스트 메시지 전송 API
 */

import { post } from "./client";

export interface GatewayTestRequest {
  target_channel: string;
  channel_id: string;
  message?: string;
}

export interface GatewayTestResponse {
  success: boolean;
  platform: string;
  sent_to: string;
  sent_at: string;
  message_id?: string;
  delivery_status?: string;
  message?: string;
}

/**
 * Gateway 테스트 메시지 전송
 */
export async function testGateway(
  gatewayName: string,
  request: GatewayTestRequest,
): Promise<GatewayTestResponse> {
  return post<GatewayTestResponse>(
    `/api/bridge/gateways/${encodeURIComponent(gatewayName)}/test`,
    request,
  );
}
