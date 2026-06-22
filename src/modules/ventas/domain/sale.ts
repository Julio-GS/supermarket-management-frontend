import type { PaymentMethod } from "./payment-method"

export interface SaleItem {
  name: string
  quantity: number
  price: number
}

export interface Sale {
  id: string
  date: string
  customer: string
  items: SaleItem[]
  subtotal: number
  vat: number
  total: number
  paymentMethod: PaymentMethod
  cashier: string
}
