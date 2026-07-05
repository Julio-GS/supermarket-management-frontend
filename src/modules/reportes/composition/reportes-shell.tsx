"use client"

import { Calendar, TrendingUp, AlertCircle, Loader2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS } from "@/modules/ventas/domain/payment-method"
import { useReportWindow } from "../application/use-report-window"
import { useBusinessReport } from "../application/use-business-report"
import { businessReportPort } from "../infrastructure/report-repository-instance"
import type { ReportWindow } from "../domain/report-read-models"

const WINDOW_OPTIONS: { value: ReportWindow; label: string }[] = [
  { value: "day", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
]

function formatRangeLabel(startsAt: string, endsAt: string): string {
  try {
    const start = new Date(startsAt).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
    })
    const end = new Date(endsAt).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
    })
    return `${start} – ${end}`
  } catch {
    return `${startsAt} – ${endsAt}`
  }
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}

export function ReportesShell() {
  const { window, setWindow } = useReportWindow()
  const { report, isLoading, error } = useBusinessReport(businessReportPort, window)

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
              onClick={() => setWindow(opt.value)}
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

      {/* Loading state */}
      {isLoading && <ReportSkeleton />}

      {/* Error state — fail-closed: no partial metrics render */}
      {error && !isLoading && (
        <Card className="rounded-xl border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">No se pudieron cargar los reportes</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real report data */}
      {report && !isLoading && !error && (
        <>
          {/* Range label */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="size-4" />
            <span>Período: {formatRangeLabel(report.range.startsAt, report.range.endsAt)}</span>
          </div>

          {/* Total collected */}
          <Card className="rounded-xl border-[#006c3a]/30 bg-[#F0F4F2]">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total cobrado</p>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(report.totalCollectedAmount)}
                </p>
              </div>
              <TrendingUp className="size-10 text-[#006c3a]" />
            </CardContent>
          </Card>

          {/* Payment method breakdown */}
          <Card className="rounded-xl border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Desglose por método de pago</CardTitle>
              <CardDescription>
                Total cobrado por cada método en el período seleccionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.paymentMethodBreakdown.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No se registraron pagos en este período
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {report.paymentMethodBreakdown.map((pm) => (
                    <div
                      key={pm.method}
                      className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {PAYMENT_METHOD_LABELS[pm.method as keyof typeof PAYMENT_METHOD_LABELS] ?? pm.method}
                      </span>
                      <Badge variant="secondary" className="text-sm font-semibold">
                        {formatCurrency(pm.amount)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top products */}
          <Card className="rounded-xl border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Productos más vendidos</CardTitle>
              <CardDescription>
                Ranking por unidades vendidas en el período seleccionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.topProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No se vendieron productos en este período
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {report.topProducts.slice(0, 10).map((tp, idx) => (
                    <div
                      key={tp.productId}
                      className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={idx === 0 ? "default" : "secondary"}>{idx + 1}</Badge>
                        <span className="text-sm font-medium text-foreground">{tp.detalle}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {tp.units_sold} {tp.units_sold === 1 ? "unidad" : "unidades"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
