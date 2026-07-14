import { describe, it, expect } from "vitest"
import { toCents, centsToDecimal, validateMoneyInput } from "../money"

describe("toCents", () => {
  it("converts 0.01 to 1 cent", () => {
    expect(toCents("0.01")).toBe(1)
  })

  it("converts 99999.99 to 9999999 cents", () => {
    expect(toCents("99999.99")).toBe(9999999)
  })

  it("converts 15.50 to 1550 cents", () => {
    expect(toCents("15.50")).toBe(1550)
  })

  it("converts 15.5 to 1550 cents (normalizes single decimal)", () => {
    expect(toCents("15.5")).toBe(1550)
  })

  it("converts integer string 100 to 10000 cents", () => {
    expect(toCents("100")).toBe(10000)
  })

  it("throws on zero", () => {
    expect(() => toCents("0")).toThrow()
  })

  it("throws on negative", () => {
    expect(() => toCents("-5")).toThrow()
  })

  it("throws on non-numeric text", () => {
    expect(() => toCents("abc")).toThrow()
  })

  it("throws on empty string", () => {
    expect(() => toCents("")).toThrow()
  })
})

describe("centsToDecimal", () => {
  it("converts 1 cent to '0.01'", () => {
    expect(centsToDecimal(1)).toBe("0.01")
  })

  it("converts 1550 cents to '15.50'", () => {
    expect(centsToDecimal(1550)).toBe("15.50")
  })

  it("converts 9999999 cents to '99999.99'", () => {
    expect(centsToDecimal(9999999)).toBe("99999.99")
  })

  it("converts 10000 cents to '100.00'", () => {
    expect(centsToDecimal(10000)).toBe("100.00")
  })
})

describe("validateMoneyInput", () => {
  it("returns null for valid 15.50", () => {
    expect(validateMoneyInput("15.50")).toBeNull()
  })

  it("returns null for valid 0.01", () => {
    expect(validateMoneyInput("0.01")).toBeNull()
  })

  it("returns error for zero", () => {
    expect(validateMoneyInput("0")).toBe("Total must be greater than zero")
  })

  it("returns error for negative", () => {
    expect(validateMoneyInput("-5")).toBe("Total must be positive")
  })

  it("returns error for non-numeric", () => {
    expect(validateMoneyInput("abc")).toBe("Total must be a number")
  })

  it("returns error for empty", () => {
    expect(validateMoneyInput("")).toBe("Total must be a number")
  })
})
