import { describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import { renderHook } from "@/test/render"
import { usePosCheckout } from "../use-pos-checkout"
import type { CatalogFilters, CatalogProduct, CatalogQueryPort } from "../catalog-query-port"
import type { CheckoutPort } from "../checkout-port"
import type { PaymentAllocation, Sale } from "../../domain/sale"
import type { CartItem } from "../../domain/cart"

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
          productId: item.productId,
          name: "",
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
  unit: "u",
  promotions: null,
  storePromotions: null,
}

function makeCartItems(products: { product: CatalogProduct; qty: number }[]): CartItem[] {
  return products.map(({ product, qty }) => ({
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
