"use client"

import { Calendar, TrendingUp, CreditCard, Banknote, QrCode, FileText, HelpCircle, AlertCircle, Wallet } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/shared/presentation/currency"
import { paymentMethodLabel } from "./provider-purchases-table"
import type { ReportWindow, ProviderPurchaseReport } from "../domain/provider-purchase"

const WINDOW_OPTIONS: { value: ReportWindow; label: string }[] = [
  { value: "day", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
]

/** Ícono por método de pago */
function PaymentMethodIcon({ method }: { method: string }) {
  const cls = "size-4 shrink-0"
  const isUnknown = !method || method === "null"
  if (isUnknown)       return <AlertCircle className={`${cls} text-muted-foreground`} />
  if (method === "transferencia") return <Wallet className={`${cls} text-blue-500`} />
  if (method === "efectivo")      return <Banknote className={`${cls} text-green-600`} />
  if (method === "tarjeta")       return <CreditCard className={`${cls} text-purple-500`} />
  if (method === "qr")            return <QrCode className={`${cls} text-orange-500`} />
  if (method === "cheque")        return <FileText className={`${cls} text-amber-600`} />
  return <HelpCircle className={`${cls} text-muted-foreground`} />
}

interface ProviderPurchaseReportWidgetProps {
  window: ReportWindow
  onWindowChange: (w: ReportWindow) => void
  report: ProviderPurchaseReport | null
  isLoading: boolean
  error?: string | null
}

function formatRangeLabel(startsAt: string, endsAt: string): string {
  try {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    return `${fmt(startsAt)} – ${fmt(endsAt)}`
  } catch {
    return `${startsAt} – ${endsAt}`
  }
}

export function ProviderPurchaseReportWidget({
  window,
  onWindowChange,
  report,
  isLoading,
  error,
}: ProviderPurchaseReportWidgetProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Window selector */}
      <div className="flex items-center gap-2">
        <Calendar className="size-4 text-muted-foreground" />
        <div className="flex rounded-lg border border-border bg-background p-1">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onWindowChange(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                window === opt.value
                  ? "bg-[#006c3a] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          Cargando reporte...
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
          <p className="font-semibold text-destructive">No se pudo cargar el reporte</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {report && !isLoading && !error && (
        <>
          {/* Range label */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="size-4" />
            <span>
              Período: <span className="font-medium text-foreground">{formatRangeLabel(report.range.startsAt, report.range.endsAt)}</span>
            </span>
          </div>

          {/* Total spent */}
          <Card className="rounded-xl border-[#006c3a]/30 bg-[#F0F4F2]">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total gastado en compras a proveedores
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(report.totalAmount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.purchaseCount}{" "}
                  {report.purchaseCount === 1 ? "compra registrada" : "compras registradas"} en el período
                </p>
              </div>
              <TrendingUp className="size-10 text-[#006c3a]" />
            </CardContent>
          </Card>

          {/* Payment method breakdown */}
          <Card className="rounded-xl border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">
                Desglose por método de pago
              </CardTitle>
              <CardDescription>
                Total gastado por cada método en el período seleccionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.paymentMethodBreakdown.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No se registraron compras en este período
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {report.paymentMethodBreakdown.map((pm) => {
                    const isUnknown = !pm.method || pm.method === "null"
                    return (
                      <div
                        key={pm.method ?? "unknown"}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                          isUnknown
                            ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <PaymentMethodIcon method={pm.method} />
                          <span className={`text-sm font-medium ${isUnknown ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>
                            {paymentMethodLabel(pm.method)}
                          </span>
                          {isUnknown && (
                            <span className="text-xs text-amber-600 dark:text-amber-500">
                              · sin medio registrado
                            </span>
                          )}
                        </div>
                        <Badge
                          variant={isUnknown ? "outline" : "secondary"}
                          className={`text-sm font-semibold ${isUnknown ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400" : ""}`}
                        >
                          {formatCurrency(pm.amount)}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
