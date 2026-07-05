"use client"

import { memo } from "react"
import { Pencil } from "lucide-react"

import { formatCurrency } from "@/shared/presentation/currency"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getStockStatus } from "../domain/product"
import type { Product } from "../domain/product"

function StockBadge({ product }: { product: { stock: number | null; stockMinimum: number } }) {
  const status = getStockStatus(product)
  if (status === "UNKNOWN_STOCK") {
    return <Badge variant="outline">No disponible</Badge>
  }
  if (status === "OUT_OF_STOCK") {
    return <Badge variant="destructive">Agotado</Badge>
  }
  if (status === "LOW_STOCK") {
    return <Badge variant="destructive">Stock bajo</Badge>
  }
  return <Badge variant="secondary">En stock</Badge>
}

interface ProductRowProps {
  product: Product
  onEdit: (product: Product) => void
}

const ProductRow = memo(function ProductRow({ product, onEdit }: ProductRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{product.name}</TableCell>
      <TableCell className="text-muted-foreground">{product.sku ?? "—"}</TableCell>
      <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
      <TableCell className="text-right">
        {product.stock === null ? "N/D" : `${product.stock} ${product.unit}`}
      </TableCell>
      <TableCell>
        <StockBadge product={product} />
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(product)}
          aria-label={`Editar ${product.name}`}
        >
          <Pencil />
        </Button>
      </TableCell>
    </TableRow>
  )
})

interface ProductTableBodyProps {
  products: Product[]
  onEdit: (product: Product) => void
}

export function ProductTableBody({ products, onEdit }: ProductTableBodyProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Producto</TableHead>
            <TableHead className="w-[25%]">SKU</TableHead>
            <TableHead className="w-[12%] text-right">Precio</TableHead>
            <TableHead className="w-[12%] text-right">Stock</TableHead>
            <TableHead className="w-[10%]">Estado</TableHead>
            <TableHead className="w-[6%] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <ProductRow key={p.id} product={p} onEdit={onEdit} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export { StockBadge, ProductRow }
