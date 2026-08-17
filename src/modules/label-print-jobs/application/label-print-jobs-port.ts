import type { RemoteLabelJob } from "../domain/remote-label-job"

export interface CreateLabelJobInput {
  product_id: string
  sku: string
  product_name: string
  sale_price: string
  /** Optional client-generated idempotency key for manual/loose label creation. */
  idempotency_key?: string
}

export interface ClaimAllForPrintOptions {
  /** Lease duration in seconds for the initial claim page. Backend range is 1..300. */
  leaseSeconds: number
  /** Page size per continuation request. Backend max is 45; defaults to 45. */
  limit?: number
}

export interface ClaimedLabelJobsSequence {
  /** All claimed jobs in claim order, deduplicated and price-validated. */
  jobs: RemoteLabelJob[]
}

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

  /**
   * Sequentially claim ALL pending jobs via `claim-batch/continue` until `has_more`
   * is false. Throws on 409, malformed pages, duplicate ids, or invalid jobs rather
   * than returning a truncated set.
   */
  claimAllForPrint(
    installationId: string,
    options: ClaimAllForPrintOptions
  ): Promise<ClaimedLabelJobsSequence>

  /** Persist a manual/loose label request. Returns the created remote job after backend success. */
  createJob(input: CreateLabelJobInput): Promise<RemoteLabelJob>

  /** Mark a claimed job as successfully completed. Requires the installation id that owns the lease. */
  completeJob(jobId: string, installationId: string): Promise<void>

  /** Mark a claimed job as failed so it becomes available for re-claim. Requires the installation id that owns the lease. */
  failJob(jobId: string, installationId: string, reason: string): Promise<void>

  /** Mark a claimed job blocked-for-review for an uncertain print outcome. Returns the blocked job. */
  blockJob(jobId: string, installationId: string, reason: string): Promise<RemoteLabelJob>
}
