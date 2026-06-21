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
import { ventasRecientes, formatoMoneda } from "@/lib/data"

export function RecentSales() {
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
            {ventasRecientes.slice(0, 6).map((venta) => (
              <TableRow key={venta.id}>
                <TableCell className="font-medium">{venta.id}</TableCell>
                <TableCell className="text-muted-foreground">
                  {venta.cliente}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary">{venta.metodoPago}</Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {venta.fecha.split(" ")[1]}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatoMoneda(venta.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
