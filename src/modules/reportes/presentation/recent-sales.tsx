"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/shared/presentation/currency"
import { PAYMENT_METHOD_LABELS, type PaymentMethodCode } from "@/modules/ventas"
import { useRecentSales } from "../application/use-recent-sales"
import type { RecentSalesPort } from "../application/recent-sales-port"

export interface RecentSalesProps {
  port: RecentSalesPort
}

const SKELETON_ROWS = 6

export function RecentSales({ port }: RecentSalesProps) {
  const { sales, staleness, isLoading } = useRecentSales(port)

  const stalenessLabel =
    staleness === "stale"
      ? " (sin conexión — datos locales)"
      : staleness === "unavailable"
        ? " (no disponible)"
        : ""

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas recientes</CardTitle>
        <CardDescription>Últimas transacciones registradas hoy{stalenessLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden sm:table-cell">Pago</TableHead>
              <TableHead className="hidden md:table-cell">Hora</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              : sales.slice(0, 6).map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.id}</TableCell>
                    <TableCell className="text-muted-foreground">{sale.customer}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {sale.paymentMethods.map((pm) => (
                          <Badge key={pm.method} variant="secondary" className="text-xs">
                            {PAYMENT_METHOD_LABELS[pm.method as PaymentMethodCode] ?? pm.method}{" "}
                            {formatCurrency(pm.amount)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {new Date(sale.date).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(sale.total)}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

