/**
 * useUiAction — POST /api/ui-action SSE 소비 훅.
 *
 * 카드 내부 상호작용(예: StockCard 의 range 전환, RefreshButton 등)을 서버 도구의
 * `invoke_action` 으로 보내고, 돌아오는 ui_loading / ui_component / ui_patch /
 * ui_error 이벤트를 스코프에 따라 병합한다.
 *
 * - target=message: 스트림 이벤트를 해당 메시지의 uiCalls 레코드로 병합.
 * - target=widget:  이벤트는 서버가 이미 widget.props 에 반영하므로
 *                    스트림 종료 후 TanStack Query 의 대시보드 키를 무효화해
 *                    최신 상태를 재동기화한다.
 */

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createParser, type ParsedEvent } from "eventsource-parser";

import { useBuilderStore, type UiEventKind } from "../store/builder";

function getCsrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export type UiActionTarget =
  | { kind: "message"; messageId: string }
  | { kind: "widget"; widgetId: string; projectId: string };

export interface UiActionInput {
  target: UiActionTarget;
  callId: string;
  tool: string;
  action: string;
  args: Record<string, unknown>;
}

interface UiActionHandle {
  invoke: (input: UiActionInput) => Promise<void>;
  isPending: boolean;
  error: string | null;
}

export function useUiAction(): UiActionHandle {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const invoke = useCallback(
    async (input: UiActionInput) => {
      const { target, callId, tool, action, args } = input;
      if (controllerRef.current) controllerRef.current.abort();

      const controller = new AbortController();
      controllerRef.current = controller;
      setIsPending(true);
      setError(null);

      const applyPatch = useBuilderStore.getState().applyUiPatchToMessage;
      const token = localStorage.getItem("token");
      const csrf = getCsrfToken();

      const body =
        target.kind === "message"
          ? {
              target: "message",
              message_id: target.messageId,
              call_id: callId,
              action,
              args,
            }
          : {
              target: "widget",
              widget_id: target.widgetId,
              call_id: callId,
              action,
              args,
            };

      try {
        const res = await fetch("/api/ui-action", {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(csrf ? { "X-CSRF-Token": csrf } : {}),
          },
          body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `UI action failed (${res.status}): ${text || res.statusText}`,
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
              case "ui_loading":
              case "ui_component":
              case "ui_patch":
              case "ui_error": {
                if (target.kind !== "message") break;
                const kind = event.slice("ui_".length) as UiEventKind;
                const eventCallId = String(payload.call_id ?? callId);
                applyPatch(target.messageId, kind, {
                  call_id: eventCallId,
                  tool: String(payload.tool ?? tool),
                  component:
                    typeof payload.component === "string"
                      ? payload.component
                      : null,
                  props:
                    payload.props && typeof payload.props === "object"
                      ? (payload.props as Record<string, unknown>)
                      : null,
                  error:
                    typeof payload.error === "string" ? payload.error : null,
                });
                break;
              }
              case "done":
                break;
              case "error": {
                const msg = String(payload.message ?? "UI action error");
                setError(msg);
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

        if (target.kind === "widget") {
          queryClient.invalidateQueries({
            queryKey: ["ui-builder", "dashboard", target.projectId],
          });
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
      } finally {
        setIsPending(false);
        controllerRef.current = null;
      }
    },
    [queryClient],
  );

  return { invoke, isPending, error };
}
