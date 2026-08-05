import type { RemoteLabelJob } from "../domain/remote-label-job"

export interface LabelPrintJobsPort {
  /** Fetch the full list of pending (unclaimed) label print jobs. */
  getPendingJobs(): Promise<RemoteLabelJob[]>

  /**
   * Claim exactly one pending job for the given installation with the specified lease.
   * Returns the claimed job or null when no pending jobs remain.
   */
  claim(installationId: string, leaseMs: number): Promise<RemoteLabelJob | null>

  /**
   * Atomically claim up to `limit` distinct claimable jobs in a single batch.
   * Returns an array of claimed jobs (empty when none available).
   */
  claimBatch(installationId: string, leaseMs: number, limit: number): Promise<RemoteLabelJob[]>

  /** Mark a claimed job as successfully completed. Requires the installation id that owns the lease. */
  completeJob(jobId: string, installationId: string): Promise<void>

  /** Mark a claimed job as failed so it becomes available for re-claim. Requires the installation id that owns the lease. */
  failJob(jobId: string, installationId: string, reason: string): Promise<void>
}
