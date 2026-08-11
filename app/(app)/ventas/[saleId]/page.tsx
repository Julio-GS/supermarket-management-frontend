"use client"

import { use, useMemo, useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CreditCard,
  FileText,
  Hash,
  Printer,
  Receipt,
  RefreshCw,
  ShoppingBag,
  User,
} from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/shared/presentation/currency"
import {
  PAYMENT_METHOD_LABELS,
  BrowserTicketPrinter,
  FiscalInvoiceDetailPanel,
  buildPrintableTickets,
  canRetryFiscalInvoice,
  createApiSalesRepository,
  formatCaeExpirationDateOnly,
  saleToCheckoutTicketSnapshot,
  type Sale,
} from "@/modules/ventas"

function InvoiceStatusBadge({ status }: { status: Sale["invoiceStatus"] }) {
  switch (status) {
    case "issued":
      return (
        <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
          <FileText className="size-3" />
          Facturada
        </Badge>
      )
    case "failed":
      return (
        <Badge className="gap-1 border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="size-3" />
          Factura fallida
        </Badge>
      )
    case "issuing":
      return (
        <Badge className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
          <RefreshCw className="size-3" />
          Factura en emisión
        </Badge>
      )
    case "ambiguous":
      return (
        <Badge className="gap-1 border-orange-200 bg-orange-50 text-orange-700">
          <AlertTriangle className="size-3" />
          Requiere conciliación
        </Badge>
      )
    case "none":
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Receipt className="size-3" />
          Ticket no fiscal
        </Badge>
      )
  }
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[120px] w-full rounded-xl" />
      <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
  )
}

export default function SaleDetailPage({
  params,
}: {
  params: Promise<{ saleId: string }>
}) {
  const { saleId } = use(params)
  const queryClient = useQueryClient()
  const salesRepo = useMemo(() => createApiSalesRepository(), [])
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [isReprinting, setIsReprinting] = useState(false)
  const [reprintError, setReprintError] = useState<string | null>(null)

  const { data: sale, isLoading, error } = useQuery<Sale>({
    queryKey: ["sale-detail", saleId],
    queryFn: () => salesRepo.getById(saleId),
  })

  const handleRetry = useCallback(async () => {
    if (!sale || !canRetryFiscalInvoice(sale.invoiceStatus)) return
    setIsRetrying(true)
    setRetryError(null)
    try {
      const updated = await salesRepo.retryFiscalInvoice(sale.id)
      queryClient.setQueryData(["sale-detail", saleId], updated)
    } catch (err) {
      setRetryError(
        err instanceof Error ? err.message : "Error al reintentar factura",
      )
    } finally {
      setIsRetrying(false)
    }
  }, [sale, saleId, salesRepo, queryClient])

  const handleReprint = useCallback(async () => {
    if (!sale) return
    setIsReprinting(true)
    setReprintError(null)
    try {
      const snapshot = saleToCheckoutTicketSnapshot(sale)
      const tickets = buildPrintableTickets(snapshot)

      if (!Array.isArray(tickets)) {
        setReprintError(tickets.reason)
        return
      }

      const printer = new BrowserTicketPrinter()
      const result = await printer.print(tickets)

      if (!result.ok) {
        setReprintError(result.reason)
      }
    } catch (err) {
      setReprintError(
        err instanceof Error ? err.message : "Error al reimprimir ticket",
      )
    } finally {
      setIsReprinting(false)
    }
  }, [sale])

  const date = sale
    ? new Date(sale.createdAt).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : ""

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      {/* Back navigation */}
      <Link
        href="/ventas/historial"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver al historial
      </Link>

      {isLoading ? (
        <DetailSkeleton />
      ) : error ? (
        <Card className="rounded-xl border-border bg-card">
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">
              {error instanceof Error ? error.message : "Error al cargar el detalle de la venta"}
            </p>
          </CardContent>
        </Card>
      ) : sale ? (
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Venta #{sale.id}
              </h1>
              <p className="text-sm text-muted-foreground">{date}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReprint}
                disabled={isReprinting}
                aria-label="Reimprimir ticket"
              >
                <Printer className="mr-1.5 size-4" strokeWidth={2.5} />
                {isReprinting ? "Imprimiendo…" : "Reimprimir"}
              </Button>
              <InvoiceStatusBadge status={sale.invoiceStatus} />
            </div>
          </div>

          {reprintError && (
            <p className="text-sm text-destructive" role="alert">
              {reprintError}
            </p>
          )}

          {/* Summary card */}
          <Card className="rounded-xl border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium">{sale.customer}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Fecha:</span>
                  <span className="font-medium">{date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Pago:</span>
                  <span className="font-medium">
                    {sale.paymentMethods
                      .map((pm) => `${PAYMENT_METHOD_LABELS[pm.method]} ${formatCurrency(pm.amount)}`)
                      .join(", ")}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-foreground">Total</span>
                <span className="text-2xl font-bold text-foreground">
                  {formatCurrency(sale.total)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="rounded-xl border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">
                <ShoppingBag className="mr-2 inline size-5" />
                Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {sale.items.map((item, idx) => {
                  const hasDiscount = Number.parseFloat(item.discountAmount) > 0
                  const hasAppliedPromos = item.appliedPromotions && item.appliedPromotions.length > 0

                  return (
                    <div
                      key={item.productId || idx}
                      className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {item.name || `Producto ${item.productId}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                      {hasAppliedPromos ? (
                        <div className="mt-1 rounded bg-emerald-50 px-3 py-2">
                          {item.appliedPromotions.map((ap, apIdx) => (
                            <div key={apIdx} className="flex items-center justify-between text-xs text-emerald-700">
                              <span>
                                {ap.promotionScope === "store" ? "Tienda: " : "Producto: "}
                                {ap.promotionType === "percentage" ? "%" : "2x1"}
                              </span>
                              <span className="font-medium">-{formatCurrency(ap.discountAmount)}</span>
                            </div>
                          ))}
                          <div className="mt-1 flex items-center justify-between border-t border-emerald-200 pt-1 text-xs font-semibold text-emerald-800">
                            <span>Descuento total</span>
                            <span>-{formatCurrency(item.discountAmount)}</span>
                          </div>
                        </div>
                      ) : hasDiscount ? (
                        <div className="flex items-center justify-between text-xs text-emerald-600 mt-1">
                          <span>Promotion discount:</span>
                          <span className="font-medium">-{formatCurrency(item.discountAmount)}</span>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Split ticket reconstruction */}
          {sale.splitTicketGroups && sale.splitTicketGroups.length > 0 && (
            <Card className="rounded-xl border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Tickets divididos</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {sale.splitTicketGroups.map((group) => {
                  const groupTotal = group.items.reduce(
                    (sum, i) => sum + Number.parseFloat(i.subtotal || "0"),
                    0
                  )
                  return (
                    <div key={group.label} className="rounded-lg border border-border p-4">
                      <h3 className="mb-3 text-sm font-bold text-foreground">
                        Grupo {group.label}
                      </h3>
                      <div className="flex flex-col gap-2">
                        {group.items.map((item, idx) => (
                          <div
                            key={`${group.label}-${item.productId || idx}`}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {`Producto ${item.productId}`} × {item.quantity}
                            </span>
                            <span className="font-medium">
                              {formatCurrency(item.subtotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Subtotal grupo {group.label}</span>
                        <span>{formatCurrency(String(groupTotal))}</span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Invoice data */}
          {sale.invoiceStatus === "issued" && (
            <Card className="rounded-xl border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Datos fiscales</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sale.cae && (
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">CAE:</span>
                    <span className="font-mono font-medium">{sale.cae}</span>
                  </div>
                )}
                {(() => {
                  const caeDisplay = formatCaeExpirationDateOnly(sale.caeVto)
                  if (caeDisplay.kind === "empty") return null
                  return (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Vto. CAE:</span>
                      <span className="font-medium">{caeDisplay.label}</span>
                    </div>
                  )
                })()}
                {sale.cbteNro && (
                  <div className="flex items-center gap-2 text-sm">
                    <Receipt className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Comprobante:</span>
                    <span className="font-mono font-medium">{sale.cbteNro}</span>
                  </div>
                )}
                {sale.ptoVta && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Punto de venta:</span>
                    <span className="font-medium">{sale.ptoVta}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fiscal invoice reconciliation / retry */}
          <FiscalInvoiceDetailPanel
            status={sale.invoiceStatus}
            isRetrying={isRetrying}
            retryError={retryError}
            onRetry={handleRetry}
          />
        </div>
      ) : (
        <Card className="rounded-xl border-border bg-card">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Venta no encontrada.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
