"use client"

import { useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/shared/presentation/currency"
import { useRecentSales } from "../application/use-recent-sales"
import type { RecentSalesPort } from "../application/recent-sales-port"

export interface RecentSalesProps {
  port: RecentSalesPort
}

export function RecentSales({ port }: RecentSalesProps) {
  const { sales, refresh } = useRecentSales(port)

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas recientes</CardTitle>
        <CardDescription>Últimas transacciones registradas hoy</CardDescription>
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
            {sales.slice(0, 6).map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-medium">{sale.id}</TableCell>
                <TableCell className="text-muted-foreground">{sale.customer}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary">{sale.paymentMethod}</Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {sale.date.split(" ")[1]}
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
