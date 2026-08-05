"use client"

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import type { LabelPrintJobsPort } from "../application/label-print-jobs-port"
import { useLabelPrintJobs } from "../application/use-label-print-jobs"
import { getInstallationId } from "../domain/installation-id"
import { CLAIM_LEASE_MS, isValidSalePrice, MAX_CLAIM_BATCH, type RemoteLabelJob } from "../domain/remote-label-job"
import type { LabelItem } from "@/modules/productos/presentation/use-label-queue"
import type { Product } from "@/modules/productos/domain/product"

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

export interface UseRemoteLabelPrintFlowResult {
  /** Current pending (unclaimed) job count derived from the pending list. */
  pendingCount: number
  /** Whether the pending list is being fetched. */
  isPendingCountLoading: boolean

  /** Claim pending jobs in a single batch and open the print dialog. Call on button click. */
  handlePrintPending: () => Promise<void>

  /** Whether a claim is currently in progress. */
  isClaiming: boolean
  /** Error from the last claim attempt, if any. */
  claimError: string | null

  /** Adapted label items for the print dialog. */
  remoteQueue: LabelItem[]
  /** Whether the print dialog should be open. */
  isPrintDialogOpen: boolean
  /** Close the print dialog. Triggers confirmation step. */
  closePrintDialog: () => void

  /** Whether the post-print confirmation dialog is open. */
  isConfirmOpen: boolean
  /** Operator confirmed printing succeeded. Completes all claimed jobs via allSettled. */
  confirmSuccess: () => Promise<void>
  /** Operator confirmed printing failed. Fails/requeues all claimed jobs via allSettled. */
  confirmFailure: (reason?: string) => Promise<void>
  /** Cancel the remote flow entirely, failing all claimed jobs via allSettled. */
  cancelRemoteFlow: () => Promise<void>

  /** Whether any finalization (complete/fail) is in progress. */
  isFinalizing: boolean
  /** Whether there are unresolved claimed jobs that can be retried. */
  hasUnresolvedJobs: boolean
  /** Retry finalization of unresolved claimed jobs. */
  retryFinalization: () => Promise<void>
}

/**
 * Settlement outcome for a single job finalization attempt.
 * Tracked so unresolved jobs can be surfaced for retry.
 */
interface SettlementEntry {
  job: RemoteLabelJob
  status: "resolved" | "unresolved"
}

export function useRemoteLabelPrintFlow(
  port: LabelPrintJobsPort
): UseRemoteLabelPrintFlowResult {
  const {
    pendingCount,
    isPendingCountLoading,
    claimBatch,
    isClaiming,
    claimError,
    completeJob,
    failJob,
    isFinalizing,
  } = useLabelPrintJobs(port)

  const [remoteQueue, setRemoteQueue] = useState<LabelItem[]>([])
  const [claimedJobs, setClaimedJobs] = useState<RemoteLabelJob[]>([])
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [hasUnresolvedJobs, setHasUnresolvedJobs] = useState(false)
  /** Pending action to retry on unresolved jobs. */
  const pendingActionRef = useRef<"complete" | "fail" | null>(null)

  const claimInFlightRef = useRef(false)

  // ── Deduplicate and validate a batch of claimed jobs ──────────────
  const deduplicateAndValidate = useCallback(
    (jobs: RemoteLabelJob[]): { valid: RemoteLabelJob[]; duplicateIds: string[] } | "invalid-price" => {
      const seen = new Set<string>()
      const deduped: RemoteLabelJob[] = []
      const duplicateIds: string[] = []

      for (const job of jobs) {
        if (seen.has(job.id)) {
          duplicateIds.push(job.id)
        } else {
          seen.add(job.id)
          deduped.push(job)
        }
      }

      // Validate sale_price on every unique job
      const badJobs = deduped.filter((job) => !isValidSalePrice(job.sale_price))
      if (badJobs.length > 0) {
        return "invalid-price"
      }

      return { valid: deduped, duplicateIds }
    },
    []
  )

  // ── Batch claim: single request ───────────────────────────────────
  const handlePrintPending = useCallback(async () => {
    if (claimInFlightRef.current) return

    claimInFlightRef.current = true
    try {
      const installationId = getInstallationId()

      const jobs = await claimBatch(installationId, CLAIM_LEASE_MS, MAX_CLAIM_BATCH)

      if (jobs.length === 0) {
        toast.info("No hay etiquetas pendientes para imprimir.")
        return
      }

      // ── Defensive deduplication & validation ──────────────────────
      const result = deduplicateAndValidate(jobs)

      if (result === "invalid-price") {
        // Malformed response — requeue ALL unique claimed jobs via allSettled
        const uniqueById = new Map<string, RemoteLabelJob>()
        for (const j of jobs) {
          if (!uniqueById.has(j.id)) uniqueById.set(j.id, j)
        }
        const uniqueJobs = Array.from(uniqueById.values())
        const reason = "Precio inválido en etiquetas remotas — reintentá más tarde"
        const settlements = await Promise.allSettled(
          uniqueJobs.map(async (job) => {
            await port.failJob(job.id, installationId, reason)
          })
        )

        const unresolved = uniqueJobs.filter((_, i) => settlements[i].status === "rejected")
        if (unresolved.length > 0) {
          setClaimedJobs(unresolved)
          setRemoteQueue(unresolved.map(remoteJobToLabelItem))
          setHasUnresolvedJobs(true)
          toast.error(
            `${jobs.length} etiqueta(s) con precio inválido detectada(s). ` +
              `${unresolved.length} no se pudo/pudieron devolver — reintentá.`
          )
        } else {
          setRemoteQueue([])
          setClaimedJobs([])
          toast.error(
            `${jobs.length} etiqueta(s) con precio inválido — todas devueltas a la cola.`
          )
        }
        return
      }

      const { valid, duplicateIds } = result
      if (duplicateIds.length > 0) {
        toast.warning(
          `API devolvió ${duplicateIds.length} trabajo(s) duplicado(s) — se ignoraron para evitar duplicados.`
        )
      }

      const items = valid.map(remoteJobToLabelItem)
      setRemoteQueue(items)
      setClaimedJobs(valid)
      setHasUnresolvedJobs(false)
      pendingActionRef.current = null
      setIsPrintDialogOpen(true)
    } catch (err) {
      // No partial state to clean up — the batch is all-or-nothing
      const message = err instanceof Error ? err.message : "Error al reclamar etiquetas"
      toast.error(message)
      setRemoteQueue([])
      setClaimedJobs([])
    } finally {
      claimInFlightRef.current = false
    }
  }, [claimBatch, port, deduplicateAndValidate])

  const closePrintDialog = useCallback(() => {
    setIsPrintDialogOpen(false)
    setIsConfirmOpen(true)
  }, [])

  // ── allSettled settlement helper ──────────────────────────────────
  const settleAll = useCallback(
    async (
      action: "complete" | "fail",
      failReason?: string
    ): Promise<SettlementEntry[]> => {
      const installationId = getInstallationId()
      const settlements = await Promise.allSettled(
        claimedJobs.map(async (job) => {
          if (action === "complete") {
            await completeJob(job.id, installationId)
          } else {
            await failJob(job.id, installationId, failReason ?? "Operador reportó falla de impresión")
          }
        })
      )

      return claimedJobs.map((job, index) => ({
        job,
        status: settlements[index].status === "fulfilled" ? "resolved" : "unresolved",
      }))
    },
    [claimedJobs, completeJob, failJob]
  )

  const confirmSuccess = useCallback(async () => {
    setIsConfirmOpen(false)
    pendingActionRef.current = "complete"
    const results = await settleAll("complete")

    const unresolved = results.filter((r) => r.status === "unresolved")
    const resolvedCount = results.length - unresolved.length

    if (unresolved.length === 0) {
      toast.success(`${resolvedCount} etiquetas completadas.`)
      setRemoteQueue([])
      setClaimedJobs([])
      setHasUnresolvedJobs(false)
      pendingActionRef.current = null
    } else {
      toast.error(`${resolvedCount} completadas, ${unresolved.length} pendientes. Reintentá.`)
      // Retain unresolved jobs for retry
      const unresolvedJobs = unresolved.map((r) => r.job)
      setClaimedJobs(unresolvedJobs)
      setRemoteQueue(unresolvedJobs.map(remoteJobToLabelItem))
      setHasUnresolvedJobs(true)
    }
  }, [settleAll])

  const confirmFailure = useCallback(
    async (reason?: string) => {
      setIsConfirmOpen(false)
      pendingActionRef.current = "fail"
      const failReason = reason ?? "Operador reportó falla de impresión"
      const results = await settleAll("fail", failReason)

      const unresolved = results.filter((r) => r.status === "unresolved")
      const resolvedCount = results.length - unresolved.length

      if (unresolved.length === 0) {
        toast.info("Etiquetas devueltas a la cola para reintentar.")
        setRemoteQueue([])
        setClaimedJobs([])
        setHasUnresolvedJobs(false)
        pendingActionRef.current = null
      } else {
        toast.error(`${resolvedCount} devueltas, ${unresolved.length} pendientes. Reintentá.`)
        const unresolvedJobs = unresolved.map((r) => r.job)
        setClaimedJobs(unresolvedJobs)
        setRemoteQueue(unresolvedJobs.map(remoteJobToLabelItem))
        setHasUnresolvedJobs(true)
      }
    },
    [settleAll]
  )

  const cancelRemoteFlow = useCallback(async () => {
    setIsConfirmOpen(false)
    setIsPrintDialogOpen(false)
    pendingActionRef.current = "fail"
    const reason = "Operador canceló la impresión remota"
    const results = await settleAll("fail", reason)

    const unresolved = results.filter((r) => r.status === "unresolved")
    if (unresolved.length === 0) {
      setRemoteQueue([])
      setClaimedJobs([])
      setHasUnresolvedJobs(false)
      pendingActionRef.current = null
    } else {
      const unresolvedJobs = unresolved.map((r) => r.job)
      setClaimedJobs(unresolvedJobs)
      setRemoteQueue(unresolvedJobs.map(remoteJobToLabelItem))
      setHasUnresolvedJobs(true)
    }
  }, [settleAll])

  const retryFinalization = useCallback(async () => {
    if (pendingActionRef.current === "complete") {
      await confirmSuccess()
    } else if (pendingActionRef.current === "fail") {
      await confirmFailure()
    }
  }, [confirmSuccess, confirmFailure])

  return {
    pendingCount,
    isPendingCountLoading,

    handlePrintPending,
    isClaiming,
    claimError,

    remoteQueue,
    isPrintDialogOpen,
    closePrintDialog,

    isConfirmOpen,
    confirmSuccess,
    confirmFailure,
    cancelRemoteFlow,

    isFinalizing,
    hasUnresolvedJobs,
    retryFinalization,
  }
}
