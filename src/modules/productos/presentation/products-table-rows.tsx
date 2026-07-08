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
      <TableCell className="font-medium">
        <div className="flex flex-col gap-1 items-start">
          <span>{product.name}</span>
                  {product.promotions && product.promotions.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {product.promotions[0].type === 'two_x_one' 
                        ? '2x1' 
                        : product.promotions[0].type === 'percentage'
                          ? `${product.promotions[0].discount_percent}% OFF`
                          : product.promotions[0].description}
                    </Badge>
                  )}
        </div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">{product.sku ?? "—"}</TableCell>
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
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Producto</TableHead>
            <TableHead className="hidden w-[22%] sm:table-cell">SKU</TableHead>
            <TableHead className="w-[14%] text-right">Precio</TableHead>
            <TableHead className="w-[12%] text-right">Stock</TableHead>
            <TableHead className="w-[8%]">Estado</TableHead>
            <TableHead className="w-[4%] text-right">Acciones</TableHead>
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

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

import { Skeleton } from "@/components/ui/skeleton"

const SKELETON_ROWS = 8

export function ProductsTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Producto</TableHead>
            <TableHead className="hidden w-[22%] sm:table-cell">SKU</TableHead>
            <TableHead className="w-[14%] text-right">Precio</TableHead>
            <TableHead className="w-[12%] text-right">Stock</TableHead>
            <TableHead className="w-[8%]">Estado</TableHead>
            <TableHead className="w-[4%] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-[70%]" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-[60%]" />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-16" />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-12" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <Skeleton className="size-6 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
