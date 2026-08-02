import { describe, expect, it, vi } from "vitest"
import { saleToCheckoutTicketSnapshot } from "@/modules/ventas/domain/sale-to-ticket-snapshot"
import { buildPrintableTickets } from "@/modules/ventas/domain/ticket-builder"
import type { Sale } from "@/modules/ventas/domain/sale"

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "V-00042",
    createdAt: "2026-07-01T15:30:00Z",
    updatedAt: "2026-07-01T15:30:00Z",
    customer: "Mostrador",
    items: [
      {
        productId: "P001",
        name: "Leche entera 1L",
        quantity: 2,
        unitPrice: "120.00",
        subtotal: "240.00",
        discountAmount: "0.00",
        appliedPromotions: [
          {
            promotionId: "promo-1",
            promotionScope: "product",
            promotionType: "percentage",
            discountAmount: "30.00",
          },
        ],
        appliedPromotionId: "promo-1",
        appliedPromotionType: "percentage",
      },
      {
        productId: "P002",
        name: "Pan lactal 500g",
        quantity: 1,
        unitPrice: "180.50",
        subtotal: "180.50",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionId: null,
        appliedPromotionType: null,
      },
    ],
    total: "420.50",
    paymentMethods: [{ method: "cash", amount: "420.50" }],
    invoiceStatus: "none",
    cae: null,
    caeVto: null,
    cbteNro: null,
    cbteTipo: null,
    ptoVta: null,
    invoiceRequestedAt: null,
    splitTicketGroups: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reprint pipeline: Sale → snapshot → printable tickets → printer
// ---------------------------------------------------------------------------

describe("Sale detail reprint pipeline", () => {
  it("builds a non-fiscal ticket from the viewed sale's persisted data", () => {
    const sale = makeSale()

    const snapshot = saleToCheckoutTicketSnapshot(sale)
    const result = buildPrintableTickets(snapshot)

    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result).toHaveLength(1)
    const ticket = result[0]

    // Non-fiscal reprint
    expect(ticket.format).toBe("nonFiscal")
    expect(ticket.fiscal).toBeNull()

    // Uses viewed sale data — not current catalog/cart
    expect(ticket.saleId).toBe("V-00042")
    expect(ticket.items).toHaveLength(2)
    expect(ticket.items[0].name).toBe("Leche entera 1L")
    expect(ticket.items[1].name).toBe("Pan lactal 500g")

    // Preserves original totals
    expect(ticket.total).toBe("420.50")

    // Preserves payment methods
    expect(ticket.payments).toHaveLength(1)
    expect(ticket.payments[0].method).toBe("cash")
    expect(ticket.payments[0].amount).toBe("420.50")

    // No invented discount labels
    expect(ticket.manualDiscount).toBeNull()
    expect(ticket.manualDiscountCents).toBe(0)
  })

  it("builds a fiscal ticket from a viewed fiscal sale's persisted data", () => {
    const sale = makeSale({
      invoiceStatus: "issued",
      cae: "12345678901234",
      caeVto: "2026-07-15",
      cbteNro: "0000042",
      cbteTipo: "1",
      ptoVta: "0001",
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)
    const result = buildPrintableTickets(snapshot)

    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result).toHaveLength(1)
    const ticket = result[0]

    // Fiscal reprint follows invoiceStatus === "issued"
    expect(ticket.format).toBe("fiscal")
    expect(ticket.fiscal).not.toBeNull()
    expect(ticket.fiscal!.cae).toBe("12345678901234")
    expect(ticket.fiscal!.cbteNro).toBe("0000042")

    // Still preserves original sale data
    expect(ticket.saleId).toBe("V-00042")
    expect(ticket.total).toBe("420.50")
  })

  it("preserves original items, totals, and discount amounts from the viewed sale", () => {
    const sale = makeSale({
      items: [
        {
          productId: "P001",
          name: "Producto con descuento",
          quantity: 3,
          unitPrice: "500.00",
          subtotal: "1500.00",
          discountAmount: "150.00",
          appliedPromotions: [
            {
              promotionId: "promo-10",
              promotionScope: "store",
              promotionType: "percentage",
              discountAmount: "150.00",
            },
          ],
          appliedPromotionId: "promo-10",
          appliedPromotionType: "percentage",
        },
      ],
      total: "1350.00",
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)
    const result = buildPrintableTickets(snapshot)

    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result).toHaveLength(1)
    const ticket = result[0]

    // Original item preserved — no catalog lookup
    expect(ticket.items[0].name).toBe("Producto con descuento")
    expect(ticket.items[0].quantity).toBe(3)
    expect(ticket.items[0].unitPrice).toBe("500.00")
    expect(ticket.items[0].subtotal).toBe("1500.00")
    expect(ticket.items[0].discountAmount).toBe("150.00")

    // Ticket total is the authoritative sale total, not item subtotal
    expect(ticket.total).toBe("1350.00")
  })

  it("does not use current catalog, cart, or discount rules for reprint", () => {
    // Simulate a sale that was made with old prices
    const sale = makeSale({
      items: [
        {
          productId: "P001",
          name: "Leche entera 1L",
          quantity: 1,
          unitPrice: "100.00", // old price
          subtotal: "100.00",
          discountAmount: "0.00",
          appliedPromotions: [],
          appliedPromotionId: null,
          appliedPromotionType: null,
        },
      ],
      total: "100.00",
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)
    const result = buildPrintableTickets(snapshot)

    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    // Even if current catalog price is now 120.00, ticket shows 100.00
    // because we use persisted data only
    expect(result[0].total).toBe("100.00")
    expect(result[0].items[0].unitPrice).toBe("100.00")

    // Discount is not invented — manualDiscount is null
    expect(result[0].manualDiscount).toBeNull()
    expect(result[0].manualDiscountCents).toBe(0)
  })

  it("historical sales without manual discount metadata print without invented labels", () => {
    // A historical sale with item-level discounts but no manual discount metadata
    const sale = makeSale({
      items: [
        {
          productId: "P001",
          name: "Item",
          quantity: 1,
          unitPrice: "1000.00",
          subtotal: "1000.00",
          discountAmount: "100.00",
          appliedPromotions: [
            {
              promotionId: "old-promo",
              promotionScope: "product",
              promotionType: "percentage",
              discountAmount: "100.00",
            },
          ],
          appliedPromotionId: "old-promo",
          appliedPromotionType: "percentage",
        },
      ],
      total: "900.00",
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)
    const result = buildPrintableTickets(snapshot)

    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    const ticket = result[0]

    // Item-level promotion discount is preserved
    expect(ticket.items[0].discountAmount).toBe("100.00")

    // No manual discount label invented
    expect(ticket.manualDiscount).toBeNull()
    expect(ticket.manualDiscountCents).toBe(0)

    // Total is the stored sale total
    expect(ticket.total).toBe("900.00")
  })

  it("reprint for 'failed' invoice status produces non-fiscal ticket", () => {
    const sale = makeSale({
      invoiceStatus: "failed",
      cae: null,
      caeVto: null,
      cbteNro: null,
      cbteTipo: null,
      ptoVta: null,
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)
    const result = buildPrintableTickets(snapshot)

    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result[0].format).toBe("nonFiscal")
  })
})
