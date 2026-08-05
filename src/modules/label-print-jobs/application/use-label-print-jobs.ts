import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef } from "react"
import type { LabelPrintJobsPort } from "./label-print-jobs-port"
import type { RemoteLabelJob } from "../domain/remote-label-job"
import { LABEL_PRINT_JOBS_PENDING_KEY } from "@/shared/infrastructure/query-keys"

/** Polling interval for pending job list (milliseconds). */
const POLL_INTERVAL_MS = 30_000

/** React Query hook set for the remote label print jobs API. */
export interface UseLabelPrintJobsResult {
  /** Current pending (unclaimed) job count derived from the pending list. */
  pendingCount: number
  /** Whether the pending list query is loading. */
  isPendingCountLoading: boolean
  /** Last pending list fetch error, if any. */
  pendingCountError: string | null

  /** Claim exactly one pending job for a given installation. Returns the job or null. */
  claimOne: (installationId: string, leaseMs: number) => Promise<RemoteLabelJob | null>
  /** Whether a claim mutation is in flight. */
  isClaiming: boolean
  /** Claim error message, if any. */
  claimError: string | null

  /** Claim up to `limit` distinct jobs in a single atomic batch. Returns the claimed array. */
  claimBatch: (installationId: string, leaseMs: number, limit: number) => Promise<RemoteLabelJob[]>
  /** Whether a claim-batch mutation is in flight. */
  isClaimingBatch: boolean

  /** Mark a single claimed job as completed. */
  completeJob: (jobId: string, installationId: string) => Promise<void>
  /** Mark a single claimed job as failed/requeued. */
  failJob: (jobId: string, installationId: string, reason: string) => Promise<void>
  /** Whether any completion/fail mutation is in flight. */
  isFinalizing: boolean
}

export function useLabelPrintJobs(port: LabelPrintJobsPort): UseLabelPrintJobsResult {
  const queryClient = useQueryClient()

  // ── Pending list (polling) ────────────────────────────────────────
  const {
    data: pendingData,
    isLoading: isPendingCountLoading,
    error: pendingCountQueryError,
  } = useQuery<RemoteLabelJob[]>({
    queryKey: LABEL_PRINT_JOBS_PENDING_KEY,
    queryFn: () => port.getPendingJobs(),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 15_000,
    // seed with empty array so count is always 0 during loading
    placeholderData: [],
  })

  // ── Claim mutation ────────────────────────────────────────────────
  const claimInFlightRef = useRef(false)

  const claimMutation = useMutation<
    RemoteLabelJob | null,
    Error,
    { installationId: string; leaseMs: number }
  >({
    mutationFn: ({ installationId, leaseMs }) => port.claim(installationId, leaseMs),
    onSuccess: () => {
      // Invalidate the pending list so it refreshes after claiming
      void queryClient.invalidateQueries({ queryKey: LABEL_PRINT_JOBS_PENDING_KEY })
    },
  })

  const claimOne = useCallback(
    async (installationId: string, leaseMs: number) => {
      if (claimInFlightRef.current) {
        throw new Error("Ya hay una solicitud de impresión en curso.")
      }
      claimInFlightRef.current = true
      try {
        return await claimMutation.mutateAsync({ installationId, leaseMs })
      } finally {
        claimInFlightRef.current = false
      }
    },
    [claimMutation]
  )

  // ── Claim-batch mutation ──────────────────────────────────────────
  const claimBatchMutation = useMutation<
    RemoteLabelJob[],
    Error,
    { installationId: string; leaseMs: number; limit: number }
  >({
    mutationFn: ({ installationId, leaseMs, limit }) =>
      port.claimBatch(installationId, leaseMs, limit),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LABEL_PRINT_JOBS_PENDING_KEY })
    },
  })

  const claimBatch = useCallback(
    async (installationId: string, leaseMs: number, limit: number) => {
      if (claimInFlightRef.current) {
        throw new Error("Ya hay una solicitud de impresión en curso.")
      }
      claimInFlightRef.current = true
      try {
        return await claimBatchMutation.mutateAsync({ installationId, leaseMs, limit })
      } finally {
        claimInFlightRef.current = false
      }
    },
    [claimBatchMutation]
  )

  // ── Complete / Fail mutations ─────────────────────────────────────
  const completeMutation = useMutation<void, Error, { jobId: string; installationId: string }>({
    mutationFn: ({ jobId, installationId }) => port.completeJob(jobId, installationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LABEL_PRINT_JOBS_PENDING_KEY })
    },
  })

  const failMutation = useMutation<
    void,
    Error,
    { jobId: string; installationId: string; reason: string }
  >({
    mutationFn: ({ jobId, installationId, reason }) =>
      port.failJob(jobId, installationId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LABEL_PRINT_JOBS_PENDING_KEY })
    },
  })

  const completeJob = useCallback(
    async (jobId: string, installationId: string) => {
      await completeMutation.mutateAsync({ jobId, installationId })
    },
    [completeMutation]
  )

  const failJob = useCallback(
    async (jobId: string, installationId: string, reason: string) => {
      await failMutation.mutateAsync({ jobId, installationId, reason })
    },
    [failMutation]
  )

  return {
    pendingCount: pendingData?.length ?? 0,
    isPendingCountLoading,
    pendingCountError: pendingCountQueryError
      ? pendingCountQueryError instanceof Error
        ? pendingCountQueryError.message
        : "Error al obtener trabajos pendientes"
      : null,

    claimOne,
    isClaiming: claimMutation.isPending,
    claimError: claimMutation.error ? claimMutation.error.message : null,

    claimBatch,
    isClaimingBatch: claimBatchMutation.isPending,

    completeJob,
    failJob,
    isFinalizing: completeMutation.isPending || failMutation.isPending,
  }
}
