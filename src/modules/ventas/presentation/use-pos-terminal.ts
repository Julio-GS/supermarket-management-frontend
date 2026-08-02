import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS } from "../domain/payment-method"
import { calculateTotals } from "../domain/totals"
import { addItem, addAdHocItem, emptyCart } from "../domain/cart"
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
import type { CartItem, CartProduct, CatalogCartItem, AdHocCartItem } from "../domain/cart"
import { validateAdHocName, validateAdHocPrice, validateAdHocQuantity } from "../domain/ad-hoc-item"
import type { CheckoutTicketSnapshot, TicketItemLine } from "../domain/ticket"
import type { CameraScanResult } from "./pos-camera-scanner"
import {
  parseScannerEntry,
  resolveArrowTarget,
  resolveArrowSideTarget,
  resolveTabTarget,
  resolveShiftTabTarget,
  resolveScannerExit,
  resolveScannerExitLateral,
  type ScannerField,
} from "./scanner-keyboard"

const MIN_SCANNER_ROWS = 5

/** Regex for validating a positive decimal string with up to 2 decimal places. */
const MANUAL_TOTAL_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/

/**
 * Validates a manual total string for special protected products.
 * Returns an error message or null if valid.
 */
function validateManualTotal(value: string): string | null {
  if (!MANUAL_TOTAL_RE.test(value)) {
    return "Enter a positive amount (e.g. 15.50)"
  }
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Enter a positive amount"
  }
  return null
}

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

export interface ScannerRow {
  id: string
  /** Row kind: catalog (product search) or ad-hoc (manual entry). */
  kind: "catalog" | "ad-hoc"
  query: string
  resolvedProduct: CatalogProduct | null
  quantity: string
  isSearching: boolean
  candidates: CatalogProduct[]
  showDropdown: boolean
  committed: boolean
  /** Backend-defined pricing mode for special products. */
  pricingMode?: "standard" | "manual"
  /** Whether the product is backend-protected (manual-price only). */
  isProtected?: boolean
  /** Manual line total as a canonical decimal string (special protected products only). */
  manualLineTotal?: string
  /** Validation error for the manual total input. */
  manualTotalError?: string | null
  // ── Ad-hoc fields (only used when kind === "ad-hoc") ──
  /** Name of the ad-hoc item (non-empty string). */
  adHocName?: string
  /** Optional free-text description. */
  adHocDescription?: string
  /** Unit price as a decimal string (e.g. "199.99"). */
  adHocUnitPrice?: string
  /** Validation error for the ad-hoc unit price field. */
  adHocUnitPriceError?: string | null
  /** Validation error for the ad-hoc name field. */
  adHocNameError?: string | null
}

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

function catalogToCartProduct(p: CatalogProduct): CartProduct {
  return { id: p.id, name: p.name, price: p.price, unit: p.unit, promotions: p.promotions, storePromotions: p.storePromotions }
}

function makeEmptyRow(id = Math.random().toString(36).slice(2)): ScannerRow {
  return {
    id,
    kind: "catalog",
    query: "",
    resolvedProduct: null,
    quantity: "1",
    isSearching: false,
    candidates: [],
    showDropdown: false,
    committed: false,
  }
}

function initRows(): ScannerRow[] {
  return Array.from({ length: MIN_SCANNER_ROWS }, makeEmptyRow)
}

/**
 * Trim empty trailing rows while keeping at least MIN_SCANNER_ROWS.
 * An "empty" row has no query, no resolved product, and is not committed.
 */
function trimTrailingEmptyRows(rows: ScannerRow[]): ScannerRow[] {
  if (rows.length <= MIN_SCANNER_ROWS) return rows

  const isEmpty = (r: ScannerRow) =>
    !r.query && !r.resolvedProduct && !r.committed

  let cutAt = rows.length
  while (cutAt > MIN_SCANNER_ROWS && isEmpty(rows[cutAt - 1])) {
    cutAt--
  }

  return cutAt < rows.length ? rows.slice(0, cutAt) : rows
}

function buildCartFromRows(rows: ScannerRow[]) {
  return rows.reduce((cart, row) => {
    // Only committed rows contribute to the cart, matching split-preview
    // derivation so cart and split never drift.
    if (!row.committed) return cart

    const parsed = Number(row.quantity)
    if (!Number.isInteger(parsed) || parsed < 1) return cart
    const quantity = parsed

    // Ad-hoc rows: add as non-mergeable ad-hoc cart items
    if (row.kind === "ad-hoc") {
      const name = row.adHocName?.trim()
      const unitPriceStr = row.adHocUnitPrice?.trim()
      if (!name || !unitPriceStr) return cart
      const unitPrice = Number.parseFloat(unitPriceStr)
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return cart
      return addAdHocItem(cart, row.id, name, unitPrice, quantity, row.adHocDescription?.trim() || undefined)
    }

    // Catalog rows: must have resolved product
    if (!row.resolvedProduct) return cart

    // Special products requiring manual price: use row.id as lineId for separate identity.
    // A row is treated as "manual" if either the product has the protected flag OR
    // if it was resolved as requiring manual price entry (isProtected forced true via price===0).
    if (row.isProtected && row.manualLineTotal) {
      return addItem(cart, catalogToCartProduct(row.resolvedProduct), quantity, {
        lineId: row.id,
        manualLineTotal: row.manualLineTotal,
      })
    }

    // Guard: if a product has price 0 and no manual total was entered, skip it
    // (the row was not properly committed with a price).
    if (row.resolvedProduct.price === 0 && !row.manualLineTotal) {
      return cart
    }

    return addItem(cart, catalogToCartProduct(row.resolvedProduct), quantity)
  }, emptyCart)
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

  const [rows, setRows] = useState<ScannerRow[]>(initRows)
  const firstRowIdRef = useRef<string | undefined>(initRows()[0]?.id)
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

  const cart = useMemo(() => buildCartFromRows(rows), [rows])
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
    setTimeout(() => productRefs.current[rowId]?.focus(), 30)
  }, [])

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
        const newRow = makeEmptyRow()
        setRows((prev) => [...prev, newRow])
        // Focus the newly appended row after state update
        setTimeout(() => focusRowField(newRow.id, "product"), 30)
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
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, query: value, resolvedProduct: null, showDropdown: false, committed: false }
          : r
      )
    )
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
        // isProtected is already normalized in setRows: true for price-0 products
        // (special codes 1–9) even if pricingMode is not 'manual' in SQLite.
        const isProtected = row.isProtected
        if (isProtected) {
          // Protected product: validate manual total before committing
          const error = validateManualTotal(row.manualLineTotal ?? "")
          if (error) {
            setRows((prev) =>
              prev.map((r) =>
                r.id === rowId ? { ...r, manualTotalError: error } : r
              )
            )
            return
          }
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId ? { ...r, committed: true, manualTotalError: undefined } : r
            )
          )
          focusNextOrExit(rowId)
          return
        }
        // Normal product already resolved — commit immediately and move on
        setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, committed: true } : r)))
        focusNextOrExit(rowId)
        return
      }

      const query = row.query.trim()
      if (!query) return

      // ── Special code routing (codes 1–9) ──────────────────
      if (isSpecialCode(query)) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId ? { ...r, isSearching: true, showDropdown: false } : r
          )
        )

        try {
          const product = await catalogQueryPort.findByCode(query)
          if (!product) {
            toast.error(`No se encontró un producto para el código "${query}"`)
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
            prev.map((r) =>
              r.id === rowId
                ? {
                    ...r,
                    resolvedProduct: product,
                    query: product.name,
                    quantity: "1",
                    isSearching: false,
                    showDropdown: false,
                    candidates: [],
                    pricingMode: product.pricingMode,
                    // Ensure isProtected is true when price is 0, even if the product flag
                    // is not set in SQLite (special codes 1–9 default to price 0).
                    isProtected: isProtectedProduct ? true : (product.isProtected ?? false),
                    committed: !isProtectedProduct, // Auto-commit normal, await manual total for protected
                  }
                : r
            )
          )

          if (isProtectedProduct) {
            // Protected products: focus the manual total (price) field
            focusManualTotal(rowId)
          } else {
            focusNextOrExit(rowId)
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

      // ── Normal search flow ────────────────────────────────

      // Try quantity-prefix parsing (*{qty}{barcode})
      const parsed = parseScannerEntry(query)
      const effectiveQuery = parsed.query
      const effectiveQuantity = parsed.kind === "prefixed" ? parsed.quantity : undefined

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
          focusNextOrExit(rowId)
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
    [searchProducts, focusNextOrExit, focusManualTotal, catalogQueryPort]
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
        setRows((prev) => prev.map((r) => (r.id === rowId ? makeEmptyRow(rowId) : r)))
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
      setRows((prev) => prev.map((r) => (r.id === rowId ? makeEmptyRow(rowId) : r)))
      focusProduct(rowId)
    },
    [focusProduct]
  )

  // ── Manual total for special protected rows ─────────────────

  const handleManualTotalChange = useCallback((rowId: string, value: string) => {
    const error = validateManualTotal(value)
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              manualLineTotal: value,
              manualTotalError: error,
              // Un-commit the row when the price is being edited so the user
              // must confirm again with Enter. This keeps cart totals in sync.
              committed: false,
            }
          : r
      )
    )
  }, [])

  /** Commit an ad-hoc row after validating all fields. */
  const handleCommitAdHocRow = useCallback(
    (rowId: string) => {
      const row = rowsRef.current.find((r) => r.id === rowId)
      if (!row || row.kind !== "ad-hoc") return

      const name = row.adHocName?.trim()
      const unitPrice = row.adHocUnitPrice?.trim()
      const parsedQty = Number(row.quantity)
      const qty = Number.isFinite(parsedQty) && Number.isInteger(parsedQty) ? parsedQty : 0

      const nameErr = validateAdHocName(name ?? "")
      const priceErr = validateAdHocPrice(unitPrice ?? "")
      const qtyErr = validateAdHocQuantity(qty)

      if (nameErr || priceErr || qtyErr) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? {
                  ...r,
                  adHocNameError: nameErr,
                  adHocUnitPriceError: priceErr,
                }
              : r
          )
        )
        if (nameErr) toast.error(nameErr)
        if (priceErr) toast.error(priceErr)
        if (qtyErr) toast.error(qtyErr)
        return
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                committed: true,
                adHocNameError: null,
                adHocUnitPriceError: null,
              }
            : r
        )
      )
      focusNextOrExit(rowId)
    },
    [focusNextOrExit]
  )

  const handleRowKeyDown = useCallback(
    (rowId: string, field: ScannerField, e: React.KeyboardEvent) => {
      const key = e.key

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

        case "Backspace": {
          // In the manualTotal field: allow normal text editing (delete characters).
          // Only intercept Backspace in product/quantity fields when the row is
          // already resolved/committed — this clears the whole row.
          if (field === "manualTotal") break
          const rowForDel = rowsRef.current.find((r) => r.id === rowId)
          if (rowForDel?.resolvedProduct || rowForDel?.committed) {
            e.preventDefault()
            handleClearRow(rowId)
          }
          // Otherwise fall through — normal Backspace character deletion
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
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                resolvedProduct: product,
                query: product.name,
                showDropdown: false,
                candidates: [],
              }
            : r
        )
      )
      focusQuantity(rowId)
    },
    [focusQuantity]
  )

  const handleQuantityChange = useCallback((rowId: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, quantity: value } : r)))
  }, [])


  const clearRowsForProduct = useCallback(
    (productId: string) => {
      const firstMatchingRowId = rowsRef.current.find((row) => row.resolvedProduct?.id === productId)?.id

      setRows((prev) =>
        trimTrailingEmptyRows(
          prev.map((row) =>
            row.resolvedProduct?.id === productId ? makeEmptyRow(row.id) : row
          )
        )
      )

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
              setRows((prev) => {
                if (rowId) {
                  // Row-specific match (ad-hoc, protected, or split row)
                  return prev.map((r) => {
                    if (r.id !== rowId || !r.committed) return r
                    const parsed = Number.parseInt(r.quantity, 10)
                    const next = Number.isFinite(parsed) && parsed >= 1 ? String(parsed + 1) : "1"
                    return { ...r, quantity: next }
                  })
                }
                // Product-based match (normal catalog): only increment the FIRST
                // matching row. The cart merges by product ID, so one cart click
                // adjusts exactly one unit.
                let found = false
                return prev.map((r) => {
                  if (found || r.kind !== "catalog" || !r.committed || r.resolvedProduct?.id !== productId) return r
                  found = true
                  const parsed = Number.parseInt(r.quantity, 10)
                  const next = Number.isFinite(parsed) && parsed >= 1 ? String(parsed + 1) : "1"
                  return { ...r, quantity: next }
                })
              })
            },
            []
          )

          /**
           * Decrease a cart item's quantity by updating the corresponding scanner row.
           * When quantity reaches 0 (was 1 before decrement), the row is cleared/removed.
           */
          const handleDecreaseCartQuantity = useCallback(
            (productId: string, rowId?: string) => {
              setRows((prev) => {
                if (rowId) {
                  // Row-specific match
                  const nextRows = prev.map((r) => {
                    if (r.id !== rowId || !r.committed) return r
                    const parsed = Number.parseInt(r.quantity, 10)
                    if (!Number.isFinite(parsed) || parsed <= 1) {
                      // Mark for removal — quantity <= 1 becomes 0 so we can clear below
                      return { ...r, quantity: "0" }
                    }
                    return { ...r, quantity: String(parsed - 1) }
                  })
                  const cleared = nextRows.map((r) =>
                    r.quantity === "0" ? makeEmptyRow(r.id) : r
                  )
                  return trimTrailingEmptyRows(cleared)
                }
                // Product-based match: only decrement the FIRST matching row.
                // The cart merges by product ID, so one cart click adjusts exactly one unit.
                let found = false
                const nextRows = prev.map((r) => {
                  if (found || r.kind !== "catalog" || !r.committed || r.resolvedProduct?.id !== productId) return r
                  found = true
                  const parsed = Number.parseInt(r.quantity, 10)
                  if (!Number.isFinite(parsed) || parsed <= 1) {
                    return { ...r, quantity: "0" }
                  }
                  return { ...r, quantity: String(parsed - 1) }
                })
                const cleared = nextRows.map((r) =>
                  r.quantity === "0" ? makeEmptyRow(r.id) : r
                )
                return trimTrailingEmptyRows(cleared)
              })
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

  const handleDismissSuccess = useCallback(() => {
    setCheckoutSuccess(null)
    setPrintError(null)
    setIsPrinting(false)
  }, [])

  const handlePrintTickets = useCallback(async () => {
    const snapshot = checkoutSuccess
    if (!snapshot) return { ok: false as const, reason: "No checkout data" }

    // Only the latest snapshot is valid
    setPrintError(null)

    const ticketSnapshot: CheckoutTicketSnapshot = {
      saleId: snapshot.saleId,
      saleDate: snapshot.saleDate,
      invoiceStatus: snapshot.invoiceStatus,
      items: snapshot.items,
      payments: snapshot.paymentMethods,
      cae: snapshot.cae,
      caeVto: snapshot.caeVto,
      cbteNro: snapshot.cbteNro,
      cbteTipo: snapshot.cbteTipo,
      ptoVta: snapshot.ptoVta,
      splitGroups: snapshot.splitGroups,
      total: snapshot.total,
      manualDiscount: snapshot.manualDiscount,
      manualDiscountCents: snapshot.manualDiscountCents,
    }

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
        console.error("[handlePrintTickets] Printer returned error:", printResult.reason)
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
      console.error("[handlePrintTickets] Printer threw exception:", msg, err)
      return { ok: false as const, reason: msg }
    } finally {
      setIsPrinting(false)
    }
  }, [checkoutSuccess, ticketPrinterPort, handleDismissSuccess])

  // Allocation helpers bridging usePosCheckout to PosPaymentPanel props

  /**
   * Mirrors the discount calculation from pos-payment-panel.tsx so the hook
   * can compute the discount-adjusted total without depending on UI state.
   *
   * Rules (identical to computeCartDiscounts in the payment panel):
   * - Best product promotion applies (highest discount wins)
   * - All store promotions stack
   */
  const computeTotalDiscount = useCallback((items: CartItem[]): number => {
    let total = 0
    for (const item of items) {
      // Ad-hoc items do not receive product-specific promotions, but receive store promotions
      if (item.kind === "ad-hoc") {
        const subtotal = item.unitPrice * item.quantity
        if (activeStorePromotions?.length) {
          for (const p of activeStorePromotions) {
            let d = 0
            if (p.type === "percentage" && p.discountPercent) {
              d = (subtotal * p.discountPercent) / 100
            } else if (p.type === "two_x_one") {
              d = item.unitPrice * Math.floor(item.quantity / 2)
            }
            total += d
          }
        }
        continue
      }

      const { product, quantity } = item
      const itemSubtotal = item.manualLineTotal
        ? Number.parseFloat(item.manualLineTotal)
        : product.price * quantity
      if (!Number.isFinite(itemSubtotal) || itemSubtotal <= 0) continue

      // Best product promotion (only the highest discount applies)
      if (product.promotions?.length) {
        let best = 0
        for (const p of product.promotions) {
          let d = 0
          if (p.type === "percentage" && p.discountPercent) {
            d = itemSubtotal * p.discountPercent / 100
          } else if (p.type === "two_x_one") {
            const unit = item.manualLineTotal
              ? Number.parseFloat(item.manualLineTotal)
              : product.price
            d = unit * Math.floor(quantity / 2)
          }
          if (d > best) best = d
        }
        total += best
      }

      // All store promotions stack
      if (product.storePromotions?.length) {
        for (const p of product.storePromotions) {
          let d = 0
          if (p.type === "percentage" && p.discountPercent) {
            d = itemSubtotal * p.discountPercent / 100
          } else if (p.type === "two_x_one") {
            const unit = item.manualLineTotal
              ? Number.parseFloat(item.manualLineTotal)
              : product.price
            d = unit * Math.floor(quantity / 2)
          }
          total += d
        }
      }
    }
    return total
  }, [activeStorePromotions])

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
        saleTotal: (checkoutPricing.payableTotalCents / 100).toFixed(2),
      })

      if (sale) {
        // Reset manual discount after successful checkout
        setSelectedManualDiscount(null)

        // Persist success snapshot BEFORE clearing cart so dialog can render
        setCheckoutSuccess({
          saleId: sale.id,
          saleDate: sale.createdAt,
          total: sale.total,
          paymentMethods: sale.paymentMethods,
          invoiceStatus: sale.invoiceStatus,
          isSplit: splitEnabled && !!splitTicketGroups,
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
                  productId: saleItem?.productId ?? ci.draftId,
                  name: ci.name,
                  description: ci.description,
                  quantity: ci.quantity,
                  unitPrice: ci.unitPrice.toFixed(2),
                  subtotal: saleItem?.subtotal ?? (ci.unitPrice * ci.quantity).toFixed(2),
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
          fiscalError: computeFiscalError(sale),
          cae: sale.cae,
          caeVto: sale.caeVto,
          cbteNro: sale.cbteNro,
          cbteTipo: sale.cbteTipo,
          ptoVta: sale.ptoVta,
        })

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
        const nextRows = initRows()
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
    [cartItems, checkout, checkoutError, focusProduct, allocations, splitEnabled, splitPreview, checkoutPricing]
  )

  // ── Camera barcode handoff ─────────────────────────────────

  const handleCameraCode = useCallback(
    async (code: string): Promise<CameraScanResult> => {
      try {
        // Find the first free (non-committed or empty) row
        let currentRows = rowsRef.current
        let freeRowIdx = currentRows.findIndex((r) => !r.committed || !r.resolvedProduct)

        if (freeRowIdx === -1) {
          // All rows full — append a new empty row
          const newRow = makeEmptyRow()
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

        const isProtectedProduct =
          (product.pricingMode === "manual" && product.isProtected === true)
          || product.price === 0 // Special products (e.g. codes 1–9) with price 0 require manual price

        setRows((prev) =>
          prev.map((r) =>
            r.id === freeRow.id
              ? {
                  ...r,
                  query: product.name,
                  resolvedProduct: product,
                  quantity: "1",
                  committed: !isProtectedProduct,
                  isSearching: false,
                  candidates: [],
                  showDropdown: false,
                  pricingMode: product.pricingMode,
                  // Normalize isProtected: force true for price-0 products
                  isProtected: isProtectedProduct ? true : (product.isProtected ?? false),
                }
              : r
          )
        )

        return { status: "matched", product }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al buscar el producto"
        toast.error(message)
        return { status: "error", message }
      }
    },
    [catalogQueryPort]
  )

  // ── Ad-hoc mode handlers ───────────────────────────────────

  /** Toggle a scanner row between catalog and ad-hoc mode. */
  const handleToggleAdHocMode = useCallback((rowId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              kind: r.kind === "catalog" ? "ad-hoc" : "catalog",
              committed: false,
              adHocName: undefined,
              adHocDescription: undefined,
              adHocUnitPrice: undefined,
              adHocUnitPriceError: null,
              adHocNameError: null,
            }
          : r
      )
    )
    focusProduct(rowId)
  }, [focusProduct])

  /** Add a new occasional product row or convert first empty row to occasional mode. */
  const handleAddOccasionalProduct = useCallback(() => {
    const currentRows = rowsRef.current
    const targetRowIdx = currentRows.findIndex((r) => !r.committed && !r.resolvedProduct && !r.query && r.kind === "catalog")

    if (targetRowIdx === -1) {
      // No empty catalog rows available: append a new row of kind "ad-hoc"
      const newRowId = Math.random().toString(36).slice(2)
      const newRow: ScannerRow = {
        id: newRowId,
        kind: "ad-hoc",
        query: "",
        resolvedProduct: null,
        quantity: "1",
        isSearching: false,
        candidates: [],
        showDropdown: false,
        committed: false,
      }
      setRows((prev) => [...prev, newRow])
      focusProduct(newRowId)
    } else {
      // Convert the existing empty row to ad-hoc mode
      const targetRow = currentRows[targetRowIdx]
      setRows((prev) =>
        prev.map((r) =>
          r.id === targetRow.id
            ? {
                ...r,
                kind: "ad-hoc",
                committed: false,
                adHocName: undefined,
                adHocDescription: undefined,
                adHocUnitPrice: undefined,
                adHocUnitPriceError: null,
                adHocNameError: null,
              }
            : r
        )
      )
      focusProduct(targetRow.id)
    }
  }, [focusProduct])

  /** Update ad-hoc name and validate inline. */
  const handleAdHocNameChange = useCallback((rowId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId && r.kind === "ad-hoc"
          ? {
              ...r,
              adHocName: value,
              adHocNameError: value.trim() ? null : validateAdHocName(value),
              committed: false,
            }
          : r
      )
    )
  }, [])

  /** Update ad-hoc unit price and validate inline. */
  const handleAdHocUnitPriceChange = useCallback((rowId: string, value: string) => {
    const error = validateAdHocPrice(value)
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId && r.kind === "ad-hoc"
          ? {
              ...r,
              adHocUnitPrice: value,
              adHocUnitPriceError: error,
              committed: false,
            }
          : r
      )
    )
  }, [])

  /** Update ad-hoc description (no validation needed). */
  const handleAdHocDescriptionChange = useCallback((rowId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId && r.kind === "ad-hoc"
          ? { ...r, adHocDescription: value, committed: false }
          : r
      )
    )
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
