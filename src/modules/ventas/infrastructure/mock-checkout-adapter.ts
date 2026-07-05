import type { Sale } from "../domain/sale"
import type { CheckoutPort, CheckoutDraft } from "../application/checkout-port"

let globalSequence = 10429

export function createMockCheckoutAdapter(initialSales: Sale[] = []): CheckoutPort {
  let sales = [...initialSales]
  let sequence = globalSequence

  return {
    async save(draft: CheckoutDraft) {
      const sale: Sale = {
        customer: "Mostrador",
        items: draft.items.map((item) => ({
          productId: item.productId,
          name: "",
          quantity: item.quantity,
          unitPrice: "0.00",
          subtotal: "0.00",
        })),
        total: "0.00",
        paymentMethods: draft.paymentMethods,
        invoiceStatus: draft.invoiceRequested ? "none" : "none",
        cae: null,
        caeVto: null,
        cbteNro: null,
        cbteTipo: null,
        ptoVta: null,
        invoiceRequestedAt: draft.invoiceRequested ? new Date().toISOString() : null,
        splitTicketGroups: draft.splitTicketGroups
          ? draft.splitTicketGroups.map((g) => ({
              label: g.label,
              items: g.items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: "0.00",
                subtotal: "0.00",
              })),
            }))
          : null,
        id: `V-${sequence}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      sequence += 1
      globalSequence = sequence
      sales = [sale, ...sales]
      return sale
    },
  }
}
