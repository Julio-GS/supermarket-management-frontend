import { describe, expect, it } from "vitest"
import { formatCurrency } from "../currency"

describe("formatCurrency", () => {
  it("formats values in ARS with two decimal places", () => {
    expect(formatCurrency(1500.5)).toBe("$\u00A01.500,50")
  })

  it("rounds to a maximum of two decimals", () => {
    expect(formatCurrency(10.999)).toBe("$\u00A011,00")
  })

  it("always shows two decimals for whole numbers", () => {
    expect(formatCurrency(100)).toBe("$\u00A0100,00")
  })
})
