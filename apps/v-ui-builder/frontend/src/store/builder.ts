/**
 * Builder 상태 저장소 — 현재 프로젝트, 파일맵, 메시지 리스트, 활성 파일.
 *
 * SSE 스트리밍 중에는 streamingMessageId 로 현재 assistant 버블을 가리키고,
 * fileMap 은 artifact_delta 를 누적한 실시간 파일 상태를 유지한다.
 *
 * Generative UI (방안 C): 스트림 도중 ui_* 이벤트는 streamingUiCalls 에 누적하고,
 * done 시점에 uiCallsByMessageId[finalMessage.id] 로 이전한다. 로드된 히스토리
 * 메시지는 message.ui_calls 필드를 그대로 사용.
 */

import { create } from "zustand";

import type {
  Artifact,
  Message,
  Project,
  UiCallRecord,
} from "../lib/api/ui-builder";

export interface FileMap {
  [filePath: string]: string;
}

export type UiEventKind = "loading" | "component" | "patch" | "error";

export interface UiEventPayload {
  call_id: string;
  tool: string;
  component?: string | null;
  props?: Record<string, unknown> | null;
  error?: string | null;
}

interface BuilderState {
  project: Project | null;
  messages: Message[];
  fileMap: FileMap;
  activeFile: string | null;
  streamingMessageId: string | null;
  streamingBuffer: string;
  streamingUiCalls: UiCallRecord[];
  uiCallsByMessageId: Record<string, UiCallRecord[]>;
  isStreaming: boolean;
  viewingSnapshotId: string | null;

  setProject: (project: Project | null) => void;
  setMessages: (messages: Message[]) => void;
  appendMessage: (message: Message) => void;
  setArtifacts: (artifacts: Artifact[]) => void;
  setActiveFile: (path: string | null) => void;
  updateFile: (path: string, content: string) => void;
  appendToFile: (path: string, delta: string) => void;
  startStreaming: () => void;
  appendStreamingContent: (delta: string) => void;
  applyUiEvent: (kind: UiEventKind, payload: UiEventPayload) => void;
  applyUiPatchToMessage: (
    messageId: string,
    kind: UiEventKind,
    payload: UiEventPayload,
  ) => void;
  finishStreaming: (finalMessage: Message) => void;
  resetStreaming: () => void;
  loadSnapshotFiles: (snapshotId: string, files: FileMap) => void;
  clearSnapshotView: () => void;
}

function upsertCall(
  list: UiCallRecord[],
  call_id: string,
  tool: string,
): [UiCallRecord[], number] {
  const idx = list.findIndex((r) => r.call_id === call_id);
  if (idx >= 0) return [list, idx];
  const next = [
    ...list,
    { call_id, tool, status: "loading" as const } satisfies UiCallRecord,
  ];
  return [next, next.length - 1];
}

function reduceUiEvent(
  list: UiCallRecord[],
  kind: UiEventKind,
  payload: UiEventPayload,
): UiCallRecord[] {
  const [base, idx] = upsertCall(list, payload.call_id, payload.tool);
  const current = base[idx];
  let updated: UiCallRecord;
  switch (kind) {
    case "loading":
      updated = {
        ...current,
        status: "loading",
        component: payload.component ?? current.component ?? null,
      };
      break;
    case "component":
      updated = {
        ...current,
        status: "ok",
        component: payload.component ?? current.component ?? null,
        props: payload.props ?? current.props ?? null,
        error: null,
      };
      break;
    case "patch":
      updated = {
        ...current,
        status: "ok",
        component: payload.component ?? current.component ?? null,
        props: { ...(current.props ?? {}), ...(payload.props ?? {}) },
        error: null,
      };
      break;
    case "error":
      updated = {
        ...current,
        status: "error",
        error: payload.error ?? "unknown error",
      };
      break;
  }
  const next = base.slice();
  next[idx] = updated;
  return next;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  project: null,
  messages: [],
  fileMap: {},
  activeFile: null,
  streamingMessageId: null,
  streamingBuffer: "",
  streamingUiCalls: [],
  uiCallsByMessageId: {},
  isStreaming: false,
  viewingSnapshotId: null,

  setProject: (project) => set({ project }),
  setMessages: (messages) =>
    set(() => {
      const map: Record<string, UiCallRecord[]> = {};
      for (const m of messages) {
        if (m.ui_calls && m.ui_calls.length > 0) map[m.id] = m.ui_calls;
      }
      return { messages, uiCallsByMessageId: map };
    }),
  appendMessage: (message) =>
    set((s) => {
      const nextMap = { ...s.uiCallsByMessageId };
      if (message.ui_calls && message.ui_calls.length > 0) {
        nextMap[message.id] = message.ui_calls;
      }
      return {
        messages: [...s.messages, message],
        uiCallsByMessageId: nextMap,
      };
    }),

  setArtifacts: (artifacts) => {
    const map: FileMap = {};
    for (const a of artifacts) map[a.file_path] = a.content;
    set((s) => ({
      fileMap: map,
      activeFile: s.activeFile ?? artifacts[0]?.file_path ?? null,
    }));
  },

  setActiveFile: (path) => set({ activeFile: path }),

  updateFile: (path, content) =>
    set((s) => ({
      fileMap: { ...s.fileMap, [path]: content },
      activeFile: s.activeFile ?? path,
    })),

  appendToFile: (path, delta) =>
    set((s) => ({
      fileMap: { ...s.fileMap, [path]: (s.fileMap[path] ?? "") + delta },
      activeFile: s.activeFile ?? path,
    })),

  startStreaming: () =>
    set({
      isStreaming: true,
      streamingBuffer: "",
      streamingMessageId: null,
      streamingUiCalls: [],
    }),

  appendStreamingContent: (delta) =>
    set((s) => ({ streamingBuffer: s.streamingBuffer + delta })),

  applyUiEvent: (kind, payload) =>
    set((s) => ({
      streamingUiCalls: reduceUiEvent(s.streamingUiCalls, kind, payload),
    })),

  applyUiPatchToMessage: (messageId, kind, payload) =>
    set((s) => {
      const prev = s.uiCallsByMessageId[messageId] ?? [];
      const next = reduceUiEvent(prev, kind, payload);
      return {
        uiCallsByMessageId: { ...s.uiCallsByMessageId, [messageId]: next },
      };
    }),

  finishStreaming: (finalMessage) =>
    set((s) => {
      const calls =
        finalMessage.ui_calls && finalMessage.ui_calls.length > 0
          ? finalMessage.ui_calls
          : s.streamingUiCalls;
      const messageWithCalls: Message = { ...finalMessage, ui_calls: calls };
      const nextMap = { ...s.uiCallsByMessageId };
      if (calls.length > 0) nextMap[finalMessage.id] = calls;
      return {
        messages: [...s.messages, messageWithCalls],
        isStreaming: false,
        streamingBuffer: "",
        streamingUiCalls: [],
        streamingMessageId: finalMessage.id,
        uiCallsByMessageId: nextMap,
      };
    }),

  resetStreaming: () =>
    set({
      isStreaming: false,
      streamingBuffer: "",
      streamingMessageId: null,
      streamingUiCalls: [],
    }),

  loadSnapshotFiles: (snapshotId, files) =>
    set({
      fileMap: { ...files },
      activeFile: Object.keys(files)[0] ?? null,
      viewingSnapshotId: snapshotId,
    }),

  clearSnapshotView: () => set({ viewingSnapshotId: null }),
}));
