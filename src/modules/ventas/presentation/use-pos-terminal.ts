import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS } from "../domain/payment-method"
import { calculateTotals } from "../domain/totals"
import { addItem, emptyCart } from "../domain/cart"
import { validateSplitGroups } from "../domain/split-validator"
import { deriveRowBasedSplitPreview, type SplitItemGroup, type RowSplitEntry } from "../domain/default-split"
import { usePosCheckout } from "../application/use-pos-checkout"
import type { SplitTicketGroupDraft } from "../application/checkout-port"
import type { CatalogProduct, CatalogQueryPort } from "../application/catalog-query-port"
import type { CheckoutPort } from "../application/checkout-port"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { Sale } from "../domain/sale"
import type { CartItem, CartProduct } from "../domain/cart"

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
  total: string
  paymentMethod: PaymentMethodCode
  invoiceStatus: Sale["invoiceStatus"]
  isSplit: boolean
  splitGroups?: SplitTicketGroupDraft[]
}

function catalogToCartProduct(p: CatalogProduct): CartProduct {
  return { id: p.id, name: p.name, price: p.price, unit: p.unit }
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

export interface UsePosTerminalResult {
  rows: ScannerRow[]
  cartItems: CartItem[]
  totals: ReturnType<typeof calculateTotals>
  /** IDs of products currently in the cart — for scanner in-cart indicators */
  cartProductIds: Set<string>
  /** Single selected payment method */
  selectedPaymentMethod: PaymentMethodCode | null
  selectPaymentMethod: (method: PaymentMethodCode) => void
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
  registerProductRef: (rowId: string, el: HTMLInputElement | null) => void
  registerQuantityRef: (rowId: string, el: HTMLInputElement | null) => void
  handleQueryChange: (rowId: string, value: string) => void
  handleQueryKeyDown: (e: React.KeyboardEvent, rowId: string) => void
  handleSelectCandidate: (rowId: string, product: CatalogProduct) => void
  handleQuantityChange: (rowId: string, value: string) => void
  handleQuantityKeyDown: (e: React.KeyboardEvent, rowId: string) => void
  handleClearRow: (rowId: string) => void
  clearRowsForProduct: (productId: string) => void
  handleRemoveFromResultsGrid: (productId: string, rowId?: string) => void
  handleCheckout: (invoiceRequested: boolean) => Promise<void>
}

export function usePosTerminal(
  catalogQueryPort: CatalogQueryPort,
  checkoutPort: CheckoutPort,
  options: UsePosTerminalOptions = {}
): UsePosTerminalResult {
  const {
    searchProducts,
    selectedPaymentMethod,
    selectPaymentMethod,
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

  const focusNextRow = useCallback(
    (currentRowId: string) => {
      const idx = rowsRef.current.findIndex((r) => r.id === currentRowId)
      const next = rowsRef.current[idx + 1]
      if (next) focusProduct(next.id)
    },
    [focusProduct]
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

  const handleQueryKeyDown = useCallback(
    async (e: React.KeyboardEvent, rowId: string) => {
      if (e.key !== "Enter") return
      e.preventDefault()

      const row = rowsRef.current.find((r) => r.id === rowId)
      if (!row) return

      if (row.resolvedProduct) {
        focusQuantity(rowId)
        return
      }

      const query = row.query.trim()
      if (!query) return

      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, isSearching: true, showDropdown: false } : r))
      )

      try {
        const results = await searchProducts({ search: query })

        if (results.length === 0) {
          toast.error(`No se encontró ningún producto para "${query}"`)
          setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, isSearching: false } : r)))
          return
        }

        if (results.length === 1) {
          const product = results[0]
          setRows((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? {
                    ...r,
                    resolvedProduct: product,
                    query: product.name,
                    isSearching: false,
                    showDropdown: false,
                    candidates: [],
                  }
                : r
            )
          )
          focusQuantity(rowId)
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
    [searchProducts, focusQuantity]
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

  const handleQuantityKeyDown = useCallback(
    (e: React.KeyboardEvent, rowId: string) => {
      if (e.key !== "Enter") return
      e.preventDefault()

      const row = rowsRef.current.find((r) => r.id === rowId)
      if (!row?.resolvedProduct) return

      const qty = parseInt(row.quantity, 10)
      if (!qty || qty <= 0) {
        toast.error("La cantidad debe ser mayor a cero.")
        return
      }

      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, committed: true } : r)))
      focusNextRow(rowId)
    },
    [focusNextRow]
  )

  const handleClearRow = useCallback(
    (rowId: string) => {
      setRows((prev) => prev.map((r) => (r.id === rowId ? makeEmptyRow(rowId) : r)))
      focusProduct(rowId)
    },
    [focusProduct]
  )

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
  }, [])

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

      const sale = await checkout({ items: cartItems, invoiceRequested, splitTicketGroups })

      if (sale) {
        // Persist success snapshot BEFORE clearing cart so dialog can render
        setCheckoutSuccess({
          saleId: sale.id,
          total: sale.total,
          paymentMethod: selectedPaymentMethod!,
          invoiceStatus: sale.invoiceStatus,
          isSplit: splitEnabled && !!splitTicketGroups,
          splitGroups: splitTicketGroups,
        })

        const paymentLabel = selectedPaymentMethod
          ? PAYMENT_METHOD_LABELS[selectedPaymentMethod]
          : ""

        const label = invoiceRequested ? "Factura registrada" : "Ticket no fiscal registrado"
        toast.success(label, {
          description: `Total ${formatCurrency(sale.total)} pagado con ${paymentLabel}.`,
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
    [cartItems, checkout, checkoutError, focusProduct, selectedPaymentMethod, splitEnabled, splitPreview]
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
    selectedPaymentMethod,
    selectPaymentMethod,
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
    registerProductRef,
    registerQuantityRef,
    handleQueryChange,
    handleQueryKeyDown,
    handleSelectCandidate,
    handleQuantityChange,
    handleQuantityKeyDown,
    handleClearRow,
    clearRowsForProduct,
    handleRemoveFromResultsGrid,
    handleCheckout,
  }
}
