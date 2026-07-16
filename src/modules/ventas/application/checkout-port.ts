import type { PaymentAllocation, Sale } from "../domain/sale"

export interface SplitTicketGroupDraft {
  label: string
  items: { productId: string; quantity: number; rowId?: string }[]
}

/** Per-item split-ticket allocation for a single checkout row. */
export interface ItemSplitTicketDraft {
  group_1_quantity: number
  group_2_quantity: number
}

/** Catalog-fixed checkout item (standard product with catalog price). */
export interface CatalogFixedCheckoutItem {
  kind: "catalog-fixed"
  productId: string
  quantity: number
  splitTicket?: ItemSplitTicketDraft
}

/** Catalog-manual checkout item (special product with manual price). */
export interface CatalogManualCheckoutItem {
  kind: "catalog-manual"
  productId: string
  quantity: 1
  lineTotal: string
  splitTicket?: ItemSplitTicketDraft
}

/** Ad-hoc checkout item (non-catalog line entered by cashier). */
export interface AdHocCheckoutItem {
  kind: "ad-hoc"
  draftId: string
  name: string
  description?: string
  unitPrice: string
  quantity: number
  splitTicket?: ItemSplitTicketDraft
}

/** Discriminated union of all checkout item kinds. */
export type CheckoutItemDraft =
  | CatalogFixedCheckoutItem
  | CatalogManualCheckoutItem
  | AdHocCheckoutItem

export interface CheckoutDraft {
  /** Checkout items as a discriminated union of catalog-fixed, catalog-manual, and ad-hoc. */
  items: CheckoutItemDraft[]
  /** Payment allocations with method + amount (e.g. [{ method: "cash", amount: "4000.00" }]) */
  paymentMethods: PaymentAllocation[]
  /** Whether to request ARCA invoice emission */
  invoiceRequested: boolean
  /**
   * Optional split-ticket groups — sent only when split is active and valid
   * AND no ad-hoc items are present. Ad-hoc/mixed split sales use per-item
   * splitTicket instead.
   */
  splitTicketGroups?: SplitTicketGroupDraft[]
}

export interface CheckoutPort {
  save(draft: CheckoutDraft): Promise<Sale>
}
