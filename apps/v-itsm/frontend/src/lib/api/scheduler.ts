import { apiClient, get } from "./client";
import type {
  SchedulerJob,
  SchedulerJobListResponse,
  SchedulerRescheduleInput,
} from "./itsmTypes";

export async function listSchedulerJobs(): Promise<SchedulerJobListResponse> {
  return get<SchedulerJobListResponse>(`/api/admin/scheduler/jobs`);
}

export async function rescheduleJob(
  jobId: string,
  data: SchedulerRescheduleInput,
): Promise<SchedulerJob> {
  const response = await apiClient.patch<SchedulerJob>(
    `/api/admin/scheduler/jobs/${jobId}`,
    data,
  );
  return response.data;
}
