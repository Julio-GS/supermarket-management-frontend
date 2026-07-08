import type { PaymentAllocation } from "./sale"
import type { SplitTicketGroupDraft } from "../application/checkout-port"

/**
 * Item line captured from the cart at checkout time, before cart reset.
 * Backend SaleItem.name is always "" — the cart is the only trustworthy source
 * for product names and unit prices at checkout.
 */
export interface TicketItemLine {
  productId: string
  name: string
  quantity: number
  /** Decimal string (e.g. "7501.50") */
  unitPrice: string
  /** Decimal string */
  subtotal: string
  discountAmount?: string | null
  appliedPromotionType?: string | null
}

/**
 * Snapshot built in handleCheckout before cart reset.
 * Contains everything needed to render one or more tickets.
 */
export interface CheckoutTicketSnapshot {
  saleId: string
  saleDate: string
  invoiceStatus: "none" | "issued" | "failed"
  /** Cart items captured at checkout time */
  items: TicketItemLine[]
  /** Sale-level payments */
  payments: PaymentAllocation[]
  /** Fiscal fields — null when not invoiced */
  cae: string | null
  caeVto: string | null
  cbteNro: string | null
  cbteTipo: string | null
  ptoVta: string | null
  /** Optional split-ticket groups */
  splitGroups?: SplitTicketGroupDraft[]
}

/** AFIP fiscal fields — all present for a valid fiscal ticket */
export interface FiscalInfo {
  cae: string
  caeVto: string
  cbteNro: string
  cbteTipo: string
  ptoVta: string
}

/**
 * One rendered ticket model.
 *
 * - For non-split sales: exactly one ticket with all items.
 * - For split sales: one ticket per division, each with only that group's items
 *   and proportionally allocated payments.
 */
export interface PrintableTicket {
  format: "fiscal" | "nonFiscal"
  /** Group label (e.g. "A", "B") for split tickets; undefined for single ticket */
  groupLabel?: string
  saleId: string
  saleDate: string
  items: TicketItemLine[]
  /** Total of this ticket (sum of item subtotals in this ticket) */
  total: string
  /** Proportionally allocated payments for this ticket */
  payments: PaymentAllocation[]
  /** Fiscal fields — non-null only when format === "fiscal" */
  fiscal: FiscalInfo | null
}

/** Result of fiscal data validation before building tickets */
export interface FiscalValidationResult {
  ok: false
  reason: string
  missingFields: string[]
}
