"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Calendar, CreditCard } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS } from "@/modules/ventas/domain/payment-method"
import { createApiSalesRepository } from "@/modules/ventas/infrastructure/api-sales-repository"
import type { Sale } from "@/modules/ventas/domain/sale"
import type { SalesPage } from "@/modules/ventas/application/sales-history-port"

const PAGE_SIZE = 20

function SaleRow({ sale }: { sale: Sale }) {
  const date = new Date(sale.createdAt).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <Link href={`/ventas/${sale.id}`}>
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-[#006c3a]/30 hover:bg-[#F0F4F2]/50">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">
              #{sale.id}
            </span>
            {sale.invoiceStatus === "issued" && (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                Facturada
              </Badge>
            )}
            {sale.invoiceStatus === "failed" && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs">
                Factura pendiente
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {date}
            </span>
            <span className="flex items-center gap-1">
              <CreditCard className="size-3" />
              {sale.paymentMethods
                .map((pm) => `${PAYMENT_METHOD_LABELS[pm.method]} ${formatCurrency(pm.amount)}`)
                .join(", ")}
            </span>
          </div>
        </div>
        <span className="text-lg font-bold text-foreground">
          {formatCurrency(sale.total)}
        </span>
      </div>
    </Link>
  )
}

function SalesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
      ))}
    </div>
  )
}

export default function VentasHistorialPage() {
  const [page, setPage] = useState(1)
  const salesRepo = useMemo(() => createApiSalesRepository(), [])

  const { data, isLoading, error } = useQuery<SalesPage>({
    queryKey: ["sales-history", page],
    queryFn: () => salesRepo.getSales({ page, limit: PAGE_SIZE }),
  })

  const sales = data?.data ?? []
  const meta = data?.meta
  const hasNext = meta?.hasNext ?? false
  const hasPrev = page > 1

  const handleNext = useCallback(() => {
    if (hasNext) setPage((p) => p + 1)
  }, [hasNext])

  const handlePrev = useCallback(() => {
    if (hasPrev) setPage((p) => p - 1)
  }, [hasPrev])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Historial de ventas"
        description="Consultá todas las ventas registradas"
      />

      <Card className="rounded-xl border-border bg-card">
        <CardContent className="p-4 sm:p-6">
          {error && (
            <p className="mb-4 text-sm text-destructive" role="alert">
              {error instanceof Error ? error.message : "Error al cargar ventas"}
            </p>
          )}

          {isLoading ? (
            <SalesSkeleton />
          ) : sales.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay ventas registradas.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {sales.map((sale) => (
                <SaleRow key={sale.id} sale={sale} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {(hasPrev || hasNext) && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={handlePrev}
                className="gap-1"
              >
                <ArrowLeft className="size-4" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {meta?.page ?? page} de {meta?.totalPages ?? "?"}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={handleNext}
                className="gap-1"
              >
                Siguiente
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
