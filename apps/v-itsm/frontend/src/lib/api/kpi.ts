/**
 * v-itsm KPI Dashboard API 클라이언트.
 */

import { get } from "./client";
import type { KpiSummary } from "./itsmTypes";

export async function getKpiSummary(): Promise<KpiSummary> {
  return get<KpiSummary>(`/api/kpi/summary`);
}
