import type { Sale } from "../domain/sale"
import type { CheckoutPort, CheckoutDraft } from "../application/checkout-port"

let globalSequence = 10429

export function createMockCheckoutAdapter(initialSales: Sale[] = []): CheckoutPort {
  let sales = [...initialSales]
  let sequence = globalSequence

  return {
    async save(draft: CheckoutDraft) {
      const sale: Sale = {
        customer: draft.customer,
        items: draft.items,
        subtotal: draft.subtotal,
        vat: draft.vat,
        total: draft.total,
        paymentMethod: draft.paymentMethod,
        cashier: draft.cashier,
        id: `V-${sequence}`,
        date: new Date().toISOString(),
      }
      sequence += 1
      globalSequence = sequence
      sales = [sale, ...sales]
      return sale
    },
  }
}
