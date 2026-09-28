import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createApiProductRepository } from "../api-product-repository"
import type { UpdateProductInput } from "../../domain/product"

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
    maneja_stock?: boolean
    stock_actual?: number | null
    iva?: string | number | null
  }) {
    return {
      id: overrides?.id ?? "P001",
      detalle: overrides?.detalle ?? "Leche Entera 1L",
      codigos: overrides?.codigos ?? ["LAC-0001"],
      costo_final: "1.10",
      maneja_stock: overrides?.maneja_stock ?? true,
      stock_actual: overrides && "stock_actual" in overrides ? overrides.stock_actual : 12,
      categoria: "Lácteos",
      promotions: overrides?.promotions,
      store_promotions: overrides?.store_promotions,
      iva: overrides?.iva,
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
    expect(products[0].manejaStock).toBe(true)
    expect(products[0].stock).toBe(12)
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

  it("preserves null stock as non-stock instead of deriving numeric stock from maneja_stock", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify([createProductDto({ id: "P003", detalle: "Producto sin stock numérico", maneja_stock: false, stock_actual: null })]), { status: 200 })
    )

    const repository = createApiProductRepository()
    const page = await repository.list()

    expect(page.products[0].manejaStock).toBe(false)
    expect(page.products[0].stock).toBeNull()
  })

  it("preserves zero and negative stock from backend DTOs", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify([
        createProductDto({ id: "P004", detalle: "Sin unidades", stock_actual: 0 }),
        createProductDto({ id: "P005", detalle: "Stock negativo", stock_actual: -3 }),
      ]), { status: 200 })
    )

    const repository = createApiProductRepository()
    const page = await repository.list()

    expect(page.products[0].stock).toBe(0)
    expect(page.products[1].stock).toBe(-3)
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
      manejaStock: true,
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
      maneja_stock: true,
      etiqueta: "true",
    })
    const createBody = JSON.parse(options?.body as string)
    expect(createBody).not.toHaveProperty("stock")
    expect(createBody).not.toHaveProperty("stock_actual")
    expect(createBody).not.toHaveProperty("cantidad_inicial")
    expect(createBody).not.toHaveProperty("categoria")
  })

  it("updates a product sending the backend payload with required iva", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createProductDto({ id: "P001", detalle: "Actualizado", codigos: ["ACT-0001"], iva: "21.00" })), { status: 200 })
    )

    const repository = createApiProductRepository()
    const product = await repository.update({
      id: "P001",
      name: "Actualizado",
      sku: "ACT-0001",
      price: 3.5,
      manejaStock: false,
      iva: 21,
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
      iva: "21.00",
      facturable: true,
      maneja_stock: false,
      etiqueta: "true",
    })
  })

  it("enforces mandatory iva in UpdateProductInput as a compile-time contract", () => {
    // @ts-expect-error - omission of mandatory iva is a compile-time contract violation
    const invalidInput: UpdateProductInput = {
      id: "P001",
      name: "Actualizado",
      sku: "ACT-0001",
      price: 3.5,
      manejaStock: false,
    }
    expect(invalidInput.id).toBe("P001")
  })

  it("updates a product preserving the product existing 21% IVA rate in the backend payload", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createProductDto({ id: "P001", detalle: "Actualizado", codigos: ["ACT-0001"], iva: "21.00" })), { status: 200 })
    )

    const repository = createApiProductRepository()
    const product = await repository.update({
      id: "P001",
      name: "Actualizado",
      sku: "ACT-0001",
      price: 3.5,
      manejaStock: false,
      iva: 21,
    })

    expect(product.name).toBe("Actualizado")
    expect(product.iva).toBe(21)

    const fetchMock = getFetchMock()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products/P001")
    expect(options?.method).toBe("PUT")
    expect(JSON.parse(options?.body as string)).toMatchObject({
      detalle: "Actualizado",
      codigos: ["ACT-0001"],
      costo_final: "3.50",
      costo_neto: "2.10",
      iva: "21.00",
      facturable: true,
      maneja_stock: false,
      etiqueta: "true",
    })
  })

  it("updates a product preserving the product existing 10.5% IVA rate in the backend payload", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createProductDto({ id: "P002", detalle: "Producto 10.5", codigos: ["ACT-0002"], iva: "10.50" })), { status: 200 })
    )

    const repository = createApiProductRepository()
    const product = await repository.update({
      id: "P002",
      name: "Producto 10.5",
      sku: "ACT-0002",
      price: 5.0,
      manejaStock: true,
      iva: 10.5,
    })

    expect(product.name).toBe("Producto 10.5")
    expect(product.iva).toBe(10.5)

    const fetchMock = getFetchMock()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products/P002")
    expect(options?.method).toBe("PUT")
    expect(JSON.parse(options?.body as string)).toMatchObject({
      detalle: "Producto 10.5",
      codigos: ["ACT-0002"],
      costo_final: "5.00",
      costo_neto: "3.00",
      iva: "10.50",
      facturable: true,
      maneja_stock: true,
      etiqueta: "true",
    })
  })

  it("preserves stock contract when finding a product by code", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createProductDto({ id: "P777", stock_actual: -4, maneja_stock: true })), { status: 200 })
    )

    const repository = createApiProductRepository()
    const product = await repository.findByCode("LAC-0001")

    expect(product?.manejaStock).toBe(true)
    expect(product?.stock).toBe(-4)
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

  // -- T2: Barcode lookup edge cases --------------------------

  it("returns null on backend 400 (bad request) for findByCode", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid code" }), { status: 400 })
    )

    const repository = createApiProductRepository()
    const product = await repository.findByCode("!!!")

    expect(product).toBeNull()
  })

  it("finds a product by short barcode (e.g. 77909145) without length rejection", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "P-SHORT",
          detalle: "Producto Código Corto",
          codigos: ["77909145"],
          costo_final: "3.50",
          maneja_stock: true,
        }),
        { status: 200 }
      )
    )

    const repository = createApiProductRepository()
    const product = await repository.findByCode("77909145")

    expect(product).not.toBeNull()
    expect(product!.id).toBe("P-SHORT")
    expect(product!.sku).toBe("77909145")

    const [url] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products/code/77909145")
  })

  // -- T3: Stock-control toggle -----------------------------------

  it("updateStockControl sends only maneja_stock and no other fields", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createProductDto({ id: "P001", maneja_stock: false, stock_actual: null })), { status: 200 })
    )

    const repository = createApiProductRepository()
    await repository.updateStockControl({ id: "P001", manejaStock: false })

    const fetchMock = getFetchMock()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products/P001")
    expect(options?.method).toBe("PUT")

    const body = JSON.parse(options?.body as string)
    // MUST contain maneja_stock
    expect(body).toHaveProperty("maneja_stock", false)
    // MUST NOT contain stock_actual
    expect(body).not.toHaveProperty("stock_actual")
    // MUST NOT contain unrelated product fields
    expect(body).not.toHaveProperty("detalle")
    expect(body).not.toHaveProperty("codigos")
    expect(body).not.toHaveProperty("costo_final")
    expect(body).not.toHaveProperty("facturable")
    expect(body).not.toHaveProperty("etiqueta")
    expect(Object.keys(body)).toEqual(["maneja_stock"])
  })

  it("updateStockControl returns the mapped product with null stock when disabled", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createProductDto({ id: "P001", maneja_stock: false, stock_actual: null })), { status: 200 })
    )

    const repository = createApiProductRepository()
    const product = await repository.updateStockControl({ id: "P001", manejaStock: false })

    expect(product.id).toBe("P001")
    expect(product.manejaStock).toBe(false)
    expect(product.stock).toBeNull()
  })

  it("updateStockControl returns the mapped product with restored stock when re-enabled", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createProductDto({ id: "P001", maneja_stock: true, stock_actual: 42 })), { status: 200 })
    )

    const repository = createApiProductRepository()
    const product = await repository.updateStockControl({ id: "P001", manejaStock: true })

    expect(product.manejaStock).toBe(true)
    expect(product.stock).toBe(42)
  })

  it("updateStockControl throws on backend 400 so the UI can surface the error", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ message: "stock_actual not allowed" }), { status: 400 })
    )

    const repository = createApiProductRepository()
    await expect(
      repository.updateStockControl({ id: "P001", manejaStock: false })
    ).rejects.toThrow()
  })

  // ── VAT rate mapping ──────────────────────────────────────────

  it("maps numeric and string VAT rates from backend DTO to domain model", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify([
          createProductDto({ id: "P001", iva: "21.00" }),
          createProductDto({ id: "P002", iva: "10.50" }),
          createProductDto({ id: "P003", iva: 21 }),
          createProductDto({ id: "P004", iva: "0.00" }),
          createProductDto({ id: "P005", iva: "27.00" }),
          createProductDto({ id: "P006", iva: null }),
          createProductDto({ id: "P007", iva: "invalid" }),
        ]),
        { status: 200 }
      )
    )

    const repository = createApiProductRepository()
    const page = await repository.list()

    expect(page.products[0].iva).toBe(21)
    expect(page.products[1].iva).toBe(10.5)
    expect(page.products[2].iva).toBe(21)
    expect(page.products[3].iva).toBe(0)
    expect(page.products[4].iva).toBe(27)
    expect(page.products[5].iva).toBeNull()
    expect(page.products[6].iva).toBeNull()
  })

  it("rejects malformed VAT rate strings (0x15, exponent notation, partial strings, NaN, infinities)", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify([
          createProductDto({ id: "P-HEX", iva: "0x15" }),
          createProductDto({ id: "P-BIN", iva: "0b10101" }),
          createProductDto({ id: "P-OCT", iva: "0o25" }),
          createProductDto({ id: "P-EXP1", iva: "2.1e1" }),
          createProductDto({ id: "P-EXP2", iva: "1.05e1" }),
          createProductDto({ id: "P-SUFFIX", iva: "21.00foo" }),
          createProductDto({ id: "P-PREFIX", iva: "foo21" }),
          createProductDto({ id: "P-PERCENT", iva: "21%" }),
          createProductDto({ id: "P-EMPTY", iva: "  " }),
          createProductDto({ id: "P-NAN", iva: Number.NaN }),
          createProductDto({ id: "P-INF", iva: Number.POSITIVE_INFINITY }),
          createProductDto({ id: "P-NINF", iva: Number.NEGATIVE_INFINITY }),
          createProductDto({ id: "P-TRIM", iva: " 21.00 " }),
        ]),
        { status: 200 }
      )
    )

    const repository = createApiProductRepository()
    const page = await repository.list()

    expect(page.products[0].iva).toBeNull() // 0x15 must not become 21
    expect(page.products[1].iva).toBeNull()
    expect(page.products[2].iva).toBeNull()
    expect(page.products[3].iva).toBeNull() // 2.1e1 must not become 21
    expect(page.products[4].iva).toBeNull() // 1.05e1 must not become 10.5
    expect(page.products[5].iva).toBeNull()
    expect(page.products[6].iva).toBeNull()
    expect(page.products[7].iva).toBeNull()
    expect(page.products[8].iva).toBeNull()
    expect(page.products[9].iva).toBeNull()
    expect(page.products[10].iva).toBeNull()
    expect(page.products[11].iva).toBeNull()
    expect(page.products[12].iva).toBe(21) // trimmed ordinary decimal
  })
})
