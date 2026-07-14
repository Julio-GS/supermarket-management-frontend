import type { PaymentAllocation, Sale } from "../domain/sale"

export interface SplitTicketGroupDraft {
  label: string
  items: { productId: string; quantity: number; rowId?: string }[]
}

export interface CheckoutDraft {
  /** Backend-aligned items array — product_id + quantity only */
  items: { productId: string; quantity: number; lineTotal?: string }[]
  /** Payment allocations with method + amount (e.g. [{ method: "cash", amount: "4000.00" }]) */
  paymentMethods: PaymentAllocation[]
  /** Whether to request ARCA invoice emission */
  invoiceRequested: boolean
  /** Optional split-ticket groups — sent only when split is active and valid */
  splitTicketGroups?: SplitTicketGroupDraft[]
}

export interface CheckoutPort {
  save(draft: CheckoutDraft): Promise<Sale>
}
