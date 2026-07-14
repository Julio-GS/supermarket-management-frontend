import { describe, expect, it } from "vitest"
import { addItem, changeQuantity, emptyCart, removeItem } from "../cart"
import type { CartItem } from "../cart"

const productA = { id: "P001", name: "Manzana", price: 1.2, unit: "kg", promotions: null, storePromotions: null }
const productB = { id: "P002", name: "Leche", price: 1.1, unit: "u", promotions: null, storePromotions: null }

describe("cart domain rules", () => {
  describe("addItem", () => {
    it("adds a new product line to an empty cart", () => {
      const cart = addItem(emptyCart, productA, 2)

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].product.id).toBe("P001")
      expect(cart.items[0].quantity).toBe(2)
    })

    it("increases quantity when the product is already in the cart", () => {
      const cart = addItem(addItem(emptyCart, productA, 1), productA, 3)

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].quantity).toBe(4)
    })

    it("keeps other lines unchanged when adding a different product", () => {
      const cart = addItem(addItem(emptyCart, productA, 1), productB, 2)

      expect(cart.items).toHaveLength(2)
      expect(cart.items[0].quantity).toBe(1)
      expect(cart.items[1].quantity).toBe(2)
    })

    // ── Special product identity ─────────────────────────────

    it("creates separate cart entries when lineId is provided, even for same product", () => {
      const cart = addItem(
        addItem(emptyCart, productA, 1, { lineId: "row-aaa", manualLineTotal: "20.00" }),
        productA,
        1,
        { lineId: "row-bbb", manualLineTotal: "25.00" }
      )

      expect(cart.items).toHaveLength(2)
      expect(cart.items[0].lineId).toBe("row-aaa")
      expect(cart.items[0].manualLineTotal).toBe("20.00")
      expect(cart.items[0].quantity).toBe(1)
      expect(cart.items[1].lineId).toBe("row-bbb")
      expect(cart.items[1].manualLineTotal).toBe("25.00")
      expect(cart.items[1].quantity).toBe(1)
    })

    it("still merges by product id when lineId is not provided (normal products)", () => {
      const cart = addItem(addItem(emptyCart, productA, 1), productA, 3)

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].quantity).toBe(4)
      expect(cart.items[0].lineId).toBeUndefined()
    })

    it("preserves manualLineTotal on the CartItem", () => {
      const cart = addItem(emptyCart, productB, 1, { lineId: "row-ccc", manualLineTotal: "15.50" })

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].manualLineTotal).toBe("15.50")
      expect(cart.items[0].lineId).toBe("row-ccc")
    })
  })

  describe("changeQuantity", () => {
    it("increments quantity by the given delta", () => {
      const cart = changeQuantity(addItem(emptyCart, productA, 2), "P001", 3)

      expect(cart.items[0].quantity).toBe(5)
    })

    it("decrements quantity and removes the line when it reaches zero", () => {
      const cart = changeQuantity(addItem(emptyCart, productA, 2), "P001", -2)

      expect(cart.items).toHaveLength(0)
    })

    it("ignores products not in the cart", () => {
      const cart = changeQuantity(addItem(emptyCart, productA, 2), "P002", 1)

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].quantity).toBe(2)
    })
  })

  describe("removeItem", () => {
    it("removes the matching product line", () => {
      const cart = removeItem(addItem(addItem(emptyCart, productA, 1), productB, 2), "P001")

      expect(cart.items).toHaveLength(1)
      expect(cart.items[0].product.id).toBe("P002")
    })
  })
})
