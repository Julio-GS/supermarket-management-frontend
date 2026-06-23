import { describe, expect, it } from "vitest"
import {
  calculateCost,
  createProduct,
  generateSku,
  getStockStatus,
  validateProductPrice,
  DEFAULT_STOCK_MINIMUM,
} from "../product"
import { evaluateStockStatus } from "../stock-status"
import { categories } from "../category"

describe("product domain rules", () => {
  describe("calculateCost", () => {
    it("returns 60% of the price rounded to two decimals", () => {
      expect(calculateCost(100)).toBe(60)
      expect(calculateCost(9.99)).toBe(5.99)
    })
  })

  describe("generateSku", () => {
    it("generates a SKU using the sequence number padded to four digits", () => {
      expect(generateSku(1)).toBe("NEW-0001")
      expect(generateSku(42)).toBe("NEW-0042")
    })
  })

  describe("createProduct", () => {
    it("creates a product with derived cost, default stock minimum and generated SKU", () => {
      const product = createProduct(
        {
          name: "Test Product",
          category: categories[0],
          sku: "",
          price: 100,
          stock: 50,
        },
        7
      )

      expect(product.id).toBe("P007")
      expect(product.name).toBe("Test Product")
      expect(product.category).toBe("Frutas y Verduras")
      expect(product.sku).toBe("NEW-0007")
      expect(product.price).toBe(100)
      expect(product.cost).toBe(60)
      expect(product.stock).toBe(50)
      expect(product.stockMinimum).toBe(DEFAULT_STOCK_MINIMUM)
      expect(product.unit).toBe("u")
      expect(product.supplier).toBe("Sin asignar")
    })
  })

  describe("evaluateStockStatus", () => {
    it("returns OUT_OF_STOCK when stock is zero", () => {
      expect(evaluateStockStatus(0, 20)).toBe("OUT_OF_STOCK")
    })

    it("returns LOW_STOCK when stock is at or below the minimum", () => {
      expect(evaluateStockStatus(5, 20)).toBe("LOW_STOCK")
      expect(evaluateStockStatus(20, 20)).toBe("LOW_STOCK")
    })

    it("returns IN_STOCK when stock is above the minimum", () => {
      expect(evaluateStockStatus(21, 20)).toBe("IN_STOCK")
    })
  })

  describe("getStockStatus", () => {
    it("delegates to evaluateStockStatus using product fields", () => {
      expect(getStockStatus({ stock: 0, stockMinimum: 20 })).toBe("OUT_OF_STOCK")
      expect(getStockStatus({ stock: 5, stockMinimum: 20 })).toBe("LOW_STOCK")
      expect(getStockStatus({ stock: 25, stockMinimum: 20 })).toBe("IN_STOCK")
    })
  })

  describe("validateProductPrice", () => {
    it("returns null for valid non-negative prices", () => {
      expect(validateProductPrice(0)).toBeNull()
      expect(validateProductPrice(1.5)).toBeNull()
      expect(validateProductPrice(100)).toBeNull()
    })

    it("returns an INVALID_PRICE error for negative prices", () => {
      const error = validateProductPrice(-1)
      expect(error).not.toBeNull()
      expect(error?.code).toBe("INVALID_PRICE")
    })

    it("returns an INVALID_PRICE error for non-finite prices", () => {
      expect(validateProductPrice(NaN)?.code).toBe("INVALID_PRICE")
      expect(validateProductPrice(Infinity)?.code).toBe("INVALID_PRICE")
    })
  })
})
