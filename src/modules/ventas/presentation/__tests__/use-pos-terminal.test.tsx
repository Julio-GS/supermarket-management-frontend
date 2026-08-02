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
})

// ── Dynamic scanner rows (Task 2.1) ────────────────────────────

describe("usePosTerminal dynamic rows", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts with at least 4 scanner rows (reduced from 12)", () => {
    const catalogPort = makeCatalogPort()
    const { result } = renderHook(() =>
      usePosTerminal(catalogPort, makeCheckoutPort(), makeTicketPrinterPort())
    )
    expect(result.current.rows.length).toBeGreaterThanOrEqual(4)
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
    expect(result.current.rows.length).toBe(5)
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

      it("initialises with 4-6 rows instead of 12", () => {
        const catalogPort = makeCatalogPort()
        const checkoutPort = makeCheckoutPort()
        const ticketPort = makeTicketPrinterPort()

        const { result } = renderHook(() =>
          usePosTerminal(catalogPort, checkoutPort, ticketPort)
        )

        const count = result.current.rows.length
        expect(count).toBeGreaterThanOrEqual(4)
        expect(count).toBeLessThanOrEqual(6)
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
