import { describe, expect, it } from "vitest"
import { buildPrintableTickets } from "../ticket-builder"
import type { CheckoutTicketSnapshot } from "../ticket"

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

function makeSnapshot(
  overrides: Partial<CheckoutTicketSnapshot> = {}
): CheckoutTicketSnapshot {
  return {
    saleId: "V-00042",
    saleDate: "2026-07-01T15:30:00Z",
    invoiceStatus: "none",
    items: [
      {
        productId: "P001",
        name: "Leche entera 1L",
        quantity: 2,
        unitPrice: "120.00",
        subtotal: "240.00",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null
      },
      {
        productId: "P002",
        name: "Pan lactal 500g",
        quantity: 1,
        unitPrice: "180.50",
        subtotal: "180.50",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null
      },
    ],
    payments: [{ method: "cash", amount: "420.50" }],
    cae: null,
    caeVto: null,
    cbteNro: null,
    cbteTipo: null,
    ptoVta: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Fiscal ticket with all fields
// ---------------------------------------------------------------------------

describe("Fiscal ticket rendering", () => {
  it("builds a fiscal ticket when invoiceStatus is 'issued' and all AFIP fields are present", () => {
    const snapshot = makeSnapshot({
      invoiceStatus: "issued",
      cae: "12345678901234",
      caeVto: "2026-07-15",
      cbteNro: "0000042",
      cbteTipo: "1",
      ptoVta: "0001",
    })

    const result = buildPrintableTickets(snapshot)

    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result).toHaveLength(1)
    const ticket = result[0]

    expect(ticket.format).toBe("fiscal")
    expect(ticket.saleId).toBe("V-00042")
    expect(ticket.fiscal).toEqual({
      cae: "12345678901234",
      caeVto: "2026-07-15",
      cbteNro: "0000042",
      cbteTipo: "1",
      ptoVta: "0001",
    })
    expect(ticket.items).toHaveLength(2)
    expect(ticket.items[0].name).toBe("Leche entera 1L")
    expect(ticket.items[0].subtotal).toBe("240.00")
  })
})

// ---------------------------------------------------------------------------
// Missing-field integrity error
// ---------------------------------------------------------------------------

describe("Fiscal integrity validation", () => {
  it("returns a FiscalValidationResult error when fiscal fields are missing", () => {
    const snapshot = makeSnapshot({
      invoiceStatus: "issued",
      cae: "12345678901234",
      caeVto: null, // missing
      cbteNro: "0000042",
      cbteTipo: "1",
      ptoVta: "0001",
    })

    const result = buildPrintableTickets(snapshot)

    // Should be an error, not an array
    expect(Array.isArray(result)).toBe(false)
    if (Array.isArray(result)) return

    expect(result.ok).toBe(false)
    expect(result.reason).toContain("missing")
    expect(result.missingFields).toContain("caeVto")
    expect(result.missingFields).not.toContain("cae")
  })

  it("detects multiple missing fiscal fields", () => {
    const snapshot = makeSnapshot({
      invoiceStatus: "issued",
      cae: "",
      caeVto: null,
      cbteNro: null,
      cbteTipo: "1",
      ptoVta: "0001",
    })

    const result = buildPrintableTickets(snapshot)

    expect(Array.isArray(result)).toBe(false)
    if (Array.isArray(result)) return

    expect(result.ok).toBe(false)
    expect(result.missingFields).toHaveLength(3)
    expect(result.missingFields).toContain("cae")
    expect(result.missingFields).toContain("caeVto")
    expect(result.missingFields).toContain("cbteNro")
  })

  it("does NOT error when invoiceStatus is 'none' and fiscal fields are missing", () => {
    const snapshot = makeSnapshot({
      invoiceStatus: "none",
      cae: null,
      caeVto: null,
      cbteNro: null,
      cbteTipo: null,
      ptoVta: null,
    })

    const result = buildPrintableTickets(snapshot)

    // Should succeed as non-fiscal
    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result[0].format).toBe("nonFiscal")
    expect(result[0].fiscal).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Non-fiscal ticket format
// ---------------------------------------------------------------------------

describe("Non-fiscal ticket format", () => {
  it("produces a nonFiscal ticket when invoiceStatus is 'none'", () => {
    const snapshot = makeSnapshot()

    const result = buildPrintableTickets(snapshot)

    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result).toHaveLength(1)
    const ticket = result[0]

    expect(ticket.format).toBe("nonFiscal")
    expect(ticket.fiscal).toBeNull()
    expect(ticket.items).toHaveLength(2)
    expect(ticket.saleDate).toBe("2026-07-01T15:30:00Z")
  })

  it("derives the non-fiscal final total after item discounts", () => {
    const snapshot = makeSnapshot({
      items: [
        {
          productId: "P001",
          name: "Leche entera 1L",
          quantity: 2,
          unitPrice: "120.00",
          subtotal: "240.00",
          discountAmount: "30.00",
          appliedPromotions: [],
          appliedPromotionType: "percentage",
        },
      ],
      payments: [{ method: "cash", amount: "210.00" }],
    })

    const result = buildPrintableTickets(snapshot)

    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result[0].total).toBe("210.00")
  })

  it("produces nonFiscal for 'failed' invoice status", () => {
    const snapshot = makeSnapshot({ invoiceStatus: "failed" })

    const result = buildPrintableTickets(snapshot)
    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result[0].format).toBe("nonFiscal")
  })
})

// ---------------------------------------------------------------------------
// Split-sale: N tickets
// ---------------------------------------------------------------------------

describe("Split-sale ticket generation", () => {
  it("generates one ticket per split group", () => {
    const snapshot = makeSnapshot({
      items: [
        {
          productId: "P001",
          name: "Leche entera 1L",
          quantity: 2,
          unitPrice: "120.00",
          subtotal: "240.00",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null
        },
        {
          productId: "P002",
          name: "Pan lactal 500g",
          quantity: 1,
          unitPrice: "180.50",
          subtotal: "180.50",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null
        },
        {
          productId: "P003",
          name: "Café molido 250g",
          quantity: 1,
          unitPrice: "350.00",
          subtotal: "350.00",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null
        },
      ],
      splitGroups: [
        {
          label: "A",
          items: [
            { productId: "P001", quantity: 2 },
            { productId: "P002", quantity: 1 },
          ],
        },
        {
          label: "B",
          items: [{ productId: "P003", quantity: 1 }],
        },
      ],
    })

    const result = buildPrintableTickets(snapshot)
    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result).toHaveLength(2)

    // Ticket A
    expect(result[0].groupLabel).toBe("A")
    expect(result[0].items).toHaveLength(2)
    expect(result[0].items[0].name).toBe("Leche entera 1L")
    expect(result[0].items[1].name).toBe("Pan lactal 500g")

    // Ticket B
    expect(result[1].groupLabel).toBe("B")
    expect(result[1].items).toHaveLength(1)
    expect(result[1].items[0].name).toBe("Café molido 250g")

    // Totals are independent
    expect(result[0].total).toBe("420.50") // 240.00 + 180.50
    expect(result[1].total).toBe("350.00") // 350.00
  })

  it("non-split sale produces exactly 1 ticket with all items", () => {
    const snapshot = makeSnapshot()

    const result = buildPrintableTickets(snapshot)
    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result).toHaveLength(1)
    expect(result[0].groupLabel).toBeUndefined()
    expect(result[0].items).toHaveLength(2)
  })

  it("returns an integrity error when ALL split groups are empty (no product matches)", () => {
    // Split groups reference products that don't exist in the snapshot items
    const snapshot = makeSnapshot({
      items: [
        {
          productId: "P001",
          name: "Leche entera 1L",
          quantity: 2,
          unitPrice: "120.00",
          subtotal: "240.00",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null
        },
      ],
      splitGroups: [
        {
          label: "A",
          items: [{ productId: "GHOST", quantity: 1 }],
        },
        {
          label: "B",
          items: [{ productId: "NONEXISTENT", quantity: 2 }],
        },
      ],
    })

    const result = buildPrintableTickets(snapshot)

    // Must be an integrity error, NOT a silent fallback to single ticket
    expect(Array.isArray(result)).toBe(false)
    if (!Array.isArray(result)) {
      expect(result.ok).toBe(false)
      expect(result.reason).toContain("Split group data mismatch")
      expect(result.reason).toContain("no items in any group")
    }
  })

  it("silently drops individual empty groups but still produces tickets for non-empty ones", () => {
    // One group matches, one doesn't
    const snapshot = makeSnapshot({
      items: [
        {
          productId: "P001",
          name: "Leche entera 1L",
          quantity: 2,
          unitPrice: "120.00",
          subtotal: "240.00",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null
        },
      ],
      splitGroups: [
        {
          label: "A",
          items: [{ productId: "P001", quantity: 2 }],
        },
        {
          label: "B",
          items: [{ productId: "NONEXISTENT", quantity: 1 }],
        },
      ],
    })

    const result = buildPrintableTickets(snapshot)
    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    // Only group A has items, group B is dropped
    expect(result).toHaveLength(1)
    expect(result[0].groupLabel).toBe("A")
    expect(result[0].items).toHaveLength(1)
    expect(result[0].items[0].name).toBe("Leche entera 1L")
  })
})

// ---------------------------------------------------------------------------
// Proportional payment allocation
// ---------------------------------------------------------------------------

describe("Proportional payment allocation", () => {
  it("splits payments across tickets proportionally by subtotal", () => {
    const snapshot = makeSnapshot({
      items: [
        {
          productId: "P001",
          name: "A",
          quantity: 1,
          unitPrice: "100.00",
          subtotal: "100.00",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null
        },
        {
          productId: "P002",
          name: "B",
          quantity: 1,
          unitPrice: "300.00",
          subtotal: "300.00",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null
        },
      ],
      payments: [
        { method: "cash", amount: "250.00" },
        { method: "card", amount: "150.00" },
      ],
      splitGroups: [
        { label: "A", items: [{ productId: "P001", quantity: 1 }] },
        { label: "B", items: [{ productId: "P002", quantity: 1 }] },
      ],
    })

    const result = buildPrintableTickets(snapshot)
    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result).toHaveLength(2)

    // Ticket A total = 100 (25% of 400)
    const ticketA = result[0]
    expect(ticketA.total).toBe("100.00")
    expect(ticketA.payments).toHaveLength(2)
    // cash: 250 * 0.25 = 62.50
    expect(ticketA.payments.find((p) => p.method === "cash")?.amount).toBe(
      "62.50"
    )
    // card: 150 * 0.25 = 37.50
    expect(ticketA.payments.find((p) => p.method === "card")?.amount).toBe(
      "37.50"
    )

    // Ticket B total = 300 (75% of 400), last ticket absorbs rounding
    const ticketB = result[1]
    expect(ticketB.total).toBe("300.00")
    expect(ticketB.payments).toHaveLength(2)
    // cash: 250 - 62.50 = 187.50
    expect(ticketB.payments.find((p) => p.method === "cash")?.amount).toBe(
      "187.50"
    )
    // card: 150 - 37.50 = 112.50
    expect(ticketB.payments.find((p) => p.method === "card")?.amount).toBe(
      "112.50"
    )
  })

  it("allocates split-ticket payments by discounted final totals", () => {
    const snapshot = makeSnapshot({
      items: [
        {
          productId: "P001",
          name: "A",
          quantity: 1,
          unitPrice: "100.00",
          subtotal: "100.00",
          discountAmount: "20.00",
          appliedPromotions: [],
          appliedPromotionType: "percentage",
        },
        {
          productId: "P002",
          name: "B",
          quantity: 1,
          unitPrice: "100.00",
          subtotal: "100.00",
          discountAmount: "0.00",
          appliedPromotions: [],
          appliedPromotionType: null,
        },
      ],
      payments: [{ method: "cash", amount: "180.00" }],
      splitGroups: [
        { label: "A", items: [{ productId: "P001", quantity: 1 }] },
        { label: "B", items: [{ productId: "P002", quantity: 1 }] },
      ],
    })

    const result = buildPrintableTickets(snapshot)
    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result[0].total).toBe("80.00")
    expect(result[0].payments.find((p) => p.method === "cash")?.amount).toBe("80.00")
    expect(result[1].total).toBe("100.00")
    expect(result[1].payments.find((p) => p.method === "cash")?.amount).toBe("100.00")
  })

  it("single ticket receives full payment allocation", () => {
    const snapshot = makeSnapshot({
      payments: [
        { method: "cash", amount: "200.00" },
        { method: "card", amount: "220.50" },
      ],
    })

    const result = buildPrintableTickets(snapshot)
    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return

    expect(result).toHaveLength(1)
    expect(result[0].payments).toEqual(snapshot.payments)
  })
})
