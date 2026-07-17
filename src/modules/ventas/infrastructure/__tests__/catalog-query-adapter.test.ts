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
          manejaStock: true,
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
      manejaStock: true,
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
      manejaStock: true,
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
      manejaStock: true,
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

  // ── Special product metadata propagation ─────────────────────

  it("propagates pricingMode and isProtected from Product to CatalogProduct in search results", async () => {
    listSpy.mockResolvedValue(
      toPage([
        {
          id: "SP001",
          name: "Gastos Varios",
          sku: "3",
          price: 0,
          cost: 0,
          manejaStock: true,
          stock: null,
          stockMinimum: 20,
          unit: "u",
          supplier: "Sin asignar",
          promotions: null,
          storePromotions: null,
          pricingMode: "manual",
          isProtected: true,
        },
      ])
    )

    const result = await catalogQueryAdapter.search()

    expect(result).toHaveLength(1)
    expect(result[0].pricingMode).toBe("manual")
    expect(result[0].isProtected).toBe(true)
    expect(result[0].manejaStock).toBe(true)
  })

  // ── manejaStock propagation ──────────────────────────────────

  it("propagates manejaStock from Product to CatalogProduct in search results", async () => {
    listSpy.mockResolvedValue(
      toPage([
        {
          id: "P100",
          name: "Stock Product",
          sku: "STK-001",
          price: 5,
          cost: 3,
          manejaStock: true,
          stock: 20,
          stockMinimum: 5,
          unit: "u",
          supplier: "Sin asignar",
          promotions: null,
          storePromotions: null,
        },
        {
          id: "P101",
          name: "No-Stock Product",
          sku: "NST-001",
          price: 8,
          cost: 4,
          manejaStock: false,
          stock: null,
          stockMinimum: 0,
          unit: "u",
          supplier: "Sin asignar",
          promotions: null,
          storePromotions: null,
        },
      ])
    )

    const result = await catalogQueryAdapter.search()

    expect(result).toHaveLength(2)
    expect(result[0].manejaStock).toBe(true)
    expect(result[1].manejaStock).toBe(false)
  })

  it("propagates manejaStock from Product to CatalogProduct in findByCode", async () => {
    findByCodeSpy.mockResolvedValue({
      id: "P200",
      name: "Stockless",
      sku: "NO-STK",
      price: 3,
      cost: 1.5,
      manejaStock: false,
      stock: null,
      stockMinimum: 0,
      unit: "u",
      supplier: "Sin asignar",
      promotions: null,
      storePromotions: null,
    })

    const result = await catalogQueryAdapter.findByCode("NO-STK")

    expect(result).not.toBeNull()
    expect(result!.manejaStock).toBe(false)
    expect(result!.stock).toBeNull()
  })

  it("propagates pricingMode and isProtected from Product to CatalogProduct in findByCode", async () => {
    findByCodeSpy.mockResolvedValue({
      id: "SP002",
      name: "Envío",
      sku: "5",
      price: 0,
      cost: 0,
      manejaStock: false,
      stock: null,
      stockMinimum: 20,
      unit: "u",
      supplier: "Sin asignar",
      promotions: null,
      storePromotions: null,
      pricingMode: "manual",
      isProtected: true,
    })

    const result = await catalogQueryAdapter.findByCode("5")

    expect(result).not.toBeNull()
    expect(result!.pricingMode).toBe("manual")
    expect(result!.isProtected).toBe(true)
    expect(result!.manejaStock).toBe(false)
  })
})
