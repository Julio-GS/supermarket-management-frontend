"use client"

import { Receipt } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { usePosTerminal } from "./use-pos-terminal"
import { PosScannerPanel } from "./pos-scanner-panel"
import { PosCartPanel } from "./pos-cart-panel"
import { PosPaymentPanel } from "./pos-payment-panel"
import type { CatalogProduct, CatalogQueryPort } from "../application/catalog-query-port"
import type { CheckoutPort } from "../application/checkout-port"

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
  } = usePosTerminal(catalogQueryPort, checkoutPort, { initialProducts })

  const subtotal = cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0)

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
        <PosScannerPanel
          rows={rows}
          catalogError={catalogError}
          onQueryChange={handleQueryChange}
          onQueryKeyDown={handleQueryKeyDown}
          onSelectCandidate={handleSelectCandidate}
          onQuantityChange={handleQuantityChange}
          onQuantityKeyDown={handleQuantityKeyDown}
          onClearRow={handleClearRow}
          registerProductRef={registerProductRef}
          registerQuantityRef={registerQuantityRef}
        />

        {/* Cart / Ticket */}
        <Card className="flex h-auto flex-col gap-0 overflow-hidden rounded-xl border-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.05)] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <CardContent className="flex h-full flex-col gap-0 p-0">
            <PosCartPanel cartItems={cartItems} onRemove={clearRowsForProduct} />
            <PosPaymentPanel
              subtotal={subtotal}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              isCartEmpty={cartItems.length === 0}
              isCheckingOut={isCheckingOut}
              onCheckout={handleCheckout}
            />
            {checkoutError && !isCheckingOut && (
              <p className="px-6 pb-4 text-sm text-destructive" role="alert">
                {checkoutError.message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
