import { describe, expect, it } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { useProductCatalog } from "../use-product-catalog"
import type { ProductRepository } from "../product-repository"
import type { CreateProductInput, Product } from "../../domain/product"
import { categories } from "../../domain/category"

function createFakeRepository(initial: Product[] = []): ProductRepository {
  let products = [...initial]
  let sequence = products.length + 1

  return {
    async list(filters = {}) {
      let result = [...products]
      if (filters.category && filters.category !== "all") {
        result = result.filter((p) => p.category === filters.category)
      }
      if (filters.search) {
        const term = filters.search.toLowerCase()
        result = result.filter(
          (p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
        )
      }
      return result
    },
    async create(input: CreateProductInput) {
      const product: Product = {
        id: `P${String(sequence).padStart(3, "0")}`,
        name: input.name,
        category: input.category,
        sku: `NEW-${String(sequence).padStart(4, "0")}`,
        price: input.price,
        cost: Number((input.price * 0.6).toFixed(2)),
        stock: input.stock,
        stockMinimum: 20,
        unit: "u",
        supplier: "Fake Supplier",
      }
      sequence += 1
      products = [product, ...products]
      return product
    },
    async update(product) {
      products = products.map((p) => (p.id === product.id ? product : p))
      return product
    },
    async delete(id) {
      products = products.filter((p) => p.id !== id)
    },
  }
}

describe("useProductCatalog", () => {
  it("initializes with optional initial products", () => {
    const repository = createFakeRepository()
    const { result } = renderHook(() =>
      useProductCatalog(repository, {
        initialProducts: [
          {
            id: "P001",
            name: "Leche",
            category: categories[1],
            sku: "LAC-0001",
            price: 1.1,
            cost: 0.66,
            stock: 100,
            stockMinimum: 20,
            unit: "u",
            supplier: "Test",
          },
        ],
      })
    )

    expect(result.current.products).toHaveLength(1)
    expect(result.current.products[0].name).toBe("Leche")
  })

  it("loads products from the repository when refresh is called", async () => {
    const repository = createFakeRepository([
      {
        id: "P001",
        name: "Leche",
        category: categories[1],
        sku: "LAC-0001",
        price: 1.1,
        cost: 0.66,
        stock: 100,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test",
      },
    ])

    const { result } = renderHook(() => useProductCatalog(repository))
    expect(result.current.products).toHaveLength(0)

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.products).toHaveLength(1)
    expect(result.current.products[0].name).toBe("Leche")
  })

  it("filters products by category through applyFilters", async () => {
    const repository = createFakeRepository([
      {
        id: "P001",
        name: "Manzana",
        category: categories[0],
        sku: "FRV-0001",
        price: 1,
        cost: 0.6,
        stock: 50,
        stockMinimum: 20,
        unit: "kg",
        supplier: "Test",
      },
      {
        id: "P002",
        name: "Leche",
        category: categories[1],
        sku: "LAC-0001",
        price: 1.1,
        cost: 0.66,
        stock: 100,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test",
      },
    ])

    const { result } = renderHook(() => useProductCatalog(repository))

    await act(async () => {
      await result.current.applyFilters({ category: categories[1] })
    })

    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(result.current.products[0].name).toBe("Leche")
  })

  it("creates a product and refreshes the list", async () => {
    const repository = createFakeRepository()
    const { result } = renderHook(() => useProductCatalog(repository))

    await act(async () => {
      await result.current.createProduct({
        name: "Nuevo",
        category: categories[0],
        price: 10,
        stock: 5,
      })
    })

    expect(result.current.products).toHaveLength(1)
    expect(result.current.products[0].name).toBe("Nuevo")
  })
})
