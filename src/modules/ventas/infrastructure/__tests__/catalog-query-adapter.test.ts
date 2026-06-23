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
    },
  }
})

describe("catalogQueryAdapter", () => {
  const listSpy = vi.mocked(productRepository.list)

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

  it("requests the documented products page without forwarding search", async () => {
    await catalogQueryAdapter.search({ search: "  leche  " })

    expect(listSpy).toHaveBeenCalledWith({ page: 1, limit: 100, sort: "created_at:desc" })
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
          category: "Bebidas",
          sku: "BEB-0001",
          price: 1.2,
          cost: 0.72,
          stock: 100,
          stockMinimum: 20,
          unit: "u",
          supplier: "Sin asignar",
        },
      ])
    )

    const result = await catalogQueryAdapter.search()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: "P001",
      name: "Agua mineral",
      category: "Bebidas",
      sku: "BEB-0001",
      price: 1.2,
      stock: 100,
      unit: "u",
    })
  })
})
