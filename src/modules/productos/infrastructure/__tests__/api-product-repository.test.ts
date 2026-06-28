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

  function createProductDto(overrides?: { id?: string; detalle?: string; codigos?: string[] }) {
    return {
      id: overrides?.id ?? "P001",
      detalle: overrides?.detalle ?? "Leche Entera 1L",
      codigos: overrides?.codigos ?? ["LAC-0001"],
      costo_final: "1.10",
      maneja_stock: true,
      categoria: "Lácteos",
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
})
