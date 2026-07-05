"use client"

import { memo } from "react"
import {
  Banknote,
  CreditCard,
  ArrowRightLeft,
  QrCode,
  Split,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/shared/presentation/currency"
import { calculateTotals } from "../domain/totals"
import { PAYMENT_METHOD_LABELS, ALL_PAYMENT_METHODS } from "../domain/payment-method"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { CheckoutError } from "../domain/checkout-error"

const PAYMENT_METHOD_ICONS: Record<PaymentMethodCode, React.ComponentType<{ className?: string }>> = {
  cash: Banknote,
  transfer: ArrowRightLeft,
  card: CreditCard,
  qr: QrCode,
}

const PaymentMethodCheckboxes = memo(function PaymentMethodCheckboxes({
  selected,
  onToggle,
}: {
  selected: PaymentMethodCode[]
  onToggle: (method: PaymentMethodCode) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ALL_PAYMENT_METHODS.map((method) => {
        const Icon = PAYMENT_METHOD_ICONS[method]
        const isSelected = selected.includes(method)
        return (
          <label
            key={method}
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
              isSelected
                ? "border-[#006c3a] bg-[#F0F4F2] font-semibold text-[#006c3a]"
                : "border-border bg-background text-muted-foreground hover:border-[#006c3a]/30"
            }`}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggle(method)}
              className="sr-only"
            />
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{PAYMENT_METHOD_LABELS[method]}</span>
          </label>
        )
      })}
    </div>
  )
})

export interface PosPaymentPanelProps {
  subtotal: number
  paymentMethods: PaymentMethodCode[]
  onTogglePaymentMethod: (method: PaymentMethodCode) => void
  splitEnabled: boolean
  onToggleSplit: () => void
  splitErrors: string | null
  isCartEmpty: boolean
  isCheckingOut: boolean
  checkoutError: CheckoutError | null
  onCheckout: (invoiceRequested: boolean) => void
}

export function PosPaymentPanel({
  subtotal,
  paymentMethods,
  onTogglePaymentMethod,
  splitEnabled,
  onToggleSplit,
  splitErrors,
  isCartEmpty,
  isCheckingOut,
  checkoutError,
  onCheckout,
}: PosPaymentPanelProps) {
  const totals = calculateTotals(subtotal)
  const hasPaymentMethod = paymentMethods.length > 0

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

      {/* Payment methods */}
      <div className="mb-4 flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Métodos de pago
        </span>
        <PaymentMethodCheckboxes selected={paymentMethods} onToggle={onTogglePaymentMethod} />
        {!hasPaymentMethod && (
          <p className="text-xs text-destructive">Seleccione al menos un método</p>
        )}
      </div>

      {/* Split ticket toggle */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-background p-3">
        <Checkbox
          id="split-ticket"
          checked={splitEnabled}
          onCheckedChange={onToggleSplit}
          disabled={isCartEmpty}
        />
        <Label htmlFor="split-ticket" className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Split className="size-4 text-muted-foreground" />
          Dividir en 2 tickets
        </Label>
      </div>

      {splitErrors && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {splitErrors}
        </p>
      )}

      {/* Invoice-failed message */}
      {checkoutError?.code === "INVOICE_FAILED" && !isCheckingOut && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          La venta se registró correctamente pero la factura electrónica no pudo emitirse.
          Revise manualmente.
        </p>
      )}

      {/* Actions */}
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        <Button
          size="lg"
          variant="outline"
          className="rounded-xl border-border py-4 text-sm font-semibold"
          disabled={isCartEmpty || isCheckingOut || !hasPaymentMethod}
          onClick={() => onCheckout(false)}
        >
          Ticket no fiscal
        </Button>
        <Button
          size="lg"
          className="rounded-xl bg-[#006c3a] py-4 text-base font-bold text-white shadow-sm hover:bg-[#23864f]"
          disabled={isCartEmpty || isCheckingOut || !hasPaymentMethod}
          onClick={() => onCheckout(true)}
        >
          Facturar
        </Button>
      </div>
    </div>
  )
}
