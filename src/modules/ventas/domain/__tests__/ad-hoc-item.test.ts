import { describe, it, expect } from "vitest"
import {
  validateAdHocName,
  validateAdHocPrice,
  validateAdHocQuantity,
  validateAdHocDraft,
  validateAdHocDrafts,
  computeAdHocSubtotal,
  type AdHocItemDraft,
} from "../ad-hoc-item"

function makeDraft(overrides: Partial<AdHocItemDraft> = {}): AdHocItemDraft {
  return {
    draftId: "draft-1",
    name: "Test Item",
    unitPrice: "100.00",
    quantity: 2,
    ...overrides,
  }
}

describe("validateAdHocName", () => {
  it("returns null for a valid name", () => {
    expect(validateAdHocName("Counter Service")).toBeNull()
  })

  it("returns error for empty string", () => {
    expect(validateAdHocName("")).toBe("El nombre del producto es obligatorio")
  })

  it("returns error for whitespace-only string", () => {
    expect(validateAdHocName("   ")).toBe("El nombre del producto es obligatorio")
  })
})

describe("validateAdHocPrice", () => {
  it("returns null for a valid price", () => {
    expect(validateAdHocPrice("199.99")).toBeNull()
  })

  it("returns error for empty string", () => {
    expect(validateAdHocPrice("")).toBe("El precio unitario es obligatorio")
  })

  it("returns error for zero", () => {
    expect(validateAdHocPrice("0")).toBe("El precio debe ser mayor a cero")
  })

  it("returns error for negative value", () => {
    expect(validateAdHocPrice("-50")).toBe("El precio debe ser mayor a cero")
  })

  it("returns error for non-numeric string", () => {
    expect(validateAdHocPrice("abc")).toBe("El precio debe ser mayor a cero")
  })
})

describe("validateAdHocQuantity", () => {
  it("returns null for a valid quantity", () => {
    expect(validateAdHocQuantity(2)).toBeNull()
    expect(validateAdHocQuantity(1)).toBeNull()
  })

  it("returns error for zero", () => {
    expect(validateAdHocQuantity(0)).toBe("La cantidad debe ser un entero positivo")
  })

  it("returns error for negative", () => {
    expect(validateAdHocQuantity(-1)).toBe("La cantidad debe ser un entero positivo")
  })

  it("returns error for non-integer (decimal)", () => {
    expect(validateAdHocQuantity(1.5)).toBe("La cantidad debe ser un entero positivo")
  })
})

describe("validateAdHocDraft", () => {
  it("returns empty error object for a valid draft", () => {
    const draft = makeDraft()
    const errors = validateAdHocDraft(draft)
    expect(errors.name).toBeUndefined()
    expect(errors.unitPrice).toBeUndefined()
    expect(errors.quantity).toBeUndefined()
  })

  it("returns name error for empty name", () => {
    const errors = validateAdHocDraft(makeDraft({ name: "" }))
    expect(errors.name).toBe("El nombre del producto es obligatorio")
  })

  it("returns price error for zero price", () => {
    const errors = validateAdHocDraft(makeDraft({ unitPrice: "0" }))
    expect(errors.unitPrice).toBe("El precio debe ser mayor a cero")
  })

  it("returns quantity error for zero quantity", () => {
    const errors = validateAdHocDraft(makeDraft({ quantity: 0 }))
    expect(errors.quantity).toBe("La cantidad debe ser un entero positivo")
  })

  it("returns multiple errors when multiple fields invalid", () => {
    const errors = validateAdHocDraft(makeDraft({ name: "", unitPrice: "0", quantity: 0 }))
    expect(errors.name).toBeDefined()
    expect(errors.unitPrice).toBeDefined()
    expect(errors.quantity).toBeDefined()
  })
})

describe("validateAdHocDrafts", () => {
  it("returns empty array when all drafts are valid", () => {
    const drafts = [makeDraft(), makeDraft({ draftId: "draft-2" })]
    expect(validateAdHocDrafts(drafts)).toHaveLength(0)
  })

  it("returns only drafts with errors", () => {
    const drafts = [
      makeDraft(),
      makeDraft({ draftId: "bad", name: "" }),
    ]
    const errors = validateAdHocDrafts(drafts)
    expect(errors).toHaveLength(1)
    expect(errors[0].draftId).toBe("bad")
  })
})

describe("computeAdHocSubtotal", () => {
  it("returns unitPrice * quantity for valid inputs", () => {
    expect(computeAdHocSubtotal(makeDraft({ unitPrice: "199.99", quantity: 2 }))).toBe(399.98)
  })

  it("returns 0 for invalid price", () => {
    expect(computeAdHocSubtotal(makeDraft({ unitPrice: "abc" }))).toBe(0)
  })

  it("returns 0 for invalid quantity", () => {
    expect(computeAdHocSubtotal(makeDraft({ quantity: 0 }))).toBe(0)
  })
})
