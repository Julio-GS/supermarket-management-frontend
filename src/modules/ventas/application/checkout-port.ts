import type { PaymentMethod } from "../domain/payment-method"
import type { Sale } from "../domain/sale"

export interface CheckoutDraft {
  invoiceRequested: boolean
  customer: string
  items: { productId: string; name: string; quantity: number; price: number }[]
  subtotal: number
  vat: number
  total: number
  paymentMethod: PaymentMethod
  cashier: string
}

export interface CheckoutPort {
  save(draft: CheckoutDraft): Promise<Sale>
}
