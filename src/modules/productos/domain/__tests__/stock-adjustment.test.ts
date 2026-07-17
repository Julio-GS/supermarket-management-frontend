import { describe, expect, it } from "vitest"
import { validateAdjustmentQuantity } from "../stock-adjustment"

describe("validateAdjustmentQuantity", () => {
  it("accepts positive integers", () => {
    expect(validateAdjustmentQuantity(1)).toBeNull()
    expect(validateAdjustmentQuantity(10)).toBeNull()
    expect(validateAdjustmentQuantity(100)).toBeNull()
  })

  it("accepts negative integers", () => {
    expect(validateAdjustmentQuantity(-1)).toBeNull()
    expect(validateAdjustmentQuantity(-10)).toBeNull()
    expect(validateAdjustmentQuantity(-100)).toBeNull()
  })

  it("accepts zero", () => {
    expect(validateAdjustmentQuantity(0)).toBeNull()
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
