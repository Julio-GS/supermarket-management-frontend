import type { PaymentMethodCode } from "./payment-method"

export interface PaymentAllocation {
  method: PaymentMethodCode
  /** Decimal string from backend (e.g. "4000.00") */
  amount: string
}

export interface SaleItem {
  productId: string
  name: string
  quantity: number
  /** Decimal string from backend (e.g. "7501.50") */
  unitPrice: string
  /** Decimal string from backend */
  subtotal: string
  discountAmount?: string | null
  appliedPromotionId?: string | null
  appliedPromotionType?: string | null
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
  /** Invoice status: none | issued | failed */
  invoiceStatus: "none" | "issued" | "failed"
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
