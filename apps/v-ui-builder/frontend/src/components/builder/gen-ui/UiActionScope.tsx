/**
 * UiActionScope — GenUiRenderer 가 어느 저장소(채팅 메시지 vs 대시보드 위젯)
 * 를 대상으로 invoke_action 을 호출할지 알려주는 React Context.
 *
 * - ChatPane 은 메시지 단위로 `{ kind: "message", messageId }` 를 제공.
 * - DashboardCanvas 는 위젯 타일별로 `{ kind: "widget", widgetId, projectId }` 를 제공.
 * - Provider 가 없으면 GenUiRenderer 는 상호작용을 비활성화한다.
 */

import { createContext, useContext } from "react";

export type UiActionScope =
  | { kind: "message"; messageId: string }
  | { kind: "widget"; widgetId: string; projectId: string };

const UiActionScopeContext = createContext<UiActionScope | null>(null);

export const UiActionScopeProvider = UiActionScopeContext.Provider;

export function useUiActionScope(): UiActionScope | null {
  return useContext(UiActionScopeContext);
}
