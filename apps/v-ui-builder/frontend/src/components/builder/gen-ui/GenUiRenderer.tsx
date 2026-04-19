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

import { AlertBanner } from "./dashboard-widgets/AlertBanner";
import type { AlertBannerProps } from "./dashboard-widgets/AlertBanner";
import { BarChart } from "./dashboard-widgets/BarChart";
import type { BarChartProps } from "./dashboard-widgets/BarChart";
import { CalloutBox } from "./dashboard-widgets/CalloutBox";
import type { CalloutBoxProps } from "./dashboard-widgets/CalloutBox";
import { DataTableManual } from "./dashboard-widgets/DataTableManual";
import type { DataTableManualProps } from "./dashboard-widgets/DataTableManual";
import { DescriptionText } from "./dashboard-widgets/DescriptionText";
import type { DescriptionTextProps } from "./dashboard-widgets/DescriptionText";
import { Divider } from "./dashboard-widgets/Divider";
import type { DividerProps } from "./dashboard-widgets/Divider";
import { DonutChart } from "./dashboard-widgets/DonutChart";
import type { DonutChartProps } from "./dashboard-widgets/DonutChart";
import { HorizontalBarChart } from "./dashboard-widgets/HorizontalBarChart";
import type { HorizontalBarChartProps } from "./dashboard-widgets/HorizontalBarChart";
import { KpiCard } from "./dashboard-widgets/KpiCard";
import type { KpiCardProps } from "./dashboard-widgets/KpiCard";
import { LineChart } from "./dashboard-widgets/LineChart";
import type { LineChartProps } from "./dashboard-widgets/LineChart";
import { PieChart } from "./dashboard-widgets/PieChart";
import type { PieChartProps } from "./dashboard-widgets/PieChart";
import { ProgressBar } from "./dashboard-widgets/ProgressBar";
import type { ProgressBarProps } from "./dashboard-widgets/ProgressBar";
import { SectionHeader } from "./dashboard-widgets/SectionHeader";
import type { SectionHeaderProps } from "./dashboard-widgets/SectionHeader";
import { StatGrid } from "./dashboard-widgets/StatGrid";
import type { StatGridProps } from "./dashboard-widgets/StatGrid";
import { TitleBlock } from "./dashboard-widgets/TitleBlock";
import type { TitleBlockProps } from "./dashboard-widgets/TitleBlock";

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
    case "TitleBlock":
      return <TitleBlock {...(props as unknown as TitleBlockProps)} />;
    case "SectionHeader":
      return <SectionHeader {...(props as unknown as SectionHeaderProps)} />;
    case "DescriptionText":
      return <DescriptionText {...(props as unknown as DescriptionTextProps)} />;
    case "Divider":
      return <Divider {...(props as unknown as DividerProps)} />;
    case "CalloutBox":
      return <CalloutBox {...(props as unknown as CalloutBoxProps)} />;
    case "AlertBanner":
      return <AlertBanner {...(props as unknown as AlertBannerProps)} />;
    case "KpiCard":
      return <KpiCard {...(props as unknown as KpiCardProps)} />;
    case "StatGrid":
      return <StatGrid {...(props as unknown as StatGridProps)} />;
    case "ProgressBar":
      return <ProgressBar {...(props as unknown as ProgressBarProps)} />;
    case "LineChart":
      return <LineChart {...(props as unknown as LineChartProps)} />;
    case "BarChart":
      return <BarChart {...(props as unknown as BarChartProps)} />;
    case "HorizontalBarChart":
      return (
        <HorizontalBarChart
          {...(props as unknown as HorizontalBarChartProps)}
        />
      );
    case "PieChart":
      return <PieChart {...(props as unknown as PieChartProps)} />;
    case "DonutChart":
      return <DonutChart {...(props as unknown as DonutChartProps)} />;
    case "DataTableManual":
      return <DataTableManual {...(props as unknown as DataTableManualProps)} />;
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
