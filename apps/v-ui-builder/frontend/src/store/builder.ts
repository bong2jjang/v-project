/**
 * Builder 상태 저장소 — 현재 프로젝트, 파일맵, 메시지 리스트, 활성 파일.
 *
 * SSE 스트리밍 중에는 streamingMessageId 로 현재 assistant 버블을 가리키고,
 * fileMap 은 artifact_delta 를 누적한 실시간 파일 상태를 유지한다.
 */

import { create } from "zustand";

import type { Artifact, Message, Project } from "../lib/api/ui-builder";

export interface FileMap {
  [filePath: string]: string;
}

interface BuilderState {
  project: Project | null;
  messages: Message[];
  fileMap: FileMap;
  activeFile: string | null;
  streamingMessageId: string | null;
  streamingBuffer: string;
  isStreaming: boolean;

  setProject: (project: Project | null) => void;
  setMessages: (messages: Message[]) => void;
  appendMessage: (message: Message) => void;
  setArtifacts: (artifacts: Artifact[]) => void;
  setActiveFile: (path: string | null) => void;
  updateFile: (path: string, content: string) => void;
  appendToFile: (path: string, delta: string) => void;
  startStreaming: () => void;
  appendStreamingContent: (delta: string) => void;
  finishStreaming: (finalMessage: Message) => void;
  resetStreaming: () => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  project: null,
  messages: [],
  fileMap: {},
  activeFile: null,
  streamingMessageId: null,
  streamingBuffer: "",
  isStreaming: false,

  setProject: (project) => set({ project }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),

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
    set({ isStreaming: true, streamingBuffer: "", streamingMessageId: null }),

  appendStreamingContent: (delta) =>
    set((s) => ({ streamingBuffer: s.streamingBuffer + delta })),

  finishStreaming: (finalMessage) =>
    set((s) => ({
      messages: [...s.messages, finalMessage],
      isStreaming: false,
      streamingBuffer: "",
      streamingMessageId: finalMessage.id,
    })),

  resetStreaming: () =>
    set({ isStreaming: false, streamingBuffer: "", streamingMessageId: null }),
}));
