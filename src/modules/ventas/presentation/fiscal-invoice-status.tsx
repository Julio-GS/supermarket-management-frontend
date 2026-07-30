import { AlertTriangle, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { InvoiceStatus } from "../domain/sale"

export function FiscalInvoiceHistoryIndicator({ status }: { status: InvoiceStatus }) {
  if (status === "issuing") {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle className="size-3" />
        En proceso
      </span>
    )
  }

  if (status === "ambiguous") {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle className="size-3" />
        Revisar
      </span>
    )
  }

  return null
}

interface FiscalInvoiceDetailPanelProps {
  status: InvoiceStatus
  isRetrying: boolean
  retryError: string | null
  onRetry: () => void
}

export function FiscalInvoiceDetailPanel({
  status,
  isRetrying,
  retryError,
  onRetry,
}: FiscalInvoiceDetailPanelProps) {
  if (status === "issuing") {
    return (
      <Card className="rounded-xl border-blue-200 bg-blue-50">
        <CardContent className="flex items-start gap-3 p-4">
          <RefreshCw className="mt-0.5 size-4 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Factura en emisión</p>
            <p className="text-xs text-blue-700">
              La factura electrónica está siendo procesada por ARCA. Si el estado persiste, requiere conciliación manual.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === "ambiguous") {
    return (
      <Card className="rounded-xl border-orange-200 bg-orange-50">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-600" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Requiere conciliación</p>
            <p className="text-xs text-orange-700">
              El estado fiscal de esta factura es ambiguo y requiere revisión manual. No se puede reintentar automáticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === "failed") {
    return (
      <Card className="rounded-xl border-red-200 bg-red-50">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-800">Factura electrónica fallida</p>
              <p className="text-xs text-red-700">
                La factura no pudo emitirse. Podés reintentar el envío a ARCA.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-red-300 text-red-700 hover:bg-red-100"
            onClick={onRetry}
            disabled={isRetrying}
          >
            <RefreshCw className={`mr-2 size-4 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Reintentando…" : "Reintentar factura"}
          </Button>
          {retryError && (
            <p className="text-xs text-red-600" role="alert">
              {retryError}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return null
}

export function FiscalInvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  switch (status) {
    case "issued":
      return (
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
          Facturada
        </Badge>
      )
    case "failed":
      return (
        <Badge className="border-red-200 bg-red-50 text-red-700 text-xs">
          Factura fallida
        </Badge>
      )
    case "issuing":
      return (
        <Badge className="border-blue-200 bg-blue-50 text-blue-700 text-xs">
          En emision
        </Badge>
      )
    case "ambiguous":
      return (
        <Badge className="border-orange-200 bg-orange-50 text-orange-700 text-xs">
          Conciliacion
        </Badge>
      )
    case "none":
    default:
      return null
  }
}
