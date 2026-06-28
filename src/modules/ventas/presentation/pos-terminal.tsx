"use client"

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Receipt,
  PackageSearch,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { formatCurrency } from "@/shared/presentation/currency"
import { calculateTotals } from "../domain/totals"
import { addItem, emptyCart } from "../domain/cart"
import { usePosCheckout } from "../application/use-pos-checkout"
import type { CatalogProduct, CatalogQueryPort } from "../application/catalog-query-port"
import type { CheckoutPort } from "../application/checkout-port"
import type { PaymentMethod } from "../domain/payment-method"
import type { CartItem, CartProduct } from "../domain/cart"

// ─── Constants ────────────────────────────────────────────────────────────────

const SCANNER_ROWS = 12

const paymentMethodConfig: Record<
  PaymentMethod,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Efectivo: { label: "Efectivo", icon: Banknote },
  Tarjeta: { label: "Tarjeta", icon: CreditCard },
  Transferencia: { label: "Transferencia", icon: ArrowRightLeft },
}

function catalogToCartProduct(p: CatalogProduct): CartProduct {
  return { id: p.id, name: p.name, price: p.price, unit: p.unit }
}

// ─── Scanner Row types ────────────────────────────────────────────────────────

interface ScannerRow {
  id: string
  query: string
  resolvedProduct: CatalogProduct | null
  quantity: string
  isSearching: boolean
  candidates: CatalogProduct[]
  showDropdown: boolean
  committed: boolean
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

// ─── ScannerRowItem ───────────────────────────────────────────────────────────

interface ScannerRowItemProps {
  row: ScannerRow
  rowIndex: number
  onQueryChange: (rowId: string, value: string) => void
  onQueryKeyDown: (e: React.KeyboardEvent, rowId: string) => void
  onQuantityChange: (rowId: string, value: string) => void
  onQuantityKeyDown: (e: React.KeyboardEvent, rowId: string) => void
  onSelectCandidate: (rowId: string, product: CatalogProduct) => void
  onClearRow: (rowId: string) => void
  productRef: (rowId: string, el: HTMLInputElement | null) => void
  quantityRef: (rowId: string, el: HTMLInputElement | null) => void
}

const ScannerRowItem = memo(function ScannerRowItem({
  row,
  rowIndex,
  onQueryChange,
  onQueryKeyDown,
  onQuantityChange,
  onQuantityKeyDown,
  onSelectCandidate,
  onClearRow,
  productRef,
  quantityRef,
}: ScannerRowItemProps) {
  const dropdownId = useId()
  const isEmpty = !row.query && !row.resolvedProduct

  const rowBg = row.committed
    ? "bg-[#F0F4F2]"
    : isEmpty && rowIndex > 0
      ? "bg-background/50"
      : "bg-background"

  return (
    <div
      className={`relative grid grid-cols-[1fr_140px_100px_36px] items-center gap-3 px-4 py-2 transition-colors ${rowBg}`}
    >
      <span
        className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/40 select-none"
        aria-hidden
      >
        {rowIndex + 1}
      </span>

      {/* Product field */}
      <div className="relative pl-4">
        <Input
          ref={(el) => productRef(row.id, el)}
          value={row.resolvedProduct ? row.resolvedProduct.name : row.query}
          onChange={(e) => {
            if (!row.resolvedProduct) onQueryChange(row.id, e.target.value)
          }}
          onKeyDown={(e) => onQueryKeyDown(e, row.id)}
          placeholder={rowIndex === 0 ? "Escaneá o escribí un producto..." : ""}
          readOnly={!!row.resolvedProduct}
          aria-label={`Producto fila ${rowIndex + 1}`}
          aria-autocomplete="list"
          aria-expanded={row.showDropdown}
          aria-controls={row.showDropdown ? dropdownId : undefined}
          className={[
            "h-8 text-sm",
            row.resolvedProduct
              ? "cursor-default border-[#006c3a]/30 bg-[#F0F4F2] text-[#006c3a] font-medium focus-visible:ring-[#006c3a]/20"
              : "",
            row.isSearching ? "opacity-60" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />

        {row.showDropdown && row.candidates.length > 0 && (
          <div
            id={dropdownId}
            role="listbox"
            className="absolute left-4 top-full z-50 mt-1 w-full min-w-[260px] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
          >
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              {row.candidates.length} resultado{row.candidates.length !== 1 ? "s" : ""} — elegí uno
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {row.candidates.map((c) => (
                <div
                  key={c.id}
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  onClick={() => onSelectCandidate(row.id, c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelectCandidate(row.id, c)
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-[#F0F4F2] hover:text-[#006c3a]"
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="shrink-0 font-semibold text-[#006c3a]">
                    {formatCurrency(c.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Price */}
      <span
        className={[
          "text-right text-sm font-semibold tabular-nums",
          row.resolvedProduct ? "text-foreground" : "text-muted-foreground/40",
        ].join(" ")}
      >
        {row.resolvedProduct ? formatCurrency(row.resolvedProduct.price) : "—"}
      </span>

      {/* Quantity */}
      <Input
        ref={(el) => quantityRef(row.id, el)}
        type="number"
        min="1"
        step="1"
        value={row.quantity}
        onChange={(e) => onQuantityChange(row.id, e.target.value)}
        onKeyDown={(e) => onQuantityKeyDown(e, row.id)}
        disabled={!row.resolvedProduct}
        className="h-8 text-right text-sm font-semibold tabular-nums disabled:opacity-30"
        aria-label={`Cantidad fila ${rowIndex + 1}`}
      />

      {/* Clear */}
      <Button
        size="icon"
        variant="ghost"
        className="size-8 shrink-0 rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-0"
        disabled={isEmpty}
        onClick={() => onClearRow(row.id)}
        tabIndex={-1}
        aria-label={`Limpiar fila ${rowIndex + 1}`}
      >
        <Minus className="size-3.5" />
      </Button>
    </div>
  )
})

// ─── Cart components ──────────────────────────────────────────────────────────

const CartRow = memo(function CartRow({
  item,
  onRemove,
}: {
  item: CartItem
  onRemove: (productId: string) => void
}) {
  return (
    <div className="-mx-6 flex items-start justify-between gap-4 border-b border-border px-6 py-3.5 transition-colors last:border-b-0 hover:bg-[#F0F4F2]">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-foreground">{item.product.name}</h3>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(item.product.price)} c/u · {item.quantity} {item.product.unit}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="min-w-[4.5rem] text-right text-base font-bold text-foreground tabular-nums">
          {formatCurrency(item.product.price * item.quantity)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(item.product.id)}
          aria-label={`Quitar ${item.product.name}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
})

const PaymentMethodToggle = memo(function PaymentMethodToggle({
  value,
  onChange,
}: {
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(v) => {
        const next = v[0]
        if (next) onChange(next as PaymentMethod)
      }}
      variant="outline"
      className="grid grid-cols-3 gap-3"
    >
      {(Object.keys(paymentMethodConfig) as PaymentMethod[]).map((method) => {
        const config = paymentMethodConfig[method]
        return (
          <ToggleGroupItem
            key={method}
            value={method}
            className="flex-col gap-1.5 rounded-xl border-border bg-background py-3 text-sm data-[state=on]:border-[#006c3a] data-[state=on]:bg-[#F0F4F2] data-[state=on]:font-semibold data-[state=on]:text-[#006c3a]"
          >
            <config.icon className="size-6 text-muted-foreground" />
            {config.label}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
})

// ─── POS Terminal ─────────────────────────────────────────────────────────────

export interface PosTerminalProps {
  initialProducts?: CatalogProduct[]
  catalogQueryPort: CatalogQueryPort
  checkoutPort: CheckoutPort
}

export function PosTerminal({
  initialProducts,
  catalogQueryPort,
  checkoutPort,
}: PosTerminalProps) {
  const {
    searchProducts,
    paymentMethod,
    setPaymentMethod,
    checkout,
    isCheckingOut,
    catalogError,
    checkoutError,
    lastSale,
  } = usePosCheckout(catalogQueryPort, checkoutPort, { initialProducts })

  // ── Scanner grid state ────────────────────────────────────────────────────
  const [rows, setRows] = useState<ScannerRow[]>(initRows)
  const firstRowIdRef = useRef<string | undefined>(initRows()[0]?.id)

  const cart = useMemo(() => buildCartFromRows(rows), [rows])
  const cartItems = cart.items

  const totals = calculateTotals(
    cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
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
      if (el) { el.focus(); el.select() }
    }, 30)
  }, [])

  const focusNextRow = useCallback((currentRowId: string) => {
    const idx = rowsRef.current.findIndex((r) => r.id === currentRowId)
    const next = rowsRef.current[idx + 1]
    if (next) focusProduct(next.id)
  }, [focusProduct])

  // ── Handlers (memoized with useCallback to prevent children re-renders) ──

  const handleQueryChange = useCallback((rowId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, query: value, resolvedProduct: null, showDropdown: false, committed: false }
          : r
      )
    )
  }, [])

  const handleQueryKeyDown = useCallback(async (e: React.KeyboardEvent, rowId: string) => {
    if (e.key !== "Enter") return
    e.preventDefault()

    const row = rowsRef.current.find((r) => r.id === rowId)
    if (!row) return

    // Already resolved → jump to quantity
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
              ? { ...r, resolvedProduct: product, query: product.name, isSearching: false, showDropdown: false, candidates: [] }
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
  }, [searchProducts, focusQuantity])

  const handleSelectCandidate = useCallback((rowId: string, product: CatalogProduct) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, resolvedProduct: product, query: product.name, showDropdown: false, candidates: [] }
          : r
      )
    )
    focusQuantity(rowId)
  }, [focusQuantity])

  const handleQuantityChange = useCallback((rowId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, quantity: value } : r))
    )
  }, [])

  const handleQuantityKeyDown = useCallback((e: React.KeyboardEvent, rowId: string) => {
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
  }, [focusNextRow])

  const handleClearRow = useCallback((rowId: string) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? makeEmptyRow(rowId) : r)))
    focusProduct(rowId)
  }, [focusProduct])

  const clearRowsForProduct = useCallback((productId: string) => {
    const firstMatchingRowId = rowsRef.current.find((row) => row.resolvedProduct?.id === productId)?.id

    setRows((prev) =>
      prev.map((row) =>
        row.resolvedProduct?.id === productId ? makeEmptyRow(row.id) : row
      )
    )

    if (firstMatchingRowId) {
      focusProduct(firstMatchingRowId)
    }
  }, [focusProduct])

  // ── Checkout ──────────────────────────────────────────────────────────────

  const handleCheckout = useCallback(async (invoiceRequested: boolean) => {
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
  }, [cartItems, checkout, checkoutError, focusProduct])

  // ── Memoized ref callbacks for each row ───────────────────────────────────
  const registerProductRef = useCallback(
    (rowId: string, el: HTMLInputElement | null) => { productRefs.current[rowId] = el },
    []
  )
  const registerQuantityRef = useCallback(
    (rowId: string, el: HTMLInputElement | null) => { quantityRefs.current[rowId] = el },
    []
  )

  const isCartEmpty = cartItems.length === 0

  return (
    <>
      <PageHeader
        title="Punto de venta"
        description="Escaneá productos y cobralos al cliente"
        actions={
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full border-border bg-card px-3 py-1.5 text-sm text-muted-foreground"
          >
            <Receipt className="size-3.5" />
            Ticket {lastSale ? lastSale.id : "V-10429"}
          </Badge>
        }
      />

      <div className="grid flex-1 grid-cols-1 gap-6 bg-background p-4 sm:p-6 lg:grid-cols-[1fr_420px]">
        {/* Scanner grid */}
        <Card className="flex flex-col gap-0 overflow-hidden rounded-xl border-border bg-card">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <PackageSearch className="size-5 text-[#006c3a]" />
              <h2 className="text-base font-semibold text-foreground">Carga de productos</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                Presioná{" "}
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  Enter
                </kbd>{" "}
                para confirmar cada campo
              </span>
            </div>

            {catalogError && (
              <p className="text-sm text-destructive" role="alert">
                {catalogError}
              </p>
            )}

            {/* Grid header */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="grid grid-cols-[1fr_140px_100px_36px] gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
                <span className="pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Producto / Código de barras
                </span>
                <span className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Precio unit.
                </span>
                <span className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cantidad
                </span>
                <span />
              </div>

              <div className="flex flex-col divide-y divide-border">
                {rows.map((row, idx) => (
                  <ScannerRowItem
                    key={row.id}
                    row={row}
                    rowIndex={idx}
                    onQueryChange={handleQueryChange}
                    onQueryKeyDown={handleQueryKeyDown}
                    onQuantityChange={handleQuantityChange}
                    onQuantityKeyDown={handleQuantityKeyDown}
                    onSelectCandidate={handleSelectCandidate}
                    onClearRow={handleClearRow}
                    productRef={registerProductRef}
                    quantityRef={registerQuantityRef}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cart / Ticket */}
        <Card className="flex h-auto flex-col gap-0 overflow-hidden rounded-xl border-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.05)] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <CardContent className="flex h-full flex-col gap-0 p-0">
            <div className="flex shrink-0 items-center justify-between border-b border-border p-6">
              <div className="flex items-center gap-3 text-foreground">
                <ShoppingCart className="size-7" />
                <h2 className="text-2xl font-semibold">Carrito</h2>
              </div>
              <Badge variant="secondary" className="rounded-full px-4 py-1.5 text-sm font-medium">
                {cartItems.length} ítems
              </Badge>
            </div>

            {isCartEmpty ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ShoppingCart />
                    </EmptyMedia>
                    <EmptyTitle>Carrito vacío</EmptyTitle>
                    <EmptyDescription>
                      Escaneá productos con el lector o escribí el código.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="px-6">
                  <div className="flex flex-col py-2">
                    {cartItems.map((item) => (
                      <CartRow
                        key={item.product.id}
                        item={item}
                        onRemove={clearRowsForProduct}
                      />
                    ))}
                  </div>
                </div>
              </ScrollArea>
            )}

            <div className="shrink-0 border-t border-border bg-card p-6">
              {/* Totals */}
              <div className="mb-6 flex flex-col gap-3">
                <div className="flex justify-between text-base text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(totals.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-base text-muted-foreground">
                  <span>IVA (10%)</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(totals.vat)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xl font-bold text-foreground">Total</span>
                  <span className="text-[28px] font-bold leading-tight text-foreground">
                    {formatCurrency(totals.total)}
                  </span>
                </div>
              </div>

              {/* Payment method */}
              <div className="mb-6 flex flex-col gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Método de pago
                </span>
                <PaymentMethodToggle value={paymentMethod} onChange={setPaymentMethod} />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-[1fr_2fr] gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-xl border-border py-4 text-sm font-semibold"
                  disabled={isCartEmpty || isCheckingOut}
                  onClick={() => handleCheckout(false)}
                >
                  Ticket no fiscal
                </Button>
                <Button
                  size="lg"
                  className="rounded-xl bg-[#006c3a] py-4 text-base font-bold text-white shadow-sm hover:bg-[#23864f]"
                  disabled={isCartEmpty || isCheckingOut}
                  onClick={() => handleCheckout(true)}
                >
                  Facturar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
