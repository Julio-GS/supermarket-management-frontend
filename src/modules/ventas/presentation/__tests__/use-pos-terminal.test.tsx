import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@/test/render"
import { act } from "@testing-library/react"
import { toast } from "sonner"
import { usePosTerminal } from "../use-pos-terminal"
import type { CatalogQueryPort, CatalogProduct } from "../../application/catalog-query-port"
import type { CheckoutPort } from "../../application/checkout-port"
import type { TicketPrinterPort } from "../../application/ticket-printer-port"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

// ── Helpers ────────────────────────────────────────────────────

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: overrides.id ?? "P001",
    name: overrides.name ?? "Test Product",
    sku: overrides.sku ?? "SKU-001",
    price: overrides.price ?? 10,
    stock: overrides.stock ?? 50,
    unit: overrides.unit ?? "u",
    promotions: overrides.promotions ?? null,
    storePromotions: overrides.storePromotions ?? null,
  }
}

function makeCatalogPort(
  overrides: Partial<CatalogQueryPort> = {}
): CatalogQueryPort {
  return {
    search: vi.fn().mockResolvedValue([]),
    findByCode: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

function makeCheckoutPort(overrides: Partial<CheckoutPort> = {}): CheckoutPort {
  return {
    checkout: vi.fn(),
    ...overrides,
  }
}

function makeTicketPrinterPort(overrides: Partial<TicketPrinterPort> = {}): TicketPrinterPort {
  return {
    print: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────

describe("usePosTerminal camera handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── handleCameraCode ──────────────────────────────────

  it("adds one committed row with exact match via handleCameraCode", async () => {
    const product = makeProduct({ id: "P042", name: "Leche", sku: "LEC-0042" })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // handleCameraCode is not yet exposed — this test is RED
    expect(result.current).toHaveProperty("handleCameraCode")

    await act(async () => {
      await result.current.handleCameraCode!("LEC-0042")
    })

    // Verify a row was committed with the product
    const committedRows = result.current.rows.filter((r) => r.committed && r.resolvedProduct)
    expect(committedRows).toHaveLength(1)
    expect(committedRows[0].resolvedProduct?.id).toBe("P042")
    expect(committedRows[0].quantity).toBe("1")
    expect(committedRows[0].committed).toBe(true)
  })

  it("returns not-found CameraScanResult when product is null", async () => {
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(null),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    let scanResult: unknown
    await act(async () => {
      scanResult = await result.current.handleCameraCode!("NONEXISTENT")
    })

    expect(scanResult).toEqual({ status: "not-found" })
    expect(toast.error).toHaveBeenCalled()
  })

  it("returns error CameraScanResult when findByCode returns ambiguous match", async () => {
    // Ambiguous: findByCode should normally return null for multiple matches,
    // but if the adapter returns something when it shouldn't, it should error.
    // For safety, the hook should handle the edge case.
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockRejectedValue(new Error("Ambiguous match")),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    let scanResult: unknown
    await act(async () => {
      scanResult = await result.current.handleCameraCode!("CODE")
    })

    expect(scanResult).toMatchObject({ status: "error" })
  })

  it("does not double-add the same product on repeated handleCameraCode calls", async () => {
    const product = makeProduct({ id: "P001", name: "Pan", sku: "PAN-001" })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // First scan
    await act(async () => {
      await result.current.handleCameraCode!("PAN-001")
    })

    // Second scan — should add ANOTHER row (intentional repeat)
    await act(async () => {
      await result.current.handleCameraCode!("PAN-001")
    })

    const committedRows = result.current.rows.filter((r) => r.committed && r.resolvedProduct)
    // Two separate scans should create two rows
    expect(committedRows).toHaveLength(2)
  })

  it("shows an error when all 12 rows are occupied", async () => {
    const product = makeProduct()
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // Fill all 12 rows
    for (let i = 0; i < 12; i++) {
      await act(async () => {
        await result.current.handleCameraCode!("CODE")
      })
    }

    // 13th scan should error
    let scanResult: unknown
    await act(async () => {
      scanResult = await result.current.handleCameraCode!("CODE-13")
    })

    expect(scanResult).toMatchObject({ status: "error" })
    expect(toast.error).toHaveBeenCalled()
  })

  it("does not change manual flow behavior when camera is not used", async () => {
    const product = makeProduct({ id: "P099", name: "Manual", sku: "MAN-001" })
    const catalogPort = makeCatalogPort({
      search: vi.fn().mockResolvedValue([product]),
      findByCode: vi.fn(),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // Use the existing handleQueryChange + handleRowKeyDown for manual entry
    const firstRowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(firstRowId, "MAN-001")
    })

    // Simulate Enter key
    await act(async () => {
      result.current.handleRowKeyDown(firstRowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    // Wait for the async search to resolve
    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === firstRowId)
        expect(row?.resolvedProduct?.id).toBe("P099")
      })
    })

    // findByCode should NOT have been called during manual entry
    expect(catalogPort.findByCode).not.toHaveBeenCalled()
  })

  it("exposes focusFirstAvailableRow for scanner close focus restoration", async () => {
    const catalogPort = makeCatalogPort()
    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // focusFirstAvailableRow must be a callable function
    expect(result.current).toHaveProperty("focusFirstAvailableRow")
    expect(typeof result.current.focusFirstAvailableRow).toBe("function")
  })
})
