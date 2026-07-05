import type { PaymentMethodCode } from "../domain/payment-method"
import type { Sale } from "../domain/sale"

export interface SplitTicketGroupDraft {
  label: string
  items: { productId: string; quantity: number; rowId?: string }[]
}

export interface CheckoutDraft {
  /** Backend-aligned items array — product_id + quantity only */
  items: { productId: string; quantity: number }[]
  /** Non-empty array of payment method codes */
  paymentMethods: PaymentMethodCode[]
  /** Whether to request ARCA invoice emission */
  invoiceRequested: boolean
  /** Optional split-ticket groups — sent only when split is active and valid */
  splitTicketGroups?: SplitTicketGroupDraft[]
}

export interface CheckoutPort {
  save(draft: CheckoutDraft): Promise<Sale>
}
