/**
 * Portal API client
 */

import { get, post, put, del } from "./client";

export interface PortalApp {
  id?: number;
  app_id: string;
  display_name: string;
  description: string;
  icon: string;
  frontend_url: string;
  api_url: string;
  health_endpoint?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface AppHealth {
  app_id: string;
  status: "online" | "offline" | "degraded" | "healthy" | "unknown";
  services: Record<string, { status: string; response_time_ms?: number }>;
  response_time_ms: number | null;
}

export interface SitemapEntry {
  app_id: string;
  display_name: string;
  menus: Array<{
    permission_key: string;
    label: string;
    icon: string;
    path: string;
    section: string;
  }>;
}

export interface AppCreateRequest {
  app_id: string;
  display_name: string;
  description?: string;
  icon?: string;
  frontend_url: string;
  api_url: string;
  health_endpoint?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface AppUpdateRequest {
  display_name?: string;
  description?: string;
  icon?: string;
  frontend_url?: string;
  api_url?: string;
  health_endpoint?: string;
  sort_order?: number;
  is_active?: boolean;
}

// ── READ ──────────────────────────────────────────

export async function getApps(): Promise<PortalApp[]> {
  return get<PortalApp[]>("/api/portal/apps");
}

export async function getAllApps(): Promise<PortalApp[]> {
  return get<PortalApp[]>("/api/portal/apps/all");
}

export async function getAllHealth(): Promise<AppHealth[]> {
  return get<AppHealth[]>("/api/portal/health");
}

export async function getAppHealth(appId: string): Promise<AppHealth> {
  return get<AppHealth>(`/api/portal/health/${appId}`);
}

export async function getSitemap(): Promise<SitemapEntry[]> {
  return get<SitemapEntry[]>("/api/portal/sitemap");
}

// ── CRUD ──────────────────────────────────────────

export async function createApp(data: AppCreateRequest): Promise<PortalApp> {
  return post<PortalApp>("/api/portal/apps", data);
}

export async function updateApp(
  appId: string,
  data: AppUpdateRequest,
): Promise<PortalApp> {
  return put<PortalApp>(`/api/portal/apps/${appId}`, data);
}

export async function deleteApp(appId: string): Promise<{ message: string }> {
  return del<{ message: string }>(`/api/portal/apps/${appId}`);
}
