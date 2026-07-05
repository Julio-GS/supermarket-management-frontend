import type { CartItem } from "./cart"
import type { SplitTicketGroupDraft } from "../application/checkout-port"

/**
 * Per-item group assignment for split-ticket rendering.
 * For the row-based derivation, itemGroups is keyed by rowId so repeated
 * products in different scanner rows retain independent A/B assignment.
 * For the legacy alternating derivation, it is keyed by productId.
 */
export type SplitItemGroup = "A" | "B"

export interface SplitPreviewResult {
  /** Per-item group assignment (key semantics depend on derivation function) */
  itemGroups: Map<string, SplitItemGroup>
  /** Aggregated groups ready for the checkout payload */
  groups: SplitTicketGroupDraft[]
}

/**
 * Lightweight row snapshot for row-based split derivation.
 * Decoupled from ScannerRow so the domain helper stays presentation-agnostic.
 */
export interface RowSplitEntry {
  rowId: string
  rowIndex: number
  productId: string
  quantity: number
}

/**
 * Derive a default 2-group split by alternating items between Group A and Group B.
 * The same output drives both the cart/scanner preview badges AND the checkout payload,
 * guaranteeing parity between what the operator sees and what is submitted.
 *
 * DEPRECATED in favor of deriveRowBasedSplitPreview for split-ticket scenarios.
 * Retained for backward compatibility; not used by the POS terminal when split is
 * enabled (row-based derivation replaces it).
 */
export function deriveDefaultSplitPreview(cartItems: CartItem[]): SplitPreviewResult {
  const groupAItems: { productId: string; quantity: number }[] = []
  const groupBItems: { productId: string; quantity: number }[] = []
  const itemGroups = new Map<string, SplitItemGroup>()

  let toggle = false
  for (const ci of cartItems) {
    const group: SplitItemGroup = toggle ? "B" : "A"
    itemGroups.set(ci.product.id, group)

    const target = toggle ? groupBItems : groupAItems
    target.push({ productId: ci.product.id, quantity: ci.quantity })
    toggle = !toggle
  }

  const groups: SplitTicketGroupDraft[] = [
    { label: "A", items: groupAItems },
    { label: "B", items: groupBItems },
  ]

  return { itemGroups, groups }
}

/**
 * Derive a 2-group split from committed scanner rows based on an anchor row index.
 *
 * The anchorRowIndex marks the first row of Ticket B — it is set at the moment
 * the operator activates the split toggle. Everything committed BEFORE the anchor
 * belongs to Group A (already scanned items); everything AT or AFTER the anchor
 * belongs to Group B (items scanned after activating split).
 *
 * - itemGroups: Map keyed by rowId so UI panels can show per-row A/B badges.
 * - groups: Per-row `{productId, quantity}` entries → backend-compatible payload.
 *
 * @param entries         Committed scanner rows (only rows with resolved product + quantity > 0).
 * @param anchorRowIndex  The row index where Group B starts (set when split is toggled on).
 */
export function deriveRowBasedSplitPreview(
  entries: RowSplitEntry[],
  anchorRowIndex: number,
): SplitPreviewResult {
  const groupAItems: { productId: string; quantity: number; rowId?: string }[] = []
  const groupBItems: { productId: string; quantity: number; rowId?: string }[] = []
  const itemGroups = new Map<string, SplitItemGroup>()

  for (const entry of entries) {
    const group: SplitItemGroup = entry.rowIndex < anchorRowIndex ? "A" : "B"
    itemGroups.set(entry.rowId, group)

    const target = group === "A" ? groupAItems : groupBItems
    target.push({ productId: entry.productId, quantity: entry.quantity, rowId: entry.rowId })
  }

  const groups: SplitTicketGroupDraft[] = [
    { label: "A", items: groupAItems },
    { label: "B", items: groupBItems },
  ]

  return { itemGroups, groups }
}
