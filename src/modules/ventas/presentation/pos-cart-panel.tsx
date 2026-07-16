"use client"

import { memo, useMemo } from "react"
import { ShoppingCart, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { formatCurrency } from "@/shared/presentation/currency"
import { isAdHocItem, type AdHocCartItem, type CartItem, type CartProduct, type CatalogCartItem } from "../domain/cart"
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
  // Ad-hoc items: use draft fields, no product reference
  if (item.kind === "ad-hoc") {
    const subtotal = item.unitPrice * item.quantity
    const removeId = item.draftId

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
            <h3 className="truncate text-sm font-semibold text-foreground">{item.name}</h3>
            <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-medium border-blue-200 bg-blue-50 text-blue-700">
              Ocasional
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(item.unitPrice)} c/u · {item.quantity} u
          </p>
          {item.description && (
            <p className="text-xs text-muted-foreground/70 italic">{item.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="min-w-[4.5rem] text-right text-base font-bold text-foreground tabular-nums">
            {formatCurrency(subtotal)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(removeId, rowId)}
            aria-label={`Quitar ${item.name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  // Catalog items
  const { product, quantity } = item
  const unitPrice = product.price
  const hasManualTotal = !!item.manualLineTotal

  // For protected items with manual total, display that; otherwise unitPrice * quantity
  const subtotal = hasManualTotal
    ? Number.parseFloat(item.manualLineTotal!)
    : unitPrice * quantity

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
          <h3 className="truncate text-sm font-semibold text-foreground">{product.name}</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(unitPrice)} c/u · {quantity} {product.unit}
        </p>
        {hasManualTotal && (
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-medium border-amber-200 bg-amber-50 text-amber-700">
              Precio manual
            </Badge>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="min-w-[4.5rem] text-right text-base font-bold text-foreground tabular-nums">
          {formatCurrency(subtotal)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(product.id, rowId)}
          aria-label={`Quitar ${product.name}`}
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

function rowKey(item: CartItem, suffix: string, index: number): string {
  if (item.kind === "ad-hoc") return `${item.draftId}-${suffix}-${index}`
  return `${item.product.id}-${suffix}-${index}`
}

/**
 * Build CartItem-shaped display objects from split group entries by
 * looking up product details from the aggregated cart (catalog and ad-hoc).
 */
function resolveSplitGroupItems(
  group: SplitTicketGroupDraft | undefined,
  productMap: Map<string, CartProduct>,
  adHocMap: Map<string, AdHocCartItem>,
  groupLabel: SplitItemGroup,
): { item: CartItem; group: SplitItemGroup; rowId?: string }[] {
  if (!group) return []
  const result: { item: CartItem; group: SplitItemGroup; rowId?: string }[] = []
  for (const si of group.items) {
    // Try catalog lookup first (productId matches a catalog product)
    const product = productMap.get(si.productId)
    if (product) {
      const catalogItem: CatalogCartItem = { kind: "catalog", product, quantity: si.quantity }
      result.push({ item: catalogItem, group: groupLabel, rowId: si.rowId })
      continue
    }
    // Try ad-hoc lookup (ad-hoc split entries use row.id as productId)
    const adHoc = adHocMap.get(si.productId)
    if (adHoc) {
      result.push({ item: { ...adHoc, quantity: si.quantity }, group: groupLabel, rowId: si.rowId })
    }
  }
  return result
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
    () => new Map(
      cartItems
        .filter((ci): ci is CatalogCartItem => ci.kind === "catalog")
        .map((ci) => [ci.product.id, ci.product])
    ),
    [cartItems],
  )

  // Ad-hoc cart item lookup by draftId — used by split preview to render
  // ad-hoc rows in the grouped split view.
  const adHocMap = useMemo(
    () => new Map(
      cartItems
        .filter((ci): ci is AdHocCartItem => ci.kind === "ad-hoc")
        .map((ci) => [ci.draftId, ci])
    ),
    [cartItems],
  )

  // Resolve row-based split display items when splitGroups is provided
  const rowBasedGroupAItems = useMemo(
    () => (splitEnabled && splitGroups ? resolveSplitGroupItems(splitGroups[0], productMap, adHocMap, "A") : null),
    [splitEnabled, splitGroups, productMap, adHocMap],
  )

  const rowBasedGroupBItems = useMemo(
    () => (splitEnabled && splitGroups ? resolveSplitGroupItems(splitGroups[1], productMap, adHocMap, "B") : null),
    [splitEnabled, splitGroups, productMap, adHocMap],
  )

  // Legacy fallback: filter aggregated cart items by product-id group
  const legacyGroupAItems = splitEnabled && !splitGroups
    ? cartItems.filter((ci) => ci.kind === "catalog" && itemGroups?.get(ci.product.id) === "A")
    : []
  const legacyGroupBItems = splitEnabled && !splitGroups
    ? cartItems.filter((ci) => ci.kind === "catalog" && itemGroups?.get(ci.product.id) === "B")
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
                ? rowBasedGroupAItems!.map(({ item, group, rowId }, i) =>
                    <CartRow
                      key={rowKey(item, "a", i)}
                      item={item}
                      group={group}
                      hasSplit
                      rowId={rowId}
                      onRemove={onRemove}
                    />
                  )
                : legacyGroupAItems.map((item) =>
                    <CartRow
                      key={(item as CatalogCartItem).product.id}
                      item={item}
                      group="A"
                      hasSplit
                      onRemove={onRemove}
                    />
                  )
              }
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
                ? rowBasedGroupBItems!.map(({ item, group, rowId }, i) =>
                    <CartRow
                      key={rowKey(item, "b", i)}
                      item={item}
                      group={group}
                      hasSplit
                      rowId={rowId}
                      onRemove={onRemove}
                    />
                  )
                : legacyGroupBItems.map((item) =>
                    <CartRow
                      key={(item as CatalogCartItem).product.id}
                      item={item}
                      group="B"
                      hasSplit
                      onRemove={onRemove}
                    />
                  )
              }
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
                  key={isAdHocItem(item) ? item.draftId : (item.lineId ?? item.product.id)}
                  item={item}
                  hasSplit={false}
                  rowId={isAdHocItem(item) ? item.draftId : item.lineId}
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
