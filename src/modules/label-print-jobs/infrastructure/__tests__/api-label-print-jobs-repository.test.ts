import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiLabelPrintJobsRepository } from "../api-label-print-jobs-repository"

vi.mock("@/shared/infrastructure/auth-token-store", () => ({
  getAccessToken: vi.fn(() => "token123"),
  clearAccessToken: vi.fn(),
}))

function getFetchMock() {
  return vi.mocked(fetch)
}

const INSTALLATION = "label-printer-abc"

function makeJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "job-1",
    product_id: "P001",
    sku: "SKU-001",
    product_name: "Product A",
    sale_price: "150.00",
    claimed_by: "label-printer-abc",
    lease_expires_at: "2026-01-15T12:00:00Z",
    status: "claimed",
    ...overrides,
  }
}

describe("ApiLabelPrintJobsRepository", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── getPendingJobs ────────────────────────────────────────────────
  describe("getPendingJobs", () => {
    it("GETs /pending and returns the job array", async () => {
      const jobs = [makeJob({ status: "pending", claimed_by: null, lease_expires_at: null })]
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(jobs), { status: 200 })
      )

      const repository = new ApiLabelPrintJobsRepository()
      const result = await repository.getPendingJobs()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("job-1")
      expect(result[0].status).toBe("pending")

      const [url, options] = getFetchMock().mock.calls[0]
      expect(url).toBe("https://api.example.com/api/v1/label-print-jobs/pending")
      expect(options?.method).toBeUndefined()
    })

    it("returns empty array when no pending jobs", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 })
      )

      const repository = new ApiLabelPrintJobsRepository()
      const result = await repository.getPendingJobs()

      expect(result).toEqual([])
    })

    it("preserves sale_price as a string from the backend", async () => {
      const jobs = [makeJob({ sale_price: "199.99", status: "pending", claimed_by: null, lease_expires_at: null })]
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(jobs), { status: 200 })
      )

      const repository = new ApiLabelPrintJobsRepository()
      const result = await repository.getPendingJobs()

      expect(result[0].sale_price).toBe("199.99")
      expect(typeof result[0].sale_price).toBe("string")
    })
  })

  // ── claim ─────────────────────────────────────────────────────────
  describe("claim", () => {
    it("POSTs /claim with { installation, lease_ms } and returns one job", async () => {
      const job = makeJob()
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(job), { status: 200 })
      )

      const repository = new ApiLabelPrintJobsRepository()
      const result = await repository.claim(INSTALLATION, 300_000)

      expect(result).not.toBeNull()
      expect(result!.id).toBe("job-1")
      expect(result!.claimed_by).toBe("label-printer-abc")

      const [url, options] = getFetchMock().mock.calls[0]
      expect(url).toBe("https://api.example.com/api/v1/label-print-jobs/claim")
      expect(options?.method).toBe("POST")
      expect(JSON.parse(options?.body as string)).toEqual({
        installation: INSTALLATION,
        lease_ms: 300_000,
      })
    })

    it("returns null when backend responds with null (no pending jobs)", async () => {
      getFetchMock().mockResolvedValue(
        new Response("null", { status: 200, headers: { "Content-Type": "application/json" } })
      )

      const repository = new ApiLabelPrintJobsRepository()
      const result = await repository.claim(INSTALLATION, 300_000)

      expect(result).toBeNull()
    })

    it("passes the configured lease_ms", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(makeJob()), { status: 200 })
      )

      const repository = new ApiLabelPrintJobsRepository()
      await repository.claim(INSTALLATION, 120_000)

      const [, options] = getFetchMock().mock.calls[0]
      expect(JSON.parse(options?.body as string).lease_ms).toBe(120_000)
    })
  })

  // ── claimBatch ────────────────────────────────────────────────────
  describe("claimBatch", () => {
    it("POSTs /claim-batch with { installation, lease_ms, limit } and returns an array", async () => {
      const jobs = [makeJob({ id: "job-a" }), makeJob({ id: "job-b", product_id: "P002", product_name: "Product B" })]
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(jobs), { status: 200 })
      )

      const repository = new ApiLabelPrintJobsRepository()
      const result = await repository.claimBatch(INSTALLATION, 300_000, 45)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe("job-a")
      expect(result[1].id).toBe("job-b")

      const [url, options] = getFetchMock().mock.calls[0]
      expect(url).toBe("https://api.example.com/api/v1/label-print-jobs/claim-batch")
      expect(options?.method).toBe("POST")
      expect(JSON.parse(options?.body as string)).toEqual({
        installation: INSTALLATION,
        lease_ms: 300_000,
        limit: 45,
      })
    })

    it("returns empty array when no claimable jobs", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 })
      )

      const repository = new ApiLabelPrintJobsRepository()
      const result = await repository.claimBatch(INSTALLATION, 300_000, 10)

      expect(result).toEqual([])
    })

    it("passes the configured lease_ms and limit", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 })
      )

      const repository = new ApiLabelPrintJobsRepository()
      await repository.claimBatch(INSTALLATION, 120_000, 20)

      const [, options] = getFetchMock().mock.calls[0]
      expect(JSON.parse(options?.body as string).lease_ms).toBe(120_000)
      expect(JSON.parse(options?.body as string).limit).toBe(20)
    })
  })

  // ── completeJob ───────────────────────────────────────────────────
  describe("completeJob", () => {
    it("POSTs /:id/complete with { installation }", async () => {
      getFetchMock().mockResolvedValue(new Response(null, { status: 204 }))

      const repository = new ApiLabelPrintJobsRepository()
      await repository.completeJob("job-1", INSTALLATION)

      const [url, options] = getFetchMock().mock.calls[0]
      expect(url).toBe("https://api.example.com/api/v1/label-print-jobs/job-1/complete")
      expect(options?.method).toBe("POST")
      expect(JSON.parse(options?.body as string)).toEqual({
        installation: INSTALLATION,
      })
    })
  })

  // ── failJob ───────────────────────────────────────────────────────
  describe("failJob", () => {
    it("POSTs /:id/fail with { installation, reason }", async () => {
      getFetchMock().mockResolvedValue(new Response(null, { status: 204 }))

      const repository = new ApiLabelPrintJobsRepository()
      await repository.failJob("job-2", INSTALLATION, "Printer jam")

      const [url, options] = getFetchMock().mock.calls[0]
      expect(url).toBe("https://api.example.com/api/v1/label-print-jobs/job-2/fail")
      expect(options?.method).toBe("POST")
      expect(JSON.parse(options?.body as string)).toEqual({
        installation: INSTALLATION,
        reason: "Printer jam",
      })
    })

    it("always includes installation and reason in the body", async () => {
      getFetchMock().mockResolvedValue(new Response(null, { status: 204 }))

      const repository = new ApiLabelPrintJobsRepository()
      await repository.failJob("job-3", INSTALLATION, "Operador canceló la impresión remota")

      const [, options] = getFetchMock().mock.calls[0]
      const body = JSON.parse(options?.body as string)
      expect(body.installation).toBe(INSTALLATION)
      expect(body.reason).toBeTruthy()
    })
  })
})
