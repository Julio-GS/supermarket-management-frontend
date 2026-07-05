"use client"

import { use, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  FileText,
  Hash,
  Receipt,
  ShoppingBag,
  User,
} from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS } from "@/modules/ventas/domain/payment-method"
import { createApiSalesRepository } from "@/modules/ventas/infrastructure/api-sales-repository"
import type { Sale } from "@/modules/ventas/domain/sale"

function InvoiceStatusBadge({ status }: { status: Sale["invoiceStatus"] }) {
  if (status === "issued") {
    return (
      <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
        <FileText className="size-3" />
        Facturada
      </Badge>
    )
  }
  if (status === "failed") {
    return (
      <Badge className="gap-1 border-amber-200 bg-amber-50 text-amber-700">
        <FileText className="size-3" />
        Factura fallida
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Receipt className="size-3" />
      Ticket no fiscal
    </Badge>
  )
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
  const salesRepo = useMemo(() => createApiSalesRepository(), [])

  const { data: sale, isLoading, error } = useQuery<Sale>({
    queryKey: ["sale-detail", saleId],
    queryFn: () => salesRepo.getById(saleId),
  })

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
            <InvoiceStatusBadge status={sale.invoiceStatus} />
          </div>

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
                {sale.items.map((item, idx) => (
                  <div
                    key={item.productId || idx}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
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
                ))}
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
                {sale.caeVto && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Vto. CAE:</span>
                    <span className="font-medium">
                      {new Date(sale.caeVto).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                )}
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

          {/* Invoice failed warning */}
          {sale.invoiceStatus === "failed" && (
            <Card className="rounded-xl border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-800">
                La factura electrónica no pudo emitirse para esta venta. Revise manualmente.
              </CardContent>
            </Card>
          )}
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
