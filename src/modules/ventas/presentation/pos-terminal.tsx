"use client"

import { useState } from "react"
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
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
import { categories } from "@/modules/productos"
import { usePosCheckout } from "../application/use-pos-checkout"
import type { CatalogProduct, CatalogQueryPort } from "../application/catalog-query-port"
import type { CheckoutPort } from "../application/checkout-port"
import type { PaymentMethod } from "../domain/payment-method"

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
  const [category, setCategory] = useState<string>(filters.category ?? "Todas")

  function applySearch(value: string) {
    setSearch(value)
    applyFilters({ ...filters, search: value || undefined })
  }

  function applyCategory(value: string) {
    setCategory(value)
    applyFilters({ ...filters, category: value })
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

  return (
    <>
      <PageHeader
        title="Punto de venta"
        description="Registra ventas y cobra a tus clientes"
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <Receipt className="size-3.5" />
            Ticket {lastSale ? lastSale.id : "V-10429"}
          </Badge>
        }
      />

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_380px]">
        {/* Catálogo */}
        <div className="flex flex-col gap-4">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar producto o SKU..."
              value={search}
              onChange={(e) => applySearch(e.target.value)}
            />
          </InputGroup>

          {catalogError && (
            <p className="text-sm text-destructive" role="alert">
              {catalogError}
            </p>
          )}

          <ScrollArea className="w-full whitespace-nowrap">
          <ToggleGroup
            value={[category]}
            onValueChange={(v) => {
              const next = v[0]
              if (next) applyCategory(next)
            }}
            variant="outline"
            className="w-max"
          >
            <ToggleGroupItem value="Todas">Todas</ToggleGroupItem>
            {categories.map((c) => (
              <ToggleGroupItem key={c} value={c}>
                {c}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          </ScrollArea>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addItem(p)}
                className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent/50"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-medium leading-tight">
                    {p.name}
                  </span>
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">{p.category}</span>
                <span className="mt-auto text-base font-semibold text-primary">
                  {formatCurrency(p.price)}
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    /{p.unit}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Carrito */}
        <Card className="flex h-fit flex-col lg:sticky lg:top-24">
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <ShoppingCart className="size-4" />
                Carrito
              </div>
              <Badge variant="secondary">{cart.items.length} ítems</Badge>
            </div>

            <Separator />

            {cart.items.length === 0 ? (
              <Empty className="py-8">
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
            ) : (
              <ScrollArea className="max-h-[40vh]">
                <div className="flex flex-col gap-3 pr-2">
                  {cart.items.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-3">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {item.product.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(item.product.price)} c/u
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => changeQuantity(item.product.id, -1)}
                        >
                          <Minus />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => changeQuantity(item.product.id, 1)}
                        >
                          <Plus />
                        </Button>
                      </div>
                      <span className="w-16 text-right text-sm font-semibold">
                        {formatCurrency(item.product.price * item.quantity)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground"
                        onClick={() => removeItem(item.product.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Separator />

            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA (10%)</span>
                <span>{formatCurrency(totals.vat)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Método de pago
              </span>
              <ToggleGroup
                value={[paymentMethod]}
                onValueChange={(v) => {
                  const next = v[0]
                  if (next) setPaymentMethod(next as PaymentMethod)
                }}
                variant="outline"
                className="grid grid-cols-3"
              >
                {(Object.keys(paymentMethodConfig) as PaymentMethod[]).map((method) => {
                  const config = paymentMethodConfig[method]
                  return (
                    <ToggleGroupItem
                      key={method}
                      value={method}
                      className="flex-col gap-1 py-2 text-xs"
                    >
                      <config.icon className="size-4" />
                      {config.label}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                variant="outline"
                disabled={cart.items.length === 0 || isCheckingOut}
                onClick={() => handleCheckout(false)}
              >
                Ticket no fiscal
              </Button>
              <Button
                size="lg"
                disabled={cart.items.length === 0 || isCheckingOut}
                onClick={() => handleCheckout(true)}
              >
                Facturar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
