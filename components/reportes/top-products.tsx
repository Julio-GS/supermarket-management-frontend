import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { productosMasVendidos, formatoMoneda } from "@/lib/data"

export function TopProducts() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos más vendidos</CardTitle>
        <CardDescription>Ranking por unidades vendidas este mes.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productosMasVendidos.map((p, i) => (
              <TableRow key={p.nombre}>
                <TableCell>
                  <Badge variant={i === 0 ? "default" : "secondary"}>{i + 1}</Badge>
                </TableCell>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell className="text-right">{p.unidades.toLocaleString("es-ES")}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatoMoneda(p.ingresos)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
