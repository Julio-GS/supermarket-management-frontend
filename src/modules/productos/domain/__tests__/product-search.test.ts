import { describe, expect, it } from "vitest"
import { matchesProductSearch } from "../product-search"

const searchableItem = {
  name: "Leche Entera 1L",
  sku: "LAC-0011",
}

describe("matchesProductSearch", () => {
  it("matches when the search term is empty", () => {
    expect(matchesProductSearch(searchableItem, "")).toBe(true)
  })

  it("matches by product name (case-insensitive)", () => {
    expect(matchesProductSearch(searchableItem, "leche")).toBe(true)
    expect(matchesProductSearch(searchableItem, "LECHE")).toBe(true)
    expect(matchesProductSearch(searchableItem, "entera")).toBe(true)
  })

  it("matches by SKU (case-insensitive)", () => {
    expect(matchesProductSearch(searchableItem, "lac-0011")).toBe(true)
    expect(matchesProductSearch(searchableItem, "LAC-0011")).toBe(true)
    expect(matchesProductSearch(searchableItem, "0011")).toBe(true)
  })

  it("does not match unrelated terms", () => {
    expect(matchesProductSearch(searchableItem, "manzana")).toBe(false)
    expect(matchesProductSearch(searchableItem, "FRV-0001")).toBe(false)
  })

  it("ignores leading and trailing whitespace", () => {
    expect(matchesProductSearch(searchableItem, "  leche  ")).toBe(true)
    expect(matchesProductSearch(searchableItem, "  ")).toBe(true)
  })
})
