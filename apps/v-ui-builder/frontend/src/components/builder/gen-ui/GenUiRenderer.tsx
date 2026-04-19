/**
 * GenUiRenderer — UiCallRecord.component 이름으로 실제 컴포넌트를 라우팅.
 *
 * 흐름: 백엔드 ui tool 이 `component: "<Name>"` 과 `props` 를 SSE 로 흘려보내면
 * Zustand store 가 UiCallRecord 로 쌓고, ChatPane 이 이 컴포넌트에 call 을 넘긴다.
 * status 가 ok 가 아닐 때는 호출자(UiCallCard)가 상태 UI 를 책임지므로
 * 여기서는 props 매핑/폴백만 담당한다.
 */

import type { UiCallRecord } from "../../../lib/api/ui-builder";

import { DataTableCard } from "./DataTableCard";
import type { DataTableCardProps } from "./DataTableCard";
import { StockCard } from "./StockCard";
import type { StockCardProps } from "./StockCard";
import { WeatherCard } from "./WeatherCard";
import type { WeatherCardProps } from "./WeatherCard";

interface GenUiRendererProps {
  call: UiCallRecord;
}

export function GenUiRenderer({ call }: GenUiRendererProps) {
  if (!call.component || !call.props) return null;
  const props = call.props as Record<string, unknown>;

  switch (call.component) {
    case "WeatherCard":
      return <WeatherCard {...(props as unknown as WeatherCardProps)} />;
    case "StockCard":
      return <StockCard {...(props as unknown as StockCardProps)} />;
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
