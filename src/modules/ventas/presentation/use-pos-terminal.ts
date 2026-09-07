import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS } from "../domain/payment-method"
import { calculateTotals } from "../domain/totals"
import { toCents, centsToDecimal, computeRemainingCents } from "../domain/money"
import { calculateCheckoutPricing } from "../domain/checkout-pricing"
import type { ManualDiscountCode } from "../domain/checkout-pricing"
import { validateSplitGroups } from "../domain/split-validator"
import { deriveRowBasedSplitPreview, type SplitItemGroup, type RowSplitEntry } from "../domain/default-split"
import { buildPrintableTickets, checkFiscalFields, FISCAL_REQUIRED_FIELDS } from "../domain/ticket-builder"
import { usePosCheckout } from "../application/use-pos-checkout"
import type { SplitTicketGroupDraft } from "../application/checkout-port"
import type { CatalogProduct, CatalogQueryPort } from "../application/catalog-query-port"
import type { CheckoutPort } from "../application/checkout-port"
import type { TicketPrinterPort } from "../application/ticket-printer-port"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { PaymentAllocation, Sale, AppliedPromotion } from "../domain/sale"
import type { CartItem, CartProduct } from "../domain/cart"
import type { CheckoutTicketSnapshot, TicketItemLine } from "../domain/ticket"
import type { CameraScanResult } from "./pos-camera-scanner"
import {
  isNumericBarcode,
  parseScannerEntry,
  resolveArrowTarget,
  resolveArrowSideTarget,
  resolveTabTarget,
  resolveShiftTabTarget,
  resolveScannerExit,
  resolveScannerExitLateral,
  type ScannerField,
} from "./scanner-keyboard"

import {
  addOrConvertFirstAvailableAdHocRow,
  applyResolvedCatalogProduct,
  buildCartFromScannerRows,
  clearRowsForProduct as clearProductRows,
  clearScannerRow,
  commitAdHocRowWithTrailingEmpty,
  commitResolvedCatalogRow,
  decreaseCartQuantity,
  increaseCartQuantity,
  initializeScannerRows,
  makeEmptyScannerRow,
  selectCandidate,
  toggleAdHocMode,
  updateAdHocDraftField,
  updateManualLineTotal,
  updateRowQuantity,
  updateRowQuery,
  type ScannerRow,
} from "./pos-row-state"

/** Checks whether a code string matches the special 1–9 pattern. */
function isSpecialCode(query: string): boolean {
  return /^[1-9]$/.test(query.trim())
}

export interface UsePosTerminalOptions {
  initialProducts?: CatalogProduct[]
  /**
   * Called just before focus is moved to the payment panel.
   * In mobile layouts, the consumer uses this to switch to the cart tab
   * so the payment buttons are visible before focus is applied.
   */
  onExitToPayment?: () => void
}

export type { ScannerRow } from "./pos-row-state"

/**
 * Snapshot of a successful checkout, persisted so the success dialog can
 * render after cart rows are already cleared.
 */
export interface PosCheckoutSuccess {
  saleId: string
  saleDate: string
  total: string
  paymentMethods: PaymentAllocation[]
  invoiceStatus: Sale["invoiceStatus"]
  isSplit: boolean
  splitGroups?: SplitTicketGroupDraft[]
  /** Cart items captured at checkout time (before cart reset) for ticket rendering */
  items: TicketItemLine[]
  /** Eager fiscal validation — non-null when invoice is "issued" but fiscal fields are missing */
  fiscalError: string | null
  /** Fiscal fields from the Sale — null when not invoiced */
  cae: string | null
  caeVto: string | null
  cbteNro: string | null
  cbteTipo: string | null
  ptoVta: string | null
  /** Manual discount code applied at checkout (null if none) */
  manualDiscount: ManualDiscountCode | null
  /** Manual discount amount in cents */
  manualDiscountCents: number
}

/**
 * Eager fiscal validation for the success dialog.
 * Uses the centralized checkFiscalFields from the domain layer to avoid
 * UI/domain drift.
 *
 * Returns an error message string when invoice is "issued" and any
 * AFIP-mandatory field is null or empty, so the dialog can disable
 * the print button before the user clicks it.
 */
function computeFiscalError(sale: Sale): string | null {
  if (sale.invoiceStatus !== "issued") return null

  const fiscalFields: Record<string, string | null> = {}
  for (const field of FISCAL_REQUIRED_FIELDS) {
    fiscalFields[field] = sale[field] as string | null
  }

  const missing = checkFiscalFields(fiscalFields)
  if (missing.length === 0) return null

  // Map English field names to Spanish for UI display
  const fieldLabels: Record<string, string> = {
    cae: "CAE",
    caeVto: "Vto. CAE",
    cbteNro: "Nro. comprobante",
    cbteTipo: "Tipo comprobante",
    ptoVta: "Punto de venta",
  }
  const labels = missing.map((f) => fieldLabels[f] ?? f)
  return `Faltan campos fiscales: ${labels.join(", ")}`
}

export interface UsePosTerminalResult {
  rows: ScannerRow[]
  cartItems: CartItem[]
  totals: ReturnType<typeof calculateTotals>
  /** IDs of products currently in the cart — for scanner in-cart indicators */
  cartProductIds: Set<string>
  /** Current allocation drafts */
  allocations: PaymentAllocation[]
  /** Toggle a method on/off in allocations */
  toggleAllocation: (method: PaymentMethodCode) => void
  /** Update the amount for a method */
  changeAllocationAmount: (method: PaymentMethodCode, amount: string) => void
  /** Validation errors for allocations */
  allocationErrors: string | null
  /** Split-ticket preview computed from the shared domain helper */
  splitPreview: ReturnType<typeof deriveRowBasedSplitPreview> | null
  splitEnabled: boolean
  /** Row index where Group B starts; rows before this → A, rows at/after → B */
  splitAnchorIndex: number
  toggleSplit: () => void
  splitErrors: string | null
  isCheckingOut: boolean
  catalogError: string | null
  checkoutError: ReturnType<typeof usePosCheckout>["checkoutError"]
  lastSale: ReturnType<typeof usePosCheckout>["lastSale"]
  /** Centralized checkout pricing from domain helper */
  checkoutPricing: ReturnType<typeof calculateCheckoutPricing>
  /** Selected manual discount code (null = none) */
  selectedManualDiscount: ManualDiscountCode | null
  /** Toggle a manual discount on/off */
  toggleManualDiscount: (code: ManualDiscountCode) => void
  /** Snapshot persisted after success so dialog renders after cart reset */
  checkoutSuccess: PosCheckoutSuccess | null
  /** Closes the success dialog and resets for next sale */
  handleDismissSuccess: () => void
  /** Print tickets from the current checkout success snapshot */
  handlePrintTickets: () => Promise<{ ok: true } | { ok: false; reason: string }>
  /** Latest print error for the success dialog to display */
  printError: string | null
  /** Whether a print operation is in progress */
  isPrinting: boolean
  registerProductRef: (rowId: string, el: HTMLInputElement | null) => void
  registerQuantityRef: (rowId: string, el: HTMLInputElement | null) => void
  registerManualTotalRef: (rowId: string, el: HTMLInputElement | null) => void
  handleQueryChange: (rowId: string, value: string) => void
  handleRowKeyDown: (rowId: string, field: ScannerField, e: React.KeyboardEvent) => void
  handleSelectCandidate: (rowId: string, product: CatalogProduct) => void
  handleQuantityChange: (rowId: string, value: string) => void
  handleClearRow: (rowId: string) => void
  clearRowsForProduct: (productId: string) => void
  handleRemoveFromResultsGrid: (productId: string, rowId?: string) => void
  /** Increase cart item quantity — for rowId-based items targets the specific row, for product-based items increments only the first matching row. */
  handleIncreaseCartQuantity: (productId: string, rowId?: string) => void
  /** Decrease cart item quantity — for rowId-based items targets the specific row, for product-based items decrements only the first matching row. */
  handleDecreaseCartQuantity: (productId: string, rowId?: string) => void
  /** Update manual line total for a special protected row and validate. */
  handleManualTotalChange: (rowId: string, value: string) => void
  /** Toggle a scanner row between catalog and ad-hoc mode. */
  handleToggleAdHocMode: (rowId: string) => void
  /** Add a new occasional product row or convert first empty row to occasional mode. */
  handleAddOccasionalProduct: () => void
  /** Update the ad-hoc item name. */
  handleAdHocNameChange: (rowId: string, value: string) => void
  /** Update the ad-hoc unit price. */
  handleAdHocUnitPriceChange: (rowId: string, value: string) => void
  /** Update the ad-hoc optional description. */
  handleAdHocDescriptionChange: (rowId: string, value: string) => void
  /** Commit an ad-hoc row after validation. */
  handleCommitAdHocRow: (rowId: string) => void
  removeAllocationMethod: (method: PaymentMethodCode) => void
  handleCheckout: (invoiceRequested: boolean) => Promise<void>
  /** Camera barcode handoff: resolves the code and commits a qty-1 row */
  handleCameraCode: (code: string) => Promise<CameraScanResult>
  /** Focus the first available (non-committed) scanner row — used after camera close */
  focusFirstAvailableRow: () => void
  /** Focus the first payment method button — used after scanner exit */
  focusFirstPaymentMethod: () => void
  /** Register a ref for a payment method button for focus management */
  registerPaymentMethodRef: (method: PaymentMethodCode, el: HTMLButtonElement | null) => void
  /** Currently active store promotions fetched from resolved products */
  activeStorePromotions: CartProduct["storePromotions"]
}

export function usePosTerminal(
  catalogQueryPort: CatalogQueryPort,
  checkoutPort: CheckoutPort,
  ticketPrinterPort: TicketPrinterPort,
  options: UsePosTerminalOptions = {}
): UsePosTerminalResult {
  const {
    searchProducts,
    allocations,
    addOrUpdateAllocation,
    removeAllocation,
    allocationErrors,
    checkout,
    isCheckingOut,
    catalogError,
    checkoutError,
    lastSale,
  } = usePosCheckout(catalogQueryPort, checkoutPort, { initialProducts: options.initialProducts })

  const [rows, setRows] = useState<ScannerRow[]>(initializeScannerRows)
  const firstRowIdRef = useRef<string | undefined>(initializeScannerRows()[0]?.id)
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [splitAnchorIndex, setSplitAnchorIndex] = useState<number>(0)
  const [splitErrors, setSplitErrors] = useState<string | null>(null)
  const [checkoutSuccess, setCheckoutSuccess] = useState<PosCheckoutSuccess | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const [selectedManualDiscount, setSelectedManualDiscount] = useState<ManualDiscountCode | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  const [prefetchedStorePromotions, setPrefetchedStorePromotions] = useState<CartProduct["storePromotions"]>(() => {
    for (const p of options.initialProducts ?? []) {
      if (p.storePromotions && p.storePromotions.length > 0) {
        return p.storePromotions
      }
    }
    return null
  })

  const activeStorePromotions = useMemo<CartProduct["storePromotions"]>(() => {
    for (const row of rows) {
      if (row.resolvedProduct?.storePromotions && row.resolvedProduct.storePromotions.length > 0) {
        return row.resolvedProduct.storePromotions
      }
    }

    return prefetchedStorePromotions
  }, [prefetchedStorePromotions, rows])

  useEffect(() => {
    let active = true
    catalogQueryPort.search({ limit: 1 })
      .then((products) => {
        if (active && products.length > 0 && products[0].storePromotions) {
          setPrefetchedStorePromotions(products[0].storePromotions)
        }
      })
      .catch((err) => {
        console.error("Failed to prefetch store promotions:", err)
      })
    return () => {
      active = false
    }
  }, [catalogQueryPort])

  // Track which payment methods have already received their first-time
  // auto-fill so revisiting them does not recalculate.
  const firstSelectedMethods = useRef<Set<PaymentMethodCode>>(new Set())

  // Refs for payment method buttons so the scanner can hand off focus.
  const paymentMethodRefs = useRef<Record<PaymentMethodCode, HTMLButtonElement | null>>({
    cash: null,
    transfer: null,
    card: null,
    qr: null,
  })

  // Stable ref for the onExitToPayment callback — avoids stale closure in focusFirstPaymentMethod.
  const onExitToPaymentRef = useRef(options.onExitToPayment)
  useEffect(() => {
    onExitToPaymentRef.current = options.onExitToPayment
  }, [options.onExitToPayment])

  const cart = useMemo(() => buildCartFromScannerRows(rows), [rows])
  const cartItems = cart.items

  const checkoutPricing = useMemo(
    () => calculateCheckoutPricing({ items: cartItems, activeStorePromotions, manualDiscount: selectedManualDiscount }),
    [cartItems, activeStorePromotions, selectedManualDiscount]
  )

  const cartProductIds = useMemo(
    () => new Set(cartItems.filter((ci) => ci.kind === "catalog").map((ci) => ci.product.id)),
    [cartItems]
  )

  const totals = useMemo(
    () =>
      calculateTotals(
        cartItems.reduce((sum, i) => {
          if (i.kind === "ad-hoc") {
            return sum + i.unitPrice * i.quantity
          }
          // Special catalog items: use manualLineTotal converted to cents
          if (i.manualLineTotal) {
            return sum + toCents(i.manualLineTotal) / 100
          }
          // Normal catalog items: price × quantity
          return sum + i.product.price * i.quantity
        }, 0)
      ),
    [cartItems]
  )

  const splitPreview = useMemo(() => {
    if (!splitEnabled) return null

    // Build row-based entries from committed scanner rows.
    const entries: RowSplitEntry[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row.committed) continue
      const qty = Number.parseInt(row.quantity, 10)
      if (!Number.isFinite(qty) || qty <= 0) continue

      // Ad-hoc rows: use row.id as productId (ad-hoc rows are never merged)
      if (row.kind === "ad-hoc") {
        entries.push({
          rowId: row.id,
          rowIndex: i,
          productId: row.id, // Use row id for split group identity
          quantity: qty,
        })
        continue
      }

      // Catalog rows: must have resolved product
      if (!row.resolvedProduct) continue
      entries.push({
        rowId: row.id,
        rowIndex: i,
        productId: row.resolvedProduct.id,
        quantity: qty,
      })
    }

    // anchorRowIndex: rows BEFORE this index → Group A, rows AT or AFTER → Group B
    return deriveRowBasedSplitPreview(entries, splitAnchorIndex)
  }, [rows, splitEnabled, splitAnchorIndex])

  /** Pending row id to focus after next render, set by ad-hoc commit helper. */
  const pendingFocusRowIdRef = useRef<string | null>(null)

  const productRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const quantityRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const manualTotalRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    const firstId = firstRowIdRef.current
    if (firstId) productRefs.current[firstId]?.focus()
  }, [])

  const rowsRef = useRef(rows)

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])


  const focusProduct = useCallback((rowId: string) => {
    // Use rAF to wait for React to render and register refs before focusing.
    // If the ref is not yet registered on the first frame, retry once.
    // At most two animation frames; missing ref becomes a safe no-op.
    requestAnimationFrame(() => {
      if (productRefs.current[rowId]) {
        productRefs.current[rowId]?.focus()
      } else {
        requestAnimationFrame(() => {
          productRefs.current[rowId]?.focus()
        })
      }
    })
  }, [])

  // Deferred focus: after rows render, focus the pending row set by ad-hoc commit helper.
  // Uses rAF double-frame retry to handle React ref registration latency.
  useEffect(() => {
    const targetId = pendingFocusRowIdRef.current
    if (!targetId) return
    pendingFocusRowIdRef.current = null
    focusProduct(targetId)
  }, [rows, focusProduct])

  const focusQuantity = useCallback((rowId: string) => {
    setTimeout(() => {
      const el = quantityRefs.current[rowId]
      if (el) {
        el.focus()
        el.select()
      }
    }, 30)
  }, [])

  const focusManualTotal = useCallback((rowId: string) => {
    setTimeout(() => {
      const el = manualTotalRefs.current[rowId]
      if (el) {
        el.focus()
        el.select()
      }
    }, 30)
  }, [])

  /**
   * Focus a specific field in a scanner row, preserving column context
   * for arrow-key navigation.
   *
   * Falls back gracefully when the target field is disabled or has no ref:
   *   "quantity" on a protected row (disabled) → manualTotal
   *   "manualTotal" on a non-protected row (no ref) → product
   */
  const focusRowField = useCallback(
    (rowId: string, field: ScannerField) => {
      if (field === "quantity") {
        const qEl = quantityRefs.current[rowId]
        if (qEl && !qEl.disabled) {
          focusQuantity(rowId)
        } else {
          // Quantity is disabled (protected row) — jump to manualTotal instead
          focusManualTotal(rowId)
        }
      } else if (field === "manualTotal") {
        const mEl = manualTotalRefs.current[rowId]
        if (mEl) {
          focusManualTotal(rowId)
        } else {
          // No manualTotal in this row (non-protected) — fall back to product
          focusProduct(rowId)
        }
      } else {
        focusProduct(rowId)
      }
    },
    [focusProduct, focusQuantity, focusManualTotal]
  )


  const focusNextRow = useCallback(
    (currentRowId: string) => {
      const idx = rowsRef.current.findIndex((r) => r.id === currentRowId)
      const next = rowsRef.current[idx + 1]
      if (next) {
        focusRowField(next.id, "product")
      } else {
        // Last row — append a new empty row and focus it
        const newRow = makeEmptyScannerRow()
        setRows((prev) => [...prev, newRow])
        // Use a longer delay so React renders the new row before we focus,
        // which ensures the browser can scroll it into view automatically.
        setTimeout(() => {
          focusRowField(newRow.id, "product")
          // Scroll the new row into view after focus
          setTimeout(() => {
            const el = productRefs.current[newRow.id]
            el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
          }, 30)
        }, 60)
      }
    },
    [focusRowField]
  )

  /**
   * Focus the first payment method button (for scanner exit bridge).
   * Calls the optional onExitToPayment hook first so the consumer can
   * switch mobile tabs before the focus lands.
   */
  const focusFirstPaymentMethod = useCallback(() => {
    const hasExternalHandler = !!onExitToPaymentRef.current
    onExitToPaymentRef.current?.()
    const doFocus = () => {
      const methods: PaymentMethodCode[] = ["cash", "transfer", "card", "qr"]
      for (const method of methods) {
        const el = paymentMethodRefs.current[method]
        if (el) {
          el.focus()
          return
        }
      }
    }
    // When switching tabs (mobile), delay focus so the DOM can render the tab content.
    if (hasExternalHandler) {
      setTimeout(doFocus, 60)
    } else {
      doFocus()
    }
  }, [])

  const registerPaymentMethodRef = useCallback(
    (method: PaymentMethodCode, el: HTMLButtonElement | null) => {
      paymentMethodRefs.current[method] = el
    },
    []
  )

  /**
   * Focus the next row, OR exit to payment if at the last row.
   */
  const focusNextOrExit = useCallback(
    (currentRowId: string) => {
      const idx = rowsRef.current.findIndex((r) => r.id === currentRowId)
      const row = rowsRef.current[idx]
      const exitTarget = resolveScannerExit("product", idx, rowsRef.current, "enter", !!row?.resolvedProduct)
      if (exitTarget === "payment") {
        focusFirstPaymentMethod()
      } else {
        // "new-row" or ScannerFieldTarget — Enter always moves forward
        focusNextRow(currentRowId)
      }
    },
    [focusNextRow, focusFirstPaymentMethod]
  )

  /**
   * Focus the first available (non-committed or empty) scanner row.
   * Used after camera scanner closes to restore input focus.
   */
  const focusFirstAvailableRow = useCallback(() => {
    const currentRows = rowsRef.current
    const freeRow = currentRows.find((r) => !r.committed || !r.resolvedProduct)
    if (freeRow) {
      focusProduct(freeRow.id)
    } else {
      // All rows are committed — focus the first row
      const firstRow = currentRows[0]
      if (firstRow) focusProduct(firstRow.id)
    }
  }, [focusProduct])

  const handleQueryChange = useCallback((rowId: string, value: string) => {
    setRows((prev) => updateRowQuery(prev, rowId, value))
  }, [])

  // ---- Internal keyboard handlers ----

  /**
   * Enter pressed in a product field: try quantity-prefix parsing first,
   * then special-code routing, then fall back to the existing search flow.
   */
  const handleProductEnter = useCallback(
    async (rowId: string) => {
      const row = rowsRef.current.find((r) => r.id === rowId)
      if (!row) return

      if (row.resolvedProduct) {
        const nextRows = commitResolvedCatalogRow(rowsRef.current, rowId)
        setRows(nextRows)
        if (nextRows.find((r) => r.id === rowId)?.committed) {
          focusNextOrExit(rowId)
        }
        return
      }

      const query = row.query.trim()
      if (!query) return

      // Try quantity-prefix parsing (*{qty}{barcode})
      const parsed = parseScannerEntry(query)
      const effectiveQuery = parsed.query
      const effectiveQuantity = parsed.kind === "prefixed" ? String(parsed.quantity) : undefined

      // ── Special code routing (codes 1–9) ──────────────────
      if (isSpecialCode(effectiveQuery)) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId ? { ...r, isSearching: true, showDropdown: false } : r
          )
        )

        try {
          const product = await catalogQueryPort.findByCode(effectiveQuery)
          if (!product) {
            toast.error(`No se encontró un producto para el código "${effectiveQuery}"`)
            setRows((prev) =>
              prev.map((r) =>
                r.id === rowId ? { ...r, isSearching: false } : r
              )
            )
            return
          }

          const isProtectedProduct =
            (product.pricingMode === "manual" && product.isProtected === true)
            || product.price === 0 // Special products (e.g. codes 1–9) have price 0 and always require manual price

          setRows((prev) =>
            applyResolvedCatalogProduct(prev, rowId, product, {
              quantity: effectiveQuantity,
            })
          )

          if (isProtectedProduct) {
            // Protected products: focus the manual total (price) field
            focusManualTotal(rowId)
          } else {
            // Use focusNextRow directly: rowsRef.current hasn't updated yet
            // (resolvedProduct was set via setRows above which is still queued),
            // so focusNextOrExit would see a stale "no product" state and
            // incorrectly exit to payment on the last row.
            focusNextRow(rowId)
          }
        } catch {
          toast.error("Error al buscar el código especial.")
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId ? { ...r, isSearching: false } : r
            )
          )
        }
        return
      }

      // ── Numeric barcode exact lookup ──────────────────────
      if (isNumericBarcode(effectiveQuery)) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId ? { ...r, isSearching: true, showDropdown: false } : r
          )
        )

        try {
          const product = await catalogQueryPort.findByCode(effectiveQuery)
          if (!product) {
            toast.error(`No se encontró ningún producto para "${effectiveQuery}"`)
            setRows((prev) =>
              prev.map((r) =>
                r.id === rowId ? { ...r, isSearching: false } : r
              )
            )
            return
          }

          const isProtectedProduct =
            (product.pricingMode === "manual" && product.isProtected === true)
            || product.price === 0

          setRows((prev) =>
            applyResolvedCatalogProduct(prev, rowId, product, {
              quantity: effectiveQuantity,
            })
          )

          if (isProtectedProduct) {
            focusManualTotal(rowId)
          } else {
            focusNextRow(rowId)
          }
        } catch {
          toast.error("Error al buscar el producto.")
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId ? { ...r, isSearching: false } : r
            )
          )
        }
        return
      }

      // ── Normal search flow ────────────────────────────────

      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, isSearching: true, showDropdown: false } : r))
      )

      try {
        const results = await searchProducts({ search: effectiveQuery })

        if (results.length === 0) {
          toast.error(`No se encontró ningún producto para "${effectiveQuery}"`)
          setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, isSearching: false } : r)))
          return
        }

        if (results.length === 1) {
          const product = results[0]
          const resolvedQuantity = effectiveQuantity !== undefined ? String(effectiveQuantity) : "1"
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? {
                    ...r,
                    resolvedProduct: product,
                    query: product.name,
                    quantity: resolvedQuantity,
                    isSearching: false,
                    showDropdown: false,
                    candidates: [],
                  }
                : r
            )
          )

          // Always auto-commit and move to next row (no stop at quantity)
          setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, committed: true } : r)))
          // Use focusNextRow directly: rowsRef.current hasn't updated yet
          // (resolvedProduct was set via setRows above which is still queued),
          // so focusNextOrExit would see a stale "no product" state and
          // incorrectly exit to payment on the last row.
          focusNextRow(rowId)
        } else {
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? { ...r, candidates: results, showDropdown: true, isSearching: false }
                : r
            )
          )
        }
      } catch {
        toast.error("Error al buscar el producto.")
        setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, isSearching: false } : r)))
      }
    },
    [searchProducts, focusNextOrExit, focusNextRow, focusManualTotal, catalogQueryPort]
  )

  /**
   * Enter pressed in a quantity field: commit the row.
   */
  const handleQuantityEnter = useCallback(
    (rowId: string) => {
      const row = rowsRef.current.find((r) => r.id === rowId)
      if (!row?.resolvedProduct) return

      const qty = Number.parseInt(row.quantity, 10)
      if (!qty || qty <= 0) {
        toast.error("La cantidad debe ser mayor a cero.")
        return
      }

      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, committed: true } : r)))
      focusNextOrExit(rowId)
    },
    [focusNextOrExit]
  )

  /**
   * ArrowUp / ArrowDown: navigate between rows preserving the current field.
   */
  const handleArrowNavigation = useCallback(
    (rowId: string, field: ScannerField, direction: "up" | "down") => {
      const idx = rowsRef.current.findIndex((r) => r.id === rowId)
      const target = resolveArrowTarget(field, idx, rowsRef.current, direction)
      if (target) focusRowField(target.rowId, target.field)
    },
    [focusRowField]
  )

  /**
   * Tab / Shift+Tab: traverse product↔quantity within row, then cross rows.
   */
  const handleTabNavigation = useCallback(
    (rowId: string, field: ScannerField, shiftKey: boolean) => {
      const idx = rowsRef.current.findIndex((r) => r.id === rowId)
      const target = shiftKey
        ? resolveShiftTabTarget(field, idx, rowsRef.current)
        : resolveTabTarget(field, idx, rowsRef.current)
      if (target) focusRowField(target.rowId, target.field)
    },
    [focusRowField]
  )

  /**
   * ArrowLeft / ArrowRight: navigate laterally between product and quantity
   * within the same row (no cross-row movement).
   * Only fires when the resolved product is present (to avoid interfering
   * with normal text cursor movement while typing a query).
   */
  const handleArrowSideNavigation = useCallback(
    (rowId: string, field: ScannerField, direction: "left" | "right") => {
      const idx = rowsRef.current.findIndex((r) => r.id === rowId)
      const target = resolveArrowSideTarget(field, idx, rowsRef.current, direction)
      if (target) focusRowField(target.rowId, target.field)
    },
    [focusRowField]
  )

  /**
   * Escape: clear the active row. If already empty, move to previous row
   * or main scanner input.
   */
  const handleEscapeRow = useCallback(
    (rowId: string) => {
      const idx = rowsRef.current.findIndex((r) => r.id === rowId)
      const row = idx >= 0 ? rowsRef.current[idx] : null

      // If row is populated, clear it and stay
      if (row && (row.query || row.resolvedProduct || row.committed)) {
        setRows((prev) => clearScannerRow(prev, rowId))
        focusProduct(rowId)
        return
      }

      // Row is empty: go to previous row
      if (idx > 0) {
        focusProduct(rowsRef.current[idx - 1].id)
      } else {
        // First row, empty — refocus the main scanner (first row product)
        const firstRow = rowsRef.current[0]
        if (firstRow) focusProduct(firstRow.id)
      }
    },
    [focusProduct]
  )

  // ---- Unified keyboard entry point ----

  const handleClearRow = useCallback(
    (rowId: string) => {
      setRows((prev) => clearScannerRow(prev, rowId))
      focusProduct(rowId)
    },
    [focusProduct]
  )

  // ── Manual total for special protected rows ─────────────────

  const handleManualTotalChange = useCallback((rowId: string, value: string) => {
    setRows((prev) => updateManualLineTotal(prev, rowId, value))
  }, [])

  /** Commit an ad-hoc row after validating all fields. */
  const handleCommitAdHocRow = useCallback(
    (rowId: string) => {
      const row = rowsRef.current.find((r) => r.id === rowId)
      if (!row || row.kind !== "ad-hoc") return

      const result = commitAdHocRowWithTrailingEmpty(rowsRef.current, rowId)
      if (result.nameError) toast.error(result.nameError)
      if (result.priceError) toast.error(result.priceError)
      if (result.quantityError) toast.error(result.quantityError)
      if (result.nameError || result.priceError || result.quantityError) {
        setRows(result.rows)
        return
      }
      pendingFocusRowIdRef.current = result.focusRowId
      setRows(result.rows)
    },
    []
  )

  const handleRowKeyDown = useCallback(
    (rowId: string, field: ScannerField, e: React.KeyboardEvent) => {
      const key = e.key
      const inputTarget = e.target as HTMLInputElement | null
      const isEditingTextField = !!inputTarget && typeof inputTarget.value === "string"

      switch (key) {
        case "Enter":
          e.preventDefault()
          const rowForEnter = rowsRef.current.find((r) => r.id === rowId)
          if (rowForEnter?.kind === "ad-hoc") {
            if (field === "product") {
              focusManualTotal(rowId)
            } else if (field === "manualTotal") {
              focusQuantity(rowId)
            } else {
              handleCommitAdHocRow(rowId)
            }
          } else {
            if (field === "product") {
              handleProductEnter(rowId)
            } else if (field === "manualTotal") {
              handleProductEnter(rowId) // Reuses protected commit validation
            } else {
              handleQuantityEnter(rowId)
            }
          }
          break

        case "ArrowUp":
          e.preventDefault()
          handleArrowNavigation(rowId, field, "up")
          break

        case "ArrowDown":
          e.preventDefault()
          {
            const idx = rowsRef.current.findIndex((r) => r.id === rowId)
            const row = rowsRef.current[idx]
            const exitTarget = resolveScannerExit(field, idx, rowsRef.current, "arrowDown", !!row?.resolvedProduct)
            if (exitTarget === "payment") {
              focusFirstPaymentMethod()
            } else if (exitTarget === "new-row") {
              // Last row has a product — expand the grid
              focusNextRow(rowId)
            } else if (exitTarget) {
              focusRowField(exitTarget.rowId, exitTarget.field)
            }
          }
          break

        case "ArrowLeft": {
          // manualTotal: let the browser handle cursor movement inside the input.
          // Only intercept when in quantity, or in product with a resolved product.
          if (field === "manualTotal") break
          const rowForLeft = rowsRef.current.find((r) => r.id === rowId)
          if (field === "quantity" || rowForLeft?.resolvedProduct || rowForLeft?.kind === "ad-hoc") {
            e.preventDefault()
            handleArrowSideNavigation(rowId, field, "left")
          }
          break
        }

        case "ArrowRight": {
          // quantity / manualTotal are the rightmost navigable columns.
          // ArrowRight from either exits to the payment panel from any row.
          if (field === "quantity") {
            e.preventDefault()
            focusFirstPaymentMethod()
            break
          }
          if (field === "manualTotal") {
            // Only intercept when the cursor is already at the end of the value
            // so the operator can still move within the text normally.
            const input = e.target as HTMLInputElement
            if (input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
              e.preventDefault()
              focusFirstPaymentMethod()
            }
            break
          }
          // product field:
          //   - resolved product → go to quantity (existing lateral nav)
          //   - empty row (no text, no product) → exit to payment panel
          //   - typing text (query exists) → let the browser move the cursor
          const rowForRight = rowsRef.current.find((r) => r.id === rowId)
          if (field === "product") {
            if (rowForRight?.resolvedProduct || rowForRight?.kind === "ad-hoc") {
              e.preventDefault()
              handleArrowSideNavigation(rowId, field, "right")
            } else if (!rowForRight?.query) {
              // Row is empty — exit to payment from any row
              e.preventDefault()
              focusFirstPaymentMethod()
            }
          }
          break
        }

        case "Tab":
          e.preventDefault()
          handleTabNavigation(rowId, field, e.shiftKey)
          break

        case "Backspace":
        case "Delete": {
          // Quantity and manualTotal (unit price) fields: always let the browser handle normal character deletion.
          // Backspace/Delete inside these editable inputs must NOT clear the whole row.
          if (field === "quantity" || field === "manualTotal") break

          // Product field: only clear the row if a product is already resolved
          // (i.e. the field is read-only). If the user is still typing a query,
          // let the browser delete characters normally.
          if (field === "product") {
            const rowForDel = rowsRef.current.find((r) => r.id === rowId)
            if (rowForDel?.resolvedProduct || rowForDel?.committed) {
              e.preventDefault()
              handleClearRow(rowId)
            }
            // Otherwise (still typing query) — normal character deletion
            break
          }

          // manualTotal field (and any other field): clear the entire row
          e.preventDefault()
          handleClearRow(rowId)
          break
        }

            case "Escape":
          e.preventDefault()
          handleEscapeRow(rowId)
          break

        default:
          // Allow default behavior for all other keys
          break
      }
    },
    [handleProductEnter, handleQuantityEnter, handleArrowNavigation, handleArrowSideNavigation, handleTabNavigation, handleClearRow, handleEscapeRow, focusFirstPaymentMethod, focusNextRow, focusRowField, focusManualTotal, focusQuantity, handleCommitAdHocRow]
  )

  const handleSelectCandidate = useCallback(
    (rowId: string, product: CatalogProduct) => {
      setRows((prev) => selectCandidate(prev, rowId, product))
      focusQuantity(rowId)
    },
    [focusQuantity]
  )

  const handleQuantityChange = useCallback((rowId: string, value: string) => {
    setRows((prev) => updateRowQuantity(prev, rowId, value))
  }, [])


  const clearRowsForProduct = useCallback(
    (productId: string) => {
      const firstMatchingRowId = rowsRef.current.find((row) => row.resolvedProduct?.id === productId)?.id

      setRows((prev) => clearProductRows(prev, productId))

      if (firstMatchingRowId) {
        focusProduct(firstMatchingRowId)
      }
    },
    [focusProduct]
  )

  /**
   * Removes a product row from the cart.
   * When `rowId` is provided (row-based split), only that specific scanner
   * row is cleared. Otherwise falls back to clearing all rows for the
   * product (non-split / legacy mode).
   */
  const handleRemoveFromResultsGrid = useCallback(
    (productId: string, rowId?: string) => {
      if (rowId) {
        handleClearRow(rowId)
      } else {
        clearRowsForProduct(productId)
      }
    },
    [clearRowsForProduct, handleClearRow]
  )


      // ── Cart +/- quantity handlers ─────────────────────────
          // ── Cart +/- quantity handlers ────────────────────────

          /**
           * Increase a cart item's quantity by updating the corresponding scanner row.
           *
           * For rowId-based matches (ad-hoc, protected, or split): adjusts the specific row.
           * For product-based matches (normal catalog): only increments the FIRST
           * matching committed row. The cart merges by product ID, so one cart click
           * adjusts exactly one unit of the merged quantity.
           */
          const handleIncreaseCartQuantity = useCallback(
            (productId: string, rowId?: string) => {
              setRows((prev) => increaseCartQuantity(prev, { productId, rowId }))
            },
            []
          )

          /**
           * Decrease a cart item's quantity by updating the corresponding scanner row.
           * When quantity reaches 0 (was 1 before decrement), the row is cleared/removed.
           */
          const handleDecreaseCartQuantity = useCallback(
            (productId: string, rowId?: string) => {
              setRows((prev) => decreaseCartQuantity(prev, { productId, rowId }))
            },
            []
          )

      const toggleManualDiscount = useCallback((code: ManualDiscountCode) => {
        setSelectedManualDiscount((current) => (current === code ? null : code))
      }, [])

      const toggleSplit = useCallback(() => {
    setSplitEnabled((prev) => {
      if (!prev) {
        // Activating split: find the first non-committed row to use as anchor.
        // Everything committed before this index → Group A.
        // Everything added at or after this index → Group B.
        const currentRows = rowsRef.current
        const firstFreeIndex = currentRows.findIndex((r) => !r.committed || !r.resolvedProduct)
        // If all rows are committed, anchor at the end (length).
        const anchor = firstFreeIndex === -1 ? currentRows.length : firstFreeIndex
        setSplitAnchorIndex(anchor)
      } else {
        setSplitErrors(null)
        setSplitAnchorIndex(0)
      }
      return !prev
    })
  }, [])

  // Ref to hold the last checkout snapshot for print retry.
  // Avoids stale React state — printing reads from this ref directly.
  const lastPrintSnapshotRef = useRef<CheckoutTicketSnapshot | null>(null)

  const handleDismissSuccess = useCallback(() => {
    setCheckoutSuccess(null)
    setPrintError(null)
    setIsPrinting(false)
    lastPrintSnapshotRef.current = null
  }, [])

  /**
   * Build tickets from the stored snapshot and send to the printer.
   * Uses lastPrintSnapshotRef to avoid stale state; the caller must
   * populate the ref before invoking.
   */
  const executePrintFromSnapshot = useCallback(async (): Promise<
    { ok: true } | { ok: false; reason: string }
  > => {
    const ticketSnapshot = lastPrintSnapshotRef.current
    if (!ticketSnapshot) return { ok: false as const, reason: "No checkout data" }

    setPrintError(null)

    const result = buildPrintableTickets(ticketSnapshot)

    if (!Array.isArray(result)) {
      const errorMsg = result.reason
      setPrintError(errorMsg)
      return { ok: false as const, reason: errorMsg }
    }

    setIsPrinting(true)
    try {
      const printResult = await ticketPrinterPort.print(result)
      if (!printResult.ok) {
        setPrintError(printResult.reason)
        console.error("[executePrintFromSnapshot] Printer returned error:", printResult.reason)
      } else {
        // Show non-blocking QR warnings after successful print
        if (printResult.warnings && printResult.warnings.length > 0) {
          const qrWarnings = printResult.warnings
          const affectedTickets = qrWarnings
            .map((w) => {
              const label = w.groupLabel ? ` (Grupo ${w.groupLabel})` : ""
              return `Ticket ${w.ticketIndex + 1} de ${w.ticketCount}${label}`
        })
            .join(", ")
          toast.warning(
            `El ticket se imprimió sin QR ARCA`,
            {
              description: `${affectedTickets}: ${qrWarnings[0].reason}`,
            },
          )
        }
        handleDismissSuccess()
      }
      return printResult
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al imprimir"
      setPrintError(msg)
      console.error("[executePrintFromSnapshot] Printer threw exception:", msg, err)
      return { ok: false as const, reason: msg }
    } finally {
      setIsPrinting(false)
    }
  }, [ticketPrinterPort, handleDismissSuccess])

  /**
   * Public retry handler — reprints from the last successful checkout snapshot.
   * Exposed for UI retry buttons.
   */
  const handlePrintTickets = useCallback(async () => {
    return executePrintFromSnapshot()
  }, [executePrintFromSnapshot])

  // Allocation helpers bridging usePosCheckout to PosPaymentPanel props

  const toggleAllocation = useCallback(
    (method: PaymentMethodCode) => {
      const existing = allocations.find((a) => a.method === method)
      if (existing) {
        // Already active — do nothing. The X button handles removal.
        return
      }

      const isFirstTime = !firstSelectedMethods.current.has(method)

      if (isFirstTime) {
        firstSelectedMethods.current.add(method)

        // Use the centralized checkout pricing so auto-fill respects promotions + manual discount
        const totalCents = checkoutPricing.payableTotalCents
        const allocatedCents = allocations.map((a) => {
          try {
            return toCents(a.amount)
          } catch {
            return 0
          }
        })
        const remaining = computeRemainingCents(totalCents, allocatedCents)

        // If fully covered, start at 0; otherwise pre-fill with remaining
        if (remaining <= 0) {
          addOrUpdateAllocation(method, "0")
        } else {
          addOrUpdateAllocation(method, centsToDecimal(remaining))
        }
      } else {
        // Revisit: don't recalculate, just add with empty
        addOrUpdateAllocation(method, "")
      }
    },
    [allocations, addOrUpdateAllocation, checkoutPricing]
  )

  const changeAllocationAmount = useCallback(
    (method: PaymentMethodCode, amount: string) => {
      addOrUpdateAllocation(method, amount)
    },
    [addOrUpdateAllocation]
  )

  const handleCheckout = useCallback(
    async (invoiceRequested: boolean) => {
      if (cartItems.length === 0) {
        toast.error("El carrito está vacío.")
        return
      }

      setSplitErrors(null)

      let splitTicketGroups: SplitTicketGroupDraft[] | undefined

      if (splitEnabled) {
        const split = splitPreview // already computed row-based in useMemo
        if (!split) return
        const validationError = validateSplitGroups(cartItems, split.groups)
        if (validationError) {
          setSplitErrors(validationError)
          return
        }
        splitTicketGroups = split.groups
      }

      const sale = await checkout({
        items: cartItems,
        invoiceRequested,
        splitTicketGroups,
        saleTotal: centsToDecimal(checkoutPricing.payableTotalCents),
        manualDiscount: checkoutPricing.manualDiscount
          ? {
              code: checkoutPricing.manualDiscount,
              amountCents: checkoutPricing.manualDiscountCents,
            }
          : undefined,
      })

      if (sale) {

            // ── Ad-hoc price provenance validation ────────────────
            // Block ticket printing if backend lowered an ad-hoc item price.
            const adHocMismatches: string[] = []
            for (const ci of cartItems) {
              if (ci.kind !== "ad-hoc") continue
              const expectedSubtotal = (ci.unitPrice * ci.quantity).toFixed(2)
              const expectedUnitPrice = ci.unitPrice.toFixed(2)
              const saleAdHocItems = sale.items.filter(si => {
                const isCatalogId = cartItems.some(c => c.kind === "catalog" && c.product.id === si.productId)
                return !isCatalogId || si.name === ci.name
              })
              const adHocCartItems = cartItems.filter(c => c.kind === "ad-hoc")
              const adHocIdx = adHocCartItems.indexOf(ci)
              const saleItem = saleAdHocItems[adHocIdx]
              if (saleItem) {
                const backendUnitPrice = saleItem.unitPrice
                const backendSubtotal = saleItem.subtotal
                const unitPriceNum = Number.parseFloat(backendUnitPrice)
                const expectedNum = Number.parseFloat(expectedUnitPrice)
                if (Number.isFinite(unitPriceNum) && Number.isFinite(expectedNum) && unitPriceNum < expectedNum - 0.001) {
                  adHocMismatches.push(
                    `"${ci.name}": precio ingresado ${expectedUnitPrice}, backend devolvió ${backendUnitPrice}`
                  )
                } else if (backendSubtotal && backendSubtotal !== expectedSubtotal) {
                  const backendSubNum = Number.parseFloat(backendSubtotal)
                  const expectedSubNum = Number.parseFloat(expectedSubtotal)
                  if (Number.isFinite(backendSubNum) && backendSubNum < expectedSubNum - 0.005) {
                    adHocMismatches.push(
                      `"${ci.name}": subtotal esperado ${expectedSubtotal}, backend devolvió ${backendSubtotal}`
                    )
                  }
                }
              }
            }
            if (adHocMismatches.length > 0) {
              const msg = "Precio de producto ocasional no coincide con el backend: " + adHocMismatches.join("; ")
              toast.error(msg)
              return
            }

        // Reset manual discount after successful checkout
        setSelectedManualDiscount(null)

        // Store ticket snapshot for immediate print — no modal
        lastPrintSnapshotRef.current = {
          saleId: sale.id,
          saleDate: sale.createdAt,
          total: sale.total,
          payments: sale.paymentMethods,
          invoiceStatus: sale.invoiceStatus,
          splitGroups: splitTicketGroups,
          manualDiscount: checkoutPricing.manualDiscount,
          manualDiscountCents: checkoutPricing.manualDiscountCents,
          items: (() => {
            // FIFO consumer queue: consume sale items per product in request order.
            // Prevents first-match reuse for duplicate product IDs (e.g., two code-3 rows).
            // Ad-hoc items are matched positionally since their backend product_id is opaque.
            const remaining = [...sale.items]
            return cartItems.map((ci, cartIdx) => {
              if (ci.kind === "ad-hoc") {
                // Ad-hoc: use positional matching — the n-th ad-hoc cart item
                // matches the n-th ad-hoc response item
                const adHocIdx = remaining.findIndex(
                  (si) => si.name !== "" || si.productId !== cartItems
                    .filter((c) => c.kind === "catalog")
                    .map((c) => c.product.id)
                    .find((id) => id === si.productId)
                )
                // Simpler: match by position among response items
                const saleItem = remaining[cartIdx] ?? remaining[remaining.length - 1]
                return {
                  productId: ci.draftId,
                  name: ci.name,
                  description: ci.description,
                  quantity: ci.quantity,
                  unitPrice: ci.unitPrice.toFixed(2),
                  subtotal: (ci.unitPrice * ci.quantity).toFixed(2),
                  discountAmount: saleItem?.discountAmount ?? "0.00",
                  appliedPromotions: saleItem?.appliedPromotions ?? [],
                  appliedPromotionType: saleItem?.appliedPromotionType ?? null,
                }
              }
              // Catalog items: match by product.id
              const idx = remaining.findIndex((si) => si.productId === ci.product.id)
              const saleItem = idx >= 0 ? remaining.splice(idx, 1)[0] : undefined
              return {
                productId: ci.product.id,
                name: ci.product.name,
                quantity: ci.quantity,
                unitPrice: ci.manualLineTotal
                  ? (Number.parseFloat(ci.manualLineTotal) / ci.quantity).toFixed(2)
                  : ci.product.price.toFixed(2),
                subtotal: saleItem?.subtotal || (ci.product.price * ci.quantity).toFixed(2),
                discountAmount: saleItem?.discountAmount ?? "0.00",
                appliedPromotions: saleItem?.appliedPromotions ?? [],
                appliedPromotionType: saleItem?.appliedPromotionType ?? null,
              }
        })
          })(),
          cae: sale.cae,
          caeVto: sale.caeVto,
          cbteNro: sale.cbteNro,
          cbteTipo: sale.cbteTipo,
          ptoVta: sale.ptoVta,
        }

        // Trigger print immediately — no modal
        const printResult = await executePrintFromSnapshot()
        if (!printResult.ok) {
          // Snapshot stays in ref for retry via handlePrintTickets
          // printError is already set by executePrintFromSnapshot
        }

        const paymentLabels = allocations
          .map((a) => PAYMENT_METHOD_LABELS[a.method])
          .join(", ")

        const paidDescription = `Total ${formatCurrency(sale.total)} pagado con ${paymentLabels}.`
        const invoiceToast = (() => {
          if (!invoiceRequested) {
            return {
              title: "Ticket no fiscal registrado",
              description: paidDescription,
            }
          }

          switch (sale.invoiceStatus) {
            case "failed":
              return {
                title: "Venta registrada con factura pendiente",
                description: `${paidDescription} La factura electrónica no pudo emitirse y requiere reintento manual.`,
              }
            case "issuing":
              return {
                title: "Venta registrada — factura en emisión",
                description: `${paidDescription} ARCA sigue procesando la factura; controlá su conciliación.`,
              }
            case "ambiguous":
              return {
                title: "Venta registrada — requiere conciliación",
                description: `${paidDescription} El estado fiscal es ambiguo y necesita revisión manual.`,
              }
            case "issued":
            case "none":
            default:
              return {
                title: "Factura registrada",
                description: paidDescription,
              }
          }
        })()

        toast.success(invoiceToast.title, {
          description: invoiceToast.description,
        })

        // Clear cart rows immediately — dialog uses snapshot
        const nextRows = initializeScannerRows()
        setRows(nextRows)
        setSplitEnabled(false)
        setSplitAnchorIndex(0)
        setSplitErrors(null)
        firstSelectedMethods.current.clear()
        focusProduct(nextRows[0].id)
      } else {
        // sale is null — checkout() already set checkoutError state;
        // read it from the mutation result to avoid stale closure values.
        const currentError = checkoutError
        if (currentError) {
          toast.error(currentError.message)
        } else {
          toast.error("No se pudo completar la venta. Intentá de nuevo.")
        }
      }
    },
    [cartItems, checkout, checkoutError, focusProduct, allocations, splitEnabled, splitPreview, checkoutPricing, executePrintFromSnapshot]
  )

  // ── Camera barcode handoff ─────────────────────────────────

  const handleCameraCode = useCallback(
    async (code: string): Promise<CameraScanResult> => {
      try {
        // Find the first free (non-committed or empty) row
        let currentRows = rowsRef.current
        let freeRowIdx = currentRows.findIndex((r) => !r.committed || !r.resolvedProduct)
        const hadFreeRow = freeRowIdx !== -1

        if (freeRowIdx === -1) {
          // All rows full – append a new empty row
          const newRow = makeEmptyScannerRow()
          setRows((prev) => [...prev, newRow])
          // Use the newly appended row
          // We need to wait for the state update, but for the ref we use the latest
          freeRowIdx = currentRows.length // the new row is at the end
        }

        const product = await catalogQueryPort.findByCode(code)

        if (!product) {
          toast.error(`No se encontró un producto con el código "${code}"`)
          return { status: "not-found" }
        }

        // Re-read ref to get latest rows
        currentRows = rowsRef.current
        // Use the free row (if we appended, the new row should now be visible)
        const freeRow = freeRowIdx < currentRows.length
          ? currentRows[freeRowIdx]
          : currentRows[currentRows.length - 1]
        const scannedIntoLastVisibleRow = hadFreeRow && freeRowIdx === currentRows.length - 1

        const isProtectedProduct =
          (product.pricingMode === "manual" && product.isProtected === true)
          || product.price === 0 // Special products (e.g. codes 1–9) with price 0 require manual price

        setRows((prev) => {
          const nextRows = applyResolvedCatalogProduct(prev, freeRow.id, product)

          if (scannedIntoLastVisibleRow || freeRowIdx === prev.length) {
            return [...nextRows, makeEmptyScannerRow()]
          }

          return nextRows
        })

        return { status: "matched", product }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al buscar el producto"
        toast.error(message)
        return { status: "error", message }
      }
    },
    [catalogQueryPort]
  )

/** Toggle a scanner row between catalog and ad-hoc mode. */
  const handleToggleAdHocMode = useCallback((rowId: string) => {
    setRows((prev) => toggleAdHocMode(prev, rowId))
    focusProduct(rowId)
  }, [focusProduct])

  /** Add a new occasional product row or convert first empty row to occasional mode. */
  const handleAddOccasionalProduct = useCallback(() => {
    const result = addOrConvertFirstAvailableAdHocRow(rowsRef.current)
    setRows(result.rows)
    focusProduct(result.rowId)
  }, [focusProduct])

  /** Update ad-hoc name and validate inline. */
  const handleAdHocNameChange = useCallback((rowId: string, value: string) => {
    setRows((prev) => updateAdHocDraftField(prev, rowId, "name", value))
  }, [])

  /** Update ad-hoc unit price and validate inline. */
  const handleAdHocUnitPriceChange = useCallback((rowId: string, value: string) => {
    setRows((prev) => updateAdHocDraftField(prev, rowId, "unitPrice", value))
  }, [])

  /** Update ad-hoc description (no validation needed). */
  const handleAdHocDescriptionChange = useCallback((rowId: string, value: string) => {
    setRows((prev) => updateAdHocDraftField(prev, rowId, "description", value))
  }, [])



  const registerProductRef = useCallback(
    (rowId: string, el: HTMLInputElement | null) => {
      productRefs.current[rowId] = el
    },
    []
  )

  const registerQuantityRef = useCallback(
    (rowId: string, el: HTMLInputElement | null) => {
      quantityRefs.current[rowId] = el
    },
    []
  )

  const registerManualTotalRef = useCallback(
    (rowId: string, el: HTMLInputElement | null) => {
      manualTotalRefs.current[rowId] = el
    },
    []
  )

  return {
    rows,
    cartItems,
    totals,
    cartProductIds,
    checkoutPricing,
    selectedManualDiscount,
    toggleManualDiscount,
    allocations,
    toggleAllocation,
    changeAllocationAmount,
    allocationErrors,
    removeAllocationMethod: removeAllocation,
    splitPreview,
    splitEnabled,
    splitAnchorIndex,
    toggleSplit,
    splitErrors,
    isCheckingOut,
    catalogError,
    checkoutError,
    lastSale,
    checkoutSuccess,
    handleDismissSuccess,
    handlePrintTickets,
    printError,
    isPrinting,
    registerProductRef,
    registerQuantityRef,
    registerManualTotalRef,
    handleQueryChange,
    handleRowKeyDown,
    handleSelectCandidate,
    handleQuantityChange,
    handleClearRow,
    clearRowsForProduct,
    handleRemoveFromResultsGrid,
        handleIncreaseCartQuantity,
        handleDecreaseCartQuantity,
        handleManualTotalChange,
    handleToggleAdHocMode,
    handleAddOccasionalProduct,
    handleAdHocNameChange,
    handleAdHocUnitPriceChange,
    handleAdHocDescriptionChange,
    handleCommitAdHocRow,
    handleCheckout,
    handleCameraCode,
    focusFirstAvailableRow,
    focusFirstPaymentMethod,
    registerPaymentMethodRef,
    activeStorePromotions,
  }
}
