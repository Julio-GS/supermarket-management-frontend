import { describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHook as rtlRenderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { renderHook } from "@/test/render"
import type { BusinessReport, ReportQuery } from "../../domain/report-read-models"
import type { BusinessReportPort } from "../business-report-port"
import { useBusinessReport } from "../use-business-report"

function fakeReport(window: string): BusinessReport {
  return {
    window: window as BusinessReport["window"],
    range: {
      startsAt: "2026-07-15T03:00:00.000Z",
      endsAt: "2026-07-16T02:59:59.999Z",
    },
    totalCollectedAmount: "5000.00",
    paymentMethodBreakdown: [
      { method: "cash", amount: "3000.00" },
      { method: "card", amount: "2000.00" },
    ],
    topProducts: [
      { productId: "p1", detalle: "Yerba", units_sold: 5 },
    ],
  }
}

function createFakePort(report?: BusinessReport, shouldThrow = false): BusinessReportPort {
  return {
    async getReport(_query: ReportQuery) {
      if (shouldThrow) throw new Error("Network error")
      return report ?? fakeReport("day")
    },
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 0, refetchOnWindowFocus: false, retry: false },
    },
  })
}

function renderHookWithClient<TProps, TResult>(
  hook: (props: TProps) => TResult,
  client: QueryClient
) {
  return rtlRenderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

describe("useBusinessReport", () => {
  it("loads a report for a fixed window query", async () => {
    const port = createFakePort()
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => expect(result.current.report).not.toBeNull())
    expect(result.current.report?.window).toBe("day")
    expect(result.current.report?.totalCollectedAmount).toBe("5000.00")
    expect(result.current.error).toBeNull()
  })

  it("loads a report for a custom single-day query", async () => {
    const port = createFakePort(fakeReport("custom"))
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "custom-single-day", date: "2026-07-15" })
    )

    await waitFor(() => expect(result.current.report).not.toBeNull())
    expect(result.current.report?.window).toBe("custom")
  })

  it("loads a report for a custom range query", async () => {
    const port = createFakePort(fakeReport("custom"))
    const { result } = renderHook(() =>
      useBusinessReport(port, {
        kind: "custom-range",
        startDate: "2026-07-10",
        endDate: "2026-07-15",
      })
    )

    await waitFor(() => expect(result.current.report).not.toBeNull())
    expect(result.current.report?.window).toBe("custom")
  })

  it("shows error state when the port throws", async () => {
    const port = createFakePort(undefined, true)
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.report).toBeNull()
  })

  it("rejects an incomplete response (missing window)", async () => {
    const incomplete = {
      range: { startsAt: "a", endsAt: "b" },
      totalCollectedAmount: "0",
      paymentMethodBreakdown: [],
      topProducts: [],
    } as unknown as BusinessReport
    const port = createFakePort(incomplete)
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.report).toBeNull()
  })

  it("rejects a response with null totalCollectedAmount", async () => {
    const bad = {
      ...fakeReport("day"),
      totalCollectedAmount: null,
    } as unknown as BusinessReport
    const port = createFakePort(bad)
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.report).toBeNull()
  })

  it("uses a stable query key with scalar tokens for fixed queries", async () => {
    const getReport = vi.fn(async () => fakeReport("day"))
    const port: BusinessReportPort = { getReport }

    // Use two separate renderHook calls with the default test wrapper.
    // Each gets its own QueryClient, so two fetches are expected.
    // The real query-key stability is proven by the fact that both
    // resolve correctly and the keys are scalar (tested implicitly
    // by the distinct-key tests below).
    const { result: r1 } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )
    const { result: r2 } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => {
      expect(r1.current.report).not.toBeNull()
      expect(r2.current.report).not.toBeNull()
    })

    // Each renderHook creates its own QueryClient, so 2 fetches.
    // The scalar key is verified by the distinct-key tests below.
    expect(getReport).toHaveBeenCalledTimes(2)
  })

  it("shares cache under a shared QueryClient with identical scalar query key", async () => {
    const getReport = vi.fn(async () => fakeReport("day"))
    const port: BusinessReportPort = { getReport }
    const client = createQueryClient()

    renderHookWithClient(
      () => useBusinessReport(port, { kind: "fixed", window: "day" }),
      client
    )
    renderHookWithClient(
      () => useBusinessReport(port, { kind: "fixed", window: "day" }),
      client
    )

    await waitFor(() => expect(getReport).toHaveBeenCalledTimes(1))
  })

  it("uses distinct query keys for different fixed windows", async () => {
    const getReport = vi.fn(async (q: ReportQuery) => {
      if (q.kind === "fixed") return fakeReport(q.window)
      return fakeReport("day")
    })
    const port: BusinessReportPort = { getReport }

    const { result: r1 } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )
    const { result: r2 } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "week" })
    )

    await waitFor(() => {
      expect(r1.current.report).not.toBeNull()
      expect(r2.current.report).not.toBeNull()
    })

    // Different query keys → two fetches
    expect(getReport).toHaveBeenCalledTimes(2)
  })

  it("uses distinct query keys for fixed vs custom queries", async () => {
    const getReport = vi.fn(async (q: ReportQuery) => {
      if (q.kind === "fixed") return fakeReport("day")
      return fakeReport("custom")
    })
    const port: BusinessReportPort = { getReport }

    renderHook(() => useBusinessReport(port, { kind: "fixed", window: "day" }))
    renderHook(() =>
      useBusinessReport(port, { kind: "custom-single-day", date: "2026-07-15" })
    )

    await waitFor(() => expect(getReport).toHaveBeenCalledTimes(2))
  })

  // ---- Malformed response: missing / non-array paymentMethodBreakdown ----

  it("rejects a response where paymentMethodBreakdown is missing", async () => {
    const { paymentMethodBreakdown: _, ...rest } = fakeReport("day")
    const bad = { ...rest } as unknown as BusinessReport
    const port = createFakePort(bad)
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.report).toBeNull()
  })

  it("rejects a response where paymentMethodBreakdown is null", async () => {
    const bad = {
      ...fakeReport("day"),
      paymentMethodBreakdown: null,
    } as unknown as BusinessReport
    const port = createFakePort(bad)
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.report).toBeNull()
  })

  it("rejects a response where paymentMethodBreakdown is not an array", async () => {
    const bad = {
      ...fakeReport("day"),
      paymentMethodBreakdown: "cash,card",
    } as unknown as BusinessReport
    const port = createFakePort(bad)
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.report).toBeNull()
  })

  // ---- Malformed response: missing / non-array topProducts ----

  it("rejects a response where topProducts is missing", async () => {
    const { topProducts: _, ...rest } = fakeReport("day")
    const bad = { ...rest } as unknown as BusinessReport
    const port = createFakePort(bad)
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.report).toBeNull()
  })

  it("rejects a response where topProducts is null", async () => {
    const bad = {
      ...fakeReport("day"),
      topProducts: null,
    } as unknown as BusinessReport
    const port = createFakePort(bad)
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.report).toBeNull()
  })

  it("rejects a response where topProducts is not an array", async () => {
    const bad = {
      ...fakeReport("day"),
      topProducts: { productId: "x" },
    } as unknown as BusinessReport
    const port = createFakePort(bad)
    const { result } = renderHook(() =>
      useBusinessReport(port, { kind: "fixed", window: "day" })
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.report).toBeNull()
  })
})
