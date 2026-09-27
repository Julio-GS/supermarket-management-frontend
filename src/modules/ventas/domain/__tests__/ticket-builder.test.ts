import { describe, expect, it } from "vitest"
import { buildPrintableTickets } from "../ticket-builder"
import { saleToCheckoutTicketSnapshot } from "../sale-to-ticket-snapshot"
import type { Sale } from "../sale"
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
        appliedPromotionType: null,
        iva: 21,
      },
      {
        productId: "P002",
        name: "Pan lactal 500g",
        quantity: 1,
        unitPrice: "180.50",
        subtotal: "180.50",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null,
        iva: 21,
      },
    ],
    payments: [{ method: "cash", amount: "420.50" }],
    cae: null,
    caeVto: null,
    cbteNro: null,
    cbteTipo: null,
    ptoVta: null,
    total: "0.00",
    manualDiscount: null,
    manualDiscountCents: 0,
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
      caeVto: "20260715",
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
      caeVto: "20260715",
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

      it("preserves entered unit price and per-split subtotal for ad-hoc items", () => {
        const snapshot = makeSnapshot({
          items: [
            {
              productId: "ad-hoc-1",
              name: "Servicio Especial",
              quantity: 2,
              unitPrice: "150.00",
              subtotal: "300.00",
              discountAmount: "0.00",
              appliedPromotions: [],
              appliedPromotionType: null,
            },
          ],
          splitGroups: [
            { label: "A", items: [{ productId: "ad-hoc-1", quantity: 1 }] },
            { label: "B", items: [{ productId: "ad-hoc-1", quantity: 1 }] },
          ],
        })

        const result = buildPrintableTickets(snapshot)
        expect(Array.isArray(result)).toBe(true)
        if (!Array.isArray(result)) return

        expect(result).toHaveLength(2)
        // Ad-hoc split line keeps the entered unit price and derives subtotal = price × split qty
        expect(result[0].items[0].unitPrice).toBe("150.00")
        expect(result[0].items[0].subtotal).toBe("150.00")
        expect(result[0].items[0].name).toBe("Servicio Especial")
        expect(result[1].items[0].unitPrice).toBe("150.00")
        expect(result[1].items[0].subtotal).toBe("150.00")
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
  // ── Slice 1: Authoritative sale total source of truth ─────────────

  describe("Authoritative sale total (Slice 1)", () => {
    it("uses snapshot.total as authoritative for non-split tickets instead of item-derived total", () => {
      const snapshot = makeSnapshot({
        total: "3500.00",
        items: [
          {
            productId: "P001",
            name: "Producto A",
            quantity: 1,
            unitPrice: "3900.00",
            subtotal: "3900.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
          },
        ],
        // Payment is 4000 (overpayment) but sale total is 3500
        payments: [{ method: "cash", amount: "4000.00" }],
        manualDiscount: null,
        manualDiscountCents: 0,
      })

      const result = buildPrintableTickets(snapshot)
      expect(Array.isArray(result)).toBe(true)
      if (!Array.isArray(result)) return

      expect(result).toHaveLength(1)
      // Ticket total must be the authoritative sale total, NOT 3900 (item subtotal)
      // and NOT 4000 (tendered amount)
      expect(result[0].total).toBe("3500.00")
    })

    it("carries manual discount fields from snapshot to printable ticket", () => {
      const snapshot = makeSnapshot({
        total: "900.00",
        manualDiscount: "cash-10",
        manualDiscountCents: 100,
      })

      const result = buildPrintableTickets(snapshot)
      expect(Array.isArray(result)).toBe(true)
      if (!Array.isArray(result)) return

      expect(result[0].manualDiscount).toBe("cash-10")
      expect(result[0].manualDiscountCents).toBe(100)
    })

    it("carries null manual discount when not applied", () => {
      const snapshot = makeSnapshot({
        total: "0.00",
        manualDiscount: null,
        manualDiscountCents: 0,
      })

      const result = buildPrintableTickets(snapshot)
      expect(Array.isArray(result)).toBe(true)
      if (!Array.isArray(result)) return

      expect(result[0].manualDiscount).toBeNull()
      expect(result[0].manualDiscountCents).toBe(0)
    })

    it("allocates authoritative total proportionally for split tickets", () => {
      const snapshot = makeSnapshot({
        total: "500.00",
        items: [
          {
            productId: "P001",
            name: "A",
            quantity: 1,
            unitPrice: "150.00",
            subtotal: "150.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
          },
          {
            productId: "P002",
            name: "B",
            quantity: 1,
            unitPrice: "250.00",
            subtotal: "250.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
          },
        ],
        splitGroups: [
          { label: "A", items: [{ productId: "P001", quantity: 1 }] },
          { label: "B", items: [{ productId: "P002", quantity: 1 }] },
        ],
        manualDiscount: null,
        manualDiscountCents: 0,
      })

      const result = buildPrintableTickets(snapshot)
      expect(Array.isArray(result)).toBe(true)
      if (!Array.isArray(result)) return

      expect(result).toHaveLength(2)

      // Proportional allocation: A = 150/400 = 37.5%, B = 250/400 = 62.5%
      // 500 * 0.375 = 187.5, 500 * 0.625 = 312.5
      // Last ticket absorbs rounding: 500 - 187.5 = 312.5
      const ticketA = result[0]
      const ticketB = result[1]
      expect(ticketA.total).toBe("187.50")
      expect(ticketB.total).toBe("312.50")

      // Sum of split totals must equal authoritative total
      const sum = parseFloat(ticketA.total) + parseFloat(ticketB.total)
      expect(sum).toBe(500.00)
        })
  // ---------------------------------------------------------------------------
  // Historical split reprint with authoritative unitPrice/subtotal
  // ---------------------------------------------------------------------------

  describe("Historical split reprint with authoritative unitPrice/subtotal", () => {
    it("preserves authoritative unitPrice and subtotal from split group draft items", () => {
      const snapshot = makeSnapshot({
        items: [
          {
            productId: "P001",
            name: "Leche entera 1L",
            quantity: 3,
            unitPrice: "120.00",
            subtotal: "360.00",
            discountAmount: "0.00",
            appliedPromotions: [],
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
            appliedPromotionType: null,
          },
        ],
        total: "540.50",
        splitGroups: [
          {
            label: "A",
            items: [
              {
                productId: "P001",
                quantity: 1,
                unitPrice: "120.00",
                subtotal: "120.00",
              },
            ],
          },
          {
            label: "B",
            items: [
              {
                productId: "P001",
                quantity: 2,
                unitPrice: "120.00",
                subtotal: "240.00",
              },
              {
                productId: "P002",
                quantity: 1,
                unitPrice: "180.50",
                subtotal: "180.50",
              },
            ],
          },
        ],
      })

      const result = buildPrintableTickets(snapshot)
      expect(Array.isArray(result)).toBe(true)
      if (!Array.isArray(result)) return

      expect(result).toHaveLength(2)

      // Ticket A: should use authoritative values, not derived from Map
      expect(result[0].groupLabel).toBe("A")
      expect(result[0].items).toHaveLength(1)
      expect(result[0].items[0].productId).toBe("P001")
      expect(result[0].items[0].quantity).toBe(1)
      expect(result[0].items[0].unitPrice).toBe("120.00")
      expect(result[0].items[0].subtotal).toBe("120.00")

      // Ticket B: same productId P001 as group A, but different split
      expect(result[1].groupLabel).toBe("B")
      expect(result[1].items).toHaveLength(2)

      // P001 in group B: quantity 2, subtotal 240.00 (NOT derived from Map)
      const p001InB = result[1].items.find((i) => i.productId === "P001")
      expect(p001InB).toBeDefined()
      expect(p001InB!.quantity).toBe(2)
      expect(p001InB!.unitPrice).toBe("120.00")
      expect(p001InB!.subtotal).toBe("240.00")

      // P002 in group B
      const p002InB = result[1].items.find((i) => i.productId === "P002")
      expect(p002InB).toBeDefined()
      expect(p002InB!.quantity).toBe(1)
      expect(p002InB!.unitPrice).toBe("180.50")
      expect(p002InB!.subtotal).toBe("180.50")
    })

    it("falls back to productId map when unitPrice/subtotal are absent (live checkout)", () => {
      // Live checkout split groups don't carry unitPrice/subtotal
      const snapshot = makeSnapshot({
        items: [
          {
            productId: "P001",
            name: "Leche entera 1L",
            quantity: 3,
            unitPrice: "120.00",
            subtotal: "360.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
          },
        ],
        total: "360.00",
        splitGroups: [
          {
            label: "A",
            items: [
              { productId: "P001", quantity: 1 },
            ],
          },
          {
            label: "B",
            items: [
              { productId: "P001", quantity: 2 },
            ],
          },
        ],
      })

      const result = buildPrintableTickets(snapshot)
      expect(Array.isArray(result)).toBe(true)
      if (!Array.isArray(result)) return

      expect(result).toHaveLength(2)

      // Both groups should derive from the Map-based ratio calculation
      expect(result[0].items[0].subtotal).toBe("120.00") // 360 * (1/3)
      expect(result[1].items[0].subtotal).toBe("240.00") // 360 * (2/3)
    })
  })

  // ── Fiscal VAT validation (VAT-2) ────────────────────────────────

  describe("Fiscal VAT validation (VAT-2)", () => {
    it("returns FiscalValidationResult error when an item has missing (null) VAT in fiscal snapshot", () => {
      const snapshot = makeSnapshot({
        invoiceStatus: "issued",
        cae: "12345678901234",
        caeVto: "20260715",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
        items: [
          {
            productId: "P001",
            name: "Leche entera 1L",
            quantity: 1,
            unitPrice: "120.00",
            subtotal: "120.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: null,
          },
        ],
      })

      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(false)
      if (Array.isArray(result)) return

      expect(result.ok).toBe(false)
      expect(result.reason).toContain("Alícuota de IVA inválida")
      expect(result.reason).toContain("Leche entera 1L")
    })

    it("returns FiscalValidationResult error when an item has 0% VAT in fiscal snapshot", () => {
      const snapshot = makeSnapshot({
        invoiceStatus: "issued",
        cae: "12345678901234",
        caeVto: "20260715",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
        items: [
          {
            productId: "P001",
            name: "Pan Exento",
            quantity: 1,
            unitPrice: "100.00",
            subtotal: "100.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: 0,
          },
        ],
      })

      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(false)
      if (Array.isArray(result)) return

      expect(result.ok).toBe(false)
      expect(result.reason).toContain("Alícuota de IVA inválida")
      expect(result.reason).toContain("Pan Exento")
    })

    it("returns FiscalValidationResult error when an item has unsupported 27% VAT in fiscal snapshot", () => {
      const snapshot = makeSnapshot({
        invoiceStatus: "issued",
        cae: "12345678901234",
        caeVto: "20260715",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
        items: [
          {
            productId: "P001",
            name: "Telecomunicaciones",
            quantity: 1,
            unitPrice: "500.00",
            subtotal: "500.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: 27,
          },
        ],
      })

      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(false)
      if (Array.isArray(result)) return

      expect(result.ok).toBe(false)
      expect(result.reason).toContain("Alícuota de IVA inválida")
    })

    it("builds fiscal ticket when items have 10.5% VAT", () => {
      const snapshot = makeSnapshot({
        invoiceStatus: "issued",
        cae: "12345678901234",
        caeVto: "20260715",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
        items: [
          {
            productId: "P001",
            name: "Carne Vacuna",
            quantity: 1,
            unitPrice: "1000.00",
            subtotal: "1000.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: 10.5,
          },
        ],
      })

      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(true)
      if (!Array.isArray(result)) return
      expect(result).toHaveLength(1)
      expect(result[0].items[0].iva).toBe(10.5)
    })

    it("builds fiscal ticket with mixed 10.5% and 21% VAT items", () => {
      const snapshot = makeSnapshot({
        invoiceStatus: "issued",
        cae: "12345678901234",
        caeVto: "20260715",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
        items: [
          {
            productId: "P001",
            name: "Carne Vacuna",
            quantity: 1,
            unitPrice: "1000.00",
            subtotal: "1000.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: 10.5,
          },
          {
            productId: "P002",
            name: "Gaseosa 2L",
            quantity: 1,
            unitPrice: "500.00",
            subtotal: "500.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: 21,
          },
        ],
      })

      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(true)
      if (!Array.isArray(result)) return
      expect(result).toHaveLength(1)
      expect(result[0].items[0].iva).toBe(10.5)
      expect(result[0].items[1].iva).toBe(21)
    })

    it("enforces VAT validation on split fiscal tickets", () => {
      const snapshot = makeSnapshot({
        invoiceStatus: "issued",
        cae: "12345678901234",
        caeVto: "20260715",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
        items: [
          {
            productId: "P001",
            name: "Carne Vacuna",
            quantity: 1,
            unitPrice: "1000.00",
            subtotal: "1000.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: 10.5,
          },
          {
            productId: "P002",
            name: "Item Sin IVA",
            quantity: 1,
            unitPrice: "200.00",
            subtotal: "200.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: 0,
          },
        ],
        splitGroups: [
          { label: "A", items: [{ productId: "P001", quantity: 1 }] },
          { label: "B", items: [{ productId: "P002", quantity: 1 }] },
        ],
      })

      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(false)
      if (Array.isArray(result)) return
      expect(result.ok).toBe(false)
      expect(result.reason).toContain("Item Sin IVA")
    })

    it("builds valid split fiscal tickets when all items have supported VAT rates", () => {
      const snapshot = makeSnapshot({
        invoiceStatus: "issued",
        cae: "12345678901234",
        caeVto: "20260715",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
        items: [
          {
            productId: "P001",
            name: "Carne Vacuna",
            quantity: 1,
            unitPrice: "1000.00",
            subtotal: "1000.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: 10.5,
          },
          {
            productId: "P002",
            name: "Gaseosa 2L",
            quantity: 1,
            unitPrice: "500.00",
            subtotal: "500.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: 21,
          },
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
      expect(result[0].items[0].iva).toBe(10.5)
      expect(result[1].items[0].iva).toBe(21)
    })

    it("allows non-fiscal tickets to build with 0% or missing VAT without error", () => {
      const snapshot = makeSnapshot({
        invoiceStatus: "none",
        items: [
          {
            productId: "P001",
            name: "Pan Exento",
            quantity: 1,
            unitPrice: "100.00",
            subtotal: "100.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
            iva: 0,
          },
        ],
      })

      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(true)
      if (!Array.isArray(result)) return
      expect(result[0].format).toBe("nonFiscal")
    })
  })

  // ── Persisted sale reprint VAT preservation ───────────────────

  describe("persisted sale reprint VAT preservation & fiscal validation", () => {
    function makePersistedSale(overrides: Partial<Sale> = {}): Sale {
      return {
        id: "V-HIST-001",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z",
        customer: "Mostrador",
        total: "1500.00",
        paymentMethods: [{ method: "cash", amount: "1500.00" }],
        invoiceStatus: "issued",
        cae: "12345678901234",
        caeVto: "20260715",
        cbteNro: "00000042",
        cbteTipo: "1",
        ptoVta: "0001",
        invoiceRequestedAt: "2026-07-01T12:00:00.000Z",
        splitTicketGroups: null,
        items: [
          {
            productId: "P001",
            name: "Carne Vacuna",
            quantity: 1,
            unitPrice: "1000.00",
            subtotal: "1000.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            iva: 10.5,
          },
          {
            productId: "P002",
            name: "Gaseosa 2L",
            quantity: 1,
            unitPrice: "500.00",
            subtotal: "500.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            iva: 21,
          },
        ],
        ...overrides,
      }
    }

    it("preserves 10.5% and 21% VAT from persisted sale to printable fiscal ticket", () => {
      const sale = makePersistedSale()
      const snapshot = saleToCheckoutTicketSnapshot(sale)
      const tickets = buildPrintableTickets(snapshot)

      expect(Array.isArray(tickets)).toBe(true)
      if (!Array.isArray(tickets)) return
      expect(tickets).toHaveLength(1)
      expect(tickets[0].format).toBe("fiscal")
      expect(tickets[0].items).toHaveLength(2)
      expect(tickets[0].items[0].iva).toBe(10.5)
      expect(tickets[0].items[1].iva).toBe(21)
    })

    it("defaults ad-hoc lines without explicit VAT to 10.5% on persisted sale reprint", () => {
      const sale = makePersistedSale({
        items: [
          {
            productId: "ad-hoc-uuid",
            name: "Servicio",
            quantity: 1,
            unitPrice: "500.00",
            subtotal: "500.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            kind: "ad-hoc",
            // iva not present, description not present
          },
          {
            productId: "P002",
            name: "Gaseosa 2L",
            quantity: 1,
            unitPrice: "1000.00",
            subtotal: "1000.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            iva: 21,
            kind: "catalog",
          },
        ],
      })

      const snapshot = saleToCheckoutTicketSnapshot(sale)
      const tickets = buildPrintableTickets(snapshot)

      expect(Array.isArray(tickets)).toBe(true)
      if (!Array.isArray(tickets)) return
      expect(tickets[0].format).toBe("fiscal")
      expect(tickets[0].items[0].iva).toBe(10.5)
      expect(tickets[0].items[1].iva).toBe(21)
    })

    it("fails closed when persisted catalog item has a description but missing VAT (description does not trigger ad-hoc default)", () => {
      const sale = makePersistedSale({
        items: [
          {
            productId: "P-CATALOG-DESC",
            name: "Producto con descripción",
            description: "Descripción de catálogo o nota",
            quantity: 1,
            unitPrice: "200.00",
            subtotal: "200.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            kind: "catalog",
            iva: null,
          },
        ],
      })

      const snapshot = saleToCheckoutTicketSnapshot(sale)
      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(false)
      if (Array.isArray(result)) return
      expect(result.ok).toBe(false)
      expect(result.reason).toContain("Producto con descripción")
      expect(result.reason).toContain("Alícuota de IVA inválida")
    })

    it("preserves explicit 21% VAT on persisted ad-hoc item", () => {
      const sale = makePersistedSale({
        items: [
          {
            productId: "ad-hoc-21",
            name: "Servicio gravado 21%",
            quantity: 1,
            unitPrice: "500.00",
            subtotal: "500.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            kind: "ad-hoc",
            iva: 21,
          },
        ],
      })

      const snapshot = saleToCheckoutTicketSnapshot(sale)
      const tickets = buildPrintableTickets(snapshot)

      expect(Array.isArray(tickets)).toBe(true)
      if (!Array.isArray(tickets)) return
      expect(tickets[0].items[0].iva).toBe(21)
    })

    it("fails closed when persisted fiscal sale contains a catalog item with 0% VAT", () => {
      const sale = makePersistedSale({
        items: [
          {
            productId: "P-EXENTO",
            name: "Pan Exento",
            quantity: 1,
            unitPrice: "100.00",
            subtotal: "100.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            iva: 0,
          },
        ],
      })

      const snapshot = saleToCheckoutTicketSnapshot(sale)
      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(false)
      if (Array.isArray(result)) return
      expect(result.ok).toBe(false)
      expect(result.reason).toContain("Pan Exento")
      expect(result.reason).toContain("0")
    })

    it("fails closed when persisted fiscal sale contains a catalog item with null/missing VAT", () => {
      const sale = makePersistedSale({
        items: [
          {
            productId: "P-NO-VAT",
            name: "Producto sin IVA",
            quantity: 1,
            unitPrice: "100.00",
            subtotal: "100.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            iva: null,
          },
        ],
      })

      const snapshot = saleToCheckoutTicketSnapshot(sale)
      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(false)
      if (Array.isArray(result)) return
      expect(result.ok).toBe(false)
      expect(result.reason).toContain("Producto sin IVA")
    })

    it("fails closed when persisted fiscal sale contains an item with unknown provenance (kind undefined) and missing VAT", () => {
      const sale = makePersistedSale({
        items: [
          {
            productId: "P-UNKNOWN-ORIGIN",
            name: "Servicio de Mantenimiento", // name looks like service but kind is undefined
            quantity: 1,
            unitPrice: "300.00",
            subtotal: "300.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            iva: null,
            kind: undefined,
          },
        ],
      })

      const snapshot = saleToCheckoutTicketSnapshot(sale)
      const result = buildPrintableTickets(snapshot)

      expect(Array.isArray(result)).toBe(false)
      if (Array.isArray(result)) return
      expect(result.ok).toBe(false)
      expect(result.reason).toContain("Servicio de Mantenimiento")
      expect(result.reason).toContain("Alícuota de IVA inválida")
    })

    it("builds fiscal ticket when historical item has explicit VAT 10.5 even with unknown provenance", () => {
      const sale = makePersistedSale({
        items: [
          {
            productId: "P-EXPLICIT-10-5",
            name: "Servicio Histórico",
            quantity: 1,
            unitPrice: "400.00",
            subtotal: "400.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            iva: 10.5,
            kind: undefined,
          },
        ],
      })

      const snapshot = saleToCheckoutTicketSnapshot(sale)
      const tickets = buildPrintableTickets(snapshot)

      expect(Array.isArray(tickets)).toBe(true)
      if (!Array.isArray(tickets)) return
      expect(tickets[0].format).toBe("fiscal")
      expect(tickets[0].items[0].iva).toBe(10.5)
    })

    it("allows non-fiscal persisted sale reprint even with 0% or missing VAT", () => {
      const sale = makePersistedSale({
        invoiceStatus: "none",
        cae: null,
        caeVto: null,
        cbteNro: null,
        cbteTipo: null,
        ptoVta: null,
        items: [
          {
            productId: "P-EXENTO",
            name: "Pan Exento",
            quantity: 1,
            unitPrice: "100.00",
            subtotal: "100.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionId: null,
            appliedPromotionType: null,
            iva: 0,
          },
        ],
      })

      const snapshot = saleToCheckoutTicketSnapshot(sale)
      const tickets = buildPrintableTickets(snapshot)

      expect(Array.isArray(tickets)).toBe(true)
      if (!Array.isArray(tickets)) return
      expect(tickets[0].format).toBe("nonFiscal")
    })
  })

})
