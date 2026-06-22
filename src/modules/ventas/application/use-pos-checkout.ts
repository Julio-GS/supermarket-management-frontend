"use client"

import { useCallback, useMemo, useState } from "react"
import { emptyCart, addItem, changeQuantity, removeItem, type Cart } from "../domain/cart"
import type { PaymentMethod } from "../domain/payment-method"
import { calculateTotals } from "../domain/totals"
import type { Sale } from "../domain/sale"
import type { CheckoutError } from "../domain/checkout-error"
import type { CatalogFilters, CatalogProduct, CatalogQueryPort } from "./catalog-query-port"
import type { CheckoutPort } from "./checkout-port"

export interface UsePosCheckoutOptions {
  initialProducts?: CatalogProduct[]
  cashier?: string
  defaultPaymentMethod?: PaymentMethod
}

export interface UsePosCheckoutResult {
  products: CatalogProduct[]
  filters: CatalogFilters
  applyFilters: (filters: CatalogFilters) => void
  refresh: () => Promise<void>
  cart: Cart
  addItem: (product: CatalogProduct, quantity?: number) => void
  changeQuantity: (productId: string, delta: number) => void
  removeItem: (productId: string) => void
  totals: { subtotal: number; vat: number; total: number }
  paymentMethod: PaymentMethod
  setPaymentMethod: (method: PaymentMethod) => void
  checkout: () => Promise<Sale | null>
  isCheckingOut: boolean
  checkoutError: CheckoutError | null
  lastSale: Sale | null
}

export function usePosCheckout(
  catalogQueryPort: CatalogQueryPort,
  checkoutPort: CheckoutPort,
  options: UsePosCheckoutOptions = {}
): UsePosCheckoutResult {
  const [products, setProducts] = useState<CatalogProduct[]>(options.initialProducts ?? [])
  const [filters, setFilters] = useState<CatalogFilters>({})
  const [cart, setCart] = useState<Cart>(emptyCart)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    options.defaultPaymentMethod ?? "Tarjeta"
  )
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null)
  const [lastSale, setLastSale] = useState<Sale | null>(null)

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        !filters.search ||
        product.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.sku.toLowerCase().includes(filters.search.toLowerCase())
      const matchesCategory =
        !filters.category || filters.category === "Todas" || product.category === filters.category
      return matchesSearch && matchesCategory
    })
  }, [products, filters])

  const load = useCallback(
    async (activeFilters: CatalogFilters) => {
      const result = await catalogQueryPort.search(activeFilters)
      setProducts(result)
    },
    [catalogQueryPort]
  )

  const applyFilters = useCallback((nextFilters: CatalogFilters) => {
    setFilters(nextFilters)
  }, [])

  const refresh = useCallback(() => load(filters), [load, filters])

  const addItemCallback = useCallback(
    (product: CatalogProduct, quantity = 1) => {
      const cartProduct = { id: product.id, name: product.name, price: product.price, unit: product.unit }
      setCart((prev) => addItem(prev, cartProduct, quantity))
    },
    []
  )

  const changeQuantityCallback = useCallback((productId: string, delta: number) => {
    setCart((prev) => changeQuantity(prev, productId, delta))
  }, [])

  const removeItemCallback = useCallback((productId: string) => {
    setCart((prev) => removeItem(prev, productId))
  }, [])

  const totals = useMemo(() => {
    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    )
    return calculateTotals(subtotal)
  }, [cart])

  const checkout = useCallback(async () => {
    setCheckoutError(null)
    if (cart.items.length === 0) {
      setCheckoutError({ code: "EMPTY_CART", message: "El carrito está vacío" })
      return null
    }
    setIsCheckingOut(true)
    try {
      const sale = await checkoutPort.save({
        customer: "Mostrador",
        items: cart.items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
        })),
        subtotal: totals.subtotal,
        vat: totals.vat,
        total: totals.total,
        paymentMethod,
        cashier: options.cashier ?? "Cajero",
      })
      setCart(emptyCart)
      setLastSale(sale)
      return sale
    } catch (error) {
      setCheckoutError({
        code: "EMPTY_CART",
        message: error instanceof Error ? error.message : "No se pudo completar la venta",
      })
      return null
    } finally {
      setIsCheckingOut(false)
    }
  }, [cart, checkoutPort, options.cashier, paymentMethod, totals])

  return {
    products: filteredProducts,
    filters,
    applyFilters,
    refresh,
    cart,
    addItem: addItemCallback,
    changeQuantity: changeQuantityCallback,
    removeItem: removeItemCallback,
    totals,
    paymentMethod,
    setPaymentMethod,
    checkout,
    isCheckingOut,
    checkoutError,
    lastSale,
  }
}
