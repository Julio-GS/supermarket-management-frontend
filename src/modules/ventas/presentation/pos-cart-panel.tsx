"use client"

import { memo, useMemo } from "react"
import { ShoppingCart, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { formatCurrency } from "@/shared/presentation/currency"
import type { CartItem, CartProduct } from "../domain/cart"
import type { SplitItemGroup } from "../domain/default-split"
import type { SplitTicketGroupDraft } from "../application/checkout-port"

const GROUP_COLORS: Record<SplitItemGroup, string> = {
  A: "border-[#006c3a] bg-[#F0F4F2] text-[#006c3a]",
  B: "border-[#1e40af] bg-[#eff6ff] text-[#1e40af]",
}

const CartRow = memo(function CartRow({
  item,
  group,
  hasSplit,
  rowId,
  onRemove,
}: {
  item: CartItem
  group?: SplitItemGroup
  hasSplit: boolean
  rowId?: string
  onRemove: (productId: string, rowId?: string) => void
}) {
  const promotion = item.product.promotions?.[0]
  let estimatedDiscountLabel = null
  
  if (promotion) {
    if (promotion.type === "percentage" && promotion.discount_percent) {
      const discountAmount = (item.product.price * promotion.discount_percent) / 100 * item.quantity
      estimatedDiscountLabel = `Estimated discount: ${formatCurrency(discountAmount)} (approx.)`
    } else if (promotion.type === "two_x_one") {
      const freeUnits = Math.floor(item.quantity / 2)
      if (freeUnits > 0) {
        const discountAmount = freeUnits * item.product.price
        estimatedDiscountLabel = `Estimated discount: ${formatCurrency(discountAmount)} (${freeUnits} free unit${freeUnits !== 1 ? 's' : ''}, approx.)`
      }
    }
  }

  return (
    <div className="-mx-6 flex items-start justify-between gap-4 border-b border-border px-6 py-3.5 transition-colors last:border-b-0 hover:bg-[#F0F4F2]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {hasSplit && group && (
            <Badge
              variant="outline"
              className={`shrink-0 rounded-md px-1.5 py-0 text-xs font-bold ${GROUP_COLORS[group]}`}
            >
              {group}
            </Badge>
          )}
          <h3 className="truncate text-sm font-semibold text-foreground">{item.product.name}</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(item.product.price)} c/u · {item.quantity} {item.product.unit}
        </p>
        {estimatedDiscountLabel && (
          <p className="mt-1 text-xs font-medium text-emerald-600">
            {estimatedDiscountLabel}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="min-w-[4.5rem] text-right text-base font-bold text-foreground tabular-nums">
          {formatCurrency(item.product.price * item.quantity)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(item.product.id, rowId)}
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
  onRemove: (productId: string, rowId?: string) => void
  /** Per-item group assignment when split is enabled */
  itemGroups?: Map<string, SplitItemGroup>
  /** Whether split-ticket mode is active */
  splitEnabled?: boolean
  /**
   * Row-based split groups for direct rendering when split is enabled.
   * When provided, the cart panel renders per-row split items instead of
   * filtering aggregated cart items by product-id group.
   * This guarantees parity with scanner-row assignments for repeated products.
   */
  splitGroups?: SplitTicketGroupDraft[]
}

/**
 * Build CartItem-shaped display objects from split group entries by
 * looking up product details (name, price, unit) from the aggregated cart.
 */
function resolveSplitGroupItems(
  group: SplitTicketGroupDraft | undefined,
  productMap: Map<string, CartProduct>,
  groupLabel: SplitItemGroup,
): { item: CartItem; group: SplitItemGroup; rowId?: string }[] {
  if (!group) return []
  return group.items
    .map((si) => {
      const product = productMap.get(si.productId)
      if (!product) return null
      return {
        item: { product, quantity: si.quantity },
        group: groupLabel,
        rowId: si.rowId,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
}

export function PosCartPanel({
  cartItems,
  onRemove,
  itemGroups,
  splitEnabled = false,
  splitGroups,
}: PosCartPanelProps) {
  const isCartEmpty = cartItems.length === 0

  const productMap = useMemo(
    () => new Map(cartItems.map((ci) => [ci.product.id, ci.product])),
    [cartItems],
  )

  // Resolve row-based split display items when splitGroups is provided
  const rowBasedGroupAItems = useMemo(
    () => (splitEnabled && splitGroups ? resolveSplitGroupItems(splitGroups[0], productMap, "A") : null),
    [splitEnabled, splitGroups, productMap],
  )

  const rowBasedGroupBItems = useMemo(
    () => (splitEnabled && splitGroups ? resolveSplitGroupItems(splitGroups[1], productMap, "B") : null),
    [splitEnabled, splitGroups, productMap],
  )

  // Legacy fallback: filter aggregated cart items by product-id group
  const legacyGroupAItems = splitEnabled && !splitGroups
    ? cartItems.filter((ci) => itemGroups?.get(ci.product.id) === "A")
    : []
  const legacyGroupBItems = splitEnabled && !splitGroups
    ? cartItems.filter((ci) => itemGroups?.get(ci.product.id) === "B")
    : []

  // Determine which split data to render
  const hasRowBasedSplit = rowBasedGroupAItems !== null && rowBasedGroupBItems !== null
  const groupACount = hasRowBasedSplit ? rowBasedGroupAItems!.length : legacyGroupAItems.length
  const groupBCount = hasRowBasedSplit ? rowBasedGroupBItems!.length : legacyGroupBItems.length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border p-4 sm:p-6">
        <div className="flex items-center gap-2 sm:gap-3 text-foreground">
          <ShoppingCart className="size-5 sm:size-7" />
          <h2 className="text-xl font-semibold sm:text-2xl">Carrito</h2>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-sm font-medium sm:px-4 sm:py-1.5">
          {cartItems.length} ítems
        </Badge>
      </div>

      {isCartEmpty ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
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
      ) : splitEnabled ? (
        /* Split-grouped view */
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col">
            {/* Group A */}
            <div className="border-b border-border bg-[#F0F4F2]/50 px-6 py-2">
              <Badge
                variant="outline"
                className="rounded-md border-[#006c3a] bg-[#F0F4F2] px-2 py-0.5 text-xs font-bold text-[#006c3a]"
              >
                Ticket A · {groupACount}{" "}
                {groupACount === 1 ? "producto" : "productos"}
              </Badge>
            </div>
            <div className="flex flex-col py-2">
              {hasRowBasedSplit
                ? rowBasedGroupAItems!.map(({ item, group, rowId }, i) => (
                    <CartRow
                      key={`${item.product.id}-a-${i}`}
                      item={item}
                      group={group}
                      hasSplit
                      rowId={rowId}
                      onRemove={onRemove}
                    />
                  ))
                : legacyGroupAItems.map((item) => (
                    <CartRow
                      key={item.product.id}
                      item={item}
                      group="A"
                      hasSplit
                      onRemove={onRemove}
                    />
                  ))}
            </div>

            {/* Group B */}
            <div className="border-b border-border bg-[#eff6ff]/50 px-6 py-2">
              <Badge
                variant="outline"
                className="rounded-md border-[#1e40af] bg-[#eff6ff] px-2 py-0.5 text-xs font-bold text-[#1e40af]"
              >
                Ticket B · {groupBCount}{" "}
                {groupBCount === 1 ? "producto" : "productos"}
              </Badge>
            </div>
            <div className="flex flex-col py-2">
              {hasRowBasedSplit
                ? rowBasedGroupBItems!.map(({ item, group, rowId }, i) => (
                    <CartRow
                      key={`${item.product.id}-b-${i}`}
                      item={item}
                      group={group}
                      hasSplit
                      rowId={rowId}
                      onRemove={onRemove}
                    />
                  ))
                : legacyGroupBItems.map((item) => (
                    <CartRow
                      key={item.product.id}
                      item={item}
                      group="B"
                      hasSplit
                      onRemove={onRemove}
                    />
                  ))}
            </div>
          </div>
        </ScrollArea>
      ) : (
        /* Normal (non-split) view */
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6">
            <div className="flex flex-col py-2">
              {cartItems.map((item) => (
                <CartRow
                  key={item.product.id}
                  item={item}
                  hasSplit={false}
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
