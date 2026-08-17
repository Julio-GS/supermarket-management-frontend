"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import type { LabelPrintJobsPort } from "../application/label-print-jobs-port"
import { useLabelPrintJobs } from "../application/use-label-print-jobs"
import { getInstallationId } from "../domain/installation-id"
import {
  CLAIM_LEASE_SECONDS,
  isValidSalePrice,
  type RemoteLabelJob,
} from "../domain/remote-label-job"
import type { LabelItem, Product } from "@/modules/productos"

/** Adapt a remote label job to a Product shape compatible with ProductLabel/ProductLabelsPrintDialog. */
function remoteJobToProduct(job: RemoteLabelJob): Product {
  const price = isValidSalePrice(job.sale_price)
    ? Number.parseFloat(job.sale_price)
    : 0
  return {
    id: job.product_id,
    name: job.product_name,
    sku: job.sku,
    price,
    cost: 0,
    manejaStock: false,
    stock: null,
    stockMinimum: 20,
    unit: "u",
    supplier: "Sin asignar",
    promotions: null,
    storePromotions: null,
  }
}

function remoteJobToLabelItem(job: RemoteLabelJob): LabelItem {
  return {
    product: remoteJobToProduct(job),
    changedAt: new Date(),
    queueKey: job.id,
  }
}

export type PrintOutcome = "complete" | "requeue" | "block"

export type RemotePrintFlowState =
  | { status: "idle" }
  | { status: "claiming" }
  | { status: "claimFailed"; error: string }
  | { status: "printPreviewOpen"; jobs: RemoteLabelJob[] }
  | { status: "awaitingOutcome"; jobs: RemoteLabelJob[] }
  | { status: "settling"; outcome: PrintOutcome; jobs: RemoteLabelJob[] }
  | { status: "settlementPartial"; outcome: PrintOutcome; jobs: RemoteLabelJob[]; message: string }
  | { status: "settled"; outcome: PrintOutcome; message: string }

export interface UseRemoteLabelPrintFlowResult {
  /** Current pending (unclaimed) job count derived from the pending list. */
  pendingCount: number
  /** Whether the pending list is being fetched. */
  isPendingCountLoading: boolean

  /** Discriminated union describing the remote print flow. */
  state: RemotePrintFlowState

  /** Claim all pending jobs and open the print dialog. Call on button click. */
  handlePrintPending: () => Promise<void>

  /** Whether a claim is currently in progress. */
  isClaiming: boolean
  /** Error from the last claim attempt, if any. */
  claimError: string | null

  /** Adapted label items for the print dialog. */
  remoteQueue: LabelItem[]
  /** Whether the print dialog should be open. */
  isPrintDialogOpen: boolean
  /** Whether the post-print outcome dialog should be open. */
  isConfirmOpen: boolean
  /** Whether any finalization (complete/fail/block) is in progress. */
  isFinalizing: boolean
  /** Whether there are unresolved claimed jobs that can be retried. */
  hasUnresolvedJobs: boolean
  /** Partial settlement message (only present in the settlementPartial state). */
  settlementMessage: string | null

  /** Transition from the print preview to the mandatory outcome dialog. */
  openOutcome: () => void

  /** Operator confirmed printing succeeded. Completes all claimed jobs. */
  confirmSuccess: () => Promise<void>
  /** Operator confirmed printing did not happen. Requeues all claimed jobs. */
  confirmRequeue: (reason?: string) => Promise<void>
  /** Operator is uncertain about the outcome. Blocks all claimed jobs for review. */
  confirmBlock: (reason?: string) => Promise<void>
  /** Retry finalization of unresolved claimed jobs with the same selected outcome. */
  retryFinalization: () => Promise<void>
  /** Manually refresh the pending label jobs list. */
  refreshPendingJobs: () => Promise<void>
}

const REQUEUE_REASON = "Operador reportó que la impresión no salió"
const BLOCK_REASON = "Resultado de impresión incierto — requiere revisión"

/** Stable empty array so the `jobs` conditional below never creates a fresh dependency each render. */
const EMPTY_REMOTE_JOBS: RemoteLabelJob[] = []

export function useRemoteLabelPrintFlow(
  port: LabelPrintJobsPort
): UseRemoteLabelPrintFlowResult {
  const {
    pendingCount,
    isPendingCountLoading,
    refreshPendingJobs,
    claimAllForPrint,
    completeJob,
    failJob,
    blockJob,
  } = useLabelPrintJobs(port)

  const [state, setState] = useState<RemotePrintFlowState>({ status: "idle" })
  const jobsRef = useRef<RemoteLabelJob[]>([])
  const lastOutcomeRef = useRef<PrintOutcome | null>(null)
  const lastReasonRef = useRef<string | undefined>(undefined)
  const claimInFlightRef = useRef(false)

  const handlePrintPending = useCallback(async () => {
    if (claimInFlightRef.current) return
    claimInFlightRef.current = true
    setState({ status: "claiming" })

    try {
      const installationId = getInstallationId()
      const { jobs } = await claimAllForPrint(installationId, {
        leaseSeconds: CLAIM_LEASE_SECONDS,
      })

      if (jobs.length === 0) {
        toast.info("No hay etiquetas pendientes para imprimir.")
        jobsRef.current = []
        setState({ status: "idle" })
        return
      }

      jobsRef.current = jobs
      setState({ status: "printPreviewOpen", jobs })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al reclamar etiquetas"
      toast.error(message)
      jobsRef.current = []
      setState({ status: "claimFailed", error: message })
    } finally {
      claimInFlightRef.current = false
    }
  }, [claimAllForPrint])

  const openOutcome = useCallback(() => {
    setState((current) =>
      current.status === "printPreviewOpen"
        ? { status: "awaitingOutcome", jobs: current.jobs }
        : current
    )
  }, [])

  const settle = useCallback(
    async (outcome: PrintOutcome, reason?: string) => {
      const installationId = getInstallationId()
      const jobs = jobsRef.current
      lastOutcomeRef.current = outcome
      lastReasonRef.current = reason
      setState({ status: "settling", outcome, jobs })

      const settlements = await Promise.allSettled(
        jobs.map(async (job) => {
          if (outcome === "complete") {
            await completeJob(job.id, installationId)
          } else if (outcome === "requeue") {
            await failJob(job.id, installationId, reason ?? REQUEUE_REASON)
          } else {
            await blockJob(job.id, installationId, reason ?? BLOCK_REASON)
          }
        })
      )

      const unresolved = jobs.filter((_, index) => settlements[index].status === "rejected")
      const resolvedCount = jobs.length - unresolved.length

      if (unresolved.length === 0) {
        jobsRef.current = []
        const message =
          outcome === "complete"
            ? `${resolvedCount} etiquetas completadas.`
            : outcome === "requeue"
              ? `${resolvedCount} etiquetas devueltas a la cola para reintentar.`
              : `${resolvedCount} etiquetas bloqueadas para revisión.`
        if (outcome === "complete") toast.success(message)
        else if (outcome === "requeue") toast.info(message)
        else toast.warning(message)
        setState({ status: "settled", outcome, message })
      } else {
        const message = `${resolvedCount} resueltas, ${unresolved.length} pendientes. Reintentá.`
        toast.error(message)
        jobsRef.current = unresolved
        setState({ status: "settlementPartial", outcome, jobs: unresolved, message })
      }
    },
    [completeJob, failJob, blockJob]
  )

  const confirmSuccess = useCallback(async () => {
    await settle("complete")
  }, [settle])

  const confirmRequeue = useCallback(
    async (reason?: string) => {
      await settle("requeue", reason)
    },
    [settle]
  )

  const confirmBlock = useCallback(
    async (reason?: string) => {
      await settle("block", reason)
    },
    [settle]
  )

  const retryFinalization = useCallback(async () => {
    const outcome = lastOutcomeRef.current
    if (outcome === null) return
    await settle(outcome, lastReasonRef.current)
  }, [settle])

  const jobs =
    state.status === "printPreviewOpen" ||
    state.status === "awaitingOutcome" ||
    state.status === "settling" ||
    state.status === "settlementPartial"
      ? state.jobs
      : EMPTY_REMOTE_JOBS

  const remoteQueue = useMemo(() => jobs.map(remoteJobToLabelItem), [jobs])

  return {
    pendingCount,
    isPendingCountLoading,

    state,

    handlePrintPending,
    isClaiming: state.status === "claiming",
    claimError: state.status === "claimFailed" ? state.error : null,

    remoteQueue,
    isPrintDialogOpen: state.status === "printPreviewOpen",
    isConfirmOpen:
      state.status === "awaitingOutcome" ||
      state.status === "settling" ||
      state.status === "settlementPartial",
    isFinalizing: state.status === "settling",
    hasUnresolvedJobs: state.status === "settlementPartial",
    settlementMessage: state.status === "settlementPartial" ? state.message : null,

    openOutcome,
    confirmSuccess,
    confirmRequeue,
    confirmBlock,
    retryFinalization,
    refreshPendingJobs,
  }
}
