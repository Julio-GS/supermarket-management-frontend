import { describe, expect, it } from "vitest"
import { validateAdjustmentQuantity } from "../stock-adjustment"

describe("validateAdjustmentQuantity", () => {
  it("accepts positive integers", () => {
    expect(validateAdjustmentQuantity(1)).toBeNull()
    expect(validateAdjustmentQuantity(10)).toBeNull()
    expect(validateAdjustmentQuantity(100)).toBeNull()
  })

  it("rejects negative integers", () => {
    expect(validateAdjustmentQuantity(-1)).not.toBeNull()
    expect(validateAdjustmentQuantity(-10)).not.toBeNull()
    expect(validateAdjustmentQuantity(-100)).not.toBeNull()
  })

  it("rejects zero", () => {
    const error = validateAdjustmentQuantity(0)
    expect(error).not.toBeNull()
    expect(error).toBeTypeOf("string")
    expect(error!.length).toBeGreaterThan(0)
  })

  it("rejects decimal values", () => {
    expect(validateAdjustmentQuantity(1.5)).not.toBeNull()
    expect(validateAdjustmentQuantity(-3.14)).not.toBeNull()
    expect(validateAdjustmentQuantity(0.1)).not.toBeNull()
  })

  it("rejects NaN", () => {
    expect(validateAdjustmentQuantity(NaN)).not.toBeNull()
  })

  it("rejects positive Infinity", () => {
    expect(validateAdjustmentQuantity(Infinity)).not.toBeNull()
  })

  it("rejects negative Infinity", () => {
    expect(validateAdjustmentQuantity(-Infinity)).not.toBeNull()
  })

  it("returns a descriptive error message for decimals", () => {
    const error = validateAdjustmentQuantity(2.5)
    expect(error).toBeTypeOf("string")
    expect(error!.length).toBeGreaterThan(0)
  })
})
