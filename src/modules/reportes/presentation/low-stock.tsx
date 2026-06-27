"use client"

import { AlertTriangle } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLowStock } from "../application/use-low-stock"
import type { LowStockPort } from "../application/low-stock-port"

export interface LowStockProps {
  port: LowStockPort
}

export function LowStock({ port }: LowStockProps) {
  const { products } = useLowStock(port)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <CardTitle>Stock bajo</CardTitle>
        </div>
        <CardDescription>
          {products.length} productos requieren reposición
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-tight">{product.name}</span>
            </div>
            <Badge variant="destructive">
              {product.stock} / {product.stockMinimum} {product.unit}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
