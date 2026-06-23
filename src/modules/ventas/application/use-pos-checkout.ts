"use client"

import { useCallback, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { matchesProductSearch } from "@/modules/productos"
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
  checkout: (invoiceRequested: boolean) => Promise<Sale | null>
  isCheckingOut: boolean
  catalogError: string | null
  checkoutError: CheckoutError | null
  lastSale: Sale | null
}

const CATALOG_QUERY_KEY = "pos-catalog"

export function usePosCheckout(
  catalogQueryPort: CatalogQueryPort,
  checkoutPort: CheckoutPort,
  options: UsePosCheckoutOptions = {}
): UsePosCheckoutResult {
  const [filters, setFilters] = useState<CatalogFilters>({})
  const [filtersApplied, setFiltersApplied] = useState(() => options.initialProducts === undefined)
  const [cart, setCart] = useState<Cart>(emptyCart)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    options.defaultPaymentMethod ?? "Tarjeta"
  )
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null)
  const [lastSale, setLastSale] = useState<Sale | null>(null)

  const {
    data: products = [],
    isLoading,
    error: catalogError,
    refetch,
  } = useQuery({
    queryKey: [CATALOG_QUERY_KEY, filters],
    queryFn: () => catalogQueryPort.search(filters),
    initialData: options.initialProducts,
    enabled: filtersApplied,
  })

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = !filters.search || matchesProductSearch(product, filters.search)
      const matchesCategory =
        !filters.category || filters.category === "Todas" || product.category === filters.category
      return matchesSearch && matchesCategory
    })
  }, [products, filters])

  const applyFilters = useCallback(
    (nextFilters: CatalogFilters) => {
      setFilters(nextFilters)
      if (!filtersApplied) {
        setFiltersApplied(true)
      }
    },
    [filtersApplied]
  )

  const refresh = useCallback(async () => {
    if (!filtersApplied) {
      setFiltersApplied(true)
    }
    await refetch()
  }, [filtersApplied, refetch])

  const addItemCallback = useCallback(
    (product: CatalogProduct, quantity = 1) => {
      const cartProduct = {
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
      }
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

  const checkoutMutation = useMutation({
    mutationFn: async (invoiceRequested: boolean): Promise<Sale> => {
      return checkoutPort.save({
        invoiceRequested,
        customer: "Mostrador",
        items: cart.items.map((item) => ({
          productId: item.product.id,
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
    },
    onSuccess: (sale) => {
      setCart(emptyCart)
      setLastSale(sale)
    },
    onError: (error) => {
      setCheckoutError({
        code: "SERVER_ERROR",
        message: error instanceof Error ? error.message : "No se pudo completar la venta",
      })
    },
  })

  const checkout = useCallback(
    async (invoiceRequested: boolean) => {
      setCheckoutError(null)
      if (cart.items.length === 0) {
        setCheckoutError({ code: "EMPTY_CART", message: "El carrito está vacío" })
        return null
      }
      try {
        return await checkoutMutation.mutateAsync(invoiceRequested)
      } catch {
        return null
      }
    },
    [cart, checkoutMutation]
  )

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
    isCheckingOut: checkoutMutation.isPending,
    catalogError: catalogError
      ? catalogError instanceof Error
        ? catalogError.message
        : "Failed to load catalog"
      : null,
    checkoutError,
    lastSale,
  }
}
