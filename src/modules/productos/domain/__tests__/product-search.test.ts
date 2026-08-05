import { describe, expect, it } from "vitest"
import { matchesProductSearch, isExactSkuMatch } from "../product-search"

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

describe("isExactSkuMatch", () => {
  const items = [
    { name: "Leche Entera 1L", sku: "LAC-0011" },
    { name: "Manzana Roja", sku: "FRV-0001" },
  ]

  it("returns true when a product SKU matches the search term exactly (case-insensitive)", () => {
    expect(isExactSkuMatch(items, "LAC-0011")).toBe(true)
    expect(isExactSkuMatch(items, "lac-0011")).toBe(true)
    expect(isExactSkuMatch(items, "FRV-0001")).toBe(true)
  })

  it("returns false when no product SKU matches exactly", () => {
    expect(isExactSkuMatch(items, "manzana")).toBe(false)
    expect(isExactSkuMatch(items, "LAC")).toBe(false)
    expect(isExactSkuMatch(items, "0011")).toBe(false)
  })

  it("returns false for an empty search term", () => {
    expect(isExactSkuMatch(items, "")).toBe(false)
    expect(isExactSkuMatch(items, "  ")).toBe(false)
  })

  it("returns false for an empty items array", () => {
    expect(isExactSkuMatch([], "LAC-0011")).toBe(false)
  })

  it("trims whitespace before comparing", () => {
    expect(isExactSkuMatch(items, "  LAC-0011  ")).toBe(true)
  })
})
