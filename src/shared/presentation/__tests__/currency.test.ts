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

  it("parses a decimal string and formats as ARS currency", () => {
    expect(formatCurrency("7501.50")).toBe("$\u00A07.501,50")
  })

  it("parses an integer-as-string and formats with two decimals", () => {
    expect(formatCurrency("42")).toBe("$\u00A042,00")
  })

  it("returns $0,00 for invalid string input", () => {
    expect(formatCurrency("not-a-number")).toBe("$\u00A00,00")
  })

  it("returns $0,00 for NaN number", () => {
    expect(formatCurrency(NaN)).toBe("$\u00A00,00")
  })

  it("returns $0,00 for Infinity", () => {
    expect(formatCurrency(Infinity)).toBe("$\u00A00,00")
  })
})
