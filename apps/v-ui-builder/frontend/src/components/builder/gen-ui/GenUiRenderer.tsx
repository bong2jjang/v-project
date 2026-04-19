/**
 * GenUiRenderer — UiCallRecord.component 이름으로 실제 컴포넌트를 라우팅.
 *
 * 흐름: 백엔드 ui tool 이 `component: "<Name>"` 과 `props` 를 SSE 로 흘려보내면
 * Zustand store 가 UiCallRecord 로 쌓고, ChatPane 이 이 컴포넌트에 call 을 넘긴다.
 * 상호작용(onAction) 대상은 `UiActionScopeProvider` 로부터 주입받는다:
 * - ChatPane: message 스코프 (ui_calls[].props 를 병합)
 * - DashboardCanvas: widget 스코프 (widget.props 를 서버에서 갱신 후 쿼리 무효화)
 */

import { useCallback } from "react";

import type { UiCallRecord } from "../../../lib/api/ui-builder";
import { useUiAction } from "../../../hooks/useUiAction";

import { DataTableCard } from "./DataTableCard";
import type { DataTableCardProps } from "./DataTableCard";
import { StockCard } from "./StockCard";
import type { StockCardProps } from "./StockCard";
import { WeatherCard } from "./WeatherCard";
import type { WeatherCardProps } from "./WeatherCard";
import { useUiActionScope } from "./UiActionScope";

interface GenUiRendererProps {
  call: UiCallRecord;
}

export function GenUiRenderer({ call }: GenUiRendererProps) {
  const { invoke, isPending } = useUiAction();
  const scope = useUiActionScope();

  const onAction = useCallback(
    (action: string, args: Record<string, unknown>) => {
      if (!scope) return;
      const target =
        scope.kind === "message"
          ? { kind: "message" as const, messageId: scope.messageId }
          : {
              kind: "widget" as const,
              widgetId: scope.widgetId,
              projectId: scope.projectId,
            };
      void invoke({
        target,
        callId: call.call_id,
        tool: call.tool,
        action,
        args,
      });
    },
    [scope, call.call_id, call.tool, invoke],
  );

  const canInteract = Boolean(scope);

  if (!call.component || !call.props) return null;
  const props = call.props as Record<string, unknown>;

  switch (call.component) {
    case "WeatherCard":
      return <WeatherCard {...(props as unknown as WeatherCardProps)} />;
    case "StockCard":
      return (
        <StockCard
          {...(props as unknown as StockCardProps)}
          onAction={canInteract ? onAction : undefined}
          actionPending={isPending}
        />
      );
    case "DataTableCard":
      return <DataTableCard {...(props as unknown as DataTableCardProps)} />;
    default:
      return (
        <div className="rounded-button border border-line-heavy bg-surface-page px-2 py-1.5 text-[11px] text-content-tertiary">
          <span className="text-content-secondary">Unknown component:</span>{" "}
          <span className="font-mono text-content-primary">
            {call.component}
          </span>
        </div>
      );
  }
}
