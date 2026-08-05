import { describe, expect, it, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { useLabelPrintJobs } from "../use-label-print-jobs"
import type { LabelPrintJobsPort } from "../label-print-jobs-port"
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

describe("useLabelPrintJobs", () => {
  describe("pending jobs", () => {
    it("fetches the pending job list and derives count", async () => {
      const jobs = [
        makeJob({ id: "j1", product_name: "A" }),
        makeJob({ id: "j2", product_name: "B" }),
        makeJob({ id: "j3", product_name: "C" }),
      ]
      const port = makePort({
        getPendingJobs: vi.fn().mockResolvedValue(jobs),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      // Initially uses placeholderData (empty array => count 0)
      expect(result.current.pendingCount).toBe(0)

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(3)
      })

      expect(port.getPendingJobs).toHaveBeenCalledTimes(1)
    })

    it("shows zero while initial fetch is in flight (placeholder)", () => {
      const port = makePort({
        getPendingJobs: vi.fn().mockImplementation(
          () => new Promise(() => {
            // never resolves — stays loading
          })
        ),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      // placeholderData supplies empty array immediately, so count is 0
      expect(result.current.pendingCount).toBe(0)
    })

    it("returns zero when pending list is empty", async () => {
      const port = makePort({
        getPendingJobs: vi.fn().mockResolvedValue([]),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(0)
      })
    })
  })

  describe("claim", () => {
    it("claims one job and returns it", async () => {
      const job = makeJob({ id: "job-42", product_name: "Claimed product", status: "claimed", claimed_by: "inst-1" })
      const port = makePort({
        claim: vi.fn().mockResolvedValue(job),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      let claimResult: RemoteLabelJob | null | undefined
      await act(async () => {
        claimResult = await result.current.claimOne("inst-1", 300_000)
      })

      expect(claimResult).not.toBeNull()
      expect(claimResult!.id).toBe("job-42")
      expect(claimResult!.claimed_by).toBe("inst-1")
      expect(port.claim).toHaveBeenCalledWith("inst-1", 300_000)
    })

    it("returns null when no jobs available", async () => {
      const port = makePort({
        claim: vi.fn().mockResolvedValue(null),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      let claimResult: RemoteLabelJob | null | undefined
      await act(async () => {
        claimResult = await result.current.claimOne("inst-1", 300_000)
      })

      expect(claimResult).toBeNull()
    })

    it("prevents concurrent claim calls", async () => {
      let resolveClaim: (value: RemoteLabelJob | null) => void = () => {}
      const port = makePort({
        claim: vi.fn().mockImplementation(
          () =>
            new Promise<RemoteLabelJob | null>((resolve) => {
              resolveClaim = resolve
            })
        ),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      let firstPromise: Promise<RemoteLabelJob | null>
      act(() => {
        firstPromise = result.current.claimOne("inst-1", 300_000)
      })

      await act(async () => {
        await expect(result.current.claimOne("inst-1", 300_000)).rejects.toThrow(
          "Ya hay una solicitud de impresión en curso."
        )
      })

      // Cleanup
      act(() => {
        resolveClaim(null)
      })
      await act(async () => {
        await firstPromise!
      })
    })

    it("reports claiming state", async () => {
      let resolveClaim: (value: RemoteLabelJob | null) => void = () => {}
      const port = makePort({
        claim: vi.fn().mockImplementation(
          () =>
            new Promise<RemoteLabelJob | null>((resolve) => {
              resolveClaim = resolve
            })
        ),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      expect(result.current.isClaiming).toBe(false)

      act(() => {
        result.current.claimOne("inst-1", 300_000)
      })

      await waitFor(() => {
        expect(result.current.isClaiming).toBe(true)
      })

      act(() => {
        resolveClaim(makeJob())
      })

      await waitFor(() => {
        expect(result.current.isClaiming).toBe(false)
      })
    })
  })

  describe("claimBatch", () => {
    it("claims a batch and returns the array", async () => {
      const jobs = [
        makeJob({ id: "batch-1", status: "claimed", claimed_by: "inst-1" }),
        makeJob({ id: "batch-2", status: "claimed", claimed_by: "inst-1", product_id: "P002" }),
      ]
      const port = makePort({
        claimBatch: vi.fn().mockResolvedValue(jobs),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      let batchResult: RemoteLabelJob[] | undefined
      await act(async () => {
        batchResult = await result.current.claimBatch("inst-1", 300_000, 45)
      })

      expect(batchResult).toHaveLength(2)
      expect(batchResult![0].id).toBe("batch-1")
      expect(port.claimBatch).toHaveBeenCalledWith("inst-1", 300_000, 45)
    })

    it("returns empty array when no jobs available", async () => {
      const port = makePort({
        claimBatch: vi.fn().mockResolvedValue([]),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      let batchResult: RemoteLabelJob[] | undefined
      await act(async () => {
        batchResult = await result.current.claimBatch("inst-1", 300_000, 10)
      })

      expect(batchResult).toEqual([])
    })

    it("prevents concurrent call when claimBatch is in flight", async () => {
      let resolveBatch: (value: RemoteLabelJob[]) => void = () => {}
      const port = makePort({
        claimBatch: vi.fn().mockImplementation(
          () =>
            new Promise<RemoteLabelJob[]>((resolve) => {
              resolveBatch = resolve
            })
        ),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      act(() => {
        result.current.claimBatch("inst-1", 300_000, 45)
      })

      await act(async () => {
        await expect(result.current.claimBatch("inst-1", 300_000, 45)).rejects.toThrow(
          "Ya hay una solicitud de impresión en curso."
        )
      })

      act(() => {
        resolveBatch([])
      })
    })
  })

  describe("complete and fail", () => {
    it("calls completeJob on the port with installation", async () => {
      const port = makePort()

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      await act(async () => {
        await result.current.completeJob("job-1", "inst-1")
      })

      expect(port.completeJob).toHaveBeenCalledWith("job-1", "inst-1")
    })

    it("calls failJob on the port with installation and reason", async () => {
      const port = makePort()

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      await act(async () => {
        await result.current.failJob("job-2", "inst-1", "Print error")
      })

      expect(port.failJob).toHaveBeenCalledWith("job-2", "inst-1", "Print error")
    })

    it("tracks finalizing state", async () => {
      let resolveComplete: () => void = () => {}
      const port = makePort({
        completeJob: vi.fn().mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              resolveComplete = resolve
            })
        ),
      })

      const { result } = renderHook(() => useLabelPrintJobs(port), { wrapper })

      expect(result.current.isFinalizing).toBe(false)

      act(() => {
        result.current.completeJob("job-1", "inst-1")
      })

      await waitFor(() => {
        expect(result.current.isFinalizing).toBe(true)
      })

      act(() => {
        resolveComplete()
      })

      await waitFor(() => {
        expect(result.current.isFinalizing).toBe(false)
      })
    })
  })
})
