import { describe, expect, it, vi } from "vitest"

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
import { act, waitFor } from "@testing-library/react"
import { renderHook } from "@/test/render"
import { useProductCatalog } from "../use-product-catalog"
import type { ProductListQuery, ProductPage, ProductRepository } from "../product-repository"
import type { CreateProductInput, Product, UpdateProductInput } from "../../domain/product"
import { matchesProductSearch } from "../../domain/product-search"
import { triggerDesktopSync } from "@/modules/sync-status/application/desktop-sync-trigger"

vi.mock("@/modules/sync-status/application/desktop-sync-trigger", () => ({
  triggerDesktopSync: vi.fn().mockResolvedValue(undefined),
}))

function toPage(products: Product[], query: ProductListQuery = {}): ProductPage {
  const page = query.page ?? 1
  const limit = (query.limit ?? products.length) || 1
  const start = (page - 1) * limit
  const totalPages = Math.max(1, Math.ceil(products.length / limit))

  return {
    products: products.slice(start, start + limit),
    meta: {
      page,
      limit,
      total: products.length,
      totalPages,
      hasNext: page < totalPages,
    },
  }
}

function createFakeRepository(initial: Product[] = []): ProductRepository {
  let products = [...initial]
  let sequence = products.length + 1

  return {
    async list(query = {}) {
      const search = query.search?.trim()
      const filteredProducts = search ? products.filter((product) => matchesProductSearch(product, search)) : products
      return toPage(filteredProducts, query)
    },
    async findByCode(_code: string) {
      return null
    },
    async create(input: CreateProductInput) {
      const product: Product = {
        id: `P${String(sequence).padStart(3, "0")}`,
        name: input.name,
        sku: input.sku || `NEW-${String(sequence).padStart(4, "0")}`,
        price: input.price,
        cost: Number((input.price * 0.6).toFixed(2)),
        manejaStock: input.manejaStock,
        stock: input.manejaStock ? 0 : null,
        stockMinimum: 20,
        unit: "u",
        supplier: "Fake Supplier",
    promotions: null,
    storePromotions: null,
      }
      sequence += 1
      products = [product, ...products]
      return product
    },
    async update(input: UpdateProductInput) {
      products = products.map((p) =>
        p.id === input.id
          ? {
              ...p,
              name: input.name,
              sku: input.sku,
              price: input.price,
              cost: Number((input.price * 0.6).toFixed(2)),
              manejaStock: true,
            }
          : p
      )
      const updated = products.find((p) => p.id === input.id)
      if (!updated) throw new Error(`Product ${input.id} not found`)
      return updated
    },
    async delete(id) {
      products = products.filter((p) => p.id !== id)
    },
  }
}

function createRepositoryThatIgnoresSearch(initial: Product[] = []): ProductRepository {
  let products = [...initial]

  return {
    async list(query = {}) {
      return toPage(products, query)
    },
    async findByCode(_code: string) {
      return null
    },
    async create(input: CreateProductInput) {
      const product: Product = {
        id: `P${String(products.length + 1).padStart(3, "0")}`,
        name: input.name,
        sku: input.sku,
        price: input.price,
        cost: Number((input.price * 0.6).toFixed(2)),
        manejaStock: input.manejaStock,
        stock: input.manejaStock ? 0 : null,
        stockMinimum: 20,
        unit: "u",
        supplier: "Backend Supplier",
    promotions: null,
    storePromotions: null,
      }
      products = [product, ...products]
      return product
    },
    async update(input: UpdateProductInput) {
      products = products.map((p) =>
        p.id === input.id
          ? {
              ...p,
              name: input.name,
              sku: input.sku,
              price: input.price,
              cost: Number((input.price * 0.6).toFixed(2)),
              manejaStock: true,
            }
          : p
      )
      const updated = products.find((p) => p.id === input.id)
      if (!updated) throw new Error(`Product ${input.id} not found`)
      return updated
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
            sku: "LAC-0001",
            price: 1.1,
            cost: 0.66,
            manejaStock: true,
            stock: 100,
            stockMinimum: 20,
            unit: "u",
            supplier: "Test",
    promotions: null,
    storePromotions: null,
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
        sku: "LAC-0001",
        price: 1.1,
        cost: 0.66,
        manejaStock: true,
        stock: 100,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test",
    promotions: null,
    storePromotions: null,
      },
    ])

    const { result } = renderHook(() => useProductCatalog(repository))
    expect(result.current.products).toHaveLength(0)

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(result.current.products[0].name).toBe("Leche")
  })

  it("passes search terms to the repository and resets the page to 1", async () => {
    const repository = createFakeRepository([
      {
        id: "P001",
        name: "Manzana Roja",
        sku: "FRV-0001",
        price: 1,
        cost: 0.6,
        manejaStock: true,
        stock: 50,
        stockMinimum: 20,
        unit: "kg",
        supplier: "Test",
    promotions: null,
    storePromotions: null,
      },
      {
        id: "P002",
        name: "Leche Entera 1L",
        sku: "LAC-0011",
        price: 1.1,
        cost: 0.66,
        manejaStock: true,
        stock: 100,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test",
    promotions: null,
    storePromotions: null,
      },
    ])
    const listSpy = vi.spyOn(repository, "list")

    const { result } = renderHook(() => useProductCatalog(repository))

    await waitFor(() => expect(result.current.products).toHaveLength(2))

    await act(async () => {
      result.current.setPage(2)
    })

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    })

    await act(async () => {
      await result.current.applyFilters({ search: "FRV-0001" })
    })

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          search: "FRV-0001",
          limit: 100,
          sort: "created_at:desc",
        })
      )
    })

    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(result.current.products[0].name).toBe("Manzana Roja")
  })

  it("filters products by name or SKU through applyFilters", async () => {
    const repository = createFakeRepository([
      {
        id: "P001",
        name: "Manzana Roja",
        sku: "FRV-0001",
        price: 1,
        cost: 0.6,
        manejaStock: true,
        stock: 50,
        stockMinimum: 20,
        unit: "kg",
        supplier: "Test",
    promotions: null,
    storePromotions: null,
      },
      {
        id: "P002",
        name: "Leche Entera 1L",
        sku: "LAC-0011",
        price: 1.1,
        cost: 0.66,
        manejaStock: true,
        stock: 100,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test",
    promotions: null,
    storePromotions: null,
      },
    ])

    const { result } = renderHook(() => useProductCatalog(repository))

    await act(async () => {
      await result.current.applyFilters({ search: "leche" })
    })

    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(result.current.products[0].name).toBe("Leche Entera 1L")

    await act(async () => {
      await result.current.applyFilters({ search: "FRV-0001" })
    })

    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(result.current.products[0].name).toBe("Manzana Roja")
  })

  it("filters products by search in the hook even when the repository ignores the search term", async () => {
    const repository = createRepositoryThatIgnoresSearch([
      {
        id: "P001",
        name: "Manzana Roja",
        sku: "FRV-0001",
        price: 1,
        cost: 0.6,
        manejaStock: true,
        stock: 50,
        stockMinimum: 20,
        unit: "kg",
        supplier: "Test",
    promotions: null,
    storePromotions: null,
      },
      {
        id: "P002",
        name: "Leche Entera 1L",
        sku: "LAC-0011",
        price: 1.1,
        cost: 0.66,
        manejaStock: true,
        stock: 100,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test",
    promotions: null,
    storePromotions: null,
      },
    ])

    const { result } = renderHook(() => useProductCatalog(repository))

    await act(async () => {
      await result.current.applyFilters({ search: "leche" })
    })

    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(result.current.products[0].name).toBe("Leche Entera 1L")

    await act(async () => {
      await result.current.applyFilters({ search: "FRV-0001" })
    })

    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(result.current.products[0].name).toBe("Manzana Roja")
  })

  it("creates a product and refreshes the list", async () => {
    const repository = createFakeRepository()
    const { result } = renderHook(() => useProductCatalog(repository))

    await act(async () => {
      await result.current.createProduct({
        name: "Nuevo",
        sku: "NUE-0001",
        price: 10,
        manejaStock: true,
      })
    })

    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(result.current.products[0].name).toBe("Nuevo")
  })

  it("triggers a background desktop sync after create", async () => {
    const repository = createFakeRepository()
    const { result } = renderHook(() => useProductCatalog(repository))

    await act(async () => {
      await result.current.createProduct({
        name: "Nuevo",
        sku: "NUE-0001",
        price: 10,
        manejaStock: true,
      })
    })

    expect(triggerDesktopSync).toHaveBeenCalledWith({ reason: "product-create" })
  })

  it("exposes create pending state and ignores duplicate create calls while one is in flight", async () => {
    const gate = deferred<Product>()
    const repository: ProductRepository = {
      list: vi.fn().mockResolvedValue(toPage([])),
      findByCode: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (input: CreateProductInput) => gate.promise.then(() => ({
        id: "P999",
        name: input.name,
        sku: input.sku,
        price: input.price,
        cost: Number((input.price * 0.6).toFixed(2)),
        manejaStock: input.manejaStock,
        stock: input.manejaStock ? 0 : null,
        stockMinimum: 20,
        unit: "u",
        supplier: "Deferred Supplier",
        promotions: null,
        storePromotions: null,
      }))),
      update: vi.fn(),
      delete: vi.fn(),
    }

    const { result } = renderHook(() => useProductCatalog(repository))

    let firstCreate: Promise<void>
    await act(async () => {
      firstCreate = result.current.createProduct({
        name: "Pendiente",
        sku: "PEN-0001",
        price: 10,
        manejaStock: true,
      })
    })

    await waitFor(() => expect(result.current.isCreating).toBe(true))

    await act(async () => {
      await result.current.createProduct({
        name: "Duplicado",
        sku: "DUP-0001",
        price: 10,
        manejaStock: true,
      })
    })

    expect(repository.create).toHaveBeenCalledTimes(1)

    await act(async () => {
      gate.resolve({
        id: "P999",
        name: "Pendiente",
        sku: "PEN-0001",
        price: 10,
        cost: 6,
        manejaStock: true,
        stock: 0,
        stockMinimum: 20,
        unit: "u",
        supplier: "Deferred Supplier",
        promotions: null,
        storePromotions: null,
      })
      await firstCreate!
    })

    await waitFor(() => expect(result.current.isCreating).toBe(false))
  })

  it("triggers a background desktop sync after update", async () => {
    const repository = createFakeRepository([
      {
        id: "P001",
        name: "Manzana Roja",
        sku: "FRV-0001",
        price: 1,
        cost: 0.6,
        manejaStock: true,
        stock: 50,
        stockMinimum: 20,
        unit: "kg",
        supplier: "Test",
        promotions: null,
        storePromotions: null,
      },
    ])

    const { result } = renderHook(() => useProductCatalog(repository))

    await act(async () => {
      await result.current.updateProduct({
        id: "P001",
        name: "Manzana Verde",
        sku: "FRV-0001-UPD",
        price: 1.5,
        manejaStock: true,
      })
    })

    expect(triggerDesktopSync).toHaveBeenCalledWith({ reason: "product-update" })
  })

  it("updates a product and refreshes the list", async () => {
    const repository = createFakeRepository([
      {
        id: "P001",
        name: "Manzana Roja",
        sku: "FRV-0001",
        price: 1,
        cost: 0.6,
        manejaStock: true,
        stock: 50,
        stockMinimum: 20,
        unit: "kg",
        supplier: "Test",
    promotions: null,
    storePromotions: null,
      },
    ])

    const { result } = renderHook(() => useProductCatalog(repository, {
        initialProducts: [
          {
            id: "P001",
            name: "Manzana Roja",
            sku: "FRV-0001",
            price: 1,
            cost: 0.6,
            manejaStock: true,
          stock: 50,
          stockMinimum: 20,
          unit: "kg",
          supplier: "Test",
    promotions: null,
    storePromotions: null,
        },
      ],
    }))

    await act(async () => {
      await result.current.updateProduct({
        id: "P001",
        name: "Manzana Verde",
        sku: "FRV-0001-UPD",
        price: 1.5,
        manejaStock: true,
      })
    })

    await waitFor(() => expect(result.current.products[0].name).toBe("Manzana Verde"))
    expect(result.current.products[0].sku).toBe("FRV-0001-UPD")
    expect(result.current.products[0].price).toBe(1.5)
  })
})
