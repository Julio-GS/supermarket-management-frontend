import { apiRequest } from "@/shared/infrastructure/api-client"
import type { LabelPrintJobsPort } from "../application/label-print-jobs-port"
import type { RemoteLabelJob } from "../domain/remote-label-job"

const BASE_PATH = "/label-print-jobs"

export class ApiLabelPrintJobsRepository implements LabelPrintJobsPort {
  async getPendingJobs(): Promise<RemoteLabelJob[]> {
    return apiRequest<RemoteLabelJob[]>(`${BASE_PATH}/pending`)
  }

  async claim(installationId: string, leaseMs: number): Promise<RemoteLabelJob | null> {
    return apiRequest<RemoteLabelJob | null>(`${BASE_PATH}/claim`, {
      method: "POST",
      body: JSON.stringify({
        installation: installationId,
        lease_ms: leaseMs,
      }),
    })
  }

  async claimBatch(installationId: string, leaseMs: number, limit: number): Promise<RemoteLabelJob[]> {
    return apiRequest<RemoteLabelJob[]>(`${BASE_PATH}/claim-batch`, {
      method: "POST",
      body: JSON.stringify({
        installation: installationId,
        lease_ms: leaseMs,
        limit,
      }),
    })
  }

  async completeJob(jobId: string, installationId: string): Promise<void> {
    await apiRequest<void>(`${BASE_PATH}/${jobId}/complete`, {
      method: "POST",
      body: JSON.stringify({ installation: installationId }),
    })
  }

  async failJob(jobId: string, installationId: string, reason: string): Promise<void> {
    await apiRequest<void>(`${BASE_PATH}/${jobId}/fail`, {
      method: "POST",
      body: JSON.stringify({ installation: installationId, reason }),
    })
  }
}
