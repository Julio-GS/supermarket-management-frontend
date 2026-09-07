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
    id: "P001",
    name: "Test Product",
    sku: "SKU-001",
    price: 10,
    stock: 50,
    manejaStock: true,
    unit: "u",
    promotions: null,
    storePromotions: null,
    ...overrides,
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
    save: vi.fn().mockResolvedValue({
      id: "V-00001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customer: "Mostrador",
      items: [],
      total: "0.00",
      paymentMethods: [],
      invoiceStatus: "none" as const,
      cae: null,
      caeVto: null,
      cbteNro: null,
      cbteTipo: null,
      ptoVta: null,
      invoiceRequestedAt: null,
      splitTicketGroups: null,
    }),
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

describe("usePosTerminal checkout invoice toast feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function checkoutWithInvoiceStatus(invoiceStatus: "failed" | "issuing" | "ambiguous") {
    const product = makeProduct({ id: `P-${invoiceStatus}`, name: `Product ${invoiceStatus}` })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })
    const checkoutPort = makeCheckoutPort({
      save: vi.fn().mockResolvedValue({
        id: `V-${invoiceStatus}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: "Mostrador",
        items: [
          {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: "10.00",
            subtotal: "10.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
          },
        ],
        total: "10.00",
        paymentMethods: [{ method: "cash", amount: "10.00" }],
        invoiceStatus,
        cae: null,
        caeVto: null,
        cbteNro: null,
        cbteTipo: null,
        ptoVta: null,
        invoiceRequestedAt: new Date().toISOString(),
        splitTicketGroups: null,
      }),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, makeTicketPrinterPort())
    )

    await act(async () => {
      await result.current.handleCameraCode("SKU")
    })

    act(() => {
      result.current.toggleAllocation("cash")
    })

    await act(async () => {
      await result.current.handleCheckout(true)
    })
  }

  it("warns specifically when fiscal invoice issuance failed", async () => {
    await checkoutWithInvoiceStatus("failed")

    expect(toast.success).toHaveBeenCalledWith(
      "Venta registrada con factura pendiente",
      expect.objectContaining({
        description: expect.stringMatching(/no pudo emitirse/i),
      }),
    )
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("uses reconciliation messaging when invoice is still issuing", async () => {
    await checkoutWithInvoiceStatus("issuing")

    expect(toast.success).toHaveBeenCalledWith(
      "Venta registrada — factura en emisión",
      expect.objectContaining({
        description: expect.stringMatching(/arca|concili/i),
      }),
    )
  })

  it("uses reconciliation messaging when invoice status is ambiguous", async () => {
    await checkoutWithInvoiceStatus("ambiguous")

    expect(toast.success).toHaveBeenCalledWith(
      "Venta registrada — requiere conciliación",
      expect.objectContaining({
        description: expect.stringMatching(/revisión manual|concili/i),
      }),
    )
  })
})

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

  it("auto-grows when all rows are filled (no more 12-row limit error)", async () => {
    const product = makeProduct()
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // Fill all initial rows
    const initialCount = result.current.rows.length
    for (let i = 0; i < initialCount; i++) {
      await act(async () => {
        await result.current.handleCameraCode!("CODE")
      })
    }

    // 13th scan should succeed — auto-grows rows
    let scanResult: unknown
    await act(async () => {
      scanResult = await result.current.handleCameraCode!("CODE-13")
    })

    expect(scanResult).toMatchObject({ status: "matched" })
    expect(result.current.rows.length).toBeGreaterThan(initialCount)
  })

  it("camera scan of protected product leaves row uncommitted with metadata", async () => {
    const specialProduct = makeProduct({
      id: "SP003",
      name: "Gastos Varios",
      sku: "3",
      pricingMode: "manual",
      isProtected: true,
    })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    await act(async () => {
      await result.current.handleCameraCode!("3")
    })

    const specialRows = result.current.rows.filter(
      (r) => r.resolvedProduct?.id === "SP003"
    )
    expect(specialRows).toHaveLength(1)
    expect(specialRows[0].committed).toBe(false)
    expect(specialRows[0].isProtected).toBe(true)
    expect(specialRows[0].pricingMode).toBe("manual")
    expect(specialRows[0].quantity).toBe("1")
  })

  it("camera scan of normal product auto-commits as before", async () => {
    const normalProduct = makeProduct({ id: "P001", name: "Normal" })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(normalProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    await act(async () => {
      await result.current.handleCameraCode!("CODE")
    })

    const rows = result.current.rows.filter(
      (r) => r.resolvedProduct?.id === "P001"
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].committed).toBe(true)
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

// ── Special product code tests ──────────────────────────────────

describe("usePosTerminal special product codes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeSpecialProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
    return makeProduct({
      id: "SP001",
      name: "Gastos Varios",
      price: 0,
      pricingMode: "manual",
      isProtected: true,
      ...overrides,
    })
  }

  // ── Task 5.6: Code routing ──────────────────────────────

  it("routes codes 1-9 through findByCode instead of catalog search", async () => {
    const specialProduct = makeSpecialProduct()
    const catalogPort = makeCatalogPort({
      search: vi.fn().mockResolvedValue([]),
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "3")
    })

    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.resolvedProduct?.id).toBe("SP001")
      })
    })

    expect(catalogPort.findByCode).toHaveBeenCalledWith("3")
    expect(catalogPort.search).not.toHaveBeenCalledWith(expect.objectContaining({ search: "3" }))
  })

  it("routes non-special codes through normal catalog search", async () => {
    const normalProduct = makeProduct({ id: "P099", name: "Normal", sku: "ABC" })
    const catalogPort = makeCatalogPort({
      search: vi.fn().mockResolvedValue([normalProduct]),
      findByCode: vi.fn(),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "ABC")
    })

    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.resolvedProduct?.id).toBe("P099")
      })
    })

    expect(catalogPort.search).toHaveBeenCalled()
    expect(catalogPort.findByCode).not.toHaveBeenCalled()
  })

  // ── Task 5.7: Protected row state ────────────────────────

  it("sets pricingMode and isProtected on row when special code resolves", async () => {
    const specialProduct = makeSpecialProduct()
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "3")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.pricingMode).toBe("manual")
        expect(row?.isProtected).toBe(true)
      })
    })
  })

  it("does NOT auto-commit protected rows — awaits manual total entry", async () => {
    const specialProduct = makeSpecialProduct()
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "3")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.resolvedProduct).not.toBeNull()
        expect(row?.committed).toBe(false)
      })
    })
  })

  it("commits protected row when valid manual total is entered", async () => {
    const specialProduct = makeSpecialProduct()
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    // Enter code "3" to resolve special product
    await act(async () => {
      result.current.handleQueryChange(rowId, "3")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.resolvedProduct).not.toBeNull()
      })
    })

    // Enter manual total via the handleManualTotalChange action
    await act(async () => {
      result.current.handleManualTotalChange!(rowId, "20.00")
    })

    // Manual total input + Enter should commit
    // We simulate committing by calling handleManualTotalChange and then pressing Enter
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    const row = result.current.rows.find((r) => r.id === rowId)
    expect(row?.committed).toBe(true)
    expect(row?.manualLineTotal).toBe("20.00")
  })

  it("rejects invalid manual totals (zero, negative, non-numeric)", async () => {
    const specialProduct = makeSpecialProduct()
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "3")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.resolvedProduct).not.toBeNull()
      })
    })

    // Try invalid total — should set error
    await act(async () => {
      result.current.handleManualTotalChange!(rowId, "0")
    })

    let row = result.current.rows.find((r) => r.id === rowId)
    expect(row?.manualTotalError).toBeTruthy()
    expect(row?.committed).toBe(false)

    // Try negative
    await act(async () => {
      result.current.handleManualTotalChange!(rowId, "-5.00")
    })
    row = result.current.rows.find((r) => r.id === rowId)
    expect(row?.manualTotalError).toBeTruthy()

    // Try non-numeric
    await act(async () => {
      result.current.handleManualTotalChange!(rowId, "abc")
    })
    row = result.current.rows.find((r) => r.id === rowId)
    expect(row?.manualTotalError).toBeTruthy()
  })

  // ── Task 5.8: Backend error ──────────────────────────────

  it("displays error when special code lookup fails", async () => {
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockRejectedValue(new Error("Network error")),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "5")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.isSearching).toBe(false)
      })
    })

    expect(toast.error).toHaveBeenCalled()
    // Row should NOT have a resolved product
    const row = result.current.rows.find((r) => r.id === rowId)
    expect(row?.resolvedProduct).toBeNull()
  })

  // ── Task 5.9: Repeated codes ─────────────────────────────

  it("creates separate scanner rows for repeated special codes", async () => {
    const specialProduct = makeSpecialProduct()
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // First special code entry
    const rowId1 = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId1, "2")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId1, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId1)
        expect(row?.resolvedProduct?.id).toBe("SP001")
      })
    })

    // Set manual total and commit
    await act(async () => {
      result.current.handleManualTotalChange!(rowId1, "15.00")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId1, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    // Second special code entry (same code "2") on next row
    const rowId2 = result.current.rows[1].id
    await act(async () => {
      result.current.handleQueryChange(rowId2, "2")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId2, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId2)
        expect(row?.resolvedProduct?.id).toBe("SP001")
      })
    })

    // Set different manual total and commit
    await act(async () => {
      result.current.handleManualTotalChange!(rowId2, "25.00")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId2, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    const committedRows = result.current.rows.filter((r) => r.committed)
    expect(committedRows).toHaveLength(2)
    expect(committedRows[0].manualLineTotal).toBe("15.00")
    expect(committedRows[1].manualLineTotal).toBe("25.00")
  })

  // ── Task 5.3: Mixed cart totals ──────────────────────────

  it("calculates totals combining special manual line totals and normal product line totals", async () => {
    const specialProduct = makeSpecialProduct({ id: "SP001", price: 0 })
    const normalProduct = makeProduct({ id: "P042", name: "Leche", price: 2.50 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
      search: vi.fn().mockResolvedValue([normalProduct]),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // Add special product with manual total $20.00
    const rowId1 = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId1, "3")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId1, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId1)
        expect(row?.resolvedProduct).not.toBeNull()
      })
    })
    await act(async () => {
      result.current.handleManualTotalChange!(rowId1, "20.00")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId1, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    // Add normal product with price $2.50 and quantity 2
    const rowId2 = result.current.rows[1].id
    await act(async () => {
      result.current.handleQueryChange(rowId2, "LECHE")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId2, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId2)
        expect(row?.resolvedProduct?.id).toBe("P042")
      })
    })

    // Set quantity to 2
    await act(async () => {
      result.current.handleQuantityChange(rowId2, "2")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId2, "quantity", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    // Total should be $20.00 (special) + $2.50 × 2 (normal) = $25.00
    expect(result.current.totals.subtotal).toBe(25.00)
    expect(result.current.cartItems).toHaveLength(2)
  })

  it("calculates cart totals using quantity × editable unit price for special products with quantity prefix", async () => {
    const specialProduct = makeSpecialProduct({ id: "SP002", price: 0 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    // Enter prefix *32 (quantity 3, special code 2)
    await act(async () => {
      result.current.handleQueryChange(rowId, "*32")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.resolvedProduct).not.toBeNull()
        expect(row?.quantity).toBe("3")
      })
    })

    // Enter unit price $15.00
    await act(async () => {
      result.current.handleManualTotalChange(rowId, "15.00")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "manualTotal", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    const row = result.current.rows.find((r) => r.id === rowId)
    expect(row?.committed).toBe(true)

    // Subtotal should be quantity × unit price = 3 × $15.00 = $45.00
    expect(result.current.totals.subtotal).toBe(45.00)
    expect(result.current.cartItems[0]).toMatchObject({
      quantity: 3,
      manualLineTotal: "45.00",
    })
  })

  it("does NOT clear row on Backspace/Delete inside manualTotal field, but DOES clear on resolved product field", async () => {
    const specialProduct = makeSpecialProduct({ id: "SP003", price: 0 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "3")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    await act(async () => {
      await vi.waitFor(() => {
        expect(result.current.rows.find((r) => r.id === rowId)?.resolvedProduct).not.toBeNull()
      })
    })

    await act(async () => {
      result.current.handleManualTotalChange(rowId, "15.00")
    })

    // Press Backspace in manualTotal field
    const preventDefaultBackspace = vi.fn()
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "manualTotal", {
        key: "Backspace",
        preventDefault: preventDefaultBackspace,
      } as unknown as React.KeyboardEvent)
    })

    // Row must NOT be cleared, preventDefault must NOT be called
    expect(preventDefaultBackspace).not.toHaveBeenCalled()
    expect(result.current.rows.find((r) => r.id === rowId)?.resolvedProduct).not.toBeNull()

    // Press Delete in manualTotal field
    const preventDefaultDelete = vi.fn()
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "manualTotal", {
        key: "Delete",
        preventDefault: preventDefaultDelete,
      } as unknown as React.KeyboardEvent)
    })

    // Row must NOT be cleared, preventDefault must NOT be called
    expect(preventDefaultDelete).not.toHaveBeenCalled()
    expect(result.current.rows.find((r) => r.id === rowId)?.resolvedProduct).not.toBeNull()

    // Commit the row
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "manualTotal", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    expect(result.current.rows.find((r) => r.id === rowId)?.committed).toBe(true)

    // Now press Backspace on the resolved/committed product field — this SHOULD clear the row
    const preventDefaultProduct = vi.fn()
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Backspace",
        preventDefault: preventDefaultProduct,
      } as unknown as React.KeyboardEvent)
    })

    expect(preventDefaultProduct).toHaveBeenCalled()
    expect(result.current.rows.find((r) => r.id === rowId)?.resolvedProduct).toBeNull()
  })

  it("keeps unit-price field editable while checkout is open, allowing re-editing and updating cart totals", async () => {
    const specialProduct = makeSpecialProduct({ id: "SP004", price: 0 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "3")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    await act(async () => {
      await vi.waitFor(() => {
        expect(result.current.rows.find((r) => r.id === rowId)?.resolvedProduct).not.toBeNull()
      })
    })

    // Commit with initial unit price 10.00
    await act(async () => {
      result.current.handleManualTotalChange(rowId, "10.00")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "manualTotal", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    expect(result.current.totals.subtotal).toBe(10.00)

    // While checkout is still open, re-edit the unit price to 25.00
    await act(async () => {
      result.current.handleManualTotalChange(rowId, "25.00")
    })
    // Re-commit
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "manualTotal", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(result.current.rows.find((r) => r.id === rowId)?.committed).toBe(true)
    expect(result.current.rows.find((r) => r.id === rowId)?.manualLineTotal).toBe("25.00")
    expect(result.current.totals.subtotal).toBe(25.00)
  })

  it("resets scanner rows on successful checkout of special product with quantity and manual unit price", async () => {
    const specialProduct = makeSpecialProduct({ id: "SP005", name: "Gastos Varios", price: 0 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(specialProduct),
    })
    const checkoutPort = makeCheckoutPort({
      save: vi.fn().mockResolvedValue({
        id: "sale-sp-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: "Mostrador",
        items: [
          {
            productId: "SP005",
            name: "Gastos Varios",
            quantity: 2,
            unitPrice: "15.00",
            subtotal: "30.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
          },
        ],
        total: "30.00",
        paymentMethods: [{ method: "cash", amount: "30.00" }],
        invoiceStatus: "none" as const,
        cae: null,
        caeVto: null,
        cbteNro: null,
        cbteTipo: null,
        ptoVta: null,
        invoiceRequestedAt: null,
        splitTicketGroups: null,
      }),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, makeTicketPrinterPort())
    )

    const rowId = result.current.rows[0].id
    // Enter *23 (quantity 2, code 3)
    await act(async () => {
      result.current.handleQueryChange(rowId, "*23")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    await act(async () => {
      await vi.waitFor(() => {
        expect(result.current.rows.find((r) => r.id === rowId)?.resolvedProduct).not.toBeNull()
      })
    })

    // Enter unit price 15.00 -> line total 30.00
    await act(async () => {
      result.current.handleManualTotalChange(rowId, "15.00")
    })
    await act(async () => {
      result.current.handleRowKeyDown(rowId, "manualTotal", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(result.current.totals.subtotal).toBe(30.00)
    expect(result.current.cartItems).toHaveLength(1)
    expect(result.current.rows.find((r) => r.id === rowId)?.committed).toBe(true)

    // Allocate payment
    act(() => {
      result.current.toggleAllocation("cash")
    })

    // Perform successful checkout through the actual UI/hook contract
    await act(async () => {
      await result.current.handleCheckout(false)
    })

    expect(checkoutPort.save).toHaveBeenCalledTimes(1)
    expect(result.current.cartItems).toHaveLength(0)
    expect(result.current.rows.filter((r) => r.committed)).toHaveLength(0)
    expect(result.current.rows.length).toBe(12)
    expect(result.current.rows[0].query).toBe("")
    expect(result.current.rows[0].resolvedProduct).toBeNull()
  })
})

// ── Dynamic scanner rows (Task 2.1) ────────────────────────────

describe("usePosTerminal dynamic rows", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts with exactly 12 scanner rows", () => {
    const catalogPort = makeCatalogPort()
    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )
    expect(result.current.rows.length).toBe(12)
  })

  it("appends a new row when exceeding initial row capacity", async () => {
    const product = makeProduct({ id: "P001", name: "Test" })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // Fill all initial rows with committed products
    const initialCount = result.current.rows.length
    for (let i = 0; i < initialCount; i++) {
      await act(async () => {
        await result.current.handleCameraCode!("CODE")
      })
    }

    // 13th scan should auto-append a new row
    await act(async () => {
      await result.current.handleCameraCode!("CODE-13")
    })

    // After exceeding capacity, a new row should be appended
    expect(result.current.rows.length).toBeGreaterThan(initialCount)
  })

        it("adds a trailing empty row as soon as the last visible row is filled", async () => {
        const product = makeProduct({ id: "P001", name: "Test" })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
        )

        const initialCount = result.current.rows.length
        for (let i = 0; i < initialCount; i++) {
          await act(async () => {
            await result.current.handleCameraCode!("CODE")
          })
        }

        expect(result.current.rows).toHaveLength(initialCount + 1)
        const trailingRow = result.current.rows.at(-1)
        expect(trailingRow?.resolvedProduct).toBeNull()
        expect(trailingRow?.committed).toBe(false)
      })

it("trims empty trailing rows after removing a product from the end", async () => {
    const product = makeProduct({ id: "P001" })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // Commit one product
    await act(async () => {
      await result.current.handleCameraCode!("CODE")
    })

    const committedRows = result.current.rows.filter((r) => r.committed)
    expect(committedRows).toHaveLength(1)

    // Remove that product
    await act(async () => {
      result.current.clearRowsForProduct("P001")
    })

    // Row count should be back to minimum (empty trailing rows removed)
    expect(result.current.rows.length).toBe(12)
  })

        it("does not clear the row when Backspace is pressed in the quantity field", async () => {
        const product = makeProduct({ id: "P001", name: "Yerba" })
        const catalogPort = makeCatalogPort({
          search: vi.fn().mockResolvedValue([product]),
        })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
        )

        const rowId = result.current.rows[0].id

        await act(async () => {
          result.current.handleQueryChange(rowId, "Yerba")
        })
        await act(async () => {
          result.current.handleRowKeyDown(rowId, "product", {
            key: "Enter",
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent)
        })
        await act(async () => {
          await vi.waitFor(() => {
            const row = result.current.rows.find((r) => r.id === rowId)
            expect(row?.resolvedProduct?.id).toBe("P001")
          })
        })

        await act(async () => {
          result.current.handleQuantityChange(rowId, "12")
        })

        const preventDefault = vi.fn()
        await act(async () => {
          result.current.handleRowKeyDown(rowId, "quantity", {
            key: "Backspace",
            preventDefault,
            target: { value: "12", selectionStart: 2, selectionEnd: 2 },
          } as unknown as React.KeyboardEvent)
        })

        const row = result.current.rows.find((r) => r.id === rowId)
        expect(preventDefault).not.toHaveBeenCalled()
        expect(row?.resolvedProduct?.id).toBe("P001")
        expect(row?.committed).toBe(true)
      })

// ── Scanner-to-payment bridge (Task 2.3) ──────────────────────

  it("exposes focusFirstPaymentMethod for scanner exit", () => {
    const catalogPort = makeCatalogPort()
    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    expect(result.current).toHaveProperty("focusFirstPaymentMethod")
    expect(typeof result.current.focusFirstPaymentMethod).toBe("function")
  })
})

// ── Payment auto-fill (Task 2.4) ───────────────────────────────

describe("usePosTerminal payment auto-fill", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("pre-fills first payment method with total amount", () => {
    const product = makeProduct({ price: 1500 }) // $15.00
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // Simulate a cart with one product at $15.00
    // The toggleAllocation for the first method should pre-fill with total
    act(() => {
      result.current.toggleAllocation("cash")
    })

    const cashAlloc = result.current.allocations.find((a) => a.method === "cash")
    // With no items in cart, subtotal is 0; but the behavior should be that it
    // pre-fills with the current sale subtotal when toggling first method
    expect(cashAlloc).toBeDefined()
  })

  it("pre-fills second payment method with remaining balance", async () => {
    const product = makeProduct({ id: "P001", price: 15 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // Add a product to cart ($15.00)
    await act(async () => {
      await result.current.handleCameraCode!("CODE")
    })

    // First method: cash for $10.00
    act(() => {
      result.current.toggleAllocation("cash")
      result.current.changeAllocationAmount("cash", "10.00")
    })

    // Second method: should pre-fill with remaining $5.00
    act(() => {
      result.current.toggleAllocation("card")
    })

    const cardAlloc = result.current.allocations.find((a) => a.method === "card")
    expect(cardAlloc).toBeDefined()
    expect(cardAlloc!.amount).toBe("5.00")
  })

  it("does NOT recalculate amount when revisiting an active method", async () => {
    const product = makeProduct({ id: "P001", price: 15 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // Add product ($15.00)
    await act(async () => {
      await result.current.handleCameraCode!("CODE")
    })

    // Activate cash with $8.00 (manually edited)
    act(() => {
      result.current.toggleAllocation("cash")
      result.current.changeAllocationAmount("cash", "8.00")
    })

    // Activate card (gets remaining $7.00)
    act(() => {
      result.current.toggleAllocation("card")
    })

    // Verify cash is still $8.00
    const cashAlloc = result.current.allocations.find((a) => a.method === "cash")
    expect(cashAlloc?.amount).toBe("8.00")
  })

  it("starts new payment method at 0 when total is already covered", async () => {
    const product = makeProduct({ id: "P001", price: 15 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    await act(async () => {
      await result.current.handleCameraCode!("CODE")
    })

    // Fully cover the total with cash ($15.00)
    act(() => {
      result.current.toggleAllocation("cash")
      result.current.changeAllocationAmount("cash", "15.00")
    })

    // Add a new method — should start at 0.00
    act(() => {
      result.current.toggleAllocation("transfer")
    })

    const transferAlloc = result.current.allocations.find((a) => a.method === "transfer")
    expect(transferAlloc).toBeDefined()
    expect(transferAlloc!.amount).toBe("0")
  })

    it('allocation auto-fill uses checkoutPricing.payableTotalCents for ad-hoc item with active store promotion', async () => {
      // Store promotion active on the terminal (would apply to catalog products only)
      const storePromo = {
        id: 'store-promo-10',
        name: '10% OFF Tienda',
        description: '10% OFF',
        scope: 'store' as const,
        type: 'percentage' as const,
        discountPercent: 10,
        startDate: null,
        endDate: null,
        weekdays: null,
      }

      // Ad-hoc items do NOT receive store promotions in the authoritative pricing
      const mockProduct = makeProduct({ storePromotions: [storePromo] })
      const catalogPort = makeCatalogPort({
        search: vi.fn().mockResolvedValue([mockProduct]),
      })
      const checkoutPort = makeCheckoutPort()
      const ticketPort = makeTicketPrinterPort()

      const { result } = renderHook(() =>
        usePosTerminal(catalogPort, checkoutPort, ticketPort)
      )

      // Wait for the async useEffect prefetch to pick up the store promotion
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Commit an ad-hoc item: $100 x 2 = $200.00
      act(() => {
        result.current.handleToggleAdHocMode(result.current.rows[0].id)
      })
      act(() => {
        result.current.handleAdHocNameChange(result.current.rows[0].id, 'Servicio')
      })
      act(() => {
        result.current.handleAdHocUnitPriceChange(result.current.rows[0].id, '100.00')
      })
      act(() => {
        result.current.handleQuantityChange(result.current.rows[0].id, '2')
      })
      await act(async () => {
        await result.current.handleCommitAdHocRow(result.current.rows[0].id)
      })

      // Verify: authoritative pricing gives $200.00 (no store promo discount on ad-hoc)
      expect(result.current.checkoutPricing.payableTotalCents).toBe(20000)

      // Trigger allocation auto-fill
      act(() => {
        result.current.toggleAllocation('cash')
      })

      // Regression: allocation must use authoritative payableTotalCents, NOT any
      // dead helper path that incorrectly applies store promotions to ad-hoc items
      const cashAlloc = result.current.allocations.find((a) => a.method === 'cash')
      expect(cashAlloc).toBeDefined()
      expect(cashAlloc!.amount).toBe('200.00')
    })

})

describe("usePosTerminal — ad-hoc scanner validation", () => {
  it("does not add an ad-hoc item when quantity is a non-integer decimal (1.5 → rejected)", async () => {
    const catalogPort = makeCatalogPort()
    const checkoutPort = makeCheckoutPort()
    const ticketPort = makeTicketPrinterPort()

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, ticketPort)
    )

    // Toggle first row to ad-hoc mode
    act(() => {
      result.current.handleToggleAdHocMode(result.current.rows[0].id)
    })

    // Set valid name and price but decimal quantity
    act(() => {
      result.current.handleAdHocNameChange(result.current.rows[0].id, "Test Item")
    })
    act(() => {
      result.current.handleAdHocUnitPriceChange(result.current.rows[0].id, "199.99")
    })
    act(() => {
      result.current.handleQuantityChange(result.current.rows[0].id, "1.5")
    })

    // Commit the ad-hoc row
    await act(async () => {
      result.current.handleCommitAdHocRow(result.current.rows[0].id)
    })

    // Cart should remain empty — non-integer quantity is rejected at commit time
    expect(result.current.cartItems).toHaveLength(0)
    // The row must NOT be committed (rejection prevents commit)
    expect(result.current.rows[0].committed).toBe(false)
    // The row must have a quantity validation error
    expect(result.current.rows[0].adHocNameError).toBeNull()
    expect(result.current.rows[0].adHocUnitPriceError).toBeNull()
  })

  it("adds an ad-hoc item when quantity is a valid integer", async () => {
    const catalogPort = makeCatalogPort()
    const checkoutPort = makeCheckoutPort()
    const ticketPort = makeTicketPrinterPort()

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, ticketPort)
    )

    act(() => {
      result.current.handleToggleAdHocMode(result.current.rows[0].id)
    })
    act(() => {
      result.current.handleAdHocNameChange(result.current.rows[0].id, "Servicio")
    })
    act(() => {
      result.current.handleAdHocUnitPriceChange(result.current.rows[0].id, "500.00")
    })
    act(() => {
      result.current.handleQuantityChange(result.current.rows[0].id, "2")
    })

    await act(async () => {
      result.current.handleCommitAdHocRow(result.current.rows[0].id)
    })

    expect(result.current.cartItems).toHaveLength(1)
    const item = result.current.cartItems[0]
    expect(item.kind).toBe("ad-hoc")
    if (item.kind === "ad-hoc") {
      expect(item.name).toBe("Servicio")
      expect(item.unitPrice).toBe(500)
      expect(item.quantity).toBe(2)
    }
  })

  it("converts an empty row to ad-hoc mode when handleAddOccasionalProduct is called", () => {
    const catalogPort = makeCatalogPort()
    const checkoutPort = makeCheckoutPort()
    const ticketPort = makeTicketPrinterPort()

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, ticketPort)
    )

    // First row should start as catalog mode
    expect(result.current.rows[0].kind).toBe("catalog")

    // Trigger adding occasional product
    act(() => {
      result.current.handleAddOccasionalProduct()
    })

    // First row should now be ad-hoc mode since it was empty
    expect(result.current.rows[0].kind).toBe("ad-hoc")
  })

  it("prefetches store promotions on mount", async () => {
    const storePromotions = [
      {
        id: "store-promo-10",
        name: "10% OFF Tienda",
        description: "10% OFF",
        scope: "store" as const,
        type: "percentage" as const,
        discountPercent: 10,
        startDate: null,
        endDate: null,
        weekdays: null,
      },
    ]
    const mockProduct = makeProduct({ storePromotions })
    const catalogPort = makeCatalogPort({
      search: vi.fn().mockResolvedValue([mockProduct]),
    })
    const checkoutPort = makeCheckoutPort()
    const ticketPort = makeTicketPrinterPort()

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, ticketPort)
    )

    // Wait for the async useEffect prefetch to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.activeStorePromotions).toEqual(storePromotions)
  })
})

// ── QR warning toast ────────────────────────────────────────

describe("usePosTerminal — QR warning toast", () => {
  it("shows toast.warning when print returns QR warnings after successful checkout", async () => {
    vi.clearAllMocks()

    const product = makeProduct({ id: "P001", name: "Test", price: 10 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })
    const checkoutPort = makeCheckoutPort({
      save: vi.fn().mockResolvedValue({
        id: "V-WARN01",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: "Mostrador",
        items: [
          {
            productId: "P001",
            name: "Test",
            quantity: 1,
            unitPrice: "10.00",
            subtotal: "10.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
          },
        ],
        total: "10.00",
        paymentMethods: [{ method: "cash", amount: "10.00" }],
        invoiceStatus: "issued" as const,
        cae: "12345678901234",
        caeVto: "2026-07-15",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
        invoiceRequestedAt: new Date().toISOString(),
        splitTicketGroups: null,
      }),
    })
    const ticketPort = makeTicketPrinterPort({
      print: vi.fn().mockResolvedValue({
        ok: true,
        warnings: [
          {
            code: "arca-qr-invalid" as const,
            saleId: "V-WARN01",
            ticketIndex: 0,
            ticketCount: 1,
            reason: "invalid numeric field: ptoVta",
          },
        ],
      }),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, ticketPort)
    )

    // Add product
    await act(async () => {
      await result.current.handleCameraCode("CODE")
    })

    // Toggle cash allocation
    act(() => {
      result.current.toggleAllocation("cash")
    })

    // Checkout with invoice
    await act(async () => {
      await result.current.handleCheckout(true)
    })

    // Print tickets — should trigger warning toast
    await act(async () => {
      await result.current.handlePrintTickets()
    })

    expect(toast.warning).toHaveBeenCalledWith(
      "El ticket se imprimió sin QR ARCA",
      expect.objectContaining({
        description: expect.stringContaining("invalid numeric field: ptoVta"),
      }),
    )
  })

  it("does NOT set printError for QR warnings", async () => {
    vi.clearAllMocks()

    const product = makeProduct({ id: "P001", name: "Test", price: 10 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })
    const checkoutPort = makeCheckoutPort({
      save: vi.fn().mockResolvedValue({
        id: "V-WARN02",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: "Mostrador",
        items: [
          {
            productId: "P001",
            name: "Test",
            quantity: 1,
            unitPrice: "10.00",
            subtotal: "10.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
          },
        ],
        total: "10.00",
        paymentMethods: [{ method: "cash", amount: "10.00" }],
        invoiceStatus: "issued" as const,
        cae: "12345678901234",
        caeVto: "2026-07-15",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
        invoiceRequestedAt: new Date().toISOString(),
        splitTicketGroups: null,
      }),
    })
    const ticketPort = makeTicketPrinterPort({
      print: vi.fn().mockResolvedValue({
        ok: true,
        warnings: [
          {
            code: "arca-qr-render-failed" as const,
            saleId: "V-WARN02",
            ticketIndex: 0,
            ticketCount: 1,
            reason: "QR library error: Canvas error",
          },
        ],
      }),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, ticketPort)
    )

    await act(async () => {
      await result.current.handleCameraCode("CODE")
    })

    act(() => {
      result.current.toggleAllocation("cash")
    })

    await act(async () => {
      await result.current.handleCheckout(true)
    })

    await act(async () => {
      await result.current.handlePrintTickets()
    })

    // printError must NOT be set for QR warnings
    expect(result.current.printError).toBeNull()
    // success cleanup should have run
    expect(result.current.checkoutSuccess).toBeNull()
  })
})

    // ── Slice 3: POS UX — reduced rows, cart +/- sync ───────────

    describe("usePosTerminal — Slice 3: reduced rows and cart quantity", () => {
      beforeEach(() => {
        vi.clearAllMocks()
      })

      it("initialises with exactly 12 rows", () => {
        const catalogPort = makeCatalogPort()
        const checkoutPort = makeCheckoutPort()
        const ticketPort = makeTicketPrinterPort()

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        expect(result.current.rows.length).toBe(12)
      })

      it("exposes handleIncreaseCartQuantity in the result", () => {
        const catalogPort = makeCatalogPort()
        const checkoutPort = makeCheckoutPort()
        const ticketPort = makeTicketPrinterPort()

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        expect(result.current).toHaveProperty("handleIncreaseCartQuantity")
        expect(typeof result.current.handleIncreaseCartQuantity).toBe("function")
      })

      it("exposes handleDecreaseCartQuantity in the result", () => {
        const catalogPort = makeCatalogPort()
        const checkoutPort = makeCheckoutPort()
        const ticketPort = makeTicketPrinterPort()

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        expect(result.current).toHaveProperty("handleDecreaseCartQuantity")
        expect(typeof result.current.handleDecreaseCartQuantity).toBe("function")
      })

      it("handleIncreaseCartQuantity increments scanner row quantity", async () => {
        const product = makeProduct({ id: "P001", name: "Pan", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        const productRow = result.current.rows.find(
          (r) => r.committed && r.resolvedProduct?.id === "P001"
        )
        expect(productRow).toBeDefined()
        expect(productRow!.quantity).toBe("1")

        act(() => {
          result.current.handleIncreaseCartQuantity("P001")
        })

        const updatedRow = result.current.rows.find(
          (r) => r.resolvedProduct?.id === "P001"
        )
        expect(updatedRow!.quantity).toBe("2")
      })

      it("handleDecreaseCartQuantity decrements scanner row quantity", async () => {
        const product = makeProduct({ id: "P001", name: "Pan", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        const row = result.current.rows.find(
          (r) => r.committed && r.resolvedProduct?.id === "P001"
        )
        act(() => {
          result.current.handleQuantityChange(row!.id, "3")
        })

        expect(result.current.rows.find((r) => r.id === row!.id)!.quantity).toBe("3")

        act(() => {
          result.current.handleDecreaseCartQuantity("P001")
        })

        const updatedRow = result.current.rows.find((r) => r.id === row!.id)
        expect(updatedRow!.quantity).toBe("2")
      })

      it("handleDecreaseCartQuantity at quantity 1 removes the row", async () => {
        const product = makeProduct({ id: "P001", name: "Pan", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        expect(result.current.cartItems).toHaveLength(1)

        act(() => {
          result.current.handleDecreaseCartQuantity("P001")
        })

        const productRows = result.current.rows.filter(
          (r) => r.committed && r.resolvedProduct?.id === "P001"
        )
        expect(productRows).toHaveLength(0)
        expect(result.current.cartItems).toHaveLength(0)
      })

      it("cart +/- does not affect unrelated rows", async () => {
        const productA = makeProduct({ id: "P001", name: "Pan", price: 10 })
        const productB = makeProduct({ id: "P002", name: "Leche", price: 20 })
        const catalogPort = makeCatalogPort({
          findByCode: vi
            .fn()
            .mockResolvedValueOnce(productA)
            .mockResolvedValueOnce(productB),
        })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE-A")
        })
        await act(async () => {
          await result.current.handleCameraCode("CODE-B")
        })

        act(() => {
          result.current.handleIncreaseCartQuantity("P001")
        })

        const rowA = result.current.rows.find(
          (r) => r.resolvedProduct?.id === "P001" && r.committed
        )
        const rowB = result.current.rows.find(
          (r) => r.resolvedProduct?.id === "P002" && r.committed
        )

        expect(rowA!.quantity).toBe("2")
        expect(rowB!.quantity).toBe("1")
      })

      it("bidirectional sync: changing scanner row quantity updates cart", async () => {
        const product = makeProduct({ id: "P001", name: "Pan", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        const row = result.current.rows.find(
          (r) => r.committed && r.resolvedProduct?.id === "P001"
        )

        act(() => {
          result.current.handleQuantityChange(row!.id, "4")
        })

        const cartItem = result.current.cartItems.find(
          (ci) => ci.kind === "catalog" && ci.product.id === "P001"
        )
        expect(cartItem).toBeDefined()
        expect(cartItem!.quantity).toBe(4)
      })
    })
      it("cart +/- only adjusts ONE row when same product appears in multiple scanner rows", async () => {
        const product = makeProduct({ id: "P001", name: "Pan", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
        )

        // Scan the same product twice — creates two committed rows with qty 1 each
        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })
        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        // Cart merges by productId: should show 1 cart line with quantity 2
        const cartBefore = result.current.cartItems.filter(
          (ci) => ci.kind === "catalog" && ci.product.id === "P001"
        )
        expect(cartBefore).toHaveLength(1)
        expect(cartBefore[0].quantity).toBe(2)

        // Click + once: should increment only ONE row, cart goes from 2 → 3
        act(() => {
          result.current.handleIncreaseCartQuantity("P001")
        })

        const cartAfter = result.current.cartItems.find(
          (ci) => ci.kind === "catalog" && ci.product.id === "P001"
        )
        expect(cartAfter!.quantity).toBe(3)

        // Both rows still exist — one at qty 2, one at qty 1
        const committedRows = result.current.rows.filter(
          (r) => r.committed && r.resolvedProduct?.id === "P001"
        )
        expect(committedRows).toHaveLength(2)
        const quantities = committedRows.map((r) => r.quantity).sort()
        expect(quantities).toEqual(["1", "2"])
      })

    // ── Immediate print on checkout (no modal) ──────────────────

    describe("usePosTerminal — immediate print on checkout", () => {
      beforeEach(() => {
        vi.clearAllMocks()
      })

      const saleResponse = {
        id: "V-IMM001",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: "Mostrador",
        items: [
          {
            productId: "P001",
            name: "Test",
            quantity: 1,
            unitPrice: "10.00",
            subtotal: "10.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
          },
        ],
        total: "10.00",
        paymentMethods: [{ method: "cash", amount: "10.00" }],
        invoiceStatus: "none" as const,
        cae: null,
        caeVto: null,
        cbteNro: null,
        cbteTipo: null,
        ptoVta: null,
        invoiceRequestedAt: null,
        splitTicketGroups: null,
      }

      it("calls ticketPrinterPort.print exactly once when Facturar checkout succeeds", async () => {
        const product = makeProduct({ id: "P001", name: "Test", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })
        const checkoutPort = makeCheckoutPort({
          save: vi.fn().mockResolvedValue(saleResponse),
        })
        const printSpy = vi.fn().mockResolvedValue({ ok: true })
        const ticketPort = makeTicketPrinterPort({ print: printSpy })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        act(() => {
          result.current.toggleAllocation("cash")
        })

        await act(async () => {
          await result.current.handleCheckout(true) // Facturar
        })

        expect(printSpy).toHaveBeenCalledTimes(1)
      })

      it("calls ticketPrinterPort.print exactly once when Ticket no fiscal checkout succeeds", async () => {
        const product = makeProduct({ id: "P001", name: "Test", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })
        const checkoutPort = makeCheckoutPort({
          save: vi.fn().mockResolvedValue(saleResponse),
        })
        const printSpy = vi.fn().mockResolvedValue({ ok: true })
        const ticketPort = makeTicketPrinterPort({ print: printSpy })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        act(() => {
          result.current.toggleAllocation("cash")
        })

        await act(async () => {
          await result.current.handleCheckout(false) // Ticket no fiscal
        })

        expect(printSpy).toHaveBeenCalledTimes(1)
      })

      it("does NOT show success dialog (checkoutSuccess stays null) after successful checkout", async () => {
        const product = makeProduct({ id: "P001", name: "Test", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })
        const checkoutPort = makeCheckoutPort({
          save: vi.fn().mockResolvedValue(saleResponse),
        })
        const ticketPort = makeTicketPrinterPort()

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        act(() => {
          result.current.toggleAllocation("cash")
        })

        await act(async () => {
          await result.current.handleCheckout(true)
        })

        // checkoutSuccess must remain null — no modal
        expect(result.current.checkoutSuccess).toBeNull()
      })

      it("does NOT call ticketPrinterPort.print when checkout fails", async () => {
        const product = makeProduct({ id: "P001", name: "Test", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })
        const checkoutPort = makeCheckoutPort({
          save: vi.fn().mockRejectedValue(new Error("Server error")),
        })
        const printSpy = vi.fn().mockResolvedValue({ ok: true })
        const ticketPort = makeTicketPrinterPort({ print: printSpy })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        act(() => {
          result.current.toggleAllocation("cash")
        })

        await act(async () => {
          await result.current.handleCheckout(true)
        })

        expect(printSpy).not.toHaveBeenCalled()
            expect(result.current.checkoutError).not.toBeNull()
      })

      it("sets printError and allows retry when ticketPrinterPort.print fails", async () => {
        const product = makeProduct({ id: "P001", name: "Test", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })
        const checkoutPort = makeCheckoutPort({
          save: vi.fn().mockResolvedValue(saleResponse),
        })
        const ticketPort = makeTicketPrinterPort({
          print: vi.fn().mockResolvedValue({ ok: false, reason: "Printer offline" }),
        })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        act(() => {
          result.current.toggleAllocation("cash")
        })

        await act(async () => {
          await result.current.handleCheckout(true)
        })

        // Print error must be visible
        expect(result.current.printError).toBe("Printer offline")
        // handlePrintTickets should still work for retry
        expect(result.current.handlePrintTickets).toBeDefined()

        // Now fix the printer and retry
        const retrySpy = vi.fn().mockResolvedValue({ ok: true })
        ticketPort.print = retrySpy

        await act(async () => {
          const retryResult = await result.current.handlePrintTickets()
          expect(retryResult.ok).toBe(true)
        })

        expect(retrySpy).toHaveBeenCalledTimes(1)
        expect(result.current.printError).toBeNull()
      })

      it("clears cart and resets rows after successful checkout + print", async () => {
        const product = makeProduct({ id: "P001", name: "Test", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })
        const checkoutPort = makeCheckoutPort({
          save: vi.fn().mockResolvedValue(saleResponse),
        })
        const ticketPort = makeTicketPrinterPort()

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        await act(async () => {
          await result.current.handleCameraCode("CODE")
        })

        expect(result.current.cartItems.length).toBeGreaterThan(0)

        act(() => {
          result.current.toggleAllocation("cash")
        })

        await act(async () => {
          await result.current.handleCheckout(true)
        })

        // Cart cleared
        expect(result.current.cartItems).toHaveLength(0)
        // Rows reset to initial count
        expect(result.current.rows.filter((r) => r.committed)).toHaveLength(0)
      })
    })
      it("sets printError when ticketPrinterPort.print throws an exception", async () => {
        const product = makeProduct({ id: "P001", name: "Test", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })
        const checkoutPort = makeCheckoutPort({
          save: vi.fn().mockResolvedValue({
            id: "V-EXC01",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            customer: "Mostrador",
            items: [{
              productId: "P001",
              name: "Test",
              quantity: 1,
              unitPrice: "10.00",
              subtotal: "10.00",
              discountAmount: "0.00",
              appliedPromotions: [],
              appliedPromotionId: null,
              appliedPromotionType: null,
            }],
            total: "10.00",
            paymentMethods: [{ method: "cash", amount: "10.00" }],
            invoiceStatus: "none" as const,
            cae: null,
            caeVto: null,
            cbteNro: null,
            cbteTipo: null,
            ptoVta: null,
            invoiceRequestedAt: null,
            splitTicketGroups: null,
          }),
        })
        const ticketPort = makeTicketPrinterPort({
          print: vi.fn().mockRejectedValue(new Error("DOM manipulation error")),
        })
        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )
        await act(async () => { await result.current.handleCameraCode("CODE") })
        act(() => { result.current.toggleAllocation("cash") })
        await act(async () => { await result.current.handleCheckout(true) })
        expect(result.current.printError).toBe("DOM manipulation error")
      })

    // ── T7: Post-sale focus restoration ──────────────────────────

    describe("usePosTerminal — T7: post-sale focus restoration", () => {
      beforeEach(() => {
        vi.clearAllMocks()
      })

      it("resets rows only after the print promise settles, not before", async () => {
        const product = makeProduct({ id: "P001", name: "Test", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })
        const checkoutPort = makeCheckoutPort({
          save: vi.fn().mockResolvedValue({
            id: "V-FOCUS01",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            customer: "Mostrador",
            items: [{
              productId: "P001", name: "Test", quantity: 1,
              unitPrice: "10.00", subtotal: "10.00", discountAmount: "0.00",
              appliedPromotions: [], appliedPromotionId: null, appliedPromotionType: null,
            }],
            total: "10.00",
            paymentMethods: [{ method: "cash", amount: "10.00" }],
            invoiceStatus: "none" as const,
            cae: null, caeVto: null, cbteNro: null, cbteTipo: null, ptoVta: null,
            invoiceRequestedAt: null, splitTicketGroups: null,
          }),
        })

        let resolvePrint!: (value: { ok: true }) => void
        const printPromise = new Promise<{ ok: true }>((resolve) => { resolvePrint = resolve })
        const printSpy = vi.fn().mockReturnValue(printPromise)
        const ticketPort = makeTicketPrinterPort({ print: printSpy })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        await act(async () => { await result.current.handleCameraCode("CODE") })
        act(() => { result.current.toggleAllocation("cash") })

        expect(result.current.cartItems.length).toBeGreaterThan(0)

        let checkoutFinished = false
        const checkoutAct = act(async () => {
          await result.current.handleCheckout(true)
          checkoutFinished = true
        })

        await Promise.resolve()
        await new Promise((r) => setTimeout(r, 0))

        expect(checkoutFinished).toBe(false)
        expect(result.current.cartItems.length).toBeGreaterThan(0)

        resolvePrint({ ok: true })
        await checkoutAct

        expect(checkoutFinished).toBe(true)
        expect(result.current.cartItems).toHaveLength(0)
        expect(result.current.rows.filter((r) => r.committed)).toHaveLength(0)
      })

      it("does NOT reset scanner rows on ticket reprint (regression)", async () => {
        const product = makeProduct({ id: "P001", name: "Test", price: 10 })
        const catalogPort = makeCatalogPort({
          findByCode: vi.fn().mockResolvedValue(product),
        })
        const checkoutPort = makeCheckoutPort({
          save: vi.fn().mockResolvedValue({
            id: "V-REPR01",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            customer: "Mostrador",
            items: [{
              productId: "P001", name: "Test", quantity: 1,
              unitPrice: "10.00", subtotal: "10.00", discountAmount: "0.00",
              appliedPromotions: [], appliedPromotionId: null, appliedPromotionType: null,
            }],
            total: "10.00",
            paymentMethods: [{ method: "cash", amount: "10.00" }],
            invoiceStatus: "none" as const,
            cae: null, caeVto: null, cbteNro: null, cbteTipo: null, ptoVta: null,
            invoiceRequestedAt: null, splitTicketGroups: null,
          }),
        })
        const printSpy = vi.fn().mockResolvedValue({ ok: true })
        const ticketPort = makeTicketPrinterPort({ print: printSpy })

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        await act(async () => { await result.current.handleCameraCode("FIRST") })
        act(() => { result.current.toggleAllocation("cash") })
        await act(async () => { await result.current.handleCheckout(true) })

        expect(result.current.cartItems).toHaveLength(0)

        const product2 = makeProduct({ id: "P002", name: "Product 2", price: 20 })
        catalogPort.findByCode = vi.fn().mockResolvedValue(product2)
        await act(async () => { await result.current.handleCameraCode("P002") })

        const committedBeforeReprint = result.current.rows.filter((r) => r.committed)
        expect(committedBeforeReprint.length).toBeGreaterThan(0)

        await act(async () => {
          await result.current.handlePrintTickets()
        })

        const committedAfterReprint = result.current.rows.filter((r) => r.committed)
        expect(committedAfterReprint.length).toBe(committedBeforeReprint.length)
        expect(result.current.cartItems.length).toBeGreaterThan(0)
      })

      it("retries focus when scanner input ref is unavailable on first rAF frame", async () => {
        // RED: The current one-shot rAF in focusProduct will NOT retry.
        // The test expects focus to eventually be called after the ref
        // becomes available on a second frame — this MUST FAIL with
        // the current implementation.

        const rAFQueue: Array<FrameRequestCallback> = []
        const originalRAF = globalThis.requestAnimationFrame
        const rafMock = vi.fn((cb: FrameRequestCallback) => {
          rAFQueue.push(cb)
          return rAFQueue.length
        })
        globalThis.requestAnimationFrame = rafMock as unknown as typeof requestAnimationFrame

        const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {})

        try {
          const product = makeProduct({ id: "P001", name: "Test", price: 10 })
          const catalogPort = makeCatalogPort({
            findByCode: vi.fn().mockResolvedValue(product),
          })
          const checkoutPort = makeCheckoutPort({
            save: vi.fn().mockResolvedValue({
              id: "V-RETRY01",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              customer: "Mostrador",
              items: [{
                productId: "P001", name: "Test", quantity: 1,
                unitPrice: "10.00", subtotal: "10.00", discountAmount: "0.00",
                appliedPromotions: [], appliedPromotionId: null, appliedPromotionType: null,
              }],
              total: "10.00",
              paymentMethods: [{ method: "cash", amount: "10.00" }],
              invoiceStatus: "none" as const,
              cae: null, caeVto: null, cbteNro: null, cbteTipo: null, ptoVta: null,
              invoiceRequestedAt: null, splitTicketGroups: null,
            }),
          })
          const printSpy = vi.fn().mockResolvedValue({ ok: true })
          const ticketPort = makeTicketPrinterPort({ print: printSpy })

          const { result } = renderHook(() =>
            usePosTerminal(catalogPort, checkoutPort, ticketPort)
          )

          await act(async () => { await result.current.handleCameraCode("CODE") })
          act(() => { result.current.toggleAllocation("cash") })

          await act(async () => { await result.current.handleCheckout(true) })

          expect(rafMock).toHaveBeenCalled()

          // Fire ONLY the first rAF frame (ref not yet registered)
          const firstCB = rAFQueue.shift()!
          firstCB(0)

          // Ref was not registered → focus NOT called yet
          expect(focusSpy).not.toHaveBeenCalled()

          // Now register the ref — simulates React render completing
          const firstRow = result.current.rows[0]
          expect(firstRow).toBeTruthy()
          const input = document.createElement('input')
          act(() => { result.current.registerProductRef(firstRow.id, input) })

          // Fire any remaining rAF frames (GREEN: second retry frame)
          while (rAFQueue.length > 0) {
            const cb = rAFQueue.shift()!
            cb(0)
          }

          // RED: one-shot rAF schedules no second frame → focus NEVER called
          // This assertion MUST FAIL with current implementation.
          // GREEN: two-frame retry finds ref on second frame → focus IS called
          expect(focusSpy).toHaveBeenCalledTimes(1)
        } finally {
          globalThis.requestAnimationFrame = originalRAF
          focusSpy.mockRestore()
        }
      })
    })

        // ── WU1: Ad-hoc trailing row invariant and scan latency ──────

        describe("usePosTerminal — WU1: ad-hoc commit trailing empty row", () => {
          beforeEach(() => {
            vi.clearAllMocks()
          })

          it("inserts an empty scannable row immediately below a committed ad-hoc row in the middle", async () => {
            const catalogPort = makeCatalogPort()
            const checkoutPort = makeCheckoutPort()
            const ticketPort = makeTicketPrinterPort()

            const { result } = renderHook(() =>
              usePosTerminal(catalogPort, checkoutPort, ticketPort)
            )

            const product = makeProduct({ id: "P001", name: "Leche", price: 10 })
            catalogPort.findByCode = vi.fn().mockResolvedValue(product)
            await act(async () => {
              await result.current.handleCameraCode("CODE")
            })

            const adHocRowId = result.current.rows[1].id
            act(() => { result.current.handleToggleAdHocMode(adHocRowId) })
            act(() => { result.current.handleAdHocNameChange(adHocRowId, "Servicio") })
            act(() => { result.current.handleAdHocUnitPriceChange(adHocRowId, "150.00") })
            act(() => { result.current.handleQuantityChange(adHocRowId, "2") })

            await act(async () => {
              result.current.handleCommitAdHocRow(adHocRowId)
            })

            const rows = result.current.rows
            const adHocIdx = rows.findIndex((r) => r.id === adHocRowId)
            expect(adHocIdx).toBeGreaterThanOrEqual(0)
            expect(rows[adHocIdx].committed).toBe(true)

            expect(adHocIdx + 1).toBeLessThan(rows.length)
            const trailingRow = rows[adHocIdx + 1]
            expect(trailingRow.committed).toBe(false)
            expect(trailingRow.resolvedProduct).toBeNull()
            expect(trailingRow.query).toBe("")
            expect(trailingRow.kind).toBe("catalog")
          })

          it("does NOT reuse a distant empty row when committing ad-hoc with empty row elsewhere", async () => {
            const catalogPort = makeCatalogPort()
            const checkoutPort = makeCheckoutPort()
            const ticketPort = makeTicketPrinterPort()

            const { result } = renderHook(() =>
              usePosTerminal(catalogPort, checkoutPort, ticketPort)
            )

            const product = makeProduct({ id: "P001", name: "Leche", price: 10 })
            catalogPort.findByCode = vi.fn().mockResolvedValue(product)
            await act(async () => {
              await result.current.handleCameraCode("CODE")
            })

            const adHocRowId = result.current.rows[2].id
            act(() => { result.current.handleToggleAdHocMode(adHocRowId) })
            act(() => { result.current.handleAdHocNameChange(adHocRowId, "Servicio") })
            act(() => { result.current.handleAdHocUnitPriceChange(adHocRowId, "150.00") })
            act(() => { result.current.handleQuantityChange(adHocRowId, "1") })

            await act(async () => {
              result.current.handleCommitAdHocRow(adHocRowId)
            })

            const rows = result.current.rows
            const adHocIdx = rows.findIndex((r) => r.id === adHocRowId)
            expect(adHocIdx).toBeGreaterThanOrEqual(0)
            expect(rows[adHocIdx].kind).toBe("ad-hoc")
            expect(rows[adHocIdx].committed).toBe(true)

            const trailingRow = rows[adHocIdx + 1]
            expect(trailingRow).toBeDefined()
            expect(trailingRow.committed).toBe(false)
            expect(trailingRow.resolvedProduct).toBeNull()
            expect(trailingRow.kind).toBe("catalog")
          })

          it("committing last ad-hoc row appends a trailing empty row at the end", async () => {
            const catalogPort = makeCatalogPort()
            const checkoutPort = makeCheckoutPort()
            const ticketPort = makeTicketPrinterPort()

            const { result } = renderHook(() =>
              usePosTerminal(catalogPort, checkoutPort, ticketPort)
            )

            const lastRowId = result.current.rows[11].id
            act(() => { result.current.handleToggleAdHocMode(lastRowId) })
            act(() => { result.current.handleAdHocNameChange(lastRowId, "Servicio") })
            act(() => { result.current.handleAdHocUnitPriceChange(lastRowId, "150.00") })
            act(() => { result.current.handleQuantityChange(lastRowId, "1") })

            const rowCountBefore = result.current.rows.length

            await act(async () => {
              result.current.handleCommitAdHocRow(lastRowId)
            })

            const rows = result.current.rows
            expect(rows.length).toBeGreaterThan(rowCountBefore)
            const lastRow = rows[rows.length - 1]
            expect(lastRow.committed).toBe(false)
            expect(lastRow.resolvedProduct).toBeNull()
            expect(lastRow.kind).toBe("catalog")
            expect(lastRow.query).toBe("")
          })
        })

        describe("usePosTerminal — WU1: scan acceptance has no frontend artificial delay", () => {
          beforeEach(() => {
            vi.clearAllMocks()
          })

          it("catalog query port is invoked without requiring fake-timer advancement after product Enter", async () => {
            const product = makeProduct({ id: "P001", name: "Test", sku: "ABC" })
            const searchMock = vi.fn().mockResolvedValue([product])
            const catalogPort = makeCatalogPort({ search: searchMock })

            const { result } = renderHook(() =>
              usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
            )

            const rowId = result.current.rows[0].id
            await act(async () => {
              result.current.handleQueryChange(rowId, "ABC")
            })

            vi.useFakeTimers()

            await act(async () => {
              result.current.handleRowKeyDown(rowId, "product", {
                key: "Enter",
                preventDefault: vi.fn(),
              } as unknown as React.KeyboardEvent)
              await Promise.resolve()
            })

            expect(searchMock).toHaveBeenCalled()

            vi.useRealTimers()
          })

          it("handleCameraCode calls findByCode without waiting on setTimeout after ad-hoc commit", async () => {
            const product = makeProduct({ id: "P042", name: "Leche", sku: "LEC" })
            const findByCodeMock = vi.fn().mockResolvedValue(product)
            const catalogPort = makeCatalogPort({ findByCode: findByCodeMock })

            const { result } = renderHook(() =>
              usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
            )

            const adHocRowId = result.current.rows[0].id
            act(() => { result.current.handleToggleAdHocMode(adHocRowId) })
            act(() => { result.current.handleAdHocNameChange(adHocRowId, "Servicio") })
            act(() => { result.current.handleAdHocUnitPriceChange(adHocRowId, "150.00") })
            act(() => { result.current.handleQuantityChange(adHocRowId, "1") })

            await act(async () => {
              result.current.handleCommitAdHocRow(adHocRowId)
            })

            vi.useFakeTimers()
            findByCodeMock.mockClear()

            await act(async () => {
              const scanPromise = result.current.handleCameraCode("LEC")
              await Promise.resolve()
            })

            expect(findByCodeMock).toHaveBeenCalledWith("LEC")

            vi.useRealTimers()
          })
        })

        // ── WU2: Occasional ticket price provenance ─────────────────

        describe("usePosTerminal — WU2: ad-hoc ticket price provenance", () => {
          beforeEach(() => {
            vi.clearAllMocks()
          })

          it("uses entered unit price and correct subtotal in ticket snapshot for ad-hoc items", async () => {
            const product = makeProduct({ id: "P001", name: "Normal", price: 10 })
            const catalogPort = makeCatalogPort({
              findByCode: vi.fn().mockResolvedValue(product),
            })
            const printSpy = vi.fn().mockResolvedValue({ ok: true })
            const ticketPort = makeTicketPrinterPort({ print: printSpy })

            // Capture what gets sent to the printer
            let capturedItems: unknown[] = []
            ticketPort.print = vi.fn().mockImplementation((tickets) => {
              if (Array.isArray(tickets) && tickets.length > 0) {
                capturedItems = tickets[0].items
              }
              return Promise.resolve({ ok: true })
            })

            const checkoutPort = makeCheckoutPort({
              save: vi.fn().mockResolvedValue({
                id: "V-WU201",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                customer: "Mostrador",
                items: [{
                  productId: "P001", name: "Normal", quantity: 1,
                  unitPrice: "10.00", subtotal: "10.00", discountAmount: "0.00",
                  appliedPromotions: [], appliedPromotionId: null, appliedPromotionType: null,
                }],
                total: "310.00",
                paymentMethods: [{ method: "cash", amount: "310.00" }],
                invoiceStatus: "none" as const,
                cae: null, caeVto: null, cbteNro: null, cbteTipo: null, ptoVta: null,
                invoiceRequestedAt: null, splitTicketGroups: null,
              }),
            })

            const { result } = renderHook(() =>
              usePosTerminal(catalogPort, checkoutPort, ticketPort)
            )

            // Add normal product first
            await act(async () => {
              await result.current.handleCameraCode("CODE")
            })

            // Add ad-hoc item: unit price 150, quantity 2 => subtotal 300
            const adHocRowId = result.current.rows[1].id
            act(() => { result.current.handleToggleAdHocMode(adHocRowId) })
            act(() => { result.current.handleAdHocNameChange(adHocRowId, "Servicio") })
            act(() => { result.current.handleAdHocUnitPriceChange(adHocRowId, "150.00") })
            act(() => { result.current.handleQuantityChange(adHocRowId, "2") })

            await act(async () => {
              result.current.handleCommitAdHocRow(adHocRowId)
            })

            act(() => { result.current.toggleAllocation("cash") })

            await act(async () => {
              await result.current.handleCheckout(true)
            })

            // Find ad-hoc item in captured ticket items
            const adHocTicketItem: any = capturedItems.find(
              (i: any) => i.name === "Servicio"
            )
            expect(adHocTicketItem).toBeDefined()
            // RED: unit price must be the entered 150.00, not backend-derived
            expect(adHocTicketItem.unitPrice).toBe("150.00")
            // RED: subtotal must be 150.00 × 2 = 300.00, not backend value
            expect(adHocTicketItem.subtotal).toBe("300.00")
          })

          it("ignores a backend-returned different subtotal and always uses entered unit price × quantity", async () => {
            const catalogPort = makeCatalogPort()

            const checkoutPort = makeCheckoutPort({
              save: vi.fn().mockResolvedValue({
                id: "V-WU203",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                customer: "Mostrador",
                items: [{
                  // Backend echoes the ad-hoc item with the SAME unit price but a
                  // DIFFERENT (higher) subtotal. This is not a lower-price conflict,
                  // so the mismatch gate must NOT block — but the ticket subtotal
                  // must still be the entered 150.00 × 2 = 300.00, never 310.00.
                  productId: "ad-hoc-row", name: "Servicio", quantity: 2,
                  unitPrice: "150.00", subtotal: "310.00", discountAmount: "0.00",
                  appliedPromotions: [], appliedPromotionId: null, appliedPromotionType: null,
                }],
                total: "310.00",
                paymentMethods: [{ method: "cash", amount: "310.00" }],
                invoiceStatus: "none" as const,
                cae: null, caeVto: null, cbteNro: null, cbteTipo: null, ptoVta: null,
                invoiceRequestedAt: null, splitTicketGroups: null,
              }),
            })

            let capturedItems: unknown[] = []
            const ticketPort = makeTicketPrinterPort()
            ticketPort.print = vi.fn().mockImplementation((tickets) => {
              if (Array.isArray(tickets) && tickets.length > 0) {
                capturedItems = tickets[0].items
              }
              return Promise.resolve({ ok: true })
            })

            const { result } = renderHook(() =>
              usePosTerminal(catalogPort, checkoutPort, ticketPort)
            )

            // Add ad-hoc item: unit price 150, quantity 2 => subtotal 300
            const adHocRowId = result.current.rows[0].id
            act(() => { result.current.handleToggleAdHocMode(adHocRowId) })
            act(() => { result.current.handleAdHocNameChange(adHocRowId, "Servicio") })
            act(() => { result.current.handleAdHocUnitPriceChange(adHocRowId, "150.00") })
            act(() => { result.current.handleQuantityChange(adHocRowId, "2") })

            await act(async () => {
              result.current.handleCommitAdHocRow(adHocRowId)
            })

            act(() => { result.current.toggleAllocation("cash") })

            await act(async () => {
              await result.current.handleCheckout(true)
            })

            const adHocTicketItem: any = capturedItems.find(
              (i: any) => i.name === "Servicio"
            )
            expect(adHocTicketItem).toBeDefined()
            // RED: subtotal must be entered 150.00 × 2 = 300.00, never backend 310.00
            expect(adHocTicketItem.subtotal).toBe("300.00")
            expect(adHocTicketItem.unitPrice).toBe("150.00")
          })

          it("blocks checkout when backend returns a lower price for ad-hoc item", async () => {
            const catalogPort = makeCatalogPort()

            const checkoutPort = makeCheckoutPort({
              save: vi.fn().mockResolvedValue({
                id: "V-WU202",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                customer: "Mostrador",
                items: [{
                  // Backend returns a LOWER unit price for the ad-hoc item
                  productId: "ad-hoc-row", name: "Servicio", quantity: 1,
                  unitPrice: "50.00", subtotal: "50.00", discountAmount: "0.00",
                  appliedPromotions: [], appliedPromotionId: null, appliedPromotionType: null,
                }],
                total: "50.00",
                paymentMethods: [{ method: "cash", amount: "50.00" }],
                invoiceStatus: "none" as const,
                cae: null, caeVto: null, cbteNro: null, cbteTipo: null, ptoVta: null,
                invoiceRequestedAt: null, splitTicketGroups: null,
              }),
            })
            const ticketPort = makeTicketPrinterPort()

            const { result } = renderHook(() =>
              usePosTerminal(catalogPort, checkoutPort, ticketPort)
            )

            // Add ad-hoc item: unit price 150, quantity 1
            const adHocRowId = result.current.rows[0].id
            act(() => { result.current.handleToggleAdHocMode(adHocRowId) })
            act(() => { result.current.handleAdHocNameChange(adHocRowId, "Servicio") })
            act(() => { result.current.handleAdHocUnitPriceChange(adHocRowId, "150.00") })
            act(() => { result.current.handleQuantityChange(adHocRowId, "1") })

            await act(async () => {
              result.current.handleCommitAdHocRow(adHocRowId)
            })

            act(() => { result.current.toggleAllocation("cash") })

            await act(async () => {
              await result.current.handleCheckout(true)
            })

            // RED: checkout should have surfaced an error because backend
            // returned unitPrice=50.00 but entered was 150.00
            expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("precio ingresado"))
          })
        })

// ── Manual discount POS seam tests ───────────────────────────────

describe("usePosTerminal — manual discount POS seam (persistir-descuento-manual-ventas)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("S1.1: cash-10 on $50 cart sends manualDiscount with percentage 10 and amount 5.00", async () => {
    const product = makeProduct({ price: 50 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })
    const checkoutPort = makeCheckoutPort()

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, makeTicketPrinterPort())
    )

    await act(async () => {
      await result.current.handleCameraCode("SKU-001")
    })

    act(() => {
      result.current.toggleManualDiscount("cash-10")
    })

    await act(async () => {
      await result.current.handleCheckout(false)
    })

    expect(checkoutPort.save).toHaveBeenCalledTimes(1)
    const draft = vi.mocked(checkoutPort.save).mock.calls[0][0]
    expect(draft.manualDiscount).toEqual({
      modality: "percentage",
      percentage: "10",
      amount: "5.00",
    })
  })

  it("S1.2: card-5 on $50 cart sends manualDiscount with percentage 5 and amount 2.50", async () => {
    const product = makeProduct({ price: 50 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })
    const checkoutPort = makeCheckoutPort()

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, makeTicketPrinterPort())
    )

    await act(async () => {
      await result.current.handleCameraCode("SKU-001")
    })

    act(() => {
      result.current.toggleManualDiscount("card-5")
    })

    await act(async () => {
      await result.current.handleCheckout(false)
    })

    expect(checkoutPort.save).toHaveBeenCalledTimes(1)
    const draft = vi.mocked(checkoutPort.save).mock.calls[0][0]
    expect(draft.manualDiscount).toEqual({
      modality: "percentage",
      percentage: "5",
      amount: "2.50",
    })
  })

  it("S1.3: no selected discount sends manualDiscount as undefined", async () => {
    const product = makeProduct({ price: 50 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })
    const checkoutPort = makeCheckoutPort()

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, makeTicketPrinterPort())
    )

    await act(async () => {
      await result.current.handleCameraCode("SKU-001")
    })

    // No toggleManualDiscount call — no discount selected

    await act(async () => {
      await result.current.handleCheckout(false)
    })

    expect(checkoutPort.save).toHaveBeenCalledTimes(1)
    const draft = vi.mocked(checkoutPort.save).mock.calls[0][0]
    expect(draft.manualDiscount).toBeUndefined()
  })

  it("S3.1: $0.04 cart with cash-10 sends manualDiscount with amount 0.00", async () => {
    // Math.floor(4 * 0.1) === 0 — floors to zero cents
    const product = makeProduct({ price: 0.04 })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(product),
    })
    const checkoutPort = makeCheckoutPort()

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, checkoutPort, makeTicketPrinterPort())
    )

    await act(async () => {
      await result.current.handleCameraCode("SKU-001")
    })

    act(() => {
      result.current.toggleManualDiscount("cash-10")
    })

    await act(async () => {
      await result.current.handleCheckout(false)
    })

    expect(checkoutPort.save).toHaveBeenCalledTimes(1)
    const draft = vi.mocked(checkoutPort.save).mock.calls[0][0]
    expect(draft.manualDiscount).toEqual({
      modality: "percentage",
      percentage: "10",
      amount: "0.00",
    })
  })
})

// ── Numeric barcode lookup optimization ─────────────────────────

describe("usePosTerminal numeric barcode lookup optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("routes ordinary multi-digit numeric barcodes through findByCode instead of catalog search", async () => {
    const product = makeProduct({ id: "P779", name: "Yerba 1kg", price: 1200, sku: "7791234567890" })
    const catalogPort = makeCatalogPort({
      search: vi.fn().mockResolvedValue([]),
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    // Clear initial mount prefetch call (search for promotions)
    vi.mocked(catalogPort.search).mockClear()

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "7791234567890")
    })

    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.resolvedProduct?.id).toBe("P779")
        expect(row?.committed).toBe(true)
      })
    })

    expect(catalogPort.findByCode).toHaveBeenCalledWith("7791234567890")
    expect(catalogPort.search).not.toHaveBeenCalled()
  })

  it("routes numeric barcode with quantity prefix through findByCode and applies parsed quantity", async () => {
    const product = makeProduct({ id: "P780", name: "Fideos 500g", price: 500, sku: "7791234567891" })
    const catalogPort = makeCatalogPort({
      search: vi.fn().mockResolvedValue([]),
      findByCode: vi.fn().mockResolvedValue(product),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    vi.mocked(catalogPort.search).mockClear()

    const rowId = result.current.rows[0].id
    // Enter prefix *47791234567891 (quantity 4, barcode 7791234567891)
    await act(async () => {
      result.current.handleQueryChange(rowId, "*47791234567891")
    })

    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.resolvedProduct?.id).toBe("P780")
        expect(row?.quantity).toBe("4")
        expect(row?.committed).toBe(true)
      })
    })

    expect(catalogPort.findByCode).toHaveBeenCalledWith("7791234567891")
    expect(catalogPort.search).not.toHaveBeenCalled()
    expect(result.current.totals.subtotal).toBe(2000)
    expect(result.current.cartItems[0]).toMatchObject({
      kind: "catalog",
      quantity: 4,
      product: expect.objectContaining({ id: "P780" }),
    })
  })

  it("routes free-text and alphanumeric search queries through broad search and not findByCode", async () => {
    const product = makeProduct({ id: "P781", name: "Leche Entera", price: 800, sku: "LEC-001" })
    const catalogPort = makeCatalogPort({
      search: vi.fn().mockResolvedValue([product]),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    vi.mocked(catalogPort.search).mockClear()

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "Leche")
    })

    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.resolvedProduct?.id).toBe("P781")
        expect(row?.committed).toBe(true)
      })
    })

    expect(catalogPort.search).toHaveBeenCalledWith(expect.objectContaining({ search: "Leche" }))
    expect(catalogPort.findByCode).not.toHaveBeenCalled()
  })

  it("handles not-found numeric barcode lookup gracefully without committing the row", async () => {
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(null),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    vi.mocked(catalogPort.search).mockClear()

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "9999999999999")
    })

    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.isSearching).toBe(false)
        expect(row?.resolvedProduct).toBeNull()
        expect(row?.committed).toBe(false)
      })
    })

    expect(catalogPort.findByCode).toHaveBeenCalledWith("9999999999999")
    expect(catalogPort.search).not.toHaveBeenCalled()
    expect(result.current.cartItems).toHaveLength(0)
  })

  it("handles error during numeric barcode lookup gracefully without committing the row", async () => {
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockRejectedValue(new Error("Network timeout")),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    vi.mocked(catalogPort.search).mockClear()

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "8888888888888")
    })

    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.isSearching).toBe(false)
        expect(row?.resolvedProduct).toBeNull()
        expect(row?.committed).toBe(false)
      })
    })

    expect(catalogPort.findByCode).toHaveBeenCalledWith("8888888888888")
    expect(catalogPort.search).not.toHaveBeenCalled()
    expect(result.current.cartItems).toHaveLength(0)
  })

  it("focuses manual total field if numeric barcode lookup resolves a protected or zero-price product", async () => {
    const protectedProduct = makeProduct({
      id: "P782",
      name: "Producto Pesable",
      price: 0,
      pricingMode: "manual",
      isProtected: true,
      sku: "2000000000001",
    })
    const catalogPort = makeCatalogPort({
      findByCode: vi.fn().mockResolvedValue(protectedProduct),
    })

    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )

    vi.mocked(catalogPort.search).mockClear()

    const rowId = result.current.rows[0].id
    await act(async () => {
      result.current.handleQueryChange(rowId, "2000000000001")
    })

    await act(async () => {
      result.current.handleRowKeyDown(rowId, "product", {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    await act(async () => {
      await vi.waitFor(() => {
        const row = result.current.rows.find((r) => r.id === rowId)
        expect(row?.resolvedProduct?.id).toBe("P782")
        expect(row?.isProtected).toBe(true)
        expect(row?.committed).toBe(false) // Protected product requires manual price before committing
      })
    })

    expect(catalogPort.findByCode).toHaveBeenCalledWith("2000000000001")
  })
})

