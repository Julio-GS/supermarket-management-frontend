"use client"

import { memo, useEffect, useRef } from "react"
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
import type { CartItem, CartProduct } from "../domain/cart"

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
  registerRef,
  onExitToScanner,
}: {
  method: PaymentMethodCode
  amount: string
  isActive: boolean
  /** Activates the method (only called when not yet active) */
  onToggle: () => void
  /** Explicitly removes the method (shown as X button when active) */
  onRemove: () => void
  onAmountChange: (value: string) => void
  /** Register this button's DOM ref */
  registerRef: (method: PaymentMethodCode, el: HTMLButtonElement | null) => void
  onExitToScanner?: () => void
}) {
  const Icon = PAYMENT_METHOD_ICONS[method]
  const methodOrder: PaymentMethodCode[] = ["cash", "transfer", "card", "qr"]

  // Ref for the amount input so we can auto-focus when the method is activated
  const inputRef = useRef<HTMLInputElement>(null)
  const wasActiveRef = useRef(isActive)

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      // Method was just activated — focus and select the amount input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 30)
    }
    wasActiveRef.current = isActive
  }, [isActive])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = methodOrder.indexOf(method)
    let targetIndex: number

    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault()
        if (currentIndex === methodOrder.length - 1) {
          // Last method — exit down to split toggle
          const panel = (e.target as HTMLElement).closest('[data-payment-panel]')
          panel?.querySelector<HTMLElement>('[data-split-toggle]')?.focus()
          return
        }
        targetIndex = currentIndex + 1
        break
      case "ArrowUp":
        e.preventDefault()
        targetIndex = currentIndex - 1 < 0 ? methodOrder.length - 1 : currentIndex - 1
        break
      case "ArrowLeft":
        e.preventDefault()
        onExitToScanner?.()
        return
      case "Enter":
        e.preventDefault()
        if (!isActive) onToggle()
        return
      default:
        return
    }

    // Focus the target button in the DOM
    const container = (e.target as HTMLElement).closest('[data-payment-container]')
    if (container) {
      const buttons = container.querySelectorAll<HTMLButtonElement>('[data-payment-method]')
      buttons[targetIndex]?.focus()
    }
  }

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
        ref={(el) => registerRef(method, el)}
        type="button"
        tabIndex={0}
        data-payment-method={method}
        onClick={isActive ? undefined : onToggle}
        onKeyDown={handleKeyDown}
        className={`flex shrink-0 items-center gap-2 text-sm transition-colors min-h-[44px] min-w-[44px] ${
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
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            onKeyDown={(e) => {
              const currentIndex = methodOrder.indexOf(method)

              const navigateToMethod = (forward: boolean) => {
                if (forward && currentIndex === methodOrder.length - 1) {
                  // Past the last method → go to split toggle
                  const panel = (e.target as HTMLElement).closest('[data-payment-panel]')
                  panel?.querySelector<HTMLElement>('[data-split-toggle]')?.focus()
                  return
                }
                if (!forward && currentIndex === 0) {
                  // Before the first method → wrap to last method button
                  const container = (e.target as HTMLElement).closest('[data-payment-container]')
                  const buttons = container?.querySelectorAll<HTMLButtonElement>('[data-payment-method]')
                  buttons?.[methodOrder.length - 1]?.focus()
                  return
                }
                const targetIndex = forward ? currentIndex + 1 : currentIndex - 1
                const container = (e.target as HTMLElement).closest('[data-payment-container]')
                if (container) {
                  const buttons = container.querySelectorAll<HTMLButtonElement>('[data-payment-method]')
                  buttons[targetIndex]?.focus()
                }
              }

              if (e.key === "Enter") {
                // Confirm amount and advance to next method (or split toggle)
                e.preventDefault()
                navigateToMethod(true)
              } else if (e.key === "Tab") {
                e.preventDefault()
                navigateToMethod(!e.shiftKey)
              } else if (e.key === "ArrowDown") {
                // Vertical navigation from inside the amount input
                e.preventDefault()
                navigateToMethod(true)
              } else if (e.key === "ArrowUp") {
                // Return focus to the current method button
                e.preventDefault()
                const container = (e.target as HTMLElement).closest('[data-payment-container]')
                const buttons = container?.querySelectorAll<HTMLButtonElement>('[data-payment-method]')
                buttons?.[currentIndex]?.focus()
              } else if (e.key === "Escape") {
                onRemove()
              }
            }}
            className="ml-auto h-8 w-28 rounded-lg border-border bg-background text-right text-sm"
            aria-label={`Monto para ${PAYMENT_METHOD_LABELS[method]}`}
          />
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive min-h-[44px] min-w-[44px]"
            aria-label={`Quitar ${PAYMENT_METHOD_LABELS[method]}`}
          >
            <X className="size-4" />
          </button>
        </>
      )}
    </div>
  )
})

/**
 * Computes total discount amount from all cart items' promotions.
 * For each item:
 *   - product promotions: only the best (highest discount) applies
 *   - store promotions: all of them stack
 *
 * Returns an array of discount lines for display and the total discount amount.
 */
function computeCartDiscounts(
  items: CartItem[],
  activeStorePromotions?: CartProduct["storePromotions"]
): {
  lines: { label: string; amount: number }[]
  totalDiscount: number
} {
  const lines: { label: string; amount: number }[] = []
  let totalDiscount = 0

  for (const item of items) {
    // Ad-hoc items have no catalog-backed promotions, but can receive store promotions
    if (item.kind === "ad-hoc") {
      const itemSubtotal = item.unitPrice * item.quantity
      if (activeStorePromotions?.length) {
        for (const p of activeStorePromotions) {
          let d = 0
          if (p.type === "percentage" && p.discountPercent) {
            d = (itemSubtotal * p.discountPercent) / 100
          } else if (p.type === "two_x_one") {
            d = item.unitPrice * Math.floor(item.quantity / 2)
          }
          if (d > 0) {
            lines.push({ label: `${item.name} — ${p.name}`, amount: d })
            totalDiscount += d
          }
        }
      }
      continue
    }

    if (item.kind !== "catalog") continue

    const { product, quantity } = item

    // Use manualLineTotal as the subtotal base for special products
    // (their catalog price is 0, so we must use the operator-entered price)
    const itemSubtotal = item.manualLineTotal
      ? Number.parseFloat(item.manualLineTotal)
      : product.price * quantity

    // Skip if we can't determine a meaningful subtotal
    if (!Number.isFinite(itemSubtotal) || itemSubtotal <= 0) continue

    // Best product promotion (only the highest discount applies)
    if (product.promotions?.length) {
      let bestAmount = 0
      let bestLabel = ""
      for (const p of product.promotions) {
        let d = 0
        if (p.type === "percentage" && p.discountPercent) {
          d = itemSubtotal * p.discountPercent / 100
        } else if (p.type === "two_x_one") {
          const unitPrice = item.manualLineTotal
            ? Number.parseFloat(item.manualLineTotal)
            : product.price
          const free = Math.floor(quantity / 2)
          d = unitPrice * free
        }
        if (d > bestAmount) {
          bestAmount = d
          bestLabel = p.type === "two_x_one"
            ? `${product.name} — 2x1`
            : `${product.name} — ${p.discountPercent}% OFF`
        }
      }
      if (bestAmount > 0) {
        lines.push({ label: bestLabel, amount: bestAmount })
        totalDiscount += bestAmount
      }
    }

    // All store promotions stack
    if (product.storePromotions?.length) {
      for (const p of product.storePromotions) {
        let d = 0
        if (p.type === "percentage" && p.discountPercent) {
          d = itemSubtotal * p.discountPercent / 100
        } else if (p.type === "two_x_one") {
          const unitPrice = item.manualLineTotal
            ? Number.parseFloat(item.manualLineTotal)
            : product.price
          const free = Math.floor(quantity / 2)
          d = unitPrice * free
        }
        if (d > 0) {
          lines.push({ label: `${product.name} — ${p.name}`, amount: d })
          totalDiscount += d
        }
      }
    }
  }

  return { lines, totalDiscount }
}

export interface PosPaymentPanelProps {
  subtotal: number
  cartItems: CartItem[]
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
  /** Register a payment method button ref for external focus management */
  registerPaymentMethodRef?: (method: PaymentMethodCode, el: HTMLButtonElement | null) => void
  onExitToScanner?: () => void
  activeStorePromotions?: CartProduct["storePromotions"]
  /** Manual discount code currently selected (null = none) */
  selectedManualDiscount?: "cash-10" | "card-5" | null
  /** Callback when a manual discount button is toggled */
  onToggleManualDiscount?: (code: "cash-10" | "card-5") => void
  /** Computed payable total in cents from checkout-pricing helper (used for vuelto) */
  payableTotalCents?: number
}

export function PosPaymentPanel({
  subtotal,
  cartItems,
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
  registerPaymentMethodRef,
  onExitToScanner,
  activeStorePromotions,
  selectedManualDiscount = null,
  onToggleManualDiscount,
  payableTotalCents,
}: PosPaymentPanelProps) {
  const hasAllocations = allocations.length > 0

  const { lines: discountLines, totalDiscount } = computeCartDiscounts(cartItems, activeStorePromotions)
  const hasDiscounts = totalDiscount > 0
  const finalTotal = Number((subtotal - totalDiscount).toFixed(2))

  // Compute allocated cents for vuelto
  const allocatedCents = allocations.reduce((sum, a) => {
    const parsed = Number.parseFloat(a.amount)
    return Number.isFinite(parsed) ? sum + Math.round(parsed * 100) : sum
  }, 0)
  // Display total: use payableTotalCents (with manual discount) when provided, else finalTotal
  const displayTotalCents = payableTotalCents ?? Math.round(finalTotal * 100)
  const displayTotal = displayTotalCents / 100
  const vueltoCents = Math.max(0, allocatedCents - displayTotalCents)
  const hasManualDiscount = selectedManualDiscount !== null && selectedManualDiscount !== undefined

  function getAllocation(method: PaymentMethodCode): PaymentAllocation | undefined {
    return allocations.find((a) => a.method === method)
  }

  return (
    <div data-payment-panel className="shrink-0 border-t border-border bg-card p-4 sm:p-6">
      {/* Totals */}
      <div className="mb-4 flex flex-col gap-3 sm:mb-6">
        <div className="flex justify-between text-base text-muted-foreground">
          <span>Subtotal</span>
          <span className="font-semibold text-foreground">
            {formatCurrency(subtotal)}
          </span>
        </div>

        {/* Discount lines — only shown when there are promotions */}
        {hasDiscounts && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              Descuentos
            </span>
            {discountLines.map((dl, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-emerald-700">{dl.label}</span>
                <span className="shrink-0 text-xs font-semibold text-emerald-700 tabular-nums">
                  -{formatCurrency(dl.amount)}
                </span>
              </div>
            ))}
            <div className="mt-0.5 flex items-center justify-between border-t border-emerald-200 pt-1">
              <span className="text-xs font-semibold text-emerald-800">Total descuentos</span>
              <span className="text-xs font-bold text-emerald-800 tabular-nums">
                -{formatCurrency(totalDiscount)}
              </span>
            </div>
          </div>
        )}

        {/* Manual discount line — shown when a manual discount is active */}
        {hasManualDiscount && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
            <span className="text-xs font-medium text-amber-700">
              {selectedManualDiscount === "cash-10" ? "10% Efectivo" : "5% Tarjeta"}
            </span>
            <span className="text-xs font-semibold text-amber-700 tabular-nums">
              -{formatCurrency((Math.round(finalTotal * 100) - displayTotalCents) / 100)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-xl font-bold text-foreground">Total</span>
          <span className="text-2xl font-bold leading-tight text-foreground sm:text-[28px]">
            {formatCurrency(displayTotal)}
          </span>
        </div>

        {/* Vuelto — only shown when overpayment */}
        {hasAllocations && vueltoCents > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="text-sm font-semibold text-emerald-700">Vuelto</span>
            <span className="text-sm font-bold text-emerald-700 tabular-nums">
              {formatCurrency(vueltoCents / 100)}
            </span>
          </div>
        )}
      </div>

      {/* Manual discount controls */}
      {onToggleManualDiscount && (
        <div className="mb-4 flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Descuento manual
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onToggleManualDiscount("cash-10")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                selectedManualDiscount === "cash-10"
                  ? "border-[#006c3a] bg-[#F0F4F2] text-[#006c3a]"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              10% Efectivo
            </button>
            <button
              type="button"
              onClick={() => onToggleManualDiscount("card-5")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                selectedManualDiscount === "card-5"
                  ? "border-[#006c3a] bg-[#F0F4F2] text-[#006c3a]"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              5% Tarjeta
            </button>
          </div>
        </div>
      )}

      {/* Payment allocations — method toggle + amount input */}
      <div className="mb-4 flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Método de pago
        </span>
        <div data-payment-container className="flex flex-col gap-2">
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
                registerRef={registerPaymentMethodRef ?? (() => {})}
                onExitToScanner={onExitToScanner}
              />
            )
          })}
        </div>
        {/* Cash default now handles empty allocations — no warning needed */}
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
          data-split-toggle
          onKeyDown={(e) => {
            const panel = (e.target as HTMLElement).closest('[data-payment-panel]')
            if (e.key === "Enter") {
              e.preventDefault()
              if (!isCartEmpty) {
                onToggleSplit()
              }
            } else if (e.key === "ArrowLeft") {
              e.preventDefault()
              onExitToScanner?.()
            } else if (e.key === "ArrowDown" || e.key === "Tab") {
              // Tab is handled naturally by the browser (next focusable = Ticket no fiscal)
              // ArrowDown → explicitly focus Ticket no fiscal
              if (e.key === "ArrowDown") {
                e.preventDefault()
                panel?.querySelector<HTMLElement>('[data-checkout-nofiscal]')?.focus()
              }
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              // Go back to last payment method button
              const container = panel?.querySelector('[data-payment-container]')
              const buttons = container?.querySelectorAll<HTMLButtonElement>('[data-payment-method]')
              buttons?.[buttons.length - 1]?.focus()
            }
          }}
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
          disabled={isCartEmpty || isCheckingOut}
          onClick={() => onCheckout(false)}
          data-checkout-nofiscal
          onKeyDown={(e) => {
            const panel = (e.target as HTMLElement).closest('[data-payment-panel]')
            if (e.key === "Enter") {
              if (isCartEmpty || isCheckingOut) {
                e.preventDefault()
                return
              }
              e.preventDefault()
              onCheckout(false)
            } else if (e.key === "ArrowRight") {
              e.preventDefault()
              panel?.querySelector<HTMLElement>('[data-checkout-invoice]')?.focus()
            } else if (e.key === "ArrowLeft") {
              e.preventDefault()
              onExitToScanner?.()
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              panel?.querySelector<HTMLElement>('[data-split-toggle]')?.focus()
            }
          }}
        >
          Ticket no fiscal
        </Button>
        <Button
          size="lg"
          className="rounded-xl bg-[#006c3a] py-4 text-base font-bold text-white shadow-sm hover:bg-[#23864f]"
          disabled={isCartEmpty || isCheckingOut}
          onClick={() => onCheckout(true)}
          data-checkout-invoice
          onKeyDown={(e) => {
            const panel = (e.target as HTMLElement).closest('[data-payment-panel]')
            if (e.key === "Enter") {
              if (isCartEmpty || isCheckingOut) {
                e.preventDefault()
                return
              }
              e.preventDefault()
              onCheckout(true)
            } else if (e.key === "ArrowLeft") {
              e.preventDefault()
              panel?.querySelector<HTMLElement>('[data-checkout-nofiscal]')?.focus()
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              panel?.querySelector<HTMLElement>('[data-split-toggle]')?.focus()
            }
          }}
        >
          Facturar
        </Button>
      </div>
    </div>
  )
}
