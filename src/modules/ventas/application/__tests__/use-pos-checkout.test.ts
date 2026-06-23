import { describe, expect, it } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHook } from "@/test/render"
import { usePosCheckout } from "../use-pos-checkout"
import type { CatalogFilters, CatalogProduct, CatalogQueryPort } from "../catalog-query-port"
import type { CheckoutPort } from "../checkout-port"
import type { Sale } from "../../domain/sale"

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
        customer: draft.customer,
        items: draft.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: draft.subtotal,
        vat: draft.vat,
        total: draft.total,
        paymentMethod: draft.paymentMethod,
        cashier: draft.cashier,
        id: `V-${String(sequence).padStart(5, "0")}`,
        date: new Date().toISOString(),
      }
      sequence += 1
      return sale
    },
  }
}

const apple: CatalogProduct = {
  id: "P001",
  name: "Manzana Roja",
  category: "Frutas y Verduras",
  sku: "FRV-0001",
  price: 1.2,
  stock: 100,
  unit: "kg",
}

const milk: CatalogProduct = {
  id: "P002",
  name: "Leche Entera 1L",
  category: "Lácteos",
  sku: "LAC-0011",
  price: 1.1,
  stock: 50,
  unit: "u",
}

describe("usePosCheckout", () => {
  it("initializes with optional initial products", () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple, milk])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() =>
      usePosCheckout(catalogAdapter, checkoutAdapter, { initialProducts: [apple] })
    )

    expect(result.current.products).toHaveLength(1)
    expect(result.current.products[0].name).toBe("Manzana Roja")
    expect(result.current.cart.items).toHaveLength(0)
  })

  it("loads products from the catalog port when refresh is called", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple, milk])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    expect(result.current.products).toHaveLength(0)

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(result.current.products).toHaveLength(2))
  })

  it("filters products by search and category", () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple, milk])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() =>
      usePosCheckout(catalogAdapter, checkoutAdapter, { initialProducts: [apple, milk] })
    )

    act(() => {
      result.current.applyFilters({ search: "leche" })
    })

    expect(result.current.products).toHaveLength(1)
    expect(result.current.products[0].name).toBe("Leche Entera 1L")

    act(() => {
      result.current.applyFilters({ search: "FRV-0001" })
    })

    expect(result.current.products).toHaveLength(1)
    expect(result.current.products[0].name).toBe("Manzana Roja")

    act(() => {
      result.current.applyFilters({ category: "Frutas y Verduras" })
    })

    expect(result.current.products).toHaveLength(1)
    expect(result.current.products[0].name).toBe("Manzana Roja")
  })

  it("adds items to the cart", () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() =>
      usePosCheckout(catalogAdapter, checkoutAdapter, { initialProducts: [apple] })
    )

    act(() => {
      result.current.addItem(apple, 2)
    })

    expect(result.current.cart.items).toHaveLength(1)
    expect(result.current.cart.items[0].quantity).toBe(2)
    expect(result.current.totals.subtotal).toBe(2.4)
  })

  it("changes quantity and removes items", () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() =>
      usePosCheckout(catalogAdapter, checkoutAdapter, { initialProducts: [apple] })
    )

    act(() => {
      result.current.addItem(apple, 3)
    })

    act(() => {
      result.current.changeQuantity(apple.id, -1)
    })

    expect(result.current.cart.items[0].quantity).toBe(2)

    act(() => {
      result.current.removeItem(apple.id)
    })

    expect(result.current.cart.items).toHaveLength(0)
  })

  it("persists a sale through the checkout port", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple, milk])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() =>
      usePosCheckout(catalogAdapter, checkoutAdapter, {
        initialProducts: [apple, milk],
        cashier: "Ana López",
      })
    )

    act(() => {
      result.current.addItem(apple, 2)
      result.current.addItem(milk, 1)
    })

    const expectedTotal = result.current.totals.total

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout(false)
    })

    expect(sale).not.toBeNull()
    expect(sale!.total).toBe(expectedTotal)
    expect(sale!.paymentMethod).toBe("Tarjeta")
    expect(sale!.cashier).toBe("Ana López")
    expect(result.current.cart.items).toHaveLength(0)
    expect(result.current.lastSale).not.toBeNull()
  })

  it("sends invoice_requested true when facturar is selected", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter([apple])
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() =>
      usePosCheckout(catalogAdapter, checkoutAdapter, { initialProducts: [apple] })
    )

    act(() => {
      result.current.addItem(apple, 1)
    })

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout(true)
    })

    expect(sale).not.toBeNull()
  })

  it("returns an error when checking out an empty cart", async () => {
    const catalogAdapter = createFakeCatalogQueryAdapter()
    const checkoutAdapter = createFakeCheckoutAdapter()
    const { result } = renderHook(() => usePosCheckout(catalogAdapter, checkoutAdapter))

    let sale: Sale | null = null
    await act(async () => {
      sale = await result.current.checkout(false)
    })

    expect(sale).toBeNull()
    expect(result.current.checkoutError).not.toBeNull()
    expect(result.current.checkoutError!.code).toBe("EMPTY_CART")
  })
})
