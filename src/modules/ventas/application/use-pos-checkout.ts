"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { calculateTotals } from "../domain/totals"
import type { Sale } from "../domain/sale"
import type { CheckoutError } from "../domain/checkout-error"
import type { CatalogFilters, CatalogProduct, CatalogQueryPort } from "./catalog-query-port"
import type { CheckoutPort } from "./checkout-port"
import type { PaymentMethod } from "../domain/payment-method"
import type { CartItem } from "../domain/cart"

export interface UsePosCheckoutOptions {
  initialProducts?: CatalogProduct[]
  cashier?: string
  defaultPaymentMethod?: PaymentMethod
}

export interface CheckoutInput {
  items: CartItem[]
  invoiceRequested: boolean
}

export interface UsePosCheckoutResult {
  searchProducts: (filters: CatalogFilters) => Promise<CatalogProduct[]>
  paymentMethod: PaymentMethod
  setPaymentMethod: (method: PaymentMethod) => void
  checkout: (input: CheckoutInput) => Promise<Sale | null>
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    options.defaultPaymentMethod ?? "Tarjeta"
  )
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null)
  const [lastSale, setLastSale] = useState<Sale | null>(null)

  // Catalog query (used for initial load if initialProducts provided)
  const { error: catalogError } = useQuery({
    queryKey: [CATALOG_QUERY_KEY],
    queryFn: () => catalogQueryPort.search({}),
    initialData: options.initialProducts,
    enabled: false, // We search on demand via searchProducts
    staleTime: 0,
  })

  // On-demand search called by the scanner grid
  const searchProducts = useCallback(
    async (filters: CatalogFilters): Promise<CatalogProduct[]> => {
      return catalogQueryPort.search(filters)
    },
    [catalogQueryPort]
  )

  const queryClient = useQueryClient()

  const checkoutMutation = useMutation({
    mutationFn: async ({ items, invoiceRequested }: CheckoutInput): Promise<Sale> => {
      const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
      const totals = calculateTotals(subtotal)
      return checkoutPort.save({
        invoiceRequested,
        customer: "Mostrador",
        items: items.map((item) => ({
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
      setLastSale(sale)
      void queryClient.invalidateQueries({ queryKey: [CATALOG_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: ["reports"] })
    },
    onError: (error) => {
      setCheckoutError({
        code: "SERVER_ERROR",
        message: error instanceof Error ? error.message : "No se pudo completar la venta",
      })
    },
  })

  const checkout = useCallback(
    async (input: CheckoutInput): Promise<Sale | null> => {
      setCheckoutError(null)
      if (input.items.length === 0) {
        setCheckoutError({ code: "EMPTY_CART", message: "El carrito está vacío" })
        return null
      }
      try {
        return await checkoutMutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [checkoutMutation]
  )

  return {
    searchProducts,
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
