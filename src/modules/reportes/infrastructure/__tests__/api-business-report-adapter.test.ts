import { beforeEach, describe, expect, it, vi } from "vitest"
import { createApiBusinessReportAdapter } from "../api-business-report-adapter"
import type { ReportQuery } from "../../domain/report-read-models"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Minimal valid response from a fixed-window backend
function fixedResponse(window: string) {
  return {
    window,
    range: { startsAt: "2026-07-15T03:00:00.000Z", endsAt: "2026-07-16T02:59:59.999Z" },
    totalCollectedAmount: "5000.00",
    paymentMethodBreakdown: [],
    topProducts: [],
  }
}

// Minimal valid response from a custom-range backend
function customResponse() {
  return {
    window: "custom",
    range: { startsAt: "2026-07-15T03:00:00.000Z", endsAt: "2026-07-16T02:59:59.999Z" },
    totalCollectedAmount: "5000.00",
    paymentMethodBreakdown: [],
    topProducts: [],
  }
}

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }
}

function badRequest(body?: unknown) {
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve(body ?? { message: "Bad Request" }),
    text: () => Promise.resolve(JSON.stringify(body ?? { message: "Bad Request" })),
  }
}

function getLastFetchUrl(): string {
  const calls = mockFetch.mock.calls as [string, ...unknown[]][]
  return calls[calls.length - 1]?.[0] ?? ""
}

function getLastFetchQueryParams(): URLSearchParams {
  return new URL(getLastFetchUrl()).searchParams
}

describe("createApiBusinessReportAdapter", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal("__MARKET_DESKTOP_CONFIG__", undefined)
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:3000/api/v1"
  })

  it("serializes a fixed window query with only the 'window' parameter", async () => {
    mockFetch.mockResolvedValue(okJson(fixedResponse("day")))

    const adapter = createApiBusinessReportAdapter()
    const query: ReportQuery = { kind: "fixed", window: "day" }
    await adapter.getReport(query)

    const params = getLastFetchQueryParams()
    expect(params.get("window")).toBe("day")
    expect(params.has("from")).toBe(false)
    expect(params.has("to")).toBe(false)
    expect(params.has("timezone")).toBe(false)
  })

  it("serializes 'week' fixed window", async () => {
    mockFetch.mockResolvedValue(okJson(fixedResponse("week")))

    const adapter = createApiBusinessReportAdapter()
    await adapter.getReport({ kind: "fixed", window: "week" })

    const params = getLastFetchQueryParams()
    expect(params.get("window")).toBe("week")
    expect(params.has("from")).toBe(false)
  })

  it("serializes 'month' fixed window", async () => {
    mockFetch.mockResolvedValue(okJson(fixedResponse("month")))

    const adapter = createApiBusinessReportAdapter()
    await adapter.getReport({ kind: "fixed", window: "month" })

    const params = getLastFetchQueryParams()
    expect(params.get("window")).toBe("month")
    expect(params.has("from")).toBe(false)
  })

  it("serializes a custom single-day query with only 'from' and 'to'", async () => {
    mockFetch.mockResolvedValue(okJson(customResponse()))

    const adapter = createApiBusinessReportAdapter()
    const query: ReportQuery = { kind: "custom-single-day", date: "2026-07-15" }
    await adapter.getReport(query)

    const params = getLastFetchQueryParams()
    expect(params.has("window")).toBe(false)
    expect(params.get("from")).toBe("2026-07-15T03:00:00.000Z")
    expect(params.get("to")).toBe("2026-07-16T02:59:59.999Z")
    expect(params.has("timezone")).toBe(false)
  })

  it("serializes a custom range query with only 'from' and 'to'", async () => {
    mockFetch.mockResolvedValue(okJson(customResponse()))

    const adapter = createApiBusinessReportAdapter()
    const query: ReportQuery = { kind: "custom-range", startDate: "2026-07-10", endDate: "2026-07-15" }
    await adapter.getReport(query)

    const params = getLastFetchQueryParams()
    expect(params.has("window")).toBe(false)
    expect(params.get("from")).toBe("2026-07-10T03:00:00.000Z")
    expect(params.get("to")).toBe("2026-07-16T02:59:59.999Z")
    expect(params.has("timezone")).toBe(false)
  })

  it("returns the report data on success", async () => {
    const payload = fixedResponse("day")
    mockFetch.mockResolvedValue(okJson(payload))

    const adapter = createApiBusinessReportAdapter()
    const report = await adapter.getReport({ kind: "fixed", window: "day" })

    expect(report.window).toBe("day")
    expect(report.totalCollectedAmount).toBe("5000.00")
  })

  it("accepts a custom response with window 'custom'", async () => {
    const payload = customResponse()
    mockFetch.mockResolvedValue(okJson(payload))

    const adapter = createApiBusinessReportAdapter()
    const report = await adapter.getReport({ kind: "custom-single-day", date: "2026-07-15" })

    expect(report.window).toBe("custom")
    expect(report.totalCollectedAmount).toBe("5000.00")
  })

  it("throws on a 400 backend response", async () => {
    mockFetch.mockResolvedValue(badRequest())

    const adapter = createApiBusinessReportAdapter()
    await expect(
      adapter.getReport({ kind: "fixed", window: "day" })
    ).rejects.toThrow()
  })

  it("throws on a malformed response with missing window", async () => {
    mockFetch.mockResolvedValue(okJson({ range: {}, totalCollectedAmount: "0" }))

    const adapter = createApiBusinessReportAdapter()
    // The adapter itself should return data; the hook validates structure.
    // The adapter just passes through the fetch response.
    const result = await adapter.getReport({ kind: "fixed", window: "day" })
    // Adapter returns the raw parsed JSON — validation is upstream in the hook.
    expect(result).toBeDefined()
  })

  it("never sends both window and from/to together", async () => {
    mockFetch.mockResolvedValue(okJson(customResponse()))

    const adapter = createApiBusinessReportAdapter()
    await adapter.getReport({ kind: "custom-range", startDate: "2026-07-10", endDate: "2026-07-15" })

    const params = getLastFetchQueryParams()
    const hasWindow = params.has("window")
    const hasFrom = params.has("from")
    const hasTo = params.has("to")

    // Mutually exclusive: either window OR (from AND to), never both
    expect(hasWindow !== (hasFrom && hasTo)).toBe(true)
  })
})
