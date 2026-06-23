import { apiRequest } from "@/shared/infrastructure/api-client"
import type { CheckoutPort, CheckoutDraft } from "../application/checkout-port"
import type { PaymentMethod } from "../domain/payment-method"
import type { Sale } from "../domain/sale"

interface BackendSaleItemDto {
  product_id: string
  quantity: number
}

interface CreateSaleRequestDto {
  invoice_requested: boolean
  items: BackendSaleItemDto[]
}

interface BackendSaleResponseDto {
  id: string
  date: string
  customer: string
  items: { product_id: string; name: string; quantity: number; price: number }[]
  subtotal: number
  vat: number
  total: number
  payment_method: string
  cashier: string
}

function normalizePaymentMethod(value: string | undefined): PaymentMethod {
  if (value === "Efectivo" || value === "Tarjeta" || value === "Transferencia") {
    return value
  }
  return "Efectivo"
}

export function createApiCheckoutAdapter(): CheckoutPort {
  return {
    async save(draft: CheckoutDraft): Promise<Sale> {
      const items: BackendSaleItemDto[] = draft.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      }))

      const dto = await apiRequest<BackendSaleResponseDto>("/sales", {
        method: "POST",
        body: JSON.stringify({
          invoice_requested: draft.invoiceRequested,
          items,
        } satisfies CreateSaleRequestDto),
      })

      return {
        id: dto.id,
        date: dto.date,
        customer: dto.customer ?? draft.customer,
        items:
          dto.items?.map((item) => ({
            productId: item.product_id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })) ?? draft.items,
        subtotal: dto.subtotal ?? draft.subtotal,
        vat: dto.vat ?? draft.vat,
        total: dto.total ?? draft.total,
        paymentMethod: normalizePaymentMethod(dto.payment_method) ?? draft.paymentMethod,
        cashier: dto.cashier ?? draft.cashier,
      }
    },
  }
}
