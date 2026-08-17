import { describe, expect, it, vi, beforeEach } from "vitest"
import { productRepository } from "@/modules/productos"
import { catalogQueryAdapter } from "../catalog-query-adapter"
import type { Product, ProductPage, ProductPromotionSummary } from "@/modules/productos"

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

  // ── ACL promotion mapping ───────────────────────────────────

  it("maps promotion summaries through the outbound ACL into CartProductPromotion DTOs", async () => {
    const fullPromotion: ProductPromotionSummary = {
      id: "promo-1",
      name: "2x1 Verano",
      description: "Llevá 2 pagá 1",
      scope: "product",
      type: "two_x_one",
      discountPercent: null,
      startDate: "2026-01-01",
      endDate: "2026-02-28",
      weekdays: [1, 2, 3],
    }
    const storePromo: ProductPromotionSummary = {
      id: "promo-store",
      name: "10% Off",
      description: "Descuento general",
      scope: "store",
      type: "percentage",
      discountPercent: 10,
      startDate: null,
      endDate: null,
      weekdays: null,
    }

    findByCodeSpy.mockResolvedValue({
      id: "P050",
      name: "Galletitas",
      sku: "GAL-0050",
      price: 10,
      cost: 6,
      manejaStock: true,
      stock: 15,
      stockMinimum: 5,
      unit: "u",
      supplier: "Sin asignar",
      promotions: [fullPromotion],
      storePromotions: [storePromo],
    })

    const result = await catalogQueryAdapter.findByCode("GAL-0050")

    expect(result).not.toBeNull()
    expect(result!.promotions).toEqual([
      {
        id: "promo-1",
        name: "2x1 Verano",
        description: "Llevá 2 pagá 1",
        scope: "product",
        type: "two_x_one",
        discountPercent: null,
        startDate: "2026-01-01",
        endDate: "2026-02-28",
        weekdays: [1, 2, 3],
      },
    ])
    expect(result!.storePromotions).toEqual([
      {
        id: "promo-store",
        name: "10% Off",
        description: "Descuento general",
        scope: "store",
        type: "percentage",
        discountPercent: 10,
        startDate: null,
        endDate: null,
        weekdays: null,
      },
    ])
  })

  it("preserves empty array promotions without synthesizing default promotions", async () => {
    findByCodeSpy.mockResolvedValue({
      id: "P051",
      name: "Arroz",
      sku: "ARR-0051",
      price: 5,
      cost: 3,
      manejaStock: true,
      stock: 10,
      stockMinimum: 5,
      unit: "u",
      supplier: "Sin asignar",
      promotions: [],
      storePromotions: [],
    })

    const result = await catalogQueryAdapter.findByCode("ARR-0051")

    expect(result).not.toBeNull()
    expect(result!.promotions).toEqual([])
    expect(result!.storePromotions).toEqual([])
  })

  it("maps promotions in search results preserving all 9 fields and null collections", async () => {
    const promo: ProductPromotionSummary = {
      id: "promo-search-1",
      name: "Descuento 15%",
      description: null,
      scope: "product",
      type: "percentage",
      discountPercent: 15,
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      weekdays: [5, 6],
    }

    listSpy.mockResolvedValue(
      toPage([
        {
          id: "P052",
          name: "Aceite",
          sku: "ACE-0052",
          price: 8,
          cost: 5,
          manejaStock: true,
          stock: 20,
          stockMinimum: 5,
          unit: "u",
          supplier: "Sin asignar",
          promotions: [promo],
          storePromotions: null,
        },
      ])
    )

    const result = await catalogQueryAdapter.search({ search: "Aceite" })

    expect(result).toHaveLength(1)
    expect(result[0].promotions).toEqual([
      {
        id: "promo-search-1",
        name: "Descuento 15%",
        description: null,
        scope: "product",
        type: "percentage",
        discountPercent: 15,
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        weekdays: [5, 6],
      },
    ])
    expect(result[0].storePromotions).toBeNull()
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
