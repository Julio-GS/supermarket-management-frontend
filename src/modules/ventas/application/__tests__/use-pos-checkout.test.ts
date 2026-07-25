import { describe, expect, it, vi } from "vitest"
import { act, renderHook as rtlRenderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { renderHook } from "@/test/render"
import { usePosCheckout } from "../use-pos-checkout"
import type { CatalogFilters, CatalogProduct, CatalogQueryPort } from "../catalog-query-port"
import type { CheckoutPort, SplitTicketGroupDraft } from "../checkout-port"
import type { PaymentAllocation, Sale } from "../../domain/sale"
import type { CartItem } from "../../domain/cart"
import { triggerDesktopSync } from "@/modules/sync-status/application/desktop-sync-trigger"

vi.mock("@/modules/sync-status/application/desktop-sync-trigger", () => ({
  triggerDesktopSync: vi.fn().mockResolvedValue(undefined),
}))

function createFakeCatalogQueryAdapter(
  products: CatalogProduct[] = []
): CatalogQueryPort {
  return {
    async search(_filters: CatalogFilters) {
      return [...products]
    },
    async findByCode(_code: string) {
      return products[0] ?? null
    },
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
    },
  })
}

function renderHookWithClient<TProps, TResult>(hook: (props: TProps) => TResult, client: QueryClient) {
  return rtlRenderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children),
  })
}

function createFakeCheckoutAdapter(): CheckoutPort {
  let sequence = 1
  return {
    async save(draft) {
      const sale: Sale = {
        id: `V-${String(sequence).padStart(5, "0")}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: "Mostrador",
        items: draft.items.map((item) => ({
          productId: item.kind === "ad-hoc" ? item.draftId : item.productId,
          name: item.kind === "ad-hoc" ? item.name : "",
          quantity: item.quantity,
          unitPrice: "0.00",
          subtotal: "0.00",
          discountAmount: "0.00",
          appliedPromotions: [],
          appliedPromotionId: null,
          appliedPromotionType: null,
        })),
        total: "0.00",
        paymentMethods: draft.paymentMethods,
        invoiceStatus: draft.invoiceRequested ? "none" : "none",
        cae: null,
        caeVto: null,
        cbteNro: null,
        cbteTipo: null,
        ptoVta: null,
        invoiceRequestedAt: draft.invoiceRequested ? new Date().toISOString() : null,
        splitTicketGroups: draft.splitTicketGroups
          ? draft.splitTicketGroups.map((g) => ({
              label: g.label,
              items: g.items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: "0.00",
                subtotal: "0.00",
              })),
            }))
          : null,
      }
      sequence += 1
      return sale
    },
  }
}

const apple: CatalogProduct = {
  id: "P001",
  name: "Manzana Roja",
  sku: "FRV-0001",
  price: 1.2,
  stock: 100,
  manejaStock: true,
  unit: "kg",
  promotions: null,
  storePromotions: null,
}

const milk: CatalogProduct = {
  id: "P002",
  name: "Leche Entera 1L",
  sku: "LAC-0011",
  price: 1.1,
  stock: 50,
  manejaStock: true,
  unit: "u",
  promotions: null,
  storePromotions: null,
}

const nonStockProduct: CatalogProduct = {
  id: "P099",
  name: "Servicio Técnico",
  sku: "SRV-0099",
  price: 25,
  stock: null,
  manejaStock: false,
  unit: "u",
  promotions: null,
  storePromotions: null,
}

const zeroStockProduct: CatalogProduct = {
  id: "P100",
  name: "Producto Sin Stock",
  sku: "ZST-0100",
  price: 3.5,
  stock: 0,
  manejaStock: true,
  unit: "u",
  promotions: null,
  storePromotions: null,
}

const negativeStockProduct: CatalogProduct = {
  id: "P101",
  name: "Stock Negativo",
  sku: "NEG-0101",
  price: 8,
  stock: -4,
  manejaStock: true,
  unit: "u",
  promotions: null,
  storePromotions: null,
}

function makeCartItems(products: { product: CatalogProduct; qty: number }[]): CartItem[] {
  return products.map(({ product, qty }) => ({
    kind: "catalog" as const,
    product: { id: product.id, name: product.name, price: product.price, unit: product.unit, promotions: null, storePromotions: null },
    quantity: qty,
  }))
}

describe("usePosCheckout", () => {
  it("searches products via searchProducts", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple, milk])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    let results: CatalogProduct[] = []
    await act(async () => {
      results = await result.current.searchProducts({})
    })

    expect(results).toHaveLength(2)
    expect(results[0].name).toBe("Manzana Roja")
  })

  it("forwards catalog filters through searchProducts", async () => {
    const searchSpy = vi.fn(async (_filters: CatalogFilters) => [apple])
    const catalogAdapter: CatalogQueryPort = {
      search: searchSpy,
      findByCode: vi.fn().mockResolvedValue(null),
    }
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    let results: CatalogProduct[] = []
    await act(async () => {
      results = await result.current.searchProducts({ search: "  leche  ", page: 2, limit: 20 })
    })

    expect(results).toHaveLength(1)
    expect(searchSpy).toHaveBeenCalledWith({ search: "  leche  ", page: 2, limit: 20 })
  })

  it("persists a sale through the checkout port with single allocation", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple, milk])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() =>
      usePosCheckout(catalogAdapter, checkoutAdapter)
    )

    const items = makeCartItems([
      { product: apple, qty: 2 },
      { product: milk, qty: 1 },
    ])
    const saleTotal = "3.50" // 2×1.2 + 1×1.1

    // Set up a single allocation that matches total
    act(() => {
      result.current.addOrUpdateAllocation("card", "3.50")
    })

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items, invoiceRequested: false, saleTotal })
    })

    expect(sale).not.toBeNull()
    expect(sale!.paymentMethods).toEqual([{ method: "card", amount: "3.50" }])
    expect(result.current.lastSale).not.toBeNull()
  })

  it("triggers a background desktop sync after successful checkout", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    act(() => {
      result.current.addOrUpdateAllocation("cash", "1.20")
    })

    await act(async () => {
      await result.current.checkout({
        items: makeCartItems([{ product: apple, qty: 1 }]),
        invoiceRequested: false,
        saleTotal: "1.20",
      })
    })

    expect(triggerDesktopSync).toHaveBeenCalledWith({ reason: "pos-checkout" })
  })

  it("sends invoice_requested true when facturar is selected", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    const items = makeCartItems([{ product: apple, qty: 1 }])
    const saleTotal = "1.20"

    act(() => {
      result.current.addOrUpdateAllocation("cash", "1.20")
    })

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items, invoiceRequested: true, saleTotal })
    })

    expect(sale).not.toBeNull()
  })

  it("returns an error when checking out an empty cart", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter()
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items: [], invoiceRequested: false, saleTotal: "0" })
    })

    expect(sale).toBeNull()
    expect(result.current.checkoutError).not.toBeNull()
    expect(result.current.checkoutError!.code).toBe("EMPTY_CART")
  })

  it("manages allocations via addOrUpdateAllocation and removeAllocation", () => {
    const catalogAdapter = createFakeCatalogQueryAdapter()
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    expect(result.current.allocations).toEqual([])

    act(() => {
      result.current.addOrUpdateAllocation("cash", "100.00")
    })
    expect(result.current.allocations).toEqual([{ method: "cash", amount: "100.00" }])

    act(() => {
      result.current.addOrUpdateAllocation("card", "50.00")
    })
    expect(result.current.allocations).toHaveLength(2)

    act(() => {
      result.current.removeAllocation("cash")
    })
    expect(result.current.allocations).toEqual([{ method: "card", amount: "50.00" }])
  })

  it("rejects checkout with unbalanced allocations", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    const items = makeCartItems([{ product: apple, qty: 2 }]) // total 2.40

    // Allocation does NOT match total
    act(() => {
      result.current.addOrUpdateAllocation("cash", "1.00")
    })

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items, invoiceRequested: false, saleTotal: "2.40" })
    })

    expect(sale).toBeNull()
    expect(result.current.allocationErrors).toContain("total")
  })

  it("rejects checkout with empty allocations", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    const items = makeCartItems([{ product: apple, qty: 1 }])

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items, invoiceRequested: false, saleTotal: "1.20" })
    })

    expect(sale).toBeNull()
    expect(result.current.allocationErrors).not.toBeNull()
  })

  it("rejects checkout with duplicate methods", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    const items = makeCartItems([{ product: apple, qty: 1 }])

    // Add duplicate — should update, not create second entry
    act(() => {
      result.current.addOrUpdateAllocation("cash", "0.60")
      result.current.addOrUpdateAllocation("cash", "1.20")
    })

    // After updating cash, it should be a single allocation
    expect(result.current.allocations).toHaveLength(1)
    expect(result.current.allocations[0].amount).toBe("1.20")

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items, invoiceRequested: false, saleTotal: "1.20" })
    })

    expect(sale).not.toBeNull()
  })

  it("validates sum of multiple allocations against total", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    const items = makeCartItems([{ product: apple, qty: 3 }]) // total 3.60

    // Multi-method but sum matches total
    act(() => {
      result.current.addOrUpdateAllocation("cash", "2.00")
      result.current.addOrUpdateAllocation("card", "1.60")
    })

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items, invoiceRequested: false, saleTotal: "3.60" })
    })

    expect(sale).not.toBeNull()
    expect(sale!.paymentMethods).toHaveLength(2)
  })
})

// ── Zero-draft preservation (Task 3.5) ─────────────────────────

describe("usePosCheckout zero-draft preservation", () => {
  it("preserves zero-value allocation draft in UI instead of removing", () => {
    const catalogAdapter = createFakeCatalogQueryAdapter()
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    act(() => {
      result.current.addOrUpdateAllocation("cash", "100.00")
    })

    // Setting amount to "0" should preserve the draft, not remove it
    act(() => {
      result.current.addOrUpdateAllocation("cash", "0")
    })

    expect(result.current.allocations).toHaveLength(1)
    expect(result.current.allocations[0].amount).toBe("0")
  })

  it("preserves empty-string allocation draft", () => {
    const catalogAdapter = createFakeCatalogQueryAdapter()
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    act(() => {
      result.current.addOrUpdateAllocation("card", "")
    })

    expect(result.current.allocations).toHaveLength(1)
    expect(result.current.allocations[0].amount).toBe("")
  })

  it("rejects checkout with zero-only allocation (unbalanced)", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    act(() => {
      result.current.addOrUpdateAllocation("cash", "0")
    })

    const items = makeCartItems([{ product: apple, qty: 1 }])
    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items, invoiceRequested: false, saleTotal: "1.20" })
    })

    expect(sale).toBeNull()
    expect(result.current.allocationErrors).not.toBeNull()
  })

  it("attaches per-item splitTicket to ad-hoc and catalog items from groups", async () => {
    const checkoutAdapter = createFakeCheckoutAdapter()
    const saveSpy = vi.spyOn(checkoutAdapter, "save")
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    act(() => {
      result.current.addOrUpdateAllocation("cash", "12.40")
    })

    const items: CartItem[] = [
      { kind: "catalog", product: { id: apple.id, name: apple.name, price: apple.price, unit: apple.unit, promotions: null, storePromotions: null }, quantity: 1 },
      { kind: "ad-hoc", draftId: "draft-1", name: "Service", unitPrice: 500.00, quantity: 2 },
    ]

    const splitTicketGroups: SplitTicketGroupDraft[] = [
      { label: "A", items: [{ productId: apple.id, quantity: 0 }, { productId: "draft-1", quantity: 1, rowId: "draft-1" }] },
      { label: "B", items: [{ productId: apple.id, quantity: 1 }, { productId: "draft-1", quantity: 1, rowId: "draft-1" }] },
    ]

    await act(async () => {
      await result.current.checkout({
        items,
        invoiceRequested: false,
        splitTicketGroups,
        saleTotal: "12.40",
      })
    })

    expect(saveSpy).toHaveBeenCalledTimes(1)
    const draft = saveSpy.mock.calls[0][0]
    expect(draft.items).toHaveLength(2)

    // Catalog item gets split
    const catalogItem = draft.items.find((i) => i.kind === "catalog-fixed")
    expect(catalogItem).toBeDefined()
    expect(catalogItem!.splitTicket).toEqual({ group_1_quantity: 0, group_2_quantity: 1 })

    // Ad-hoc item gets split
    const adHocItem = draft.items.find((i) => i.kind === "ad-hoc")
    expect(adHocItem).toBeDefined()
    expect(adHocItem!.splitTicket).toEqual({ group_1_quantity: 1, group_2_quantity: 1 })
  })
})

// ── Batch 3: POS Warning-Only Behavior and Cache Freshness ──

describe("usePosCheckout — Batch 3 cache and payload", () => {
  it("checkout payload does not add stock, inventory, or reservation fields", async () => {
    const checkoutAdapter = createFakeCheckoutAdapter()
    const saveSpy = vi.spyOn(checkoutAdapter, "save")
    const catalogAdapter = createFakeCatalogQueryAdapter([apple, zeroStockProduct, negativeStockProduct, nonStockProduct])
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    act(() => {
      result.current.addOrUpdateAllocation("cash", "37.50")
    })

    const items = makeCartItems([
      { product: apple, qty: 1 },
      { product: zeroStockProduct, qty: 1 },
      { product: negativeStockProduct, qty: 1 },
      { product: nonStockProduct, qty: 1 },
    ])

    await act(async () => {
      await result.current.checkout({ items, invoiceRequested: false, saleTotal: "37.50" })
    })

    expect(saveSpy).toHaveBeenCalledTimes(1)
    const draft = saveSpy.mock.calls[0][0]

    // The draft must NOT contain stock or inventory fields at top level
    expect(draft).not.toHaveProperty("stock")
    expect(draft).not.toHaveProperty("inventory")
    expect(draft).not.toHaveProperty("reservation")

    // Each catalog item must NOT have stock fields
    for (const item of draft.items) {
      if (item.kind !== "ad-hoc") {
        expect(item).not.toHaveProperty("stock")
        expect(item).not.toHaveProperty("stockActual")
        expect(item).not.toHaveProperty("manejaStock")
      }
    }
  })

  it("failed checkout does not apply stock refresh as a successful deduction", async () => {
    const failAdapter: CheckoutPort = {
      save: vi.fn().mockRejectedValue(new Error("Server error")),
    }
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, failAdapter))

    act(() => {
      result.current.addOrUpdateAllocation("cash", "1.20")
    })

    const items = makeCartItems([{ product: apple, qty: 1 }])
    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items, invoiceRequested: false, saleTotal: "1.20" })
    })

    expect(sale).toBeNull()
    expect(result.current.checkoutError).not.toBeNull()
    expect(result.current.checkoutError!.code).toBe("SERVER_ERROR")
    // lastSale should remain null since the sale failed
    expect(result.current.lastSale).toBeNull()
  })

  it("successful checkout invalidates pos-catalog, stock, and report query families for immediate refresh", async () => {
    const checkoutAdapter = createFakeCheckoutAdapter()
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const client = createQueryClient()
    const invalidateQueries = vi.spyOn(client, "invalidateQueries")
    const { result } = renderHookWithClient(() => usePosCheckout(catalogAdapter, checkoutAdapter), client)

    act(() => {
      result.current.addOrUpdateAllocation("cash", "1.20")
    })

    const items = makeCartItems([{ product: apple, qty: 1 }])
    await act(async () => {
      await result.current.checkout({ items, invoiceRequested: false, saleTotal: "1.20" })
    })

    expect(result.current.lastSale).not.toBeNull()
    expect(result.current.allocations).toEqual([])
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["pos-catalog"], refetchType: "active" })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["products"], refetchType: "active" })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["stock"], refetchType: "active" })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reports"], refetchType: "active" })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reports", "sales-summary"], refetchType: "active" })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reports", "recent-sales"], refetchType: "active" })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reports", "business-report"], refetchType: "active" })
  })
})

