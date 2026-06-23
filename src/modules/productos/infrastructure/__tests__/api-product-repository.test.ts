import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createApiProductRepository } from "../api-product-repository"

describe("createApiProductRepository", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
    localStorage.setItem("sg-access-token", "token123")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    )
  })

  afterEach(() => {
    localStorage.clear()
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
    const products = await repository.list()

    expect(products).toHaveLength(2)
    expect(products[0].name).toBe("Leche Entera 1L")
    expect(products[0].sku).toBe("LAC-0001")
    expect(products[0].price).toBe(1.1)
    expect(products[0].stock).toBeNull()
    expect(products[1].sku).toBe("FRV-0001")
  })

  it("uses the first code as SKU", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify([createProductDto({ codigos: ["ABC", "DEF"] })]), { status: 200 })
    )

    const repository = createApiProductRepository()
    const products = await repository.list()

    expect(products[0].sku).toBe("ABC")
  })

  it("does not derive numeric stock from maneja_stock", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify([createProductDto({ id: "P003", detalle: "Producto sin stock numérico" })]), { status: 200 })
    )

    const repository = createApiProductRepository()
    const products = await repository.list()

    expect(products[0].stock).toBeNull()
  })

  it("creates a product sending the backend payload", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createProductDto({ id: "P099", detalle: "Nuevo", codigos: ["NUE-0001"] })), { status: 201 })
    )

    const repository = createApiProductRepository()
    const product = await repository.create({
      name: "Nuevo",
      category: "Bebidas",
      sku: "NUE-0001",
      price: 2.5,
      stock: 10,
    })

    expect(product.name).toBe("Nuevo")
    expect(product.sku).toBe("NUE-0001")

    const fetchMock = getFetchMock()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products")
    expect(options?.method).toBe("POST")
    expect(JSON.parse(options?.body as string)).toEqual({
      detalle: "Nuevo",
      codigos: ["NUE-0001"],
      costo_final: "2.50",
      categoria: "Bebidas",
    })
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
    expect(JSON.parse(options?.body as string)).toEqual({
      detalle: "Actualizado",
      codigos: ["ACT-0001"],
      costo_final: "3.50",
    })
  })
})
