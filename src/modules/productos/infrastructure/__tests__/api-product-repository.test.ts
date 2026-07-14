import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createApiProductRepository } from "../api-product-repository"

vi.mock("@/shared/infrastructure/auth-token-store", () => ({
  getAccessToken: vi.fn(() => "token123"),
  clearAccessToken: vi.fn(),
}))

describe("createApiProductRepository", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function getFetchMock() {
    return vi.mocked(fetch)
  }

  function createProductDto(overrides?: {
    id?: string
    detalle?: string
    codigos?: string[]
    promotions?: Array<{
      id: string
      name: string
      description: string | null
      scope?: string
      type?: string
      discount_percent?: number | null
      start_date?: string | null
      end_date?: string | null
      weekdays?: number[] | null
    }> | null
    store_promotions?: Array<{
      id: string
      name: string
      description: string | null
      scope?: string
      type?: string
      discount_percent?: number | null
      start_date?: string | null
      end_date?: string | null
      weekdays?: number[] | null
    }> | null
  }) {
    return {
      id: overrides?.id ?? "P001",
      detalle: overrides?.detalle ?? "Leche Entera 1L",
      codigos: overrides?.codigos ?? ["LAC-0001"],
      costo_final: "1.10",
      maneja_stock: true,
      categoria: "Lácteos",
      promotions: overrides?.promotions,
      store_promotions: overrides?.store_promotions,
    }
  }

  it("lists products mapping backend DTOs to domain models", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify([createProductDto(), createProductDto({ id: "P002", codigos: ["FRV-0001", "FRV-0002"] })]), { status: 200 })
    )

    const repository = createApiProductRepository()
    const page = await repository.list()
    const products = page.products

    expect(products).toHaveLength(2)
    expect(products[0].name).toBe("Leche Entera 1L")
    expect(products[0].sku).toBe("LAC-0001")
    expect(products[0].price).toBe(1.1)
    expect(products[0].stock).toBeNull()
    expect(products[0]).not.toHaveProperty("category")
    expect(products[1].sku).toBe("FRV-0001")
    expect(page.meta.total).toBe(2)
  })

  it("normalizes embedded promotion weekdays when listing products", async () => {
    const weekdayPromotions = [
      {
        id: "promo-sunday",
        name: "Sunday promo",
        description: null,
        scope: "product",
        type: "percentage",
        discount_percent: 10,
        start_date: null,
        end_date: null,
        weekdays: [7],
      },
      {
        id: "promo-monday",
        name: "Monday promo",
        description: null,
        scope: "product",
        type: "percentage",
        discount_percent: 12,
        start_date: null,
        end_date: null,
        weekdays: [1],
      },
      {
        id: "promo-saturday",
        name: "Saturday promo",
        description: null,
        scope: "product",
        type: "percentage",
        discount_percent: 15,
        start_date: null,
        end_date: null,
        weekdays: [6],
      },
      {
        id: "promo-null",
        name: "Any day promo",
        description: null,
        scope: "product",
        type: "percentage",
        discount_percent: 20,
        start_date: null,
        end_date: null,
        weekdays: null,
      },
    ]

    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify([
          createProductDto({
            promotions: weekdayPromotions,
            store_promotions: weekdayPromotions,
          }),
        ]),
        { status: 200 }
      )
    )

    const repository = createApiProductRepository()
    const page = await repository.list()

    const expectedPromotions = [
      {
        id: "promo-sunday",
        name: "Sunday promo",
        description: null,
        scope: "product",
        type: "percentage",
        discountPercent: 10,
        startDate: null,
        endDate: null,
        weekdays: [0],
      },
      {
        id: "promo-monday",
        name: "Monday promo",
        description: null,
        scope: "product",
        type: "percentage",
        discountPercent: 12,
        startDate: null,
        endDate: null,
        weekdays: [1],
      },
      {
        id: "promo-saturday",
        name: "Saturday promo",
        description: null,
        scope: "product",
        type: "percentage",
        discountPercent: 15,
        startDate: null,
        endDate: null,
        weekdays: [6],
      },
      {
        id: "promo-null",
        name: "Any day promo",
        description: null,
        scope: "product",
        type: "percentage",
        discountPercent: 20,
        startDate: null,
        endDate: null,
        weekdays: null,
      },
    ]

    expect(page.products[0].promotions).toEqual(expectedPromotions)
    expect(page.products[0].storePromotions).toEqual(expectedPromotions)
  })

  it("lists products with search against legacy array responses", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify([createProductDto()]), { status: 200 })
    )

    const repository = createApiProductRepository()
    const page = await repository.list({ search: "leche" })

    expect(page.products).toHaveLength(1)
    expect(page.meta.total).toBe(1)

    const [url] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products?search=leche")
  })

  it("lists products with documented pagination, sort, and search params", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [createProductDto()],
          meta: { page: 2, limit: 20, total: 45, totalPages: 3, hasNext: true },
        }),
        { status: 200 }
      )
    )

    const repository = createApiProductRepository()
    const page = await repository.list({ search: "leche", page: 2, limit: 20, sort: "detalle:asc" })

    expect(page.products).toHaveLength(1)
    expect(page.meta).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3, hasNext: true })

    const [url] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products?search=leche&page=2&limit=20&sort=detalle%3Aasc")
    expect(String(url)).not.toContain("category=")
  })

  it("uses the first code as SKU", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify([createProductDto({ codigos: ["ABC", "DEF"] })]), { status: 200 })
    )

    const repository = createApiProductRepository()
    const page = await repository.list()

    expect(page.products[0].sku).toBe("ABC")
  })

  it("does not derive numeric stock from maneja_stock", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify([createProductDto({ id: "P003", detalle: "Producto sin stock numérico" })]), { status: 200 })
    )

    const repository = createApiProductRepository()
    const page = await repository.list()

    expect(page.products[0].stock).toBeNull()
  })

  it("creates a product sending the backend payload", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createProductDto({ id: "P099", detalle: "Nuevo", codigos: ["NUE-0001"] })), { status: 201 })
    )

    const repository = createApiProductRepository()
    const product = await repository.create({
      name: "Nuevo",
      sku: "NUE-0001",
      price: 2.5,
      stock: 10,
      costo_neto: 1.5,
      iva: 0.5,
    })

    expect(product.name).toBe("Nuevo")
    expect(product.sku).toBe("NUE-0001")

    const fetchMock = getFetchMock()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products")
    expect(options?.method).toBe("POST")
    expect(JSON.parse(options?.body as string)).toMatchObject({
      detalle: "Nuevo",
      codigos: ["NUE-0001"],
      costo_final: "2.50",
      costo_neto: "1.50",
      iva: "0.50",
      facturable: true,
      maneja_stock: false,
      etiqueta: "true",
    })
    expect(JSON.parse(options?.body as string)).not.toHaveProperty("categoria")
  })

  it("updates a product sending the backend payload", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createProductDto({ id: "P001", detalle: "Actualizado", codigos: ["ACT-0001"] })), { status: 200 })
    )

    const repository = createApiProductRepository()
    const product = await repository.update({
      id: "P001",
      name: "Actualizado",
      sku: "ACT-0001",
      price: 3.5,
    })

    expect(product.name).toBe("Actualizado")
    expect(product.sku).toBe("ACT-0001")

    const fetchMock = getFetchMock()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products/P001")
    expect(options?.method).toBe("PUT")
    expect(JSON.parse(options?.body as string)).toMatchObject({
      detalle: "Actualizado",
      codigos: ["ACT-0001"],
      costo_final: "3.50",
      costo_neto: "2.10",
      iva: "0.00",
      facturable: true,
      maneja_stock: false,
      etiqueta: "true",
    })
  })

  it("finds a product by code via the dedicated /products/code/:code endpoint", async () => {
    // findByCode now calls GET /products/code/:code (dedicated endpoint)
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "uuid-abc",
          detalle: "Leche Entera 1L",
          codigos: ["LAC-0001", "BARCODE-999"],
          costo_final: "1.10",
          maneja_stock: false,
        }),
        { status: 200 }
      )
    )

    const repository = createApiProductRepository()
    const product = await repository.findByCode("BARCODE-999")

    expect(product).not.toBeNull()
    expect(product!.id).toBe("uuid-abc")
    expect(product!.sku).toBe("LAC-0001") // sku is still codigos[0]

    const [url] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products/code/BARCODE-999")
  })

  it("returns null on 404 from the dedicated endpoint", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ message: "Not found" }), { status: 404 })
    )

    const repository = createApiProductRepository()
    const product = await repository.findByCode("NONEXISTENT")

    expect(product).toBeNull()
  })

  it("returns null for an empty code string without making a network call", async () => {
    // Capture the current call count before the test
    const callCountBefore = getFetchMock().mock.calls.length

    const repository = createApiProductRepository()
    const product = await repository.findByCode("  ")

    expect(product).toBeNull()
    // Verify no new fetch call was made for empty input
    expect(getFetchMock().mock.calls.length).toBe(callCountBefore)
  })

  // ── Special product code metadata ────────────────────────────

  it("maps pricing_mode and is_protected from backend DTO to Product domain", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "SP001",
          detalle: "Gastos Varios",
          codigos: ["3"],
          costo_final: "0.00",
          maneja_stock: false,
          pricing_mode: "manual",
          is_protected: true,
        }),
        { status: 200 }
      )
    )

    const repository = createApiProductRepository()
    const product = await repository.findByCode("3")

    expect(product).not.toBeNull()
    expect(product!.pricingMode).toBe("manual")
    expect(product!.isProtected).toBe(true)
  })

  it("maps standard products without pricing_mode or is_protected as undefined", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify([createProductDto()]), { status: 200 })
    )

    const repository = createApiProductRepository()
    const page = await repository.list()
    const product = page.products[0]

    expect(product.pricingMode).toBeUndefined()
    expect(product.isProtected).toBeUndefined()
  })

  it("maps explicit pricing_mode: standard and is_protected: false correctly", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "P099",
          detalle: "Producto Normal",
          codigos: ["NORM-0001"],
          costo_final: "5.00",
          maneja_stock: true,
          pricing_mode: "standard",
          is_protected: false,
        }),
        { status: 200 }
      )
    )

    const repository = createApiProductRepository()
    const product = await repository.findByCode("NORM-0001")

    expect(product).not.toBeNull()
    expect(product!.pricingMode).toBe("standard")
    expect(product!.isProtected).toBe(false)
  })
})
