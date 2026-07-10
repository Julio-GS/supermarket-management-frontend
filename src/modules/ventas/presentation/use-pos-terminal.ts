import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS } from "../domain/payment-method"
import { calculateTotals } from "../domain/totals"
import { addItem, emptyCart } from "../domain/cart"
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
import {
  parseScannerEntry,
  resolveArrowTarget,
  resolveArrowSideTarget,
  resolveTabTarget,
  resolveShiftTabTarget,
  type ScannerField,
} from "./scanner-keyboard"

const SCANNER_ROWS = 12

export interface UsePosTerminalOptions {
  initialProducts?: CatalogProduct[]
}

export interface ScannerRow {
  id: string
  query: string
  resolvedProduct: CatalogProduct | null
  quantity: string
  isSearching: boolean
  candidates: CatalogProduct[]
  showDropdown: boolean
  committed: boolean
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
}

function catalogToCartProduct(p: CatalogProduct): CartProduct {
  return { id: p.id, name: p.name, price: p.price, unit: p.unit, promotions: p.promotions, storePromotions: p.storePromotions }
}

function makeEmptyRow(id = Math.random().toString(36).slice(2)): ScannerRow {
  return {
    id,
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
  return Array.from({ length: SCANNER_ROWS }, makeEmptyRow)
}

function buildCartFromRows(rows: ScannerRow[]) {
  return rows.reduce((cart, row) => {
    // Only committed rows contribute to the cart, matching split-preview
    // derivation so cart and split never drift.
    if (!row.committed || !row.resolvedProduct) return cart

    const quantity = Number.parseInt(row.quantity, 10)
    if (!Number.isFinite(quantity) || quantity <= 0) return cart

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
  handleQueryChange: (rowId: string, value: string) => void
  handleRowKeyDown: (rowId: string, field: ScannerField, e: React.KeyboardEvent) => void
  handleSelectCandidate: (rowId: string, product: CatalogProduct) => void
  handleQuantityChange: (rowId: string, value: string) => void
  handleClearRow: (rowId: string) => void
  clearRowsForProduct: (productId: string) => void
  handleRemoveFromResultsGrid: (productId: string, rowId?: string) => void
  removeAllocationMethod: (method: PaymentMethodCode) => void
  handleCheckout: (invoiceRequested: boolean) => Promise<void>
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
  const [isPrinting, setIsPrinting] = useState(false)

  const cart = useMemo(() => buildCartFromRows(rows), [rows])
  const cartItems = cart.items

  const cartProductIds = useMemo(
    () => new Set(cartItems.map((ci) => ci.product.id)),
    [cartItems]
  )

  const totals = useMemo(
    () =>
      calculateTotals(
        cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
      ),
    [cartItems]
  )

  const splitPreview = useMemo(() => {
    if (!splitEnabled) return null

    // Build row-based entries from committed scanner rows.
    // Only rows with a resolved product and positive quantity contribute.
    const entries: RowSplitEntry[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row.committed || !row.resolvedProduct) continue
      const qty = Number.parseInt(row.quantity, 10)
      if (!Number.isFinite(qty) || qty <= 0) continue
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

  /**
   * Focus a specific field in a scanner row, preserving column context
   * for arrow-key navigation.
   */
  const focusRowField = useCallback(
    (rowId: string, field: ScannerField) => {
      if (field === "quantity") {
        focusQuantity(rowId)
      } else {
        focusProduct(rowId)
      }
    },
    [focusProduct, focusQuantity]
  )

  const focusNextRow = useCallback(
    (currentRowId: string) => {
      const idx = rowsRef.current.findIndex((r) => r.id === currentRowId)
      const next = rowsRef.current[idx + 1]
      if (next) focusRowField(next.id, "product")
    },
    [focusRowField]
  )

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
   * then fall back to the existing search flow.
   */
  const handleProductEnter = useCallback(
    async (rowId: string) => {
      const row = rowsRef.current.find((r) => r.id === rowId)
      if (!row) return

      if (row.resolvedProduct) {
        // Product already resolved — commit immediately and move on
        setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, committed: true } : r)))
        focusNextRow(rowId)
        return
      }

      const query = row.query.trim()
      if (!query) return

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
    [searchProducts, focusNextRow]
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
      focusNextRow(rowId)
    },
    [focusNextRow]
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

  const handleRowKeyDown = useCallback(
    (rowId: string, field: ScannerField, e: React.KeyboardEvent) => {
      const key = e.key

      switch (key) {
        case "Enter":
          e.preventDefault()
          if (field === "product") {
            handleProductEnter(rowId)
          } else {
            handleQuantityEnter(rowId)
          }
          break

        case "ArrowUp":
          e.preventDefault()
          handleArrowNavigation(rowId, field, "up")
          break

        case "ArrowDown":
          e.preventDefault()
          handleArrowNavigation(rowId, field, "down")
          break

        case "ArrowLeft": {
          // Only intercept when in the quantity field, or when in the product
          // field with a resolved product (cursor navigation is irrelevant there).
          const rowForLeft = rowsRef.current.find((r) => r.id === rowId)
          if (field === "quantity" || rowForLeft?.resolvedProduct) {
            e.preventDefault()
            handleArrowSideNavigation(rowId, field, "left")
          }
          break
        }

        case "ArrowRight": {
          // Only intercept when in the product field with a resolved product,
          // or when already in the quantity field (move cursor left has no effect).
          const rowForRight = rowsRef.current.find((r) => r.id === rowId)
          if (field === "product" && rowForRight?.resolvedProduct) {
            e.preventDefault()
            handleArrowSideNavigation(rowId, field, "right")
          }
          break
        }

        case "Tab":
          e.preventDefault()
          handleTabNavigation(rowId, field, e.shiftKey)
          break

        case "Backspace": {
          // Only intercept Backspace when the row is already resolved/committed
          // (no free-text editing in progress). This clears the whole row.
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
    [handleProductEnter, handleQuantityEnter, handleArrowNavigation, handleArrowSideNavigation, handleTabNavigation, handleClearRow, handleEscapeRow]
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
        prev.map((row) =>
          row.resolvedProduct?.id === productId ? makeEmptyRow(row.id) : row
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
  const toggleAllocation = useCallback(
    (method: PaymentMethodCode) => {
      const existing = allocations.find((a) => a.method === method)
      if (existing) {
        // Already active — do nothing. The X button handles removal.
        return
      }
      // Pre-fill with full total as a convenience when adding the first method
      if (allocations.length === 0) {
        addOrUpdateAllocation(method, totals.subtotal.toString())
      } else {
        addOrUpdateAllocation(method, "")
      }
    },
    [allocations, addOrUpdateAllocation, totals.subtotal]
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
        saleTotal: totals.subtotal.toFixed(2),
      })

      if (sale) {
        // Persist success snapshot BEFORE clearing cart so dialog can render
        setCheckoutSuccess({
          saleId: sale.id,
          saleDate: sale.createdAt,
          total: sale.total,
          paymentMethods: allocations,
          invoiceStatus: sale.invoiceStatus,
          isSplit: splitEnabled && !!splitTicketGroups,
          splitGroups: splitTicketGroups,
          items: cartItems.map((ci) => {
            const saleItem = sale.items.find((si) => si.productId === ci.product.id)
            return {
              productId: ci.product.id,
              name: ci.product.name,
              quantity: ci.quantity,
              unitPrice: ci.product.price.toFixed(2),
              subtotal: saleItem?.subtotal || (ci.product.price * ci.quantity).toFixed(2),
              discountAmount: saleItem?.discountAmount ?? "0.00",
              appliedPromotions: saleItem?.appliedPromotions ?? [],
              appliedPromotionType: saleItem?.appliedPromotionType ?? null,
            }
          }),
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

        const label = invoiceRequested ? "Factura registrada" : "Ticket no fiscal registrado"
        toast.success(label, {
          description: `Total ${formatCurrency(sale.total)} pagado con ${paymentLabels}.`,
        })

        if (sale.invoiceStatus === "failed" && invoiceRequested) {
          toast.warning(
            "La factura electrónica no pudo emitirse. Revise manualmente.",
            { duration: 8000 }
          )
        }

        // Clear cart rows immediately — dialog uses snapshot
        const nextRows = initRows()
        setRows(nextRows)
        setSplitEnabled(false)
        setSplitAnchorIndex(0)
        setSplitErrors(null)
        focusProduct(nextRows[0].id)
      } else if (checkoutError) {
        toast.error(checkoutError.message)
      }
    },
    [cartItems, checkout, checkoutError, focusProduct, allocations, splitEnabled, splitPreview, totals.subtotal]
  )

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

  return {
    rows,
    cartItems,
    totals,
    cartProductIds,
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
    handleQueryChange,
    handleRowKeyDown,
    handleSelectCandidate,
    handleQuantityChange,
    handleClearRow,
    clearRowsForProduct,
    handleRemoveFromResultsGrid,
    handleCheckout,
  }
}
