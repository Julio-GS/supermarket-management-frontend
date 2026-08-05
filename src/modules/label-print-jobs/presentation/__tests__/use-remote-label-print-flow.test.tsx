import { describe, expect, it, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { useRemoteLabelPrintFlow } from "../use-remote-label-print-flow"
import type { LabelPrintJobsPort } from "../../application/label-print-jobs-port"
import type { RemoteLabelJob } from "../../domain/remote-label-job"

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
}

function makeJob(overrides: Partial<RemoteLabelJob> = {}): RemoteLabelJob {
  return {
    id: "job-1",
    product_id: "P001",
    sku: "SKU-001",
    product_name: "Product A",
    sale_price: "150.00",
    claimed_by: null,
    lease_expires_at: null,
    status: "pending",
    ...overrides,
  }
}

function makeClaimedJob(id: string, installation: string): RemoteLabelJob {
  return makeJob({
    id,
    product_id: `P${id.split("-")[1]}`,
    product_name: `Product ${id}`,
    sale_price: "100.00",
    claimed_by: installation,
    lease_expires_at: "2026-01-15T12:00:00Z",
    status: "claimed",
  })
}

function makePort(overrides: Partial<LabelPrintJobsPort> = {}): LabelPrintJobsPort {
  return {
    getPendingJobs: vi.fn().mockResolvedValue([] as RemoteLabelJob[]),
    claim: vi.fn().mockResolvedValue(null as RemoteLabelJob | null),
    claimBatch: vi.fn().mockResolvedValue([] as RemoteLabelJob[]),
    completeJob: vi.fn().mockResolvedValue(undefined),
    failJob: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("useRemoteLabelPrintFlow", () => {
  it("starts with zero pending count and closed dialogs", () => {
    const port = makePort()
    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    expect(result.current.pendingCount).toBe(0)
    expect(result.current.isPrintDialogOpen).toBe(false)
    expect(result.current.isConfirmOpen).toBe(false)
    expect(result.current.remoteQueue).toEqual([])
  })

  // ── Batch claim: single request ───────────────────────────────────
  it("claims a batch in one request and opens the print dialog with 5 different products", async () => {
    const INSTALL = "label-printer-batch"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-batch") })

    const jobs = [1, 2, 3, 4, 5].map((n) => makeClaimedJob(`job-${n}`, INSTALL))
    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue(jobs),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    // One single request
    expect(port.claimBatch).toHaveBeenCalledTimes(1)
    expect(port.claimBatch).toHaveBeenCalledWith(INSTALL, 300_000, 45)
    // No per-job claim calls
    expect(port.claim).not.toHaveBeenCalled()

    expect(result.current.remoteQueue).toHaveLength(5)
    expect(result.current.isPrintDialogOpen).toBe(true)

    // Each label has a different product
    const productIds = result.current.remoteQueue.map((item) => item.product.id)
    expect(new Set(productIds).size).toBe(5)

    vi.unstubAllGlobals()
  })

  it("uses 5-minute lease (300000 ms)", async () => {
    const INSTALL = "install-lease-test"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-lease") })

    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue([]),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(port.claimBatch).toHaveBeenCalledWith(INSTALL, 300_000, 45)

    vi.unstubAllGlobals()
  })

  it("does nothing when batch returns empty array", async () => {
    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue([]),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(result.current.isPrintDialogOpen).toBe(false)
    expect(result.current.remoteQueue).toHaveLength(0)
    expect(port.claimBatch).toHaveBeenCalledTimes(1)
  })

  it("passes the 45 cap as limit", async () => {
    const INSTALL = "install-cap-test"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-cap") })

    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue([makeClaimedJob("job-1", INSTALL)]),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(port.claimBatch).toHaveBeenCalledWith(expect.any(String), expect.any(Number), 45)

    vi.unstubAllGlobals()
  })

  // ── Deduplication ─────────────────────────────────────────────────
  it("deduplicates duplicate job IDs in the API response and produces unique labels", async () => {
    const INSTALL = "install-dup"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-dup") })

    const jobs = [
      makeClaimedJob("job-1", INSTALL),
      makeClaimedJob("job-2", INSTALL),
      makeClaimedJob("job-1", INSTALL), // duplicate ID
      makeClaimedJob("job-3", INSTALL),
    ]
    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue(jobs),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(port.claimBatch).toHaveBeenCalledTimes(1)
    // Only 3 unique labels (deduplicated job-1)
    expect(result.current.remoteQueue).toHaveLength(3)
    const queueKeys = result.current.remoteQueue.map((item) => item.queueKey)
    expect(new Set(queueKeys).size).toBe(3)
    expect(result.current.isPrintDialogOpen).toBe(true)

    vi.unstubAllGlobals()
  })

  // ── Validation: malformed price ───────────────────────────────────
  it("rejects malformed sale_price and requeues all unique jobs via allSettled", async () => {
    const INSTALL = "install-malformed"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-mal") })

    const badJob = makeClaimedJob("job-bad", INSTALL)
    badJob.sale_price = "not-a-number"

    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue([badJob]),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    // Dialog must NOT open
    expect(result.current.isPrintDialogOpen).toBe(false)
    // All claimed jobs must be requeued
    expect(port.failJob).toHaveBeenCalledTimes(1)
    expect(port.failJob).toHaveBeenCalledWith(
      "job-bad",
      INSTALL,
      "Precio inválido en etiquetas remotas — reintentá más tarde"
    )
    expect(result.current.remoteQueue).toHaveLength(0)

    vi.unstubAllGlobals()
  })

  it("requeues ALL unique jobs when ANY has malformed price in a mixed batch (allSettled)", async () => {
    const INSTALL = "install-mixed"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-mixed") })

    const valid1 = makeClaimedJob("job-valid1", INSTALL)
    valid1.sale_price = "200.00"
    const bad = makeClaimedJob("job-bad", INSTALL)
    bad.sale_price = "Infinity"
    const valid2 = makeClaimedJob("job-valid2", INSTALL)
    valid2.sale_price = "300.00"

    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue([valid1, bad, valid2]),
      failJob: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Fail endpoint down"))
        .mockResolvedValueOnce(undefined),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(result.current.isPrintDialogOpen).toBe(false)
    expect(port.failJob).toHaveBeenCalledTimes(3)
    // One failJob rejection → 1 unresolved job retained
    expect(result.current.remoteQueue).toHaveLength(1)
    expect(result.current.hasUnresolvedJobs).toBe(true)

    vi.unstubAllGlobals()
  })

  // ── Same product, distinct jobs ───────────────────────────────────
  it("two distinct jobs sharing product_id produce two queue items with unique keys", async () => {
    const INSTALL = "install-two-same-prod"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-two") })

    const jobA = makeClaimedJob("job-alpha", INSTALL)
    jobA.product_id = "P-shared"
    const jobB = makeClaimedJob("job-beta", INSTALL)
    jobB.product_id = "P-shared"

    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue([jobA, jobB]),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(result.current.remoteQueue).toHaveLength(2)
    expect(result.current.remoteQueue[0].queueKey).toBe("job-alpha")
    expect(result.current.remoteQueue[1].queueKey).toBe("job-beta")
    expect(result.current.remoteQueue[0].product.id).toBe("P-shared")
    expect(result.current.remoteQueue[1].product.id).toBe("P-shared")
    expect(result.current.remoteQueue[0].queueKey).not.toBe(
      result.current.remoteQueue[1].queueKey
    )

    vi.unstubAllGlobals()
  })

  // ── Batch network error (no partial state) ────────────────────────
  it("shows error on network failure without partial-state cleanup", async () => {
    const INSTALL = "install-net-error"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-net") })

    const networkError = new Error("Network failure")
    const port = makePort({
      claimBatch: vi.fn().mockRejectedValue(networkError),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(result.current.isPrintDialogOpen).toBe(false)
    expect(result.current.remoteQueue).toHaveLength(0)
    // No failJob calls needed — the batch never returned any data
    expect(port.failJob).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  // ── No per-job claim calls ────────────────────────────────────────
  it("never calls the single claim endpoint", async () => {
    const INSTALL = "install-no-single"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-no-single") })

    const jobs = [makeClaimedJob("job-1", INSTALL)]
    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue(jobs),
      claim: vi.fn().mockRejectedValue(new Error("should not be called")),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(port.claimBatch).toHaveBeenCalledTimes(1)
    expect(port.claim).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  // ── Finalization: allSettled + retry retention ────────────────────
  it("completes all claimed jobs via allSettled on confirmed success", async () => {
    const INSTALL = "install-finalize"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-final") })

    const jobs = [1, 2, 3].map((n) => makeClaimedJob(`job-${n}`, INSTALL))
    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue(jobs),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(result.current.isPrintDialogOpen).toBe(true)

    act(() => {
      result.current.closePrintDialog()
    })

    await act(async () => {
      await result.current.confirmSuccess()
    })

    expect(port.completeJob).toHaveBeenCalledTimes(3)
    expect(port.completeJob).toHaveBeenCalledWith("job-1", INSTALL)
    expect(port.completeJob).toHaveBeenCalledWith("job-2", INSTALL)
    expect(port.completeJob).toHaveBeenCalledWith("job-3", INSTALL)
    expect(result.current.isConfirmOpen).toBe(false)

    vi.unstubAllGlobals()
  })

  it("retains unresolved jobs for retry when some completions fail (allSettled)", async () => {
    const INSTALL = "install-retry"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-retry") })

    const jobs = [makeClaimedJob("job-1", INSTALL), makeClaimedJob("job-2", INSTALL)]
    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue(jobs),
      completeJob: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Complete endpoint down")),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    act(() => {
      result.current.closePrintDialog()
    })

    await act(async () => {
      await result.current.confirmSuccess()
    })

    expect(port.completeJob).toHaveBeenCalledTimes(2)
    expect(result.current.isConfirmOpen).toBe(false)
    expect(result.current.remoteQueue).not.toHaveLength(0)
    expect(result.current.remoteQueue.length).toBeGreaterThan(0)

    vi.unstubAllGlobals()
  })

  it("fails all claimed jobs via allSettled on confirmed failure", async () => {
    const INSTALL = "install-fail-final"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-failfinal") })

    const jobs = [makeClaimedJob("job-1", INSTALL), makeClaimedJob("job-2", INSTALL)]
    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue(jobs),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    act(() => {
      result.current.closePrintDialog()
    })

    await act(async () => {
      await result.current.confirmFailure("Atascamiento de papel")
    })

    expect(port.failJob).toHaveBeenCalledTimes(2)
    expect(port.failJob).toHaveBeenCalledWith("job-1", INSTALL, "Atascamiento de papel")
    expect(port.failJob).toHaveBeenCalledWith("job-2", INSTALL, "Atascamiento de papel")
    expect(result.current.isConfirmOpen).toBe(false)

    vi.unstubAllGlobals()
  })

  // ── Remote cancel ─────────────────────────────────────────────────
  it("cancels remote flow by failing all claimed jobs via allSettled", async () => {
    const INSTALL = "install-cancel"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-cancel") })

    const jobs = [makeClaimedJob("job-1", INSTALL), makeClaimedJob("job-2", INSTALL)]
    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue(jobs),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    await act(async () => {
      await result.current.cancelRemoteFlow()
    })

    expect(port.failJob).toHaveBeenCalledTimes(2)
    expect(result.current.isPrintDialogOpen).toBe(false)
    expect(result.current.isConfirmOpen).toBe(false)

    vi.unstubAllGlobals()
  })

  // ── Decimal price mapping ─────────────────────────────────────────
  it("maps sale_price string to number for label rendering", async () => {
    const INSTALL = "install-decimal"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-decimal") })

    const job = makeClaimedJob("job-1", INSTALL)
    job.sale_price = "100.00"
    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue([job]),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(result.current.remoteQueue[0].product.price).toBe(100)
    expect(typeof result.current.remoteQueue[0].product.price).toBe("number")

    vi.unstubAllGlobals()
  })

  // ── 45 unique jobs ────────────────────────────────────────────────
  it("45 unique jobs all appear in the queue", async () => {
    const INSTALL = "install-45"
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-45") })

    const jobs = Array.from({ length: 45 }, (_, i) => makeClaimedJob(`job-${i + 1}`, INSTALL))
    const port = makePort({
      claimBatch: vi.fn().mockResolvedValue(jobs),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(port.claimBatch).toHaveBeenCalledTimes(1)
    expect(result.current.remoteQueue).toHaveLength(45)
    const keys = result.current.remoteQueue.map((item) => item.queueKey)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(45)

    vi.unstubAllGlobals()
  })
})
