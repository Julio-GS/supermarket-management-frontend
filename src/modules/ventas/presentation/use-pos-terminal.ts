"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { formatCurrency } from "@/shared/presentation/currency"
import { calculateTotals } from "../domain/totals"
import { addItem, emptyCart } from "../domain/cart"
import { usePosCheckout } from "../application/use-pos-checkout"
import type { CatalogProduct, CatalogQueryPort } from "../application/catalog-query-port"
import type { CheckoutPort } from "../application/checkout-port"
import type { PaymentMethod } from "../domain/payment-method"
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
    if (!row.resolvedProduct) return cart

    const quantity = Number.parseInt(row.quantity, 10)
    if (!Number.isFinite(quantity) || quantity <= 0) return cart

    return addItem(cart, catalogToCartProduct(row.resolvedProduct), quantity)
  }, emptyCart)
}

export interface UsePosTerminalResult {
  rows: ScannerRow[]
  cartItems: CartItem[]
  totals: ReturnType<typeof calculateTotals>
  paymentMethod: PaymentMethod
  setPaymentMethod: (method: PaymentMethod) => void
  isCheckingOut: boolean
  catalogError: string | null
  checkoutError: ReturnType<typeof usePosCheckout>["checkoutError"]
  lastSale: ReturnType<typeof usePosCheckout>["lastSale"]
  registerProductRef: (rowId: string, el: HTMLInputElement | null) => void
  registerQuantityRef: (rowId: string, el: HTMLInputElement | null) => void
  handleQueryChange: (rowId: string, value: string) => void
  handleQueryKeyDown: (e: React.KeyboardEvent, rowId: string) => void
  handleSelectCandidate: (rowId: string, product: CatalogProduct) => void
  handleQuantityChange: (rowId: string, value: string) => void
  handleQuantityKeyDown: (e: React.KeyboardEvent, rowId: string) => void
  handleClearRow: (rowId: string) => void
  clearRowsForProduct: (productId: string) => void
  handleCheckout: (invoiceRequested: boolean) => Promise<void>
}

export function usePosTerminal(
  catalogQueryPort: CatalogQueryPort,
  checkoutPort: CheckoutPort,
  options: UsePosTerminalOptions = {}
): UsePosTerminalResult {
  const {
    searchProducts,
    paymentMethod,
    setPaymentMethod,
    checkout,
    isCheckingOut,
    catalogError,
    checkoutError,
    lastSale,
  } = usePosCheckout(catalogQueryPort, checkoutPort, { initialProducts: options.initialProducts })

  const [rows, setRows] = useState<ScannerRow[]>(initRows)
  const firstRowIdRef = useRef<string | undefined>(initRows()[0]?.id)

  const cart = useMemo(() => buildCartFromRows(rows), [rows])
  const cartItems = cart.items

  const totals = useMemo(
    () =>
      calculateTotals(
        cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
      ),
    [cartItems]
  )

  const productRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const quantityRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    const firstId = firstRowIdRef.current
    if (firstId) productRefs.current[firstId]?.focus()
  }, [])

  const rowsRef = useRef(rows)
  rowsRef.current = rows

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

  const handleCheckout = useCallback(
    async (invoiceRequested: boolean) => {
      if (cartItems.length === 0) {
        toast.error("El carrito está vacío.")
        return
      }
      const sale = await checkout({ items: cartItems, invoiceRequested })
      if (sale) {
        const label = invoiceRequested ? "Factura registrada" : "Ticket no fiscal registrado"
        toast.success(label, {
          description: `Total ${formatCurrency(sale.total)} pagado con ${sale.paymentMethod.toLowerCase()}.`,
        })
        const nextRows = initRows()
        setRows(nextRows)
        focusProduct(nextRows[0].id)
      } else if (checkoutError) {
        toast.error(checkoutError.message)
      }
    },
    [cartItems, checkout, checkoutError, focusProduct]
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
    paymentMethod,
    setPaymentMethod,
    isCheckingOut,
    catalogError,
    checkoutError,
    lastSale,
    registerProductRef,
    registerQuantityRef,
    handleQueryChange,
    handleQueryKeyDown,
    handleSelectCandidate,
    handleQuantityChange,
    handleQuantityKeyDown,
    handleClearRow,
    clearRowsForProduct,
    handleCheckout,
  }
}
