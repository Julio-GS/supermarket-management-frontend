"use client"

import { useEffect } from "react"
import { Printer, CheckCircle2, Ticket, FileText, AlertTriangle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS } from "../domain/payment-method"
import type { PaymentAllocation } from "../domain/sale"
import type { PosCheckoutSuccess } from "./use-pos-terminal"

export interface PosCheckoutSuccessDialogProps {
  success: PosCheckoutSuccess
  /** Dismiss the dialog without printing */
  onClose: () => void
  /** Trigger ticket generation and printing */
  onPrint: () => Promise<{ ok: true } | { ok: false; reason: string }>
  /** Latest print error from a failed print attempt */
  printError: string | null
  /** Whether a print operation is in progress */
  isPrinting: boolean
}

/**
 * Modal displayed after a successful checkout.
 * Shows sale details, payment allocations, and ticket info.
 * Supports printing tickets and displays fiscal integrity errors.
 */
export function PosCheckoutSuccessDialog({
  success,
  onClose,
  onPrint,
  printError,
  isPrinting,
}: PosCheckoutSuccessDialogProps) {
  const invoiceLabel = (() => {
    switch (success.invoiceStatus) {
      case "issued":
        return "Factura electrónica emitida"
      case "failed":
        return "Factura fallida — la venta fue registrada"
      case "issuing":
        return "Factura en emisión — la venta fue registrada"
      case "ambiguous":
        return "Requiere conciliación — la venta fue registrada"
      case "none":
      default:
        return "Ticket no fiscal"
    }
  })()

  const hasFiscalError = success.fiscalError !== null
  const ticketCount = success.isSplit && success.splitGroups
    ? success.splitGroups.length
    : 1

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (!hasFiscalError && !isPrinting) {
          e.preventDefault()
          onPrint()
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasFiscalError, isPrinting, onPrint, onClose])

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
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">Venta confirmada</h2>
            <p className="text-sm text-muted-foreground">{success.saleId}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </Button>
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

          {/* Applied promotion breakdown per item */}
          {success.items.some((item) => item.appliedPromotions && item.appliedPromotions.length > 0) && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Descuentos aplicados
              </span>
              <div className="flex flex-col gap-2">
                {success.items.filter(item => item.appliedPromotions && item.appliedPromotions.length > 0).map((item) => (
                  <div key={item.productId} className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    {item.appliedPromotions!.map((ap, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-emerald-700 mt-1">
                        <span>{ap.promotionScope === "store" ? "Tienda" : "Producto"}: {ap.promotionType === "percentage" ? "%" : "2x1"}</span>
                        <span className="font-medium">-{formatCurrency(ap.discountAmount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 mt-1 pt-1 border-t border-emerald-200">
                      <span>Total descuento</span>
                      <span>-{formatCurrency(item.discountAmount ?? "0.00")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                    {success.items.length}{" "}
                    {success.items.length === 1 ? "producto" : "productos"}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Fiscal integrity error */}
          {hasFiscalError && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  No se puede imprimir ticket fiscal
                </p>
                <p className="text-xs text-amber-700">{success.fiscalError}</p>
              </div>
            </div>
          )}

          {/* Print error from a previous attempt */}
          {printError && !hasFiscalError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-800">Error de impresión</p>
                <p className="text-xs text-red-700">{printError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <Button
            autoFocus
            className="w-full rounded-xl bg-[#006c3a] py-4 text-base font-bold text-white shadow-sm hover:bg-[#23864f] disabled:opacity-50"
            onClick={onPrint}
            disabled={hasFiscalError || isPrinting}
          >
            <Printer className="mr-2 size-4" />
            {isPrinting
              ? "Imprimiendo..."
              : `Imprimir ticket${ticketCount > 1 ? "s" : ""}${ticketCount > 1 ? ` (${ticketCount})` : ""}`}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            El carrito fue limpiado. Podés iniciar una nueva venta.
          </p>
        </div>
      </div>
    </div>
  )
}
