"use client"

import { memo } from "react"
import { ShoppingCart, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { formatCurrency } from "@/shared/presentation/currency"
import type { CartItem } from "../domain/cart"

const CartRow = memo(function CartRow({
  item,
  onRemove,
}: {
  item: CartItem
  onRemove: (productId: string) => void
}) {
  return (
    <div className="-mx-6 flex items-start justify-between gap-4 border-b border-border px-6 py-3.5 transition-colors last:border-b-0 hover:bg-[#F0F4F2]">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-foreground">{item.product.name}</h3>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(item.product.price)} c/u · {item.quantity} {item.product.unit}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="min-w-[4.5rem] text-right text-base font-bold text-foreground tabular-nums">
          {formatCurrency(item.product.price * item.quantity)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(item.product.id)}
          aria-label={`Quitar ${item.product.name}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
})

export interface PosCartPanelProps {
  cartItems: CartItem[]
  onRemove: (productId: string) => void
}

export function PosCartPanel({ cartItems, onRemove }: PosCartPanelProps) {
  const isCartEmpty = cartItems.length === 0

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border p-6">
        <div className="flex items-center gap-3 text-foreground">
          <ShoppingCart className="size-7" />
          <h2 className="text-2xl font-semibold">Carrito</h2>
        </div>
        <Badge variant="secondary" className="rounded-full px-4 py-1.5 text-sm font-medium">
          {cartItems.length} ítems
        </Badge>
      </div>

      {isCartEmpty ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShoppingCart />
              </EmptyMedia>
              <EmptyTitle>Carrito vacío</EmptyTitle>
              <EmptyDescription>
                Escaneá productos con el lector o escribí el código.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="px-6">
            <div className="flex flex-col py-2">
              {cartItems.map((item) => (
                <CartRow
                  key={item.product.id}
                  item={item}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
