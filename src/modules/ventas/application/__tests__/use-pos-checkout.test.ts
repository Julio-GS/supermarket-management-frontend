import { describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import { renderHook } from "@/test/render"
import { usePosCheckout } from "../use-pos-checkout"
import type { CatalogFilters, CatalogProduct, CatalogQueryPort } from "../catalog-query-port"
import type { CheckoutPort } from "../checkout-port"
import type { Sale } from "../../domain/sale"
import type { CartItem } from "../../domain/cart"

function createFakeCatalogQueryAdapter(
  products: CatalogProduct[] = []
): CatalogQueryPort {
  return {
    async search(_filters: CatalogFilters) {
      return [...products]
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
}

const milk: CatalogProduct = {
  id: "P002",
  name: "Leche Entera 1L",
  sku: "LAC-0011",
  price: 1.1,
  stock: 50,
  unit: "u",
}

function makeCartItems(products: { product: CatalogProduct; qty: number }[]): CartItem[] {
  return products.map(({ product, qty }) => ({
    product: { id: product.id, name: product.name, price: product.price, unit: product.unit },
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

  it("persists a sale through the checkout port", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple, milk])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() =>
      usePosCheckout(catalogAdapter, checkoutAdapter)
    )

    const items = makeCartItems([
      { product: apple, qty: 2 },
      { product: milk, qty: 1 },
    ])

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items, invoiceRequested: false })
    })

    expect(sale).not.toBeNull()
    expect(sale!.paymentMethods).toEqual(["card"])
    expect(result.current.lastSale).not.toBeNull()
  })

  it("sends invoice_requested true when facturar is selected", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    const items = makeCartItems([{ product: apple, qty: 1 }])

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items, invoiceRequested: true })
    })

    expect(sale).not.toBeNull()
  })

  it("returns an error when checking out an empty cart", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter()
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout({ items: [], invoiceRequested: false })
    })

    expect(sale).toBeNull()
    expect(result.current.checkoutError).not.toBeNull()
    expect(result.current.checkoutError!.code).toBe("EMPTY_CART")
  })

  it("toggles payment methods", () => {
    const catalogAdapter = createFakeCatalogQueryAdapter()
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() =>
      usePosCheckout(catalogAdapter, checkoutAdapter, { defaultPaymentMethods: ["cash"] })
    )

    expect(result.current.paymentMethods).toEqual(["cash"])

    act(() => {
      result.current.togglePaymentMethod("card")
    })

    expect(result.current.paymentMethods).toEqual(["cash", "card"])

    act(() => {
      result.current.togglePaymentMethod("cash")
    })

    expect(result.current.paymentMethods).toEqual(["card"])
  })
})
