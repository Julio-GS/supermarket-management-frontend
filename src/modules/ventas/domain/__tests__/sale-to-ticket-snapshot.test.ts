import { describe, expect, it } from "vitest"
import { saleToCheckoutTicketSnapshot } from "../sale-to-ticket-snapshot"
import type { Sale } from "../sale"

// ---------------------------------------------------------------------------
// Shared fixture helpers
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
        appliedPromotions: [],
        appliedPromotionId: null,
        appliedPromotionType: null,
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
// Non-fiscal reprint mapping
// ---------------------------------------------------------------------------

describe("saleToCheckoutTicketSnapshot — non-fiscal sale", () => {
  it("maps a non-fiscal Sale to a non-fiscal CheckoutTicketSnapshot", () => {
    const sale = makeSale()

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.saleId).toBe("V-00042")
    expect(snapshot.saleDate).toBe("2026-07-01T15:30:00Z")
    expect(snapshot.invoiceStatus).toBe("none")
    expect(snapshot.items).toHaveLength(2)
    expect(snapshot.items[0].productId).toBe("P001")
    expect(snapshot.items[0].name).toBe("Leche entera 1L")
    expect(snapshot.items[0].quantity).toBe(2)
    expect(snapshot.items[0].unitPrice).toBe("120.00")
    expect(snapshot.items[0].subtotal).toBe("240.00")
  })

  it("preserves the sale.total as the authoritative total", () => {
    const sale = makeSale({ total: "3500.00" })

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.total).toBe("3500.00")
  })

  it("maps payment methods from sale.paymentMethods", () => {
    const sale = makeSale({
      paymentMethods: [
        { method: "cash", amount: "200.00" },
        { method: "card", amount: "220.50" },
      ],
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.payments).toHaveLength(2)
    expect(snapshot.payments[0]).toEqual({ method: "cash", amount: "200.00" })
    expect(snapshot.payments[1]).toEqual({ method: "card", amount: "220.50" })
  })

  it("sets manual discount to null for historical sales without metadata", () => {
    const sale = makeSale()

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.manualDiscount).toBeNull()
    expect(snapshot.manualDiscountCents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Fiscal reprint mapping
// ---------------------------------------------------------------------------

describe("saleToCheckoutTicketSnapshot — fiscal sale", () => {
  it("maps a fiscal Sale to a fiscal CheckoutTicketSnapshot", () => {
    const sale = makeSale({
      invoiceStatus: "issued",
      cae: "12345678901234",
      caeVto: "2026-07-15",
      cbteNro: "0000042",
      cbteTipo: "1",
      ptoVta: "0001",
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.invoiceStatus).toBe("issued")
    expect(snapshot.cae).toBe("12345678901234")
    expect(snapshot.caeVto).toBe("2026-07-15")
    expect(snapshot.cbteNro).toBe("0000042")
    expect(snapshot.cbteTipo).toBe("1")
    expect(snapshot.ptoVta).toBe("0001")
  })

  it("preserves item-level promotion data from the persisted sale", () => {
    const sale = makeSale({
      invoiceStatus: "issued",
      cae: "CAE123",
      caeVto: "2026-08-01",
      cbteNro: "0000100",
      cbteTipo: "1",
      ptoVta: "0001",
      items: [
        {
          productId: "P001",
          name: "Leche entera 1L",
          quantity: 2,
          unitPrice: "120.00",
          subtotal: "240.00",
          discountAmount: "30.00",
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
      ],
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.items[0].discountAmount).toBe("30.00")
    expect(snapshot.items[0].appliedPromotions).toHaveLength(1)
    expect(snapshot.items[0].appliedPromotions[0].promotionId).toBe("promo-1")
  })

  it("does NOT invent manual discount labels for historical fiscal sales", () => {
    const sale = makeSale({
      invoiceStatus: "issued",
      cae: "CAE123",
      caeVto: "2026-08-01",
      cbteNro: "0000100",
      cbteTipo: "1",
      ptoVta: "0001",
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.manualDiscount).toBeNull()
    expect(snapshot.manualDiscountCents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("saleToCheckoutTicketSnapshot — edge cases", () => {
  it("maps sale items with empty name to empty string", () => {
    const sale = makeSale({
      items: [
        {
          productId: "P003",
          name: "",
          quantity: 1,
          unitPrice: "50.00",
          subtotal: "50.00",
          discountAmount: "0.00",
          appliedPromotions: [],
          appliedPromotionId: null,
          appliedPromotionType: null,
        },
      ],
      total: "50.00",
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.items[0].name).toBe("")
  })

  it("maps a sale with no items to an empty items array", () => {
    const sale = makeSale({ items: [], total: "0.00" })

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.items).toHaveLength(0)
  })

  it("maps split ticket groups from persisted sale when present", () => {
    const sale = makeSale({
      splitTicketGroups: [
        {
          label: "A",
          items: [
            { productId: "P001", quantity: 2, unitPrice: "120.00", subtotal: "240.00" },
          ],
        },
        {
          label: "B",
          items: [
            { productId: "P002", quantity: 1, unitPrice: "180.50", subtotal: "180.50" },
          ],
        },
      ],
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.splitGroups).toHaveLength(2)
    expect(snapshot.splitGroups![0].label).toBe("A")
    expect(snapshot.splitGroups![0].items).toHaveLength(1)
    expect(snapshot.splitGroups![0].items[0].productId).toBe("P001")
    expect(snapshot.splitGroups![0].items[0].quantity).toBe(2)
    // rowId should be undefined for historical sales without row IDs
    expect(snapshot.splitGroups![0].items[0].rowId).toBeUndefined()
        // Authoritative unitPrice and subtotal from historical split group items
        expect(snapshot.splitGroups![0].items[0].unitPrice).toBe("120.00")
        expect(snapshot.splitGroups![0].items[0].subtotal).toBe("240.00")
        expect(snapshot.splitGroups![1].items[0].unitPrice).toBe("180.50")
        expect(snapshot.splitGroups![1].items[0].subtotal).toBe("180.50")
    expect(snapshot.splitGroups![1].label).toBe("B")
    expect(snapshot.splitGroups![1].items[0].productId).toBe("P002")
  })

  it("sets splitGroups to undefined when sale has no split groups", () => {
    const sale = makeSale({ splitTicketGroups: null })

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.splitGroups).toBeUndefined()
  })

  it("preserves item description from persisted sale", () => {
    const sale = makeSale({
      items: [
        {
          productId: "P004",
          name: "Producto especial",
          description: "Descripción adicional",
          quantity: 1,
          unitPrice: "99.00",
          subtotal: "99.00",
          discountAmount: "0.00",
          appliedPromotions: [],
          appliedPromotionId: null,
          appliedPromotionType: null,
        },
      ],
      total: "99.00",
    })

    const snapshot = saleToCheckoutTicketSnapshot(sale)

    expect(snapshot.items[0].description).toBe("Descripción adicional")
  })
})
