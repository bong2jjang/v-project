/**
 * useChatStream — POST /api/chat SSE 소비 훅.
 *
 * EventSource 는 Authorization 헤더를 실을 수 없어 fetch + ReadableStream +
 * eventsource-parser 조합을 사용한다. 서버 이벤트를 builder store 액션으로 분기하여
 * 실시간 message 버퍼와 fileMap 을 갱신한다.
 */

import { useCallback, useRef, useState } from "react";
import { createParser, type ParsedEvent } from "eventsource-parser";

import { useBuilderStore } from "../store/builder";
import { uiBuilderApi, type Message } from "../lib/api/ui-builder";

function getCsrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

interface ChatStreamOptions {
  projectId: string;
  onError?: (message: string) => void;
}

interface ChatStreamHandle {
  send: (prompt: string, model?: string) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
}

export function useChatStream({
  projectId,
  onError,
}: ChatStreamOptions): ChatStreamHandle {
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const {
    appendMessage,
    startStreaming,
    appendStreamingContent,
    finishStreaming,
    resetStreaming,
    updateFile,
    appendToFile,
    setActiveFile,
  } = useBuilderStore.getState();

  const send = useCallback(
    async (prompt: string, model?: string) => {
      if (!prompt.trim()) return;
      if (controllerRef.current) controllerRef.current.abort();

      const controller = new AbortController();
      controllerRef.current = controller;

      // 낙관적으로 user 메시지를 버블에 추가 (서버가 영속화하지만 UX 는 즉시 표시)
      appendMessage({
        id: `tmp-user-${Date.now()}`,
        project_id: projectId,
        role: "user",
        content: prompt,
        tokens_in: null,
        tokens_out: null,
        created_at: new Date().toISOString(),
      });

      startStreaming();
      setIsStreaming(true);

      const token = localStorage.getItem("token");
      const csrf = getCsrfToken();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(csrf ? { "X-CSRF-Token": csrf } : {}),
          },
          body: JSON.stringify({
            project_id: projectId,
            prompt,
            ...(model ? { model } : {}),
          }),
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Chat stream failed (${res.status}): ${text || res.statusText}`,
          );
        }

        const artifactBuffers: Record<string, string> = {};
        const contentBuffer: string[] = [];

        const parser = createParser((evt: ParsedEvent | { type: "reconnect-interval" }) => {
          if (evt.type !== "event") return;
          const { event, data } = evt;
          if (!event || !data) return;

          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(data);
          } catch {
            return;
          }

          switch (event) {
              case "content": {
                const delta = String(payload.delta ?? "");
                contentBuffer.push(delta);
                appendStreamingContent(delta);
                break;
              }
              case "artifact_start": {
                const filePath = String(payload.file_path ?? "");
                if (!filePath) return;
                artifactBuffers[filePath] = "";
                updateFile(filePath, "");
                setActiveFile(filePath);
                break;
              }
              case "artifact_delta": {
                const filePath = String(payload.file_path ?? "");
                const delta = String(payload.delta ?? "");
                if (!filePath) return;
                artifactBuffers[filePath] =
                  (artifactBuffers[filePath] ?? "") + delta;
                appendToFile(filePath, delta);
                break;
              }
              case "artifact_end": {
                // 파일 블록 완료 — 현재 구현에서는 추가 처리 없음
                break;
              }
              case "done": {
                const finalMessage: Message = {
                  id: String(payload.message_id ?? `tmp-asst-${Date.now()}`),
                  project_id: projectId,
                  role: "assistant",
                  content: contentBuffer.join(""),
                  tokens_in: null,
                  tokens_out: null,
                  created_at: new Date().toISOString(),
                };
                finishStreaming(finalMessage);
                break;
              }
              case "error": {
                const message = String(payload.message ?? "LLM error");
                resetStreaming();
                onError?.(message);
                break;
              }
            }
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }

        // 스트림은 끝났지만 done 이벤트가 없었던 경우 — 안전망으로 최종 refresh
        if (useBuilderStore.getState().isStreaming) {
          try {
            const [messages, artifacts] = await Promise.all([
              uiBuilderApi.listMessages(projectId),
              uiBuilderApi.listArtifacts(projectId),
            ]);
            useBuilderStore.setState({ messages });
            useBuilderStore.getState().setArtifacts(artifacts);
          } finally {
            resetStreaming();
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          resetStreaming();
          return;
        }
        const msg = err instanceof Error ? err.message : "Unknown error";
        resetStreaming();
        onError?.(msg);
      } finally {
        setIsStreaming(false);
        controllerRef.current = null;
      }
    },
    [
      projectId,
      appendMessage,
      startStreaming,
      appendStreamingContent,
      appendToFile,
      updateFile,
      setActiveFile,
      finishStreaming,
      resetStreaming,
      onError,
    ],
  );

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    resetStreaming();
    setIsStreaming(false);
  }, [resetStreaming]);

  return { send, abort, isStreaming };
}
