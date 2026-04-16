/**
 * useRouteHealth - Route Health Check 훅
 *
 * TanStack Query 기반 route health 조회 및 테스트 메시지 전송
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  routesApi,
  type RouteHealthResponse,
  type AllRoutesHealthResponse,
  type RouteTestResponse,
} from "@/lib/api/routes";

const HEALTH_QUERY_KEY = "routes-health";

/**
 * 전체 Route Health 조회
 */
export function useAllRoutesHealth(enabled = true) {
  return useQuery<AllRoutesHealthResponse>({
    queryKey: [HEALTH_QUERY_KEY, "all"],
    queryFn: () => routesApi.getAllRoutesHealth(),
    enabled,
    refetchInterval: 5 * 60 * 1000, // 5분마다 자동 갱신
    staleTime: 60 * 1000, // 1분 동안 stale 아님
  });
}

/**
 * 개별 Route Health 조회
 */
export function useRouteHealth(
  sourcePlatform: string,
  sourceChannel: string,
  targetPlatform: string,
  targetChannel: string,
  enabled = true,
) {
  return useQuery<RouteHealthResponse>({
    queryKey: [
      HEALTH_QUERY_KEY,
      sourcePlatform,
      sourceChannel,
      targetPlatform,
      targetChannel,
    ],
    queryFn: () =>
      routesApi.getRouteHealth(
        sourcePlatform,
        sourceChannel,
        targetPlatform,
        targetChannel,
      ),
    enabled,
    staleTime: 30 * 1000,
  });
}

/**
 * Route 테스트 메시지 전송
 */
export function useTestRoute() {
  const queryClient = useQueryClient();

  return useMutation<
    RouteTestResponse,
    Error,
    {
      sourcePlatform: string;
      sourceChannel: string;
      targetPlatform: string;
      targetChannel: string;
      direction?: string;
    }
  >({
    mutationFn: ({
      sourcePlatform,
      sourceChannel,
      targetPlatform,
      targetChannel,
      direction = "forward",
    }) =>
      routesApi.testRoute(
        sourcePlatform,
        sourceChannel,
        targetPlatform,
        targetChannel,
        direction,
      ),
    onSuccess: () => {
      // 테스트 후 health 캐시 무효화
      queryClient.invalidateQueries({ queryKey: [HEALTH_QUERY_KEY] });
    },
  });
}

/**
 * route_id에서 health 결과를 찾는 헬퍼
 */
export function findHealthForRoute(
  allHealth: AllRoutesHealthResponse | undefined,
  sourcePlatform: string,
  sourceChannel: string,
  targetPlatform: string,
  targetChannel: string,
): RouteHealthResponse | undefined {
  if (!allHealth) return undefined;
  const routeId = `${sourcePlatform}:${sourceChannel}→${targetPlatform}:${targetChannel}`;
  return allHealth.results.find((r) => r.route_id === routeId);
}
