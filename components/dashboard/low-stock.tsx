import { AlertTriangle } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { productosBajoStock } from "@/lib/data"

export function LowStock() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <CardTitle>Stock bajo</CardTitle>
        </div>
        <CardDescription>
          {productosBajoStock.length} productos requieren reposición
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {productosBajoStock.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-tight">{p.nombre}</span>
              <span className="text-xs text-muted-foreground">{p.categoria}</span>
            </div>
            <Badge variant="destructive">
              {p.stock} / {p.stockMinimo} {p.unidad}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
