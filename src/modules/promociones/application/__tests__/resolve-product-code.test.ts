import { describe, expect, it } from "vitest"
import {
  resolveProductCode,
  ProductCodeNotFoundError,
  type ProductCodeLookup,
} from "../resolve-product-code"

function makeStubLookup(
  products: Array<{ id: string; sku: string }>
): ProductCodeLookup {
  return {
    findByCode: async (code: string) => {
      const trimmed = code.trim()
      const found = products.find(
        (p) => p.sku === trimmed || p.id === trimmed
      )
      return found ? { id: found.id } : null
    },
  }
}

describe("resolveProductCode", () => {
  it("resolves a known product code to its UUID", async () => {
    const lookup = makeStubLookup([{ id: "uuid-123", sku: "LAC-0001" }])
    const id = await resolveProductCode(lookup, "LAC-0001")
    expect(id).toBe("uuid-123")
  })

  it("resolves by product ID as well (edit-mode fallback)", async () => {
    const lookup = makeStubLookup([{ id: "uuid-456", sku: "BEB-0002" }])
    const id = await resolveProductCode(lookup, "uuid-456")
    expect(id).toBe("uuid-456")
  })

  it("trims whitespace from the code before lookup", async () => {
    const lookup = makeStubLookup([{ id: "uuid-789", sku: "FRV-0001" }])
    const id = await resolveProductCode(lookup, "  FRV-0001  ")
    expect(id).toBe("uuid-789")
  })

  it("throws ProductCodeNotFoundError when code does not match any product", async () => {
    const lookup = makeStubLookup([])
    await expect(resolveProductCode(lookup, "GHOST-CODE")).rejects.toThrow(
      ProductCodeNotFoundError
    )
    await expect(resolveProductCode(lookup, "GHOST-CODE")).rejects.toThrow(
      'No se encontró ningún producto con el código "GHOST-CODE"'
    )
  })

  it("throws ProductCodeNotFoundError when code is empty", async () => {
    const lookup = makeStubLookup([])
    await expect(resolveProductCode(lookup, "   ")).rejects.toThrow(
      ProductCodeNotFoundError
    )
  })

  it("resolves code using a minimal lookup object without full repository methods", async () => {
    const minimalLookup: ProductCodeLookup = {
      findByCode: async (code: string) => {
        if (code === "MIN-001") {
          return { id: "min-uuid-1" }
        }
        return null
      },
    }
    const id = await resolveProductCode(minimalLookup, "MIN-001")
    expect(id).toBe("min-uuid-1")
  })

  it("maintains structural compatibility when passed a full repository shape", async () => {
    const fullRepoShape = {
      list: async () => ({
        products: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false },
      }),
      findByCode: async (code: string) => {
        if (code === "FULL-001") {
          return {
            id: "full-uuid-1",
            name: "Full Product",
            sku: "FULL-001",
            price: 25,
            cost: 15,
            manejaStock: true,
            stock: 5,
            stockMinimum: 2,
            unit: "u",
            supplier: "Supplier X",
            promotions: null,
            storePromotions: null,
          }
        }
        return null
      },
      create: async () => { throw new Error("not used") },
      update: async () => { throw new Error("not used") },
      delete: async () => { throw new Error("not used") },
      updateStockControl: async () => { throw new Error("not used") },
    }

    const id = await resolveProductCode(fullRepoShape, "FULL-001")
    expect(id).toBe("full-uuid-1")
  })
})
