import type { Sale } from "../domain/sale"
import type { CheckoutPort } from "../application/checkout-port"

let globalSequence = 10429

export function createMockCheckoutAdapter(initialSales: Sale[] = []): CheckoutPort {
  let sales = [...initialSales]
  let sequence = globalSequence

  return {
    async save(draft) {
      const sale: Sale = {
        ...draft,
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
