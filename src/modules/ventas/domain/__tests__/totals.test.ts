import { describe, expect, it } from "vitest"
import { calculateTotals, VAT_RATE } from "../totals"

describe("totals domain rules", () => {
  it("returns total equal to subtotal (IVA-inclusive catalog prices)", () => {
    const result = calculateTotals(1000)

    expect(result.subtotal).toBe(1000)
    expect(result.vat).toBe(0)
    expect(result.total).toBe(1000)
  })

  it("total equals subtotal for any amount", () => {
    const result = calculateTotals(250.5)

    expect(result.subtotal).toBe(250.5)
    expect(result.vat).toBe(0)
    expect(result.total).toBe(250.5)
  })

  it("returns zero totals for empty cart", () => {
    const result = calculateTotals(0)

    expect(result.subtotal).toBe(0)
    expect(result.vat).toBe(0)
    expect(result.total).toBe(0)
  })

  it("VAT_RATE is 0 because catalog prices are IVA-inclusive", () => {
    expect(VAT_RATE).toBe(0)
  })
})
