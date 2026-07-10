import { describe, expect, it } from "vitest"
import { validateSplitGroups } from "../split-validator"
import type { SplitTicketGroupDraft } from "../../application/checkout-port"
import type { CartItem } from "../cart"

function makeCartItem(id: string, qty: number): CartItem {
  return {
    product: { id, name: `Product ${id}`, price: 100, unit: "u", promotions: null, storePromotions: null },
    quantity: qty,
  }
}

function makeGroup(
  label: string,
  items: { productId: string; quantity: number }[]
): SplitTicketGroupDraft {
  return { label, items }
}

describe("validateSplitGroups", () => {
  it("accepts 2 valid groups with distinct labels and balanced quantities", () => {
    const cart = [makeCartItem("P001", 2), makeCartItem("P002", 3)]
    const groups = [
      makeGroup("A", [
        { productId: "P001", quantity: 2 },
        { productId: "P002", quantity: 1 },
      ]),
      makeGroup("B", [{ productId: "P002", quantity: 2 }]),
    ]

    expect(validateSplitGroups(cart, groups)).toBeNull()
  })

  it("rejects when there are not exactly 2 groups", () => {
    const cart = [makeCartItem("P001", 1)]
    const groups = [makeGroup("A", [{ productId: "P001", quantity: 1 }])]

    expect(validateSplitGroups(cart, groups)).toBe("Se requieren exactamente 2 grupos.")
  })

  it("rejects 3 groups", () => {
    const cart = [makeCartItem("P001", 3)]
    const groups = [
      makeGroup("A", [{ productId: "P001", quantity: 1 }]),
      makeGroup("B", [{ productId: "P001", quantity: 1 }]),
      makeGroup("C", [{ productId: "P001", quantity: 1 }]),
    ]

    expect(validateSplitGroups(cart, groups)).toBe("Se requieren exactamente 2 grupos.")
  })

  it("rejects duplicate labels", () => {
    const cart = [makeCartItem("P001", 2)]
    const groups = [
      makeGroup("A", [{ productId: "P001", quantity: 1 }]),
      makeGroup("A", [{ productId: "P001", quantity: 1 }]),
    ]

    expect(validateSplitGroups(cart, groups)).toBe("Los labels de los grupos deben ser distintos.")
  })

  it("rejects when quantities don't sum to cart total", () => {
    const cart = [makeCartItem("P001", 2)]
    const groups = [
      makeGroup("A", [{ productId: "P001", quantity: 1 }]),
      makeGroup("B", [{ productId: "P001", quantity: 2 }]),
    ]

    expect(validateSplitGroups(cart, groups)).toBe(
      "La distribución de cantidades no cierra para el producto."
    )
  })

  it("rejects when a group references a product not in the cart", () => {
    const cart = [makeCartItem("P001", 1)]
    const groups = [
      makeGroup("A", [{ productId: "P001", quantity: 1 }]),
      makeGroup("B", [{ productId: "P999", quantity: 1 }]),
    ]

    expect(validateSplitGroups(cart, groups)).toBe(
      'Producto "P999" no está en el carrito.'
    )
  })

  it("accepts empty split items in one group when other group takes all", () => {
    const cart = [makeCartItem("P001", 5)]
    const groups = [
      makeGroup("A", [{ productId: "P001", quantity: 5 }]),
      makeGroup("B", []),
    ]

    expect(validateSplitGroups(cart, groups)).toBeNull()
  })
})
