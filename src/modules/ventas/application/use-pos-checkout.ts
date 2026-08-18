"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { PaymentAllocation, Sale } from "../domain/sale"
import type { CheckoutError } from "../domain/checkout-error"
import type { CatalogFilters, CatalogProduct, CatalogQueryPort } from "./catalog-query-port"
import type { CheckoutPort, CheckoutItemDraft, SplitTicketGroupDraft, ItemSplitTicketDraft, ManualDiscountDraft } from "./checkout-port"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { CartItem } from "../domain/cart"
import { centsToDecimal, toCents } from "../domain/money"
import { manualDiscountPercentageString, type ManualDiscountCode } from "../domain/checkout-pricing"
import { validateAdHocDrafts } from "../domain/ad-hoc-item"
import type { AdHocItemDraft } from "../domain/ad-hoc-item"
import { POS_CATALOG_QUERY_KEY } from "@/shared/infrastructure/query-keys"
import { invalidatePostCheckoutQueries } from "@/shared/infrastructure/query-cache-policy"
import { triggerDesktopSync } from "@/modules/sync-status/trigger"

export interface UsePosCheckoutOptions {
  initialProducts?: CatalogProduct[]
  cashier?: string
}

export interface CheckoutManualDiscountInput {
  code: ManualDiscountCode
  amountCents: number
}

export interface CheckoutInput {
  items: CartItem[]
  invoiceRequested: boolean
  splitTicketGroups?: SplitTicketGroupDraft[]
  /** Sale total as a decimal string for client-side allocation validation */
  saleTotal: string
  /** Selected manual discount and computed amount from checkout pricing. */
  manualDiscount?: CheckoutManualDiscountInput
}

export interface UsePosCheckoutResult {
  searchProducts: (filters: CatalogFilters) => Promise<CatalogProduct[]>
  /** Current allocation drafts: one per method with amount */
  allocations: PaymentAllocation[]
  /** Add or replace an allocation for a method */
  addOrUpdateAllocation: (method: PaymentMethodCode, amount: string) => void
  /** Remove an allocation for a method */
  removeAllocation: (method: PaymentMethodCode) => void
  /** Validation and submission errors for the allocation editor */
  allocationErrors: string | null
  checkout: (input: CheckoutInput) => Promise<Sale | null>
  isCheckingOut: boolean
  catalogError: string | null
  checkoutError: CheckoutError | null
  lastSale: Sale | null
}

/**
 * Derive per-item split ticket allocation from the two split-ticket groups.
 *
 * For catalog items the lookup key is `productId`.
 * For ad-hoc items the lookup key is the scanner `rowId` (which equals `draftId`)
 * because `deriveRowBasedSplitPreview` uses `row.id` as the split-group
 * `productId` for ad-hoc rows.
 *
 * Returns `undefined` when split is not enabled or groups are missing.
 */
function derivePerItemSplit(
  groups: SplitTicketGroupDraft[] | undefined,
  lookupKey: string,
): ItemSplitTicketDraft | undefined {
  if (!groups || groups.length !== 2) return undefined
  const a = groups[0].items.find(
    (i) => i.productId === lookupKey || i.rowId === lookupKey,
  )
  const b = groups[1].items.find(
    (i) => i.productId === lookupKey || i.rowId === lookupKey,
  )
  if (!a || !b) return undefined
  return {
    group_1_quantity: a.quantity,
    group_2_quantity: b.quantity,
  }
}

// Local catalog key aliased from shared query-keys — keep in sync with POS_CATALOG_QUERY_KEY

/** Convert application-level discount input into the port draft shape. */
function buildManualDiscountDraft(
  input: CheckoutManualDiscountInput
): ManualDiscountDraft {
  return {
    modality: "percentage",
    percentage: manualDiscountPercentageString(input.code),
    amount: centsToDecimal(input.amountCents),
  }
}

/**
 * Validates that allocations are balanced against the sale total,
 * no duplicate methods exist, and at least one allocation is present.
 */
function validateAllocations(
  allocations: PaymentAllocation[],
  saleTotal: string
): string | null {
  if (allocations.length === 0) {
    return null // Empty allocations are handled by cash-default before validation
  }

  // Unique method constraint
  const seen = new Set<string>()
  for (const a of allocations) {
    if (seen.has(a.method)) {
      return "Cada método de pago solo puede usarse una vez"
    }
    seen.add(a.method)
  }

  // Sum equals total — use integer cents to avoid floating-point drift
  const sumCents = allocations.reduce((acc, a) => {
    try {
      return acc + toCents(a.amount)
    } catch {
      return acc // Invalid amounts are handled by amount-level validation
    }
  }, 0)
  const totalCents = (() => {
    try {
      return toCents(saleTotal)
    } catch {
      return null
    }
  })()

  if (totalCents === null) {
    return null // Can't validate without a valid total — let backend handle it
  }

  if (sumCents < totalCents) {
    return "El total de las asignaciones no coincide con el total de la venta"
  }

  return null
}

export function usePosCheckout(
  catalogQueryPort: CatalogQueryPort,
  checkoutPort: CheckoutPort,
  options: UsePosCheckoutOptions = {}
): UsePosCheckoutResult {
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([])
  const [allocationErrors, setAllocationErrors] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null)
  const [lastSale, setLastSale] = useState<Sale | null>(null)

  // Ref to avoid stale closures in mutationFn
  const allocationsRef = useRef(allocations)
  useEffect(() => {
    allocationsRef.current = allocations
  }, [allocations])

  const addOrUpdateAllocation = useCallback((method: PaymentMethodCode, amount: string) => {
    setAllocationErrors(null)
    setAllocations((prev) => {
      const existing = prev.find((a) => a.method === method)
      if (existing) {
        // Preserve zero/empty drafts in the UI — the X button handles removal.
        // Validation at checkout time rejects unbalanced allocations.
        return prev.map((a) => (a.method === method ? { ...a, amount } : a))
      }
      // New method: always add it so the amount input appears in the UI,
      // even when amount is empty (the user will fill it in).
      return [...prev, { method, amount }]
    })
  }, [])

  const removeAllocation = useCallback((method: PaymentMethodCode) => {
    setAllocationErrors(null)
    setAllocations((prev) => prev.filter((a) => a.method !== method))
  }, [])

  // Catalog query (used for initial load if initialProducts provided)
  const { error: catalogError } = useQuery({
    queryKey: [POS_CATALOG_QUERY_KEY],
    queryFn: () => catalogQueryPort.search({}),
    initialData: options.initialProducts,
    enabled: false, // We search on demand via searchProducts
    staleTime: 0,
  })

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
      saleTotal,
      manualDiscount,
    }: CheckoutInput): Promise<Sale> => {
      const current = allocationsRef.current

      // Compute effective allocations: default empty to cash
      const effectiveAllocations: PaymentAllocation[] =
        current.length === 0
          ? [{ method: "cash" as PaymentMethodCode, amount: saleTotal }]
          : current

      // Sync state so UI reflects auto-cash if checkout fails or stays visible
      if (current.length === 0) {
        setAllocations(effectiveAllocations)
      }

      // Validate before sending
      const error = validateAllocations(effectiveAllocations, saleTotal)
      if (error) {
        throw new Error(error)
      }

      // Validate ad-hoc items before submission
      const adHocDrafts: AdHocItemDraft[] = items
        .filter((item) => item.kind === "ad-hoc")
        .map((item) => ({
          draftId: item.draftId,
          name: item.name,
          description: item.description,
          unitPrice: item.unitPrice.toFixed(2),
          quantity: item.quantity,
        }))

      if (adHocDrafts.length > 0) {
        const adHocErrors = validateAdHocDrafts(adHocDrafts)
        if (adHocErrors.length > 0) {
          const firstError = adHocErrors[0]
          const messages: string[] = []
          if (firstError.name) messages.push(firstError.name)
          if (firstError.unitPrice) messages.push(firstError.unitPrice)
          if (firstError.quantity) messages.push(firstError.quantity)
          throw new Error(messages.join(". "))
        }
      }

      return checkoutPort.save({
        invoiceRequested,
        items: items.map((item): CheckoutItemDraft => {
          // Per-item split ticket when groups are provided and any ad-hoc item exists.
          // For ad-hoc items the lookup key is draftId (matches split-group productId
          // which is the scanner row.id). For catalog items it's the product id.
          const perItemSplit = splitTicketGroups
            ? derivePerItemSplit(
                splitTicketGroups,
                item.kind === "ad-hoc" ? item.draftId : item.product.id,
              )
            : undefined

          if (item.kind === "ad-hoc") {
            return {
              kind: "ad-hoc",
              draftId: item.draftId,
              name: item.name,
              description: item.description,
              unitPrice: item.unitPrice.toFixed(2),
              quantity: item.quantity,
              splitTicket: perItemSplit,
            }
          }
          // Catalog items: distinguish fixed vs manual
          if (item.manualLineTotal) {
            return {
              kind: "catalog-manual",
              productId: item.product.id,
              quantity: 1,
              lineTotal: item.manualLineTotal,
              splitTicket: perItemSplit,
            }
          }
          return {
            kind: "catalog-fixed",
            productId: item.product.id,
            quantity: item.quantity,
            splitTicket: perItemSplit,
          }
        }),
        paymentMethods: effectiveAllocations,
        splitTicketGroups,
        saleTotal,
        manualDiscount: manualDiscount
          ? buildManualDiscountDraft(manualDiscount)
          : undefined,
      })
    },
    onSuccess: (sale) => {
      setLastSale(sale)
      setAllocations([])

      void invalidatePostCheckoutQueries(queryClient)

      void triggerDesktopSync({ reason: "pos-checkout" })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "No se pudo completar la venta"
      // If the error looks like a validation error, show it inline
      if (
        message.includes("método de pago") ||
        message.includes("asignaciones") ||
        message.includes("total")
      ) {
        setAllocationErrors(message)
      }
      setCheckoutError({
        code: "SERVER_ERROR",
        message,
      })
    },
  })

  const checkout = useCallback(
    async (input: CheckoutInput): Promise<Sale | null> => {
      setCheckoutError(null)
      setAllocationErrors(null)

      if (input.items.length === 0) {
        setCheckoutError({ code: "EMPTY_CART", message: "El carrito está vacío" })
        return null
      }

      // Pre-flight allocation validation (also done in mutationFn)
      // Default empty allocations to cash for pre-flight check too
      const effectiveAllocations =
        allocations.length === 0
          ? [{ method: "cash" as PaymentMethodCode, amount: input.saleTotal }]
          : allocations
      const error = validateAllocations(effectiveAllocations, input.saleTotal)
      if (error) {
        setAllocationErrors(error)
        return null
      }

      try {
        return await checkoutMutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [checkoutMutation, allocations]
  )

  return {
    searchProducts,
    allocations,
    addOrUpdateAllocation,
    removeAllocation,
    allocationErrors,
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
