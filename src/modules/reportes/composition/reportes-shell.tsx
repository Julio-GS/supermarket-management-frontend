"use client"

import { useState } from "react"
import { Calendar, TrendingUp, AlertCircle } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS } from "@/modules/ventas"
import { useReportWindow } from "../application/use-report-window"
import { useBusinessReport } from "../application/use-business-report"
import { businessReportPort } from "./reportes-ports"
import type { FixedReportWindow, ReportQuery } from "../domain/report-read-models"

const WINDOW_OPTIONS: { value: FixedReportWindow; label: string }[] = [
  { value: "day", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
]

const CUSTOM_OPTIONS = [
  { value: "single", label: "Un día" },
  { value: "range", label: "Rango" },
] as const

function todayArgentina(): string {
  // Argentina calendar date in YYYY-MM-DD
  const now = new Date()
  // Convert to Argentina time and format
  const argTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }))
  const y = argTime.getFullYear()
  const m = String(argTime.getMonth() + 1).padStart(2, "0")
  const d = String(argTime.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

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

function isQueryActive(query: ReportQuery, target: ReportQuery): boolean {
  if (query.kind !== target.kind) return false
  switch (query.kind) {
    case "fixed":
      return target.kind === "fixed" && query.window === target.window
    case "custom-single-day":
      return target.kind === "custom-single-day" && query.date === target.date
    case "custom-range":
      return (
        target.kind === "custom-range" &&
        query.startDate === target.startDate &&
        query.endDate === target.endDate
      )
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
  const { query, setQuery } = useReportWindow()
  const { report, isLoading, error } = useBusinessReport(businessReportPort, query)

  // Custom date form state
  const [customMode, setCustomMode] = useState<"single" | "range">("single")
  const [singleDate, setSingleDate] = useState(todayArgentina())
  const [rangeStart, setRangeStart] = useState(todayArgentina())
  const [rangeEnd, setRangeEnd] = useState(todayArgentina())
  const [dateError, setDateError] = useState<string | null>(null)

  const isCustomActive = query.kind === "custom-single-day" || query.kind === "custom-range"

  const handleCustomApply = () => {
    setDateError(null)

    if (customMode === "single") {
      if (!singleDate) {
        setDateError("Seleccioná una fecha")
        return
      }
      setQuery({ kind: "custom-single-day", date: singleDate })
    } else {
      if (!rangeStart || !rangeEnd) {
        setDateError("Seleccioná ambas fechas")
        return
      }
      if (rangeEnd < rangeStart) {
        setDateError("La fecha final debe ser igual o posterior a la inicial")
        return
      }
      setQuery({ kind: "custom-range", startDate: rangeStart, endDate: rangeEnd })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Window selector */}
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="size-4 text-muted-foreground" />
        <div className="flex rounded-lg border border-border bg-background p-1">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setQuery({ kind: "fixed", window: opt.value })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isQueryActive(query, { kind: "fixed", window: opt.value })
                  ? "bg-[#006c3a] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom date toggle */}
        <button
          type="button"
          onClick={() => {
            if (!isCustomActive) {
              handleCustomApply()
            }
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors border ${
            isCustomActive
              ? "bg-[#006c3a] text-white shadow-sm border-[#006c3a]"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Personalizado
        </button>
      </div>

      {/* Custom date controls */}
      {isCustomActive && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border bg-background p-1">
            {CUSTOM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCustomMode(opt.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  customMode === opt.value
                    ? "bg-[#006c3a] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {customMode === "single" ? (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Fecha:</label>
              <Input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="w-44"
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Desde:</label>
                <Input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Hasta:</label>
                <Input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="w-44"
                />
              </div>
            </>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleCustomApply}
            className="bg-[#006c3a] hover:bg-[#005a30] text-white"
          >
            Aplicar
          </Button>

          {dateError && (
            <p className="text-sm text-destructive w-full">{dateError}</p>
          )}
        </div>
      )}

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
