import { describe, expect, it } from "vitest"
import { deriveDefaultSplitPreview, deriveRowBasedSplitPreview } from "../default-split"
import { validateSplitGroups } from "../split-validator"
import type { RowSplitEntry } from "../default-split"
import type { CartItem } from "../cart"

function makeItem(id: string, quantity = 1): CartItem {
  return {
    product: { id, name: `Product ${id}`, price: 100, unit: "u" },
    quantity,
  }
}

function makeEntry(
  rowId: string,
  rowIndex: number,
  productId: string,
  quantity = 1,
): RowSplitEntry {
  return { rowId, rowIndex, productId, quantity }
}

describe("deriveDefaultSplitPreview", () => {
  it("assigns single item to group A", () => {
    const items = [makeItem("P001")]
    const { itemGroups, groups } = deriveDefaultSplitPreview(items)

    expect(itemGroups.get("P001")).toBe("A")
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe("A")
    expect(groups[0].items).toEqual([{ productId: "P001", quantity: 1 }])
    expect(groups[1].items).toEqual([])
  })

  it("alternates items between groups A and B", () => {
    const items = [makeItem("P001"), makeItem("P002"), makeItem("P003"), makeItem("P004")]
    const { itemGroups, groups } = deriveDefaultSplitPreview(items)

    expect(itemGroups.get("P001")).toBe("A")
    expect(itemGroups.get("P002")).toBe("B")
    expect(itemGroups.get("P003")).toBe("A")
    expect(itemGroups.get("P004")).toBe("B")

    expect(groups[0].items).toEqual([
      { productId: "P001", quantity: 1 },
      { productId: "P003", quantity: 1 },
    ])
    expect(groups[1].items).toEqual([
      { productId: "P002", quantity: 1 },
      { productId: "P004", quantity: 1 },
    ])
  })

  it("preserves quantity per item in the correct group", () => {
    const items = [makeItem("P001", 2), makeItem("P002", 3), makeItem("P003", 1)]
    const { itemGroups, groups } = deriveDefaultSplitPreview(items)

    expect(itemGroups.get("P001")).toBe("A")
    expect(itemGroups.get("P002")).toBe("B")
    expect(itemGroups.get("P003")).toBe("A")

    expect(groups[0].items).toEqual([
      { productId: "P001", quantity: 2 },
      { productId: "P003", quantity: 1 },
    ])
    expect(groups[1].items).toEqual([{ productId: "P002", quantity: 3 }])
  })

  it("handles empty cart", () => {
    const { itemGroups, groups } = deriveDefaultSplitPreview([])

    expect(itemGroups.size).toBe(0)
    expect(groups).toHaveLength(2)
    expect(groups[0].items).toEqual([])
    expect(groups[1].items).toEqual([])
  })

  it("parity: itemGroups map and groups array agree on every item", () => {
    const items = [makeItem("P001", 2), makeItem("P002", 1), makeItem("P003", 4)]
    const { itemGroups, groups } = deriveDefaultSplitPreview(items)

    // Every item in the groups must match the itemGroups map
    for (const group of groups) {
      for (const item of group.items) {
        expect(itemGroups.get(item.productId)).toBe(group.label)
      }
    }

    // Every entry in itemGroups must appear in exactly one group
    const groupedIds = new Set<string>()
    for (const group of groups) {
      for (const item of group.items) {
        expect(groupedIds.has(item.productId)).toBe(false)
        groupedIds.add(item.productId)
      }
    }
    expect(groupedIds.size).toBe(items.length)
  })
})

describe("deriveRowBasedSplitPreview", () => {
  const TOTAL_ROWS = 12

  it("assigns a single committed row in the upper zone to group A", () => {
    const entries = [makeEntry("r1", 0, "P001")]
    const { itemGroups, groups } = deriveRowBasedSplitPreview(entries, TOTAL_ROWS)

    expect(itemGroups.get("r1")).toBe("A")
    expect(groups[0].items).toEqual([{ productId: "P001", quantity: 1, rowId: "r1" }])
    expect(groups[1].items).toEqual([])
  })

  it("assigns a single committed row in the lower zone to group B", () => {
    // midPoint = ceil(12/2) = 6, so rowIndex 6 is the first lower-zone row
    const entries = [makeEntry("r7", 6, "P002")]
    const { itemGroups, groups } = deriveRowBasedSplitPreview(entries, TOTAL_ROWS)

    expect(itemGroups.get("r7")).toBe("B")
    expect(groups[0].items).toEqual([])
    expect(groups[1].items).toEqual([{ productId: "P002", quantity: 1, rowId: "r7" }])
  })

  it("splits boundary: row 5 → A, row 6 → B", () => {
    const entries = [
      makeEntry("r6", 5, "P-A"),
      makeEntry("r7", 6, "P-B"),
    ]
    const { itemGroups, groups } = deriveRowBasedSplitPreview(entries, TOTAL_ROWS)

    expect(itemGroups.get("r6")).toBe("A")
    expect(itemGroups.get("r7")).toBe("B")
    expect(groups[0].items).toEqual([{ productId: "P-A", quantity: 1, rowId: "r6" }])
    expect(groups[1].items).toEqual([{ productId: "P-B", quantity: 1, rowId: "r7" }])
  })

  it("preserves row-level quantities", () => {
    // Both row indices (0, 1) are in the upper zone (< 6) → both in Group A
    const entries = [
      makeEntry("r1", 0, "P001", 3),
      makeEntry("r2", 1, "P002", 5),
    ]
    const { groups } = deriveRowBasedSplitPreview(entries, TOTAL_ROWS)

    expect(groups[0].items).toEqual([
      { productId: "P001", quantity: 3, rowId: "r1" },
      { productId: "P002", quantity: 5, rowId: "r2" },
    ])
    expect(groups[1].items).toEqual([])
  })

  it("keeps same-product rows independent across A and B (FIX: repeated products)", () => {
    // Two rows of the SAME product, one in upper zone (A), one in lower zone (B)
    const entries = [
      makeEntry("r1", 2, "COCA-COLA", 1),
      makeEntry("r2", 7, "COCA-COLA", 1),
    ]
    const { itemGroups, groups } = deriveRowBasedSplitPreview(entries, TOTAL_ROWS)

    // Each row gets its own group assignment
    expect(itemGroups.get("r1")).toBe("A")
    expect(itemGroups.get("r2")).toBe("B")

    // Group A has one Coca Cola, Group B has one Coca Cola
    expect(groups[0].items).toEqual([{ productId: "COCA-COLA", quantity: 1, rowId: "r1" }])
    expect(groups[1].items).toEqual([{ productId: "COCA-COLA", quantity: 1, rowId: "r2" }])
  })

  it("handles empty entries (no committed rows)", () => {
    const { itemGroups, groups } = deriveRowBasedSplitPreview([], TOTAL_ROWS)

    expect(itemGroups.size).toBe(0)
    expect(groups).toHaveLength(2)
    expect(groups[0].items).toEqual([])
    expect(groups[1].items).toEqual([])
  })

  it("handles arbitrary total rows (e.g. 6-row scanner)", () => {
    const entries = [
      makeEntry("r1", 0, "P001"),
      makeEntry("r2", 2, "P002"),
      makeEntry("r3", 3, "P003"),
    ]
    // midPoint = ceil(6/2) = 3, so rows 0-2 → A, 3-5 → B
    const { itemGroups, groups } = deriveRowBasedSplitPreview(entries, 6)

    expect(itemGroups.get("r1")).toBe("A")
    expect(itemGroups.get("r2")).toBe("A")
    expect(itemGroups.get("r3")).toBe("B")

    expect(groups[0].items).toEqual([
      { productId: "P001", quantity: 1, rowId: "r1" },
      { productId: "P002", quantity: 1, rowId: "r2" },
    ])
    expect(groups[1].items).toEqual([{ productId: "P003", quantity: 1, rowId: "r3" }])
  })

  it("parity: itemGroups (keyed by rowId) and groups agree", () => {
    const entries = [
      makeEntry("rA", 1, "PROD-1", 2),
      makeEntry("rB", 4, "PROD-2", 1),
      makeEntry("rC", 8, "PROD-3", 3),
    ]
    const { itemGroups, groups } = deriveRowBasedSplitPreview(entries, TOTAL_ROWS)

    // Build a set of (productId, quantity) per group from groups
    const observed = new Map<string, { productId: string; quantity: number; group: string }>()
    for (const group of groups) {
      for (const item of group.items) {
        const key = `${item.productId}:${item.quantity}:${group.label}`
        expect(observed.has(key)).toBe(false)
        observed.set(key, { ...item, group: group.label })
      }
    }

    // Every entry must appear with its quantity in the correct group
    for (const entry of entries) {
      const expectedGroup = entry.rowIndex < 6 ? "A" : "B"
      const key = `${entry.productId}:${entry.quantity}:${expectedGroup}`
      expect(observed.has(key)).toBe(true)
    }
  })

  it("backend-compatible: groups can be validated by validateSplitGroups with same totals", () => {
    // Same-product rows test: 3 Coca-Colas across A and B
    const entries = [
      makeEntry("r1", 2, "COCA", 2),   // row 2 → A
      makeEntry("r2", 7, "COCA", 1),   // row 7 → B
      makeEntry("r3", 3, "PEPSI", 1),  // row 3 → A
    ]
    const { groups } = deriveRowBasedSplitPreview(entries, TOTAL_ROWS)

    // Aggregated cart: Coca 3, Pepsi 1
    const cartItems: CartItem[] = [
      makeItem("COCA", 3),
      makeItem("PEPSI", 1),
    ]

    // Validate with split-validator (imported at top level)
    expect(validateSplitGroups(cartItems, groups)).toBeNull()
  })
})
