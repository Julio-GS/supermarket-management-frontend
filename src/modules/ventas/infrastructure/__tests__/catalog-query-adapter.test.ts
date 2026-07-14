import { describe, expect, it, vi, beforeEach } from "vitest"
import { productRepository } from "@/modules/productos"
import { catalogQueryAdapter } from "../catalog-query-adapter"
import type { Product, ProductPage } from "@/modules/productos"

vi.mock("@/modules/productos", async () => {
  const actual = await vi.importActual<typeof import("@/modules/productos")>("@/modules/productos")
  return {
    ...actual,
    productRepository: {
      list: vi.fn(),
      findByCode: vi.fn(),
    },
  }
})

describe("catalogQueryAdapter", () => {
  const listSpy = vi.mocked(productRepository.list)
  const findByCodeSpy = vi.mocked(productRepository.findByCode)

  function toPage(products: Product[] = []): ProductPage {
    return {
      products,
      meta: { page: 1, limit: 100, total: products.length, totalPages: 1, hasNext: false },
    }
  }

  beforeEach(() => {
    listSpy.mockReset()
    listSpy.mockResolvedValue(toPage())
  })

  it("forwards the trimmed search term to the product repository", async () => {
    await catalogQueryAdapter.search({ search: "  leche  " })

    expect(listSpy).toHaveBeenCalledWith({
      search: "leche",
      page: 1,
      limit: 100,
      sort: "created_at:desc",
    })
  })

  it("passes requested pagination to the product repository", async () => {
    await catalogQueryAdapter.search({ page: 2, limit: 20 })

    expect(listSpy).toHaveBeenCalledWith({ page: 2, limit: 20, sort: "created_at:desc" })
  })

  it("maps repository products to catalog products", async () => {
    listSpy.mockResolvedValue(
      toPage([
        {
          id: "P001",
          name: "Agua mineral",
          sku: "BEB-0001",
          price: 1.2,
          cost: 0.72,
          stock: 100,
          stockMinimum: 20,
          unit: "u",
          supplier: "Sin asignar",
          promotions: null,
          storePromotions: null,
        },
      ])
    )

    const result = await catalogQueryAdapter.search()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: "P001",
      name: "Agua mineral",
      sku: "BEB-0001",
      price: 1.2,
      stock: 100,
      unit: "u",
      promotions: null,
      storePromotions: null,
    })
  })

  // ── findByCode ──────────────────────────────────────────────

  it("returns a mapped CatalogProduct when the repository finds an exact match", async () => {
    findByCodeSpy.mockResolvedValue({
      id: "P042",
      name: "Leche entera",
      sku: "LEC-0042",
      price: 2.5,
      cost: 1.5,
      stock: 50,
      stockMinimum: 20,
      unit: "u",
      supplier: "Proveedor A",
      promotions: null,
      storePromotions: null,
    })

    const result = await catalogQueryAdapter.findByCode("LEC-0042")

    expect(findByCodeSpy).toHaveBeenCalledWith("LEC-0042")
    expect(result).not.toBeNull()
    expect(result!).toEqual({
      id: "P042",
      name: "Leche entera",
      sku: "LEC-0042",
      price: 2.5,
      stock: 50,
      unit: "u",
      promotions: null,
      storePromotions: null,
    })
  })

  it("returns null when the repository finds no match", async () => {
    findByCodeSpy.mockResolvedValue(null)

    const result = await catalogQueryAdapter.findByCode("NONEXISTENT")

    expect(findByCodeSpy).toHaveBeenCalledWith("NONEXISTENT")
    expect(result).toBeNull()
  })

  it("forwards the code to the repository without trimming modification", async () => {
    findByCodeSpy.mockResolvedValue(null)

    await catalogQueryAdapter.findByCode("  7791234567890  ")

    // The adapter passes the code as-is; the repository handles trimming
    expect(findByCodeSpy).toHaveBeenCalledWith("  7791234567890  ")
  })
})
