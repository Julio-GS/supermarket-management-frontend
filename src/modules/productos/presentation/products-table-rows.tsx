"use client"

import { memo } from "react"
import { ArrowUpDown, Pencil, Printer } from "lucide-react"

import { formatCurrency } from "@/shared/presentation/currency"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getStockStatus } from "../domain/product"
import type { Product, ProductPromotionSummary } from "../domain/product"

function StockBadge({ product }: { product: { manejaStock: boolean; stock: number | null; stockMinimum: number } }) {
  if (!product.manejaStock) {
    return <Badge variant="outline">No controla stock</Badge>
  }

  const status = getStockStatus(product)
  if (status === "NON_STOCK") {
    return <Badge variant="outline">No controla stock</Badge>
  }
  if (status === "NEGATIVE_STOCK") {
    return <Badge variant="destructive">Stock negativo</Badge>
  }
  if (status === "OUT_OF_STOCK") {
    return <Badge variant="destructive">Sin stock</Badge>
  }
  if (status === "LOW_STOCK") {
    return <Badge variant="destructive">Stock bajo</Badge>
  }
  return <Badge variant="secondary">En stock</Badge>
}

function bestProductPromo(promotions: ProductPromotionSummary[] | null): ProductPromotionSummary | null {
  if (!promotions || promotions.length === 0) return null
  // Pick the best: highest discount_percent for percentage, prefer 2x1 over percentage on tie
  let best = promotions[0]
  for (const p of promotions) {
    if (p.type === "two_x_one" && best.type !== "two_x_one") {
      best = p
    } else if (p.type === "percentage" && p.discountPercent && best.type === "percentage") {
      if ((p.discountPercent ?? 0) > (best.discountPercent ?? 0)) {
        best = p
      }
    }
  }
  return best
}

function PromotionBadge({ promo }: { promo: ProductPromotionSummary | null }) {
  if (!promo) return null
  const label = promo.type === "two_x_one"
    ? "2x1"
    : `${promo.discountPercent}% OFF`
  return (
    <Badge variant="secondary" className="text-xs">
      {label}
    </Badge>
  )
}

function StorePromoIndicator({ storePromotions }: { storePromotions: ProductPromotionSummary[] | null }) {
  if (!storePromotions || storePromotions.length === 0) return null
  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs">
      +{storePromotions.length} promos tienda
    </Badge>
  )
}

interface ProductRowProps {
  product: Product
  onEdit: (product: Product) => void
  onAdjustStock?: (product: Product) => void
  onPrintLabel?: (product: Product) => void
}

const ProductRow = memo(function ProductRow({ product, onEdit, onAdjustStock, onPrintLabel }: ProductRowProps) {
  const bestPromo = bestProductPromo(product.promotions)
  const hasStorePromos = product.storePromotions && product.storePromotions.length > 0

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex flex-col gap-1 items-start">
          <span>{product.name}</span>
          <div className="flex flex-wrap gap-1">
            {bestPromo && <PromotionBadge promo={bestPromo} />}
            {hasStorePromos && <StorePromoIndicator storePromotions={product.storePromotions} />}
          </div>
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
        <div className="flex items-center justify-end gap-1">
          {onPrintLabel && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="min-h-[44px] min-w-[44px]"
              onClick={() => onPrintLabel(product)}
              aria-label={`Imprimir etiqueta de ${product.name}`}
            >
              <Printer />
            </Button>
          )}
          {product.manejaStock && onAdjustStock && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onAdjustStock(product)}
              aria-label={`Ajustar stock de ${product.name}`}
            >
              <ArrowUpDown />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onEdit(product)}
            aria-label={`Editar ${product.name}`}
          >
            <Pencil />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
})

interface ProductTableBodyProps {
  products: Product[]
  onEdit: (product: Product) => void
  onAdjustStock?: (product: Product) => void
  onPrintLabel?: (product: Product) => void
}

export function ProductTableBody({ products, onEdit, onAdjustStock, onPrintLabel }: ProductTableBodyProps) {
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
            <ProductRow key={p.id} product={p} onEdit={onEdit} onAdjustStock={onAdjustStock} onPrintLabel={onPrintLabel} />
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
