import { apiClient, get } from "./client";
import type {
  SchedulerJob,
  SchedulerJobListResponse,
  SchedulerRescheduleInput,
} from "./itsmTypes";

export async function listSchedulerJobs(): Promise<SchedulerJobListResponse> {
  return get<SchedulerJobListResponse>(`/api/scheduler/jobs`);
}

export async function rescheduleJob(
  jobId: string,
  data: SchedulerRescheduleInput,
): Promise<SchedulerJob> {
  const response = await apiClient.patch<SchedulerJob>(
    `/api/scheduler/jobs/${jobId}`,
    data,
  );
  return response.data;
}
