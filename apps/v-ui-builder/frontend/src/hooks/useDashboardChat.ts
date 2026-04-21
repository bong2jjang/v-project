/**
 * useDashboardChat — POST /api/projects/:id/dashboard/chat SSE 소비 훅 (P3.4).
 *
 * 공용 ChatPane(scope="dashboard") 에서 호출. 이벤트별 처리:
 *  - content                      → 어시스턴트 스트리밍 텍스트 누적
 *  - dashboard_widget_added       → zustand upsertWidget
 *  - dashboard_widget_updated     → zustand upsertWidget
 *  - dashboard_widget_removed     → zustand removeWidget
 *  - dashboard_layout_changed     → zustand replaceWidgets (reflow 결과)
 *  - dashboard_op_error           → 에러 콜백
 *  - done                         → 최종 message_id. 로컬 스트리밍 버퍼 flush.
 *  - error                        → 전역 에러.
 *
 * 모든 캐시 정합은 zustand 직접 갱신으로 처리하고, TanStack Query 키
 * `["ui-builder", "dashboard", projectId]` 는 done 시 한 번 invalidate.
 */

import { useCallback, useRef, useState } from "react";
import { createParser, type ParsedEvent } from "eventsource-parser";
import { useQueryClient } from "@tanstack/react-query";

import { useDashboardStore } from "../store/dashboard";
import type { DashboardWidget, WidgetProposal } from "../lib/api/dashboards";

function getCsrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const dashboardQueryKey = (projectId: string) =>
  ["ui-builder", "dashboard", projectId] as const;

const dashboardMessagesKey = (projectId: string) =>
  ["ui-builder", "dashboard-messages", projectId] as const;

export interface DashboardChatSendOptions {
  model?: string;
  selectedWidgetIds?: string[];
}

export interface DashboardAssistantTurn {
  content: string;
  opErrors: string[];
  opCount: number;
  /** LLM 이 이번 턴에 제안한 위젯 프리뷰들. ChatPane 이 카드로 렌더. */
  proposals: WidgetProposal[];
}

export interface DashboardChatHandle {
  send: (prompt: string, options?: DashboardChatSendOptions) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
  /** 현재 스트리밍 중인 어시스턴트 메시지 (스트림 완료 시 리셋). */
  streaming: DashboardAssistantTurn | null;
}

interface UseDashboardChatOptions {
  projectId: string;
  onError?: (message: string) => void;
}

export function useDashboardChat({
  projectId,
  onError,
}: UseDashboardChatOptions): DashboardChatHandle {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streaming, setStreaming] = useState<DashboardAssistantTurn | null>(
    null,
  );
  const controllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const upsertWidget = useDashboardStore((s) => s.upsertWidget);
  const removeWidget = useDashboardStore((s) => s.removeWidget);
  const replaceWidgets = useDashboardStore((s) => s.replaceWidgets);

  const send = useCallback(
    async (prompt: string, options?: DashboardChatSendOptions) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;

      if (controllerRef.current) controllerRef.current.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setIsStreaming(true);
      const turn: DashboardAssistantTurn = {
        content: "",
        opErrors: [],
        opCount: 0,
        proposals: [],
      };
      setStreaming(turn);

      const token = localStorage.getItem("token");
      const csrf = getCsrfToken();

      try {
        const res = await fetch(
          `/api/projects/${projectId}/dashboard/chat`,
          {
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
              prompt: trimmed,
              selected_widget_ids: options?.selectedWidgetIds ?? [],
              ...(options?.model ? { model: options.model } : {}),
            }),
          },
        );

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `dashboard chat failed (${res.status}): ${text || res.statusText}`,
          );
        }

        const parser = createParser(
          (evt: ParsedEvent | { type: "reconnect-interval" }) => {
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
                turn.content += delta;
                setStreaming({ ...turn });
                break;
              }
              case "dashboard_widget_added":
              case "dashboard_widget_updated": {
                const w = payload.widget as DashboardWidget | undefined;
                if (!w || typeof w !== "object") return;
                upsertWidget(w);
                turn.opCount += 1;
                setStreaming({ ...turn });
                break;
              }
              case "dashboard_widget_proposed": {
                const p = payload.proposal as WidgetProposal | undefined;
                if (!p || typeof p !== "object" || !p.proposal_id) return;
                turn.proposals = [...turn.proposals, p];
                turn.opCount += 1;
                setStreaming({ ...turn });
                break;
              }
              case "dashboard_widget_removed": {
                const id = String(payload.widget_id ?? "");
                if (!id) return;
                removeWidget(id);
                turn.opCount += 1;
                setStreaming({ ...turn });
                break;
              }
              case "dashboard_layout_changed": {
                const widgets = payload.widgets as
                  | DashboardWidget[]
                  | undefined;
                if (Array.isArray(widgets)) replaceWidgets(widgets);
                turn.opCount += 1;
                setStreaming({ ...turn });
                break;
              }
              case "dashboard_op_error": {
                const err = String(payload.error ?? "op error");
                turn.opErrors.push(err);
                setStreaming({ ...turn });
                onError?.(err);
                break;
              }
              case "done": {
                queryClient.invalidateQueries({
                  queryKey: dashboardQueryKey(projectId),
                });
                queryClient.invalidateQueries({
                  queryKey: dashboardMessagesKey(projectId),
                });
                setStreaming(null);
                break;
              }
              case "error": {
                const msg = String(payload.message ?? "dashboard chat error");
                setStreaming(null);
                onError?.(msg);
                break;
              }
            }
          },
        );

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStreaming(null);
          return;
        }
        const msg = err instanceof Error ? err.message : "unknown error";
        setStreaming(null);
        onError?.(msg);
      } finally {
        setIsStreaming(false);
        controllerRef.current = null;
      }
    },
    [projectId, upsertWidget, removeWidget, replaceWidgets, queryClient, onError],
  );

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStreaming(null);
    setIsStreaming(false);
  }, []);

  return { send, abort, isStreaming, streaming };
}
