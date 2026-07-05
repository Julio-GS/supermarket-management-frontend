"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Sale } from "../domain/sale"
import type { CheckoutError } from "../domain/checkout-error"
import type { CatalogFilters, CatalogProduct, CatalogQueryPort } from "./catalog-query-port"
import type { CheckoutPort, SplitTicketGroupDraft } from "./checkout-port"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { CartItem } from "../domain/cart"

export interface UsePosCheckoutOptions {
  initialProducts?: CatalogProduct[]
  cashier?: string
  /** Single default payment method — exactly one is pre-selected. */
  defaultPaymentMethod?: PaymentMethodCode
}

export interface CheckoutInput {
  items: CartItem[]
  invoiceRequested: boolean
  splitTicketGroups?: SplitTicketGroupDraft[]
}

export interface UsePosCheckoutResult {
  searchProducts: (filters: CatalogFilters) => Promise<CatalogProduct[]>
  /** Exactly one selected payment method, or null if none picked yet. */
  selectedPaymentMethod: PaymentMethodCode | null
  /** Selects exactly one payment method; deselects the previous one. */
  selectPaymentMethod: (method: PaymentMethodCode) => void
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodCode | null>(
    options.defaultPaymentMethod ?? "card"
  )
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null)
  const [lastSale, setLastSale] = useState<Sale | null>(null)

  const selectPaymentMethod = useCallback((method: PaymentMethodCode) => {
    setSelectedPaymentMethod(method)
  }, [])

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
    mutationFn: async ({
      items,
      invoiceRequested,
      splitTicketGroups,
    }: CheckoutInput): Promise<Sale> => {
      return checkoutPort.save({
        invoiceRequested,
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        paymentMethods: selectedPaymentMethod ? [selectedPaymentMethod] : [],
        splitTicketGroups,
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
      if (!selectedPaymentMethod) {
        setCheckoutError({
          code: "EMPTY_CART",
          message: "Seleccione un método de pago",
        })
        return null
      }
      try {
        return await checkoutMutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [checkoutMutation, selectedPaymentMethod]
  )

  return {
    searchProducts,
    selectedPaymentMethod,
    selectPaymentMethod,
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
