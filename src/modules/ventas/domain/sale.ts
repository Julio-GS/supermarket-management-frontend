import type { PaymentMethodCode } from "./payment-method"

// ---- Invoice status domain model ----

export const INVOICE_STATUSES = ["none", "issuing", "issued", "failed", "ambiguous"] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

/**
 * Type guard — checks whether an unknown value is a valid InvoiceStatus.
 * Does NOT throw; use parseInvoiceStatus for parsing with loud failure.
 */
export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return typeof value === "string" && (INVOICE_STATUSES as readonly string[]).includes(value)
}

/**
 * Parse a backend invoice_status value into an InvoiceStatus.
 *
 * Throws on any unknown, missing, or non-string value — never silently
 * defaults to `none`. This ensures backend contract changes are caught
 * in tests and runtime logs instead of being hidden from operators.
 */
export function parseInvoiceStatus(value: unknown): InvoiceStatus {
  if (isInvoiceStatus(value)) return value
  throw new Error(`Unknown invoice status: ${JSON.stringify(value)}`)
}

/**
 * Whether the operator can retry fiscal invoice issuance for this status.
 * True ONLY for `failed`.
 */
export function canRetryFiscalInvoice(status: InvoiceStatus): boolean {
  return status === "failed"
}

/**
 * Whether the fiscal invoice status requires operator reconciliation.
 * True for `issuing` and `ambiguous`.
 */
export function requiresFiscalReconciliation(status: InvoiceStatus): boolean {
  return status === "issuing" || status === "ambiguous"
}

export interface PaymentAllocation {
  method: PaymentMethodCode
  /** Decimal string from backend (e.g. "4000.00") */
  amount: string
}

export interface AppliedPromotion {
  promotionId: string
  promotionScope: "product" | "store"
  promotionType: "percentage" | "two_x_one"
  /** Decimal string from backend (e.g. "450.00") */
  discountAmount: string
}

export interface SaleItem {
  productId: string
  name: string
  /** Optional description from ad-hoc sale lines. Empty string for catalog items. */
  description?: string
  quantity: number
  /** Decimal string from backend (e.g. "7501.50") */
  unitPrice: string
  /** Decimal string from backend */
  subtotal: string
  /** Decimal string from backend — "0.00" if no discount applied */
  discountAmount: string
  /** Stacked promotions that contributed to this item's discount */
  appliedPromotions: AppliedPromotion[]
  /** Legacy — best product promotion UUID only */
  appliedPromotionId: string | null
  /** Legacy — best product promotion type only */
  appliedPromotionType: string | null
}

export interface SplitTicketGroupItem {
  productId: string
  quantity: number
  /** Decimal string from backend */
  unitPrice: string
  /** Decimal string from backend */
  subtotal: string
}

export interface SplitTicketGroup {
  label: string
  items: SplitTicketGroupItem[]
}

export interface Sale {
  id: string
  createdAt: string
  updatedAt: string
  customer: string
  items: SaleItem[]
  /** Decimal string from backend (e.g. "7501.50") */
  total: string
  /** Payment allocations with method + amount from backend */
  paymentMethods: PaymentAllocation[]
  /** Invoice status: none | issuing | issued | failed | ambiguous */
  invoiceStatus: InvoiceStatus
  /** ARCA fiscal fields — null when not invoiced */
  cae: string | null
  caeVto: string | null
  cbteNro: string | null
  cbteTipo: string | null
  ptoVta: string | null
  invoiceRequestedAt: string | null
  /** Split-ticket groups — null when no split was requested */
  splitTicketGroups: SplitTicketGroup[] | null
}
