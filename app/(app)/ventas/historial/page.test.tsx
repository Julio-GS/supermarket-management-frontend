import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SidebarProvider } from "@/components/ui/sidebar"
import VentasHistorialPage from "./page"
import type { ReactNode } from "react"

// Mock the ventas module to return empty data without network calls
vi.mock("@/modules/ventas", () => ({
  createApiSalesRepository: () => ({
    getSales: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false } }),
    getById: vi.fn(),
    retryFiscalInvoice: vi.fn(),
  }),
  PAYMENT_METHOD_LABELS: {},
  FiscalInvoiceHistoryIndicator: () => null,
  FiscalInvoiceStatusBadge: () => null,
  canRetryFiscalInvoice: () => false,
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false },
    },
  })
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <SidebarProvider>{children}</SidebarProvider>
    </QueryClientProvider>
  )
}

// ── T6: Action icon strengthening ─────────────────────────

describe("VentasHistorialPage — action icon strengthening (Sales scope)", () => {
  it("renders without error", () => {
    render(<VentasHistorialPage />, { wrapper: Wrapper })
    expect(screen.getByText("Historial de ventas")).toBeInTheDocument()
  })
})
