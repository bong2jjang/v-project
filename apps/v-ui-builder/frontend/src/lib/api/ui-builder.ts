/**
 * v-ui-builder API — projects / messages / artifacts / chat(SSE).
 *
 * Vite proxy(`/api` → `ui-builder-backend:8000`)가 적용된 상태이므로
 * URL은 상대 경로 `/api/...` 를 사용한다.
 */

import { apiClient, get, post, put, del } from "@v-platform/core/api/client";

export type Template = "react-ts" | "vue" | "vanilla-ts";
export type LLMProvider = "openai" | "anthropic" | "gemini";
export type MessageRole = "user" | "assistant" | "system";

export interface Project {
  id: string;
  user_id: number;
  name: string;
  description: string | null;
  template: string;
  llm_provider: string;
  llm_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  role: MessageRole;
  content: string;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface Artifact {
  id: string;
  project_id: string;
  file_path: string;
  content: string;
  version: number;
  created_at: string;
}

export interface ProjectDetail extends Project {
  messages: Message[];
  artifacts: Artifact[];
}

export interface ProjectCreateRequest {
  name: string;
  description?: string;
  template?: Template;
  llm_provider?: LLMProvider;
  llm_model?: string;
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  llm_provider?: LLMProvider;
  llm_model?: string;
}

export interface ProviderInfo {
  name: string;
  available: boolean;
  models: string[];
}

export const uiBuilderApi = {
  listProjects: () => get<Project[]>("/api/projects"),
  getProject: (id: string) => get<ProjectDetail>(`/api/projects/${id}`),
  createProject: (data: ProjectCreateRequest) =>
    post<Project>("/api/projects", data),
  updateProject: (id: string, data: ProjectUpdateRequest) =>
    apiClient.patch<Project>(`/api/projects/${id}`, data).then((r) => r.data),
  deleteProject: (id: string) => del<void>(`/api/projects/${id}`),

  listMessages: (projectId: string) =>
    get<Message[]>(`/api/projects/${projectId}/messages`),
  listArtifacts: (projectId: string) =>
    get<Artifact[]>(`/api/projects/${projectId}/artifacts`),
  upsertArtifact: (projectId: string, file_path: string, content: string) =>
    post<Artifact>(`/api/projects/${projectId}/artifacts`, {
      file_path,
      content,
    }),

  listProviders: () => get<ProviderInfo[]>("/api/llm/providers"),
  testProvider: (name: string) =>
    post<{ provider: string; available: boolean }>(`/api/llm/test/${name}`, {}),
};

export { put };
