"use client"

import { Printer, CheckCircle2, Ticket, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS } from "../domain/payment-method"
import type { PaymentAllocation } from "../domain/sale"
import type { PosCheckoutSuccess } from "./use-pos-terminal"

export interface PosCheckoutSuccessDialogProps {
  success: PosCheckoutSuccess
  onPrintAndClose: () => void
}

/**
 * Modal displayed after a successful checkout.
 * Shows sale details, payment allocations, and ticket info.
 */
export function PosCheckoutSuccessDialog({
  success,
  onPrintAndClose,
}: PosCheckoutSuccessDialogProps) {
  const invoiceLabel =
    success.invoiceStatus === "issued"
      ? "Factura electrónica emitida"
      : "Ticket no fiscal"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Venta confirmada"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-[#F0F4F2] px-6 py-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#006c3a] text-white">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Venta confirmada</h2>
            <p className="text-sm text-muted-foreground">{success.saleId}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-5">
          {/* Totals */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground">Total cobrado</span>
            <span className="text-xl font-bold text-foreground">
              {formatCurrency(success.total)}
            </span>
          </div>

          {/* Payment allocations */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Métodos de pago
            </span>
            <div className="flex flex-col gap-2">
              {success.paymentMethods.map((pm: PaymentAllocation) => (
                <div
                  key={pm.method}
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
                >
                  <span className="text-sm font-medium text-foreground">
                    {PAYMENT_METHOD_LABELS[pm.method] ?? pm.method}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(pm.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice status */}
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Comprobante
            </span>
            <p className="mt-1 text-sm font-semibold text-foreground">{invoiceLabel}</p>
          </div>

          {/* Ticket list */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tickets para imprimir
            </span>
            <div className="flex flex-col gap-2">
              {success.isSplit && success.splitGroups ? (
                success.splitGroups.map((group) => (
                  <div
                    key={group.label}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3"
                  >
                    <Ticket className="size-4 text-[#006c3a]" />
                    <span className="flex-1 text-sm font-medium text-foreground">
                      Ticket {group.label}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {group.items.length} {group.items.length === 1 ? "producto" : "productos"}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
                  <FileText className="size-4 text-[#006c3a]" />
                  <span className="flex-1 text-sm font-medium text-foreground">
                    Ticket de venta
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {success.splitGroups
                      ? success.splitGroups.reduce((sum, g) => sum + g.items.length, 0)
                      : 1}{" "}
                    producto
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <Button
            className="w-full rounded-xl bg-[#006c3a] py-4 text-base font-bold text-white shadow-sm hover:bg-[#23864f]"
            onClick={onPrintAndClose}
          >
            <Printer className="mr-2 size-4" />
            Imprimir ticket{success.isSplit ? "s" : ""}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            El carrito fue limpiado. Podés iniciar una nueva venta.
          </p>
        </div>
      </div>
    </div>
  )
}
