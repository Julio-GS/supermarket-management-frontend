import { describe, expect, it } from "vitest"
import {
  addItem,
  addAdHocItem,
  changeQuantity,
  emptyCart,
  removeItem,
  removeAdHocItem,
  isCatalogItem,
  isAdHocItem,
} from "../cart"
import type { CartItem, CatalogCartItem, AdHocCartItem } from "../cart"

const productA = {
  id: "P001",
  name: "Manzana",
  price: 1.2,
  unit: "kg",
  promotions: null,
  storePromotions: null,
}
const productB = {
  id: "P002",
  name: "Leche",
  price: 1.1,
  unit: "u",
  promotions: null,
  storePromotions: null,
}

/** Helper: assert item is a catalog item and return it typed. */
function asCatalog(item: CartItem): CatalogCartItem {
  if (item.kind !== "catalog") throw new Error("Expected catalog item")
  return item
}

/** Helper: assert item is an ad-hoc item and return it typed. */
function asAdHoc(item: CartItem): AdHocCartItem {
  if (item.kind !== "ad-hoc") throw new Error("Expected ad-hoc item")
  return item
}

describe("cart domain rules", () => {
  describe("addItem (catalog)", () => {
    it("adds a new product line to an empty cart", () => {
      const cart = addItem(emptyCart, productA, 2)

      expect(cart.items).toHaveLength(1)
      const item = asCatalog(cart.items[0])
      expect(item.product.id).toBe("P001")
      expect(item.quantity).toBe(2)
    })

    it("increases quantity when the product is already in the cart", () => {
      const cart = addItem(addItem(emptyCart, productA, 1), productA, 3)

      expect(cart.items).toHaveLength(1)
      const item = asCatalog(cart.items[0])
      expect(item.quantity).toBe(4)
    })

    it("keeps other lines unchanged when adding a different product", () => {
      const cart = addItem(addItem(emptyCart, productA, 1), productB, 2)

      expect(cart.items).toHaveLength(2)
      expect(asCatalog(cart.items[0]).quantity).toBe(1)
      expect(asCatalog(cart.items[1]).quantity).toBe(2)
    })

    // ── Special product identity ─────────────────────────────

    it("creates separate cart entries when lineId is provided, even for same product", () => {
      const cart = addItem(
        addItem(emptyCart, productA, 1, {
          lineId: "row-aaa",
          manualLineTotal: "20.00",
        }),
        productA,
        1,
        { lineId: "row-bbb", manualLineTotal: "25.00" }
      )

      expect(cart.items).toHaveLength(2)
      const item0 = asCatalog(cart.items[0])
      expect(item0.lineId).toBe("row-aaa")
      expect(item0.manualLineTotal).toBe("20.00")
      expect(item0.quantity).toBe(1)
      const item1 = asCatalog(cart.items[1])
      expect(item1.lineId).toBe("row-bbb")
      expect(item1.manualLineTotal).toBe("25.00")
      expect(item1.quantity).toBe(1)
    })

    it("still merges by product id when lineId is not provided (normal products)", () => {
      const cart = addItem(addItem(emptyCart, productA, 1), productA, 3)

      expect(cart.items).toHaveLength(1)
      const item = asCatalog(cart.items[0])
      expect(item.quantity).toBe(4)
      expect(item.lineId).toBeUndefined()
    })

    it("preserves manualLineTotal on the CartItem", () => {
      const cart = addItem(emptyCart, productB, 1, {
        lineId: "row-ccc",
        manualLineTotal: "15.50",
      })

      expect(cart.items).toHaveLength(1)
      const item = asCatalog(cart.items[0])
      expect(item.manualLineTotal).toBe("15.50")
      expect(item.lineId).toBe("row-ccc")
    })
  })

  describe("addAdHocItem", () => {
    it("adds an ad-hoc item to the cart", () => {
      const cart = addAdHocItem(emptyCart, "draft-1", "Counter Service", 199.99, 2)

      expect(cart.items).toHaveLength(1)
      const item = asAdHoc(cart.items[0])
      expect(item.draftId).toBe("draft-1")
      expect(item.name).toBe("Counter Service")
      expect(item.unitPrice).toBe(199.99)
      expect(item.quantity).toBe(2)
      expect(item.description).toBeUndefined()
    })

    it("adds an ad-hoc item with optional description", () => {
      const cart = addAdHocItem(emptyCart, "draft-2", "Service", 50, 1, "Manual entry")

      const item = asAdHoc(cart.items[0])
      expect(item.description).toBe("Manual entry")
    })

    it("never merges ad-hoc items with same name and price", () => {
      const cart = addAdHocItem(
        addAdHocItem(emptyCart, "draft-a", "Alfajor", 250, 1),
        "draft-b",
        "Alfajor",
        250,
        1
      )

      expect(cart.items).toHaveLength(2)
      expect(asAdHoc(cart.items[0]).draftId).toBe("draft-a")
      expect(asAdHoc(cart.items[1]).draftId).toBe("draft-b")
    })

    it("coexists with catalog items in the same cart", () => {
      const cart = addAdHocItem(addItem(emptyCart, productA, 1), "draft-1", "Service", 100, 1)

      expect(cart.items).toHaveLength(2)
      expect(isCatalogItem(cart.items[0])).toBe(true)
      expect(isAdHocItem(cart.items[1])).toBe(true)
    })
  })

  describe("isCatalogItem / isAdHocItem", () => {
    it("correctly discriminates catalog items", () => {
      const cart = addItem(emptyCart, productA, 1)
      expect(isCatalogItem(cart.items[0])).toBe(true)
      expect(isAdHocItem(cart.items[0])).toBe(false)
    })

    it("correctly discriminates ad-hoc items", () => {
      const cart = addAdHocItem(emptyCart, "d1", "Svc", 100, 1)
      expect(isAdHocItem(cart.items[0])).toBe(true)
      expect(isCatalogItem(cart.items[0])).toBe(false)
    })
  })

  describe("changeQuantity", () => {
    it("increments quantity by the given delta", () => {
      const cart = changeQuantity(addItem(emptyCart, productA, 2), "P001", 3)

      expect(asCatalog(cart.items[0]).quantity).toBe(5)
    })

    it("decrements quantity and removes the line when it reaches zero", () => {
      const cart = changeQuantity(addItem(emptyCart, productA, 2), "P001", -2)

      expect(cart.items).toHaveLength(0)
    })

    it("ignores products not in the cart", () => {
      const cart = changeQuantity(addItem(emptyCart, productA, 2), "P002", 1)

      expect(cart.items).toHaveLength(1)
      expect(asCatalog(cart.items[0]).quantity).toBe(2)
    })

    it("ignores ad-hoc items (only affects catalog)", () => {
      const cart = changeQuantity(
        addAdHocItem(emptyCart, "d1", "Svc", 100, 2),
        "d1",
        1
      )
      // Ad-hoc items are not affected by changeQuantity (productId-based)
      expect(cart.items).toHaveLength(1)
      expect(asAdHoc(cart.items[0]).quantity).toBe(2)
    })
  })

  describe("removeItem", () => {
    it("removes the matching product line", () => {
      const cart = removeItem(
        addItem(addItem(emptyCart, productA, 1), productB, 2),
        "P001"
      )

      expect(cart.items).toHaveLength(1)
      expect(asCatalog(cart.items[0]).product.id).toBe("P002")
    })
  })

  describe("removeAdHocItem", () => {
    it("removes the ad-hoc item by draftId", () => {
      const cart = removeAdHocItem(
        addAdHocItem(addAdHocItem(emptyCart, "d1", "A", 100, 1), "d2", "B", 200, 1),
        "d1"
      )

      expect(cart.items).toHaveLength(1)
      expect(asAdHoc(cart.items[0]).draftId).toBe("d2")
    })

    it("does not affect catalog items", () => {
      const cart = removeAdHocItem(addItem(emptyCart, productA, 1), "any")

      expect(cart.items).toHaveLength(1)
      expect(isCatalogItem(cart.items[0])).toBe(true)
    })
  })
})
