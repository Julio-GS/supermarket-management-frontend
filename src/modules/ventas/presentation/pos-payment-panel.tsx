"use client"

import { memo } from "react"
import {
  Banknote,
  CreditCard,
  ArrowRightLeft,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { formatCurrency } from "@/shared/presentation/currency"
import { calculateTotals } from "../domain/totals"
import type { PaymentMethod } from "../domain/payment-method"

const paymentMethodConfig: Record<
  PaymentMethod,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Efectivo: { label: "Efectivo", icon: Banknote },
  Tarjeta: { label: "Tarjeta", icon: CreditCard },
  Transferencia: { label: "Transferencia", icon: ArrowRightLeft },
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
            <config.icon className="size-6 text-muted-foreground" />
            {config.label}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
})

export interface PosPaymentPanelProps {
  subtotal: number
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (method: PaymentMethod) => void
  isCartEmpty: boolean
  isCheckingOut: boolean
  onCheckout: (invoiceRequested: boolean) => void
}

export function PosPaymentPanel({
  subtotal,
  paymentMethod,
  onPaymentMethodChange,
  isCartEmpty,
  isCheckingOut,
  onCheckout,
}: PosPaymentPanelProps) {
  const totals = calculateTotals(subtotal)

  return (
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
        <PaymentMethodToggle value={paymentMethod} onChange={onPaymentMethodChange} />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        <Button
          size="lg"
          variant="outline"
          className="rounded-xl border-border py-4 text-sm font-semibold"
          disabled={isCartEmpty || isCheckingOut}
          onClick={() => onCheckout(false)}
        >
          Ticket no fiscal
        </Button>
        <Button
          size="lg"
          className="rounded-xl bg-[#006c3a] py-4 text-base font-bold text-white shadow-sm hover:bg-[#23864f]"
          disabled={isCartEmpty || isCheckingOut}
          onClick={() => onCheckout(true)}
        >
          Facturar
        </Button>
      </div>
    </div>
  )
}
