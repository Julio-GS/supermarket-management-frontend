"use client"

import { memo, useState } from "react"
import { toast } from "sonner"
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { formatCurrency } from "@/shared/presentation/currency"
import { usePosCheckout } from "../application/use-pos-checkout"
import type { CatalogProduct, CatalogQueryPort } from "../application/catalog-query-port"
import type { CheckoutPort } from "../application/checkout-port"
import type { PaymentMethod } from "../domain/payment-method"
import type { Cart, CartItem } from "../domain/cart"
import type { Sale } from "../domain/sale"

const POS_GRID_PAGE_SIZE = 24

const paymentMethodConfig: Record<
  PaymentMethod,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Efectivo: { label: "Efectivo", icon: Banknote },
  Tarjeta: { label: "Tarjeta", icon: CreditCard },
  Transferencia: { label: "Transferencia", icon: ArrowRightLeft },
}

export interface PosTerminalProps {
  initialProducts?: CatalogProduct[]
  catalogQueryPort: CatalogQueryPort
  checkoutPort: CheckoutPort
}

interface ProductGridProps {
  products: CatalogProduct[]
  onAddItem: (product: CatalogProduct) => void
}

const ProductCard = memo(function ProductCard({
  product,
  onAddItem,
}: {
  product: CatalogProduct
  onAddItem: (product: CatalogProduct) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onAddItem(product)}
      className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-[#006c3a] hover:bg-[#F0F4F2]"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-semibold leading-tight">
          {product.name}
        </span>
        <Plus className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-[#006c3a]" />
      </div>
      <span className="mt-auto text-lg font-bold text-[#006c3a]">
        {formatCurrency(product.price)}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          /{product.unit}
        </span>
      </span>
    </button>
  )
})

const ProductGrid = memo(function ProductGrid({ products, onAddItem }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onAddItem={onAddItem} />
      ))}
    </div>
  )
})

interface ProductGridPaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

const ProductGridPagination = memo(function ProductGridPagination({
  page,
  totalPages,
  onPageChange,
}: ProductGridPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label="Paginación de resultados"
      className="flex items-center justify-between gap-4"
    >
      <span className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
})

interface CartListProps {
  items: CartItem[]
  onChangeQuantity: (productId: string, delta: number) => void
  onRemoveItem: (productId: string) => void
}

const CartRow = memo(function CartRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: CartItem
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
}) {
  return (
    <div className="-mx-6 flex items-start justify-between gap-4 border-b border-border px-6 py-4 transition-colors last:border-b-0 hover:bg-[#F0F4F2]">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-foreground">
          {item.product.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(item.product.price)} c/u
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-full border border-border bg-muted">
          <Button
            size="icon"
            variant="ghost"
            className="size-10 rounded-full hover:bg-background"
            onClick={onDecrease}
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-8 text-center text-base font-semibold">
            {item.quantity}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-10 rounded-full hover:bg-background"
            onClick={onIncrease}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <span className="min-w-[5rem] text-right text-lg font-bold text-foreground">
          {formatCurrency(item.product.price * item.quantity)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-10 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
})

const CartList = memo(function CartList({
  items,
  onChangeQuantity,
  onRemoveItem,
}: CartListProps) {
  return (
    <div className="flex flex-col py-2">
      {items.map((item) => (
        <CartRow
          key={item.product.id}
          item={item}
          onIncrease={() => onChangeQuantity(item.product.id, 1)}
          onDecrease={() => onChangeQuantity(item.product.id, -1)}
          onRemove={() => onRemoveItem(item.product.id)}
        />
      ))}
    </div>
  )
})

interface CartSummaryProps {
  totals: { subtotal: number; vat: number; total: number }
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (method: PaymentMethod) => void
  onCheckout: (invoiceRequested: boolean) => void
  isCheckingOut: boolean
  isEmpty: boolean
}

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
            <config.icon className="size-6 text-muted-foreground transition-colors group-data-[state=on]/toggle:text-[#006c3a]" />
            {config.label}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
})

const CartSummary = memo(function CartSummary({
  totals,
  paymentMethod,
  onPaymentMethodChange,
  onCheckout,
  isCheckingOut,
  isEmpty,
}: CartSummaryProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
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

      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Método de pago
        </span>
        <PaymentMethodToggle value={paymentMethod} onChange={onPaymentMethodChange} />
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-4">
        <Button
          size="lg"
          variant="outline"
          className="rounded-xl border-border py-4 text-sm font-semibold"
          disabled={isEmpty || isCheckingOut}
          onClick={() => onCheckout(false)}
        >
          Ticket no fiscal
        </Button>
        <Button
          size="lg"
          className="rounded-xl bg-[#006c3a] py-4 text-base font-bold text-white shadow-sm hover:bg-[#23864f]"
          disabled={isEmpty || isCheckingOut}
          onClick={() => onCheckout(true)}
        >
          Facturar
        </Button>
      </div>
    </div>
  )
})

export function PosTerminal({
  initialProducts,
  catalogQueryPort,
  checkoutPort,
}: PosTerminalProps) {
  const {
    products,
    filters,
    applyFilters,
    cart,
    addItem,
    changeQuantity,
    removeItem,
    totals,
    paymentMethod,
    setPaymentMethod,
    checkout,
    isCheckingOut,
    catalogError,
    checkoutError,
    lastSale,
  } = usePosCheckout(catalogQueryPort, checkoutPort, { initialProducts })

  const [search, setSearch] = useState(filters.search ?? "")
  const [page, setPage] = useState(1)

  const totalPages = Math.ceil(products.length / POS_GRID_PAGE_SIZE)
  const currentPage = Math.max(1, Math.min(page, totalPages || 1))
  const paginatedProducts = products.slice(
    (currentPage - 1) * POS_GRID_PAGE_SIZE,
    currentPage * POS_GRID_PAGE_SIZE
  )

  function applySearch(value: string) {
    setSearch(value)
    setPage(1)
    applyFilters({ ...filters, search: value || undefined })
  }

  async function handleCheckout(invoiceRequested: boolean) {
    const sale = await checkout(invoiceRequested)
    if (sale) {
      const label = invoiceRequested ? "Factura registrada" : "Ticket no fiscal registrado"
      toast.success(label, {
        description: `Total ${formatCurrency(sale.total)} pagado con ${sale.paymentMethod.toLowerCase()}.`,
      })
    } else if (checkoutError) {
      toast.error(checkoutError.message)
    }
  }

  const isCartEmpty = cart.items.length === 0
  const hasActiveFilter = search.trim().length > 0

  return (
    <>
      <PageHeader
        title="Punto de venta"
        description="Registra ventas y cobra a tus clientes"
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
        {/* Catálogo */}
        <Card className="flex flex-col gap-0 overflow-hidden rounded-xl border-border bg-card">
          <CardContent className="flex flex-col gap-6 p-6">
            <InputGroup className="h-auto border-border bg-background">
              <InputGroupAddon className="pl-4">
                <Search className="size-5 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar producto o SKU..."
                value={search}
                onChange={(e) => applySearch(e.target.value)}
                className="py-3 text-base placeholder:font-medium placeholder:text-muted-foreground"
              />
            </InputGroup>

            {catalogError && (
              <p className="text-sm text-destructive" role="alert">
                {catalogError}
              </p>
            )}

            {hasActiveFilter ? (
              products.length === 0 ? (
                <Empty className="min-h-[320px] flex-1 rounded-xl border border-dashed border-border bg-background">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Search />
                    </EmptyMedia>
                    <EmptyTitle>Sin resultados</EmptyTitle>
                    <EmptyDescription>
                      No se encontraron productos con los filtros seleccionados.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <>
                  <ProductGrid products={paginatedProducts} onAddItem={addItem} />
                  <ProductGridPagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </>
              )
            ) : (
              <Empty className="min-h-[320px] flex-1 rounded-xl border border-dashed border-border bg-background">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search />
                  </EmptyMedia>
                  <EmptyTitle>Busca un producto</EmptyTitle>
                  <EmptyDescription>
                    Escribe en la barra de búsqueda para ver productos.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        {/* Carrito */}
        <Card className="flex h-auto flex-col gap-0 overflow-hidden rounded-xl border-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.05)] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <CardContent className="flex h-full flex-col gap-0 p-0">
            <div className="flex shrink-0 items-center justify-between border-b border-border p-6">
              <div className="flex items-center gap-3 text-foreground">
                <ShoppingCart className="size-7" />
                <h2 className="text-2xl font-semibold">Carrito</h2>
              </div>
              <Badge
                variant="secondary"
                className="rounded-full px-4 py-1.5 text-sm font-medium"
              >
                {cart.items.length} ítems
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
                      Selecciona productos del catálogo para empezar.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="px-6">
                  <CartList
                    items={cart.items}
                    onChangeQuantity={changeQuantity}
                    onRemoveItem={removeItem}
                  />
                </div>
              </ScrollArea>
            )}

            <div className="shrink-0 border-t border-border bg-card p-6">
              <CartSummary
                totals={totals}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                onCheckout={handleCheckout}
                isCheckingOut={isCheckingOut}
                isEmpty={isCartEmpty}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
