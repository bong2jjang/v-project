/**
 * WebSocket Message Types
 *
 * Server → Client 메시지 타입 정의
 */

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
}

// Status Update
export interface StatusUpdateMessage extends WebSocketMessage {
  type: "status_update";
  data: {
    running: boolean;
    pid: number | null;
    uptime: number;
    version: string;
    container_status: "running" | "stopped" | "not_found" | "unknown";
    last_restart: string | null;
  };
}

// Log Update
export interface LogUpdateMessage extends WebSocketMessage {
  type: "log_update";
  data: {
    lines: string[];
  };
}

// Config Update
export interface ConfigUpdateMessage extends WebSocketMessage {
  type: "config_update";
  data: {
    gateway_count: number;
    account_count: number;
  };
}

// Connection Status
export interface ConnectionMessage extends WebSocketMessage {
  type: "connection";
  data: {
    status: "connected" | "disconnected";
    client_id: string;
  };
}

// Error
export interface ErrorMessage extends WebSocketMessage {
  type: "error";
  data: {
    message: string;
    code: string;
  };
}

// Subscription Updated
export interface SubscriptionUpdatedMessage extends WebSocketMessage {
  type: "subscription_updated";
  data: {
    action: "subscribed" | "unsubscribed";
    channels: string[];
  };
}

// Pong (response to ping)
export interface PongMessage extends WebSocketMessage {
  type: "pong";
}

// Union type for all possible messages
export type WSMessage =
  | StatusUpdateMessage
  | LogUpdateMessage
  | ConfigUpdateMessage
  | ConnectionMessage
  | ErrorMessage
  | SubscriptionUpdatedMessage
  | PongMessage;

// Client → Server Messages
export interface SubscribeMessage {
  type: "subscribe";
  data: {
    channels: string[];
  };
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  data: {
    channels: string[];
  };
}

export interface PingMessage {
  type: "ping";
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;
