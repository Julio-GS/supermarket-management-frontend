"use client"

import { memo } from "react"
import {
  Banknote,
  CreditCard,
  ArrowRightLeft,
  QrCode,
  Split,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS, ALL_PAYMENT_METHODS } from "../domain/payment-method"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { PaymentAllocation } from "../domain/sale"
import type { CheckoutError } from "../domain/checkout-error"

const PAYMENT_METHOD_ICONS: Record<PaymentMethodCode, React.ComponentType<{ className?: string }>> = {
  cash: Banknote,
  transfer: ArrowRightLeft,
  card: CreditCard,
  qr: QrCode,
}

const AllocationRow = memo(function AllocationRow({
  method,
  amount,
  isActive,
  onToggle,
  onRemove,
  onAmountChange,
}: {
  method: PaymentMethodCode
  amount: string
  isActive: boolean
  /** Activates the method (only called when not yet active) */
  onToggle: () => void
  /** Explicitly removes the method (shown as X button when active) */
  onRemove: () => void
  onAmountChange: (value: string) => void
}) {
  const Icon = PAYMENT_METHOD_ICONS[method]

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
        isActive
          ? "border-[#006c3a] bg-[#F0F4F2]"
          : "border-border bg-background"
      }`}
    >
      {/* When active: label is decorative (no toggle on click). When inactive: clicking activates. */}
      <button
        type="button"
        onClick={isActive ? undefined : onToggle}
        className={`flex shrink-0 items-center gap-2 text-sm transition-colors ${
          isActive
            ? "cursor-default font-semibold text-[#006c3a]"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="size-5 shrink-0" />
        <span className="truncate">{PAYMENT_METHOD_LABELS[method]}</span>
      </button>
      {isActive && (
        <>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="ml-auto h-8 w-28 rounded-lg border-border bg-background text-right text-sm"
            aria-label={`Monto para ${PAYMENT_METHOD_LABELS[method]}`}
          />
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Quitar ${PAYMENT_METHOD_LABELS[method]}`}
          >
            <X className="size-4" />
          </button>
        </>
      )}
    </div>
  )
})

export interface PosPaymentPanelProps {
  subtotal: number
  allocations: PaymentAllocation[]
  onToggleAllocation: (method: PaymentMethodCode) => void
  onRemoveAllocation: (method: PaymentMethodCode) => void
  onAmountChange: (method: PaymentMethodCode, amount: string) => void
  allocationErrors: string | null
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
  allocations,
  onToggleAllocation,
  onRemoveAllocation,
  onAmountChange,
  allocationErrors,
  splitEnabled,
  onToggleSplit,
  splitErrors,
  isCartEmpty,
  isCheckingOut,
  checkoutError,
  onCheckout,
}: PosPaymentPanelProps) {
  const hasAllocations = allocations.length > 0

  function getAllocation(method: PaymentMethodCode): PaymentAllocation | undefined {
    return allocations.find((a) => a.method === method)
  }

  return (
    <div className="shrink-0 border-t border-border bg-card p-4 sm:p-6">
      {/* Totals */}
      <div className="mb-4 flex flex-col gap-3 sm:mb-6">
        <div className="flex justify-between text-base text-muted-foreground">
          <span>Subtotal</span>
          <span className="font-semibold text-foreground">
            {formatCurrency(subtotal)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-xl font-bold text-foreground">Total</span>
          <span className="text-2xl font-bold leading-tight text-foreground sm:text-[28px]">
            {formatCurrency(subtotal)}
          </span>
        </div>
      </div>

      {/* Payment allocations — method toggle + amount input */}
      <div className="mb-4 flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Método de pago
        </span>
        <div className="flex flex-col gap-2">
          {ALL_PAYMENT_METHODS.map((method) => {
            const alloc = getAllocation(method)
            return (
              <AllocationRow
                key={method}
                method={method}
                amount={alloc?.amount ?? ""}
                isActive={!!alloc}
                onToggle={() => onToggleAllocation(method)}
                onRemove={() => onRemoveAllocation(method)}
                onAmountChange={(value) => onAmountChange(method, value)}
              />
            )
          })}
        </div>
        {!hasAllocations && (
          <p className="text-xs text-destructive">Seleccione al menos un método de pago</p>
        )}
      </div>

      {/* Allocation validation errors */}
      {allocationErrors && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {allocationErrors}
        </p>
      )}

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
          disabled={isCartEmpty || isCheckingOut || !hasAllocations}
          onClick={() => onCheckout(false)}
        >
          Ticket no fiscal
        </Button>
        <Button
          size="lg"
          className="rounded-xl bg-[#006c3a] py-4 text-base font-bold text-white shadow-sm hover:bg-[#23864f]"
          disabled={isCartEmpty || isCheckingOut || !hasAllocations}
          onClick={() => onCheckout(true)}
        >
          Facturar
        </Button>
      </div>
    </div>
  )
}
