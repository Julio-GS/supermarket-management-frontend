import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import type {
  ProviderPurchaseReport,
  ReportWindow,
} from "../../domain/provider-purchase"
import { useProviderPurchaseReport } from "../use-provider-purchase-report"

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockReport = vi.fn<(window: ReportWindow) => Promise<ProviderPurchaseReport>>()

vi.mock(
  "../../infrastructure/api-provider-purchase-repository",
  () => ({
    providerPurchaseRepository: {
      report: (window: ReportWindow) => mockReport(window),
    },
  })
)

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeReport(
  overrides: Partial<ProviderPurchaseReport> = {}
): ProviderPurchaseReport {
  return {
    window: "day",
    range: {
      startsAt: "2026-07-14T00:00:00.000+00:00",
      endsAt: "2026-07-14T23:59:59.000+00:00",
    },
    totalAmount: "15000.00",
    purchaseCount: 2,
    paymentMethodBreakdown: [
      { method: "transferencia", amount: "10000.00" },
      { method: "efectivo", amount: "5000.00" },
    ],
    ...overrides,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useProviderPurchaseReport", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  it("fetches report with given window and exposes data", async () => {
    mockReport.mockResolvedValue(makeReport())

    const { result } = renderHook(() => useProviderPurchaseReport("day"), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.report).not.toBeNull()
    })

    expect(result.current.report?.totalAmount).toBe("15000.00")
    expect(result.current.report?.purchaseCount).toBe(2)
    expect(result.current.report?.paymentMethodBreakdown).toHaveLength(2)
  })

  it("exposes loading state during fetch", async () => {
    mockReport.mockResolvedValue(makeReport())

    const { result } = renderHook(() => useProviderPurchaseReport("day"), {
      wrapper: createWrapper(queryClient),
    })

    expect(result.current.isLoading).toBe(true)

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it("exposes error when report fails", async () => {
    mockReport.mockRejectedValue(new Error("Report error"))

    const { result } = renderHook(() => useProviderPurchaseReport("day"), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })

    expect(result.current.error?.message).toBe("Report error")
  })

  it("refetches when window changes", async () => {
    mockReport.mockResolvedValue(makeReport())

    const { result, rerender } = renderHook(
      ({ window }: { window: ReportWindow }) =>
        useProviderPurchaseReport(window),
      {
        wrapper: createWrapper(queryClient),
        initialProps: { window: "day" },
      }
    )

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockReport).toHaveBeenCalledTimes(1)
    expect(mockReport).toHaveBeenCalledWith("day")

    // Switch to week
    mockReport.mockResolvedValue(
      makeReport({ window: "week", totalAmount: "50000.00" })
    )
    rerender({ window: "week" })

    await vi.waitFor(() => {
      expect(result.current.report?.window).toBe("week")
    })

    expect(mockReport).toHaveBeenCalledTimes(2)
    expect(mockReport).toHaveBeenCalledWith("week")
    expect(result.current.report?.totalAmount).toBe("50000.00")
  })

  it("returns null report when window is null (not yet selected)", async () => {
    mockReport.mockResolvedValue(makeReport())

    const { result } = renderHook(
      () =>
        useProviderPurchaseReport(null as unknown as ReportWindow),
      {
        wrapper: createWrapper(queryClient),
      }
    )

    // With null window, query is disabled and report should be null
    expect(result.current.report).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(mockReport).not.toHaveBeenCalled()
  })
})
