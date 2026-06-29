"use client"

import { memo, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Pencil } from "lucide-react"

import { formatCurrency } from "@/shared/presentation/currency"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getStockStatus } from "../domain/product"
import type { Product } from "../domain/product"

const VIRTUALIZATION_THRESHOLD = 100
const ROW_HEIGHT = 53

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
      <TableCell className="text-muted-foreground">{product.sku}</TableCell>
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

interface VirtualizedProductRowsProps {
  products: Product[]
  onEdit: (product: Product) => void
}

function VirtualizedProductRows({ products, onEdit }: VirtualizedProductRowsProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()

  return (
    <div ref={parentRef} className="max-h-[600px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <tr>
            <td colSpan={6} style={{ height: totalHeight, position: "relative" }}>
              {virtualRows.map((virtualRow) => {
                const product = products[virtualRow.index]
                return (
                  <div
                    key={product.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <Table className="border-0">
                      <TableBody className="border-0">
                        <ProductRow product={product} onEdit={onEdit} />
                      </TableBody>
                    </Table>
                  </div>
                )
              })}
            </td>
          </tr>
        </TableBody>
      </Table>
    </div>
  )
}

interface ProductTableBodyProps {
  products: Product[]
  onEdit: (product: Product) => void
}

export function ProductTableBody({ products, onEdit }: ProductTableBodyProps) {
  if (products.length >= VIRTUALIZATION_THRESHOLD) {
    return <VirtualizedProductRows products={products} onEdit={onEdit} />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
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

export { StockBadge, ProductRow, VirtualizedProductRows }
