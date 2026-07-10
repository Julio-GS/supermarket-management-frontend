import { describe, expect, it } from "vitest"
import {
  resolveProductCode,
  ProductCodeNotFoundError,
} from "../resolve-product-code"
import type { ProductRepository } from "@/modules/productos/application/product-repository"

function makeStubRepo(
  products: Array<{ id: string; sku: string }>
): ProductRepository {
  return {
    list: async () => ({
      products: [],
      meta: { page: 1, limit: 1, total: 0, totalPages: 1, hasNext: false },
    }),
    findByCode: async (code: string) => {
      const trimmed = code.trim()
      const found = products.find(
        (p) => p.sku === trimmed || p.id === trimmed
      )
      return found
        ? {
            id: found.id,
            name: "Test",
            sku: found.sku,
            price: 0,
            cost: 0,
            stock: null,
            stockMinimum: 20,
            unit: "u",
            supplier: "",
            promotions: null,
            storePromotions: null,
          }
        : null
    },
    create: async () => {
      throw new Error("not implemented")
    },
    update: async () => {
      throw new Error("not implemented")
    },
    delete: async () => {
      throw new Error("not implemented")
    },
  }
}

describe("resolveProductCode", () => {
  it("resolves a known product code to its UUID", async () => {
    const repo = makeStubRepo([{ id: "uuid-123", sku: "LAC-0001" }])
    const id = await resolveProductCode(repo, "LAC-0001")
    expect(id).toBe("uuid-123")
  })

  it("resolves by product ID as well (edit-mode fallback)", async () => {
    const repo = makeStubRepo([{ id: "uuid-456", sku: "BEB-0002" }])
    const id = await resolveProductCode(repo, "uuid-456")
    expect(id).toBe("uuid-456")
  })

  it("trims whitespace from the code before lookup", async () => {
    const repo = makeStubRepo([{ id: "uuid-789", sku: "FRV-0001" }])
    const id = await resolveProductCode(repo, "  FRV-0001  ")
    expect(id).toBe("uuid-789")
  })

  it("throws ProductCodeNotFoundError when code does not match any product", async () => {
    const repo = makeStubRepo([])
    await expect(resolveProductCode(repo, "GHOST-CODE")).rejects.toThrow(
      ProductCodeNotFoundError
    )
    await expect(resolveProductCode(repo, "GHOST-CODE")).rejects.toThrow(
      'No se encontró ningún producto con el código "GHOST-CODE"'
    )
  })

  it("throws ProductCodeNotFoundError when code is empty", async () => {
    const repo = makeStubRepo([])
    await expect(resolveProductCode(repo, "   ")).rejects.toThrow(
      ProductCodeNotFoundError
    )
  })
})
