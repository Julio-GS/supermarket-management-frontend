import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { useRemoteLabelPrintFlow, type UseRemoteLabelPrintFlowResult } from "../use-remote-label-print-flow"
import type { ClaimedLabelJobsSequence, LabelPrintJobsPort } from "../../application/label-print-jobs-port"
import type { RemoteLabelJob } from "../../domain/remote-label-job"

const INSTALL = "install-test"

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
    blocked_reason: null,
    blocked_by: null,
    blocked_at: null,
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
    claimAllForPrint: vi.fn().mockResolvedValue({ jobs: [] } as ClaimedLabelJobsSequence),
    createJob: vi.fn().mockResolvedValue(undefined),
    completeJob: vi.fn().mockResolvedValue(undefined),
    failJob: vi.fn().mockResolvedValue(undefined),
    blockJob: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

async function claimAndOpenOutcome(result: { current: UseRemoteLabelPrintFlowResult }) {
  await act(async () => {
    await result.current.handlePrintPending()
  })
  act(() => {
    result.current.openOutcome()
  })
}

describe("useRemoteLabelPrintFlow", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => INSTALL),
      setItem: vi.fn(),
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-test") })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("starts idle with zero pending count and closed dialogs", () => {
    const port = makePort()
    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    expect(result.current.pendingCount).toBe(0)
    expect(result.current.state).toEqual({ status: "idle" })
    expect(result.current.isPrintDialogOpen).toBe(false)
    expect(result.current.isConfirmOpen).toBe(false)
    expect(result.current.remoteQueue).toEqual([])
  })

  it("claims all pages in one call and opens a single print preview with every job", async () => {
    const jobs = [1, 2, 3, 4, 5].map((n) => makeClaimedJob(`job-${n}`, INSTALL))
    const port = makePort({
      claimAllForPrint: vi.fn().mockResolvedValue({ jobs } as ClaimedLabelJobsSequence),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(port.claimAllForPrint).toHaveBeenCalledTimes(1)
    expect(port.claimAllForPrint).toHaveBeenCalledWith(INSTALL, { leaseSeconds: 300 })
    expect(port.claim).not.toHaveBeenCalled()
    expect(port.claimBatch).not.toHaveBeenCalled()

    expect(result.current.state.status).toBe("printPreviewOpen")
    expect(result.current.remoteQueue).toHaveLength(5)
    expect(result.current.isPrintDialogOpen).toBe(true)
  })

  it("stays idle when no jobs are claimed", async () => {
    const port = makePort({
      claimAllForPrint: vi.fn().mockResolvedValue({ jobs: [] } as ClaimedLabelJobsSequence),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(result.current.state.status).toBe("idle")
    expect(result.current.isPrintDialogOpen).toBe(false)
    expect(result.current.remoteQueue).toHaveLength(0)
  })

  it("moves to claimFailed on claim error without opening the preview", async () => {
    const networkError = new Error("Network failure")
    const port = makePort({
      claimAllForPrint: vi.fn().mockRejectedValue(networkError),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })

    expect(result.current.state.status).toBe("claimFailed")
    expect(result.current.claimError).toBe("Network failure")
    expect(result.current.isPrintDialogOpen).toBe(false)
    expect(result.current.remoteQueue).toHaveLength(0)
  })

  it("openOutcome transitions preview -> awaitingOutcome", async () => {
    const jobs = [makeClaimedJob("job-1", INSTALL)]
    const port = makePort({
      claimAllForPrint: vi.fn().mockResolvedValue({ jobs } as ClaimedLabelJobsSequence),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })

    await act(async () => {
      await result.current.handlePrintPending()
    })
    expect(result.current.state.status).toBe("printPreviewOpen")

    act(() => {
      result.current.openOutcome()
    })

    expect(result.current.state.status).toBe("awaitingOutcome")
    expect(result.current.isConfirmOpen).toBe(true)
  })

  it("confirmSuccess completes every claimed job and never blocks or requeues", async () => {
    const jobs = [1, 2, 3].map((n) => makeClaimedJob(`job-${n}`, INSTALL))
    const port = makePort({
      claimAllForPrint: vi.fn().mockResolvedValue({ jobs } as ClaimedLabelJobsSequence),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })
    await claimAndOpenOutcome(result)

    await act(async () => {
      await result.current.confirmSuccess()
    })

    expect(port.completeJob).toHaveBeenCalledTimes(3)
    expect(port.completeJob).toHaveBeenCalledWith("job-1", INSTALL)
    expect(port.failJob).not.toHaveBeenCalled()
    expect(port.blockJob).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe("settled")
    expect(result.current.isConfirmOpen).toBe(false)
  })

  it("confirmRequeue fails/requeues every claimed job and never blocks", async () => {
    const jobs = [makeClaimedJob("job-1", INSTALL), makeClaimedJob("job-2", INSTALL)]
    const port = makePort({
      claimAllForPrint: vi.fn().mockResolvedValue({ jobs } as ClaimedLabelJobsSequence),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })
    await claimAndOpenOutcome(result)

    await act(async () => {
      await result.current.confirmRequeue("Atascamiento de papel")
    })

    expect(port.failJob).toHaveBeenCalledTimes(2)
    expect(port.failJob).toHaveBeenCalledWith("job-1", INSTALL, "Atascamiento de papel")
    expect(port.completeJob).not.toHaveBeenCalled()
    expect(port.blockJob).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe("settled")
  })

  it("confirmBlock blocks every claimed job and never fails/requeues", async () => {
    const jobs = [makeClaimedJob("job-1", INSTALL), makeClaimedJob("job-2", INSTALL)]
    const port = makePort({
      claimAllForPrint: vi.fn().mockResolvedValue({ jobs } as ClaimedLabelJobsSequence),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })
    await claimAndOpenOutcome(result)

    await act(async () => {
      await result.current.confirmBlock("Resultado incierto")
    })

    expect(port.blockJob).toHaveBeenCalledTimes(2)
    expect(port.blockJob).toHaveBeenCalledWith("job-1", INSTALL, "Resultado incierto")
    expect(port.failJob).not.toHaveBeenCalled()
    expect(port.completeJob).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe("settled")
  })

  it("preserves unresolved jobs and retries the SAME outcome on partial settlement", async () => {
    const jobs = [makeClaimedJob("job-1", INSTALL), makeClaimedJob("job-2", INSTALL)]
    const port = makePort({
      claimAllForPrint: vi.fn().mockResolvedValue({ jobs } as ClaimedLabelJobsSequence),
      completeJob: vi
        .fn()
        .mockRejectedValueOnce(new Error("Complete endpoint down"))
        .mockResolvedValue(undefined),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })
    await claimAndOpenOutcome(result)

    await act(async () => {
      await result.current.confirmSuccess()
    })

    expect(result.current.state.status).toBe("settlementPartial")
    expect(result.current.hasUnresolvedJobs).toBe(true)
    expect(port.completeJob).toHaveBeenCalledTimes(2)

    await act(async () => {
      await result.current.retryFinalization()
    })

    // One retry for the unresolved job, still complete — never fail/block
    expect(port.completeJob).toHaveBeenCalledTimes(3)
    expect(port.failJob).not.toHaveBeenCalled()
    expect(port.blockJob).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe("settled")
  })

  it("retries the block outcome without ever failing/requeuing on partial block settlement", async () => {
    const jobs = [makeClaimedJob("job-1", INSTALL), makeClaimedJob("job-2", INSTALL)]
    const port = makePort({
      claimAllForPrint: vi.fn().mockResolvedValue({ jobs } as ClaimedLabelJobsSequence),
      blockJob: vi
        .fn()
        .mockRejectedValueOnce(new Error("Block endpoint down"))
        .mockResolvedValue(undefined),
    })

    const { result } = renderHook(() => useRemoteLabelPrintFlow(port), { wrapper })
    await claimAndOpenOutcome(result)

    await act(async () => {
      await result.current.confirmBlock("Resultado incierto")
    })

    expect(result.current.state.status).toBe("settlementPartial")
    expect(port.blockJob).toHaveBeenCalledTimes(2)

    await act(async () => {
      await result.current.retryFinalization()
    })

    expect(port.blockJob).toHaveBeenCalledTimes(3)
    expect(port.failJob).not.toHaveBeenCalled()
    expect(port.completeJob).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe("settled")
  })
})
