import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createApiStockRepository } from "../api-stock-repository"

vi.mock("@/shared/infrastructure/auth-token-store", () => ({
  getAccessToken: vi.fn(() => "token123"),
  clearAccessToken: vi.fn(),
}))

describe("createApiStockRepository", () => {
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

  // ── GET /stock/:product_id ────────────────────────────────────

  it("getStock returns numeric stock for a stock-managed product", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ stock_actual: 42 }), { status: 200 })
    )

    const repository = createApiStockRepository()
    const stock = await repository.getStock("P001")

    expect(stock).toBe(42)

    const [url] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/stock/P001")
  })

  it("getStock returns null for a non-stock product", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ stock_actual: null }), { status: 200 })
    )

    const repository = createApiStockRepository()
    const stock = await repository.getStock("P002")

    expect(stock).toBeNull()
  })

  it("getStock propagates 404 errors", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ message: "Product not found" }), { status: 404 })
    )

    const repository = createApiStockRepository()
    await expect(repository.getStock("NONEXISTENT")).rejects.toThrow("Product not found")
  })

  // ── POST /stock/adjust ────────────────────────────────────────

  it("adjust sends product_id, integer quantity and returns a mapped StockMovement", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "mov-001",
          product_id: "P001",
          quantity: 10,
          type: "adjustment",
          reference_id: null,
          previous_stock: 5,
          new_stock: 15,
          reason: null,
          created_at: "2025-06-01T12:00:00Z",
        }),
        { status: 200 }
      )
    )

    const repository = createApiStockRepository()
    const movement = await repository.adjust({
      productId: "P001",
      quantity: 10,
    })

    expect(movement).toEqual({
      id: "mov-001",
      productId: "P001",
      quantity: 10,
      type: "adjustment",
      referenceId: null,
      previousStock: 5,
      newStock: 15,
      reason: null,
      createdAt: "2025-06-01T12:00:00Z",
    })

    const [url, options] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/stock/adjust")
    expect(options?.method).toBe("POST")

    const body = JSON.parse(options?.body as string)
    expect(body).toEqual({
      product_id: "P001",
      quantity: 10,
    })
  })

  it("adjust includes optional reason in the payload", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "mov-002",
          product_id: "P002",
          quantity: -3,
          type: "adjustment",
          reference_id: null,
          previous_stock: 10,
          new_stock: 7,
          reason: "Corrección de inventario",
          created_at: "2025-06-01T13:00:00Z",
        }),
        { status: 200 }
      )
    )

    const repository = createApiStockRepository()
    const movement = await repository.adjust({
      productId: "P002",
      quantity: -3,
      reason: "Corrección de inventario",
    })

    expect(movement.reason).toBe("Corrección de inventario")

    const [, options] = getFetchMock().mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body).toEqual({
      product_id: "P002",
      quantity: -3,
      reason: "Corrección de inventario",
    })
  })

  it("adjust safely omits reason when it is an empty string", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "mov-003",
          product_id: "P003",
          quantity: 5,
          type: "adjustment",
          reference_id: null,
          previous_stock: 0,
          new_stock: 5,
          reason: null,
          created_at: "2025-06-01T14:00:00Z",
        }),
        { status: 200 }
      )
    )

    const repository = createApiStockRepository()
    await repository.adjust({
      productId: "P003",
      quantity: 5,
      reason: "",
    })

    const [, options] = getFetchMock().mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body).toEqual({
      product_id: "P003",
      quantity: 5,
    })
    expect(body).not.toHaveProperty("reason")
  })

  it("adjust propagates 400 errors (non-stock product)", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({ message: "El producto no maneja stock" }),
        { status: 400 }
      )
    )

    const repository = createApiStockRepository()
    await expect(
      repository.adjust({ productId: "P004", quantity: 1 })
    ).rejects.toThrow("El producto no maneja stock")
  })

  it("adjust propagates 404 errors (product not found)", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Producto no encontrado" }),
        { status: 404 }
      )
    )

    const repository = createApiStockRepository()
    await expect(
      repository.adjust({ productId: "NONEXISTENT", quantity: 1 })
    ).rejects.toThrow("Producto no encontrado")
  })

  it("adjust allows negative quantities producing negative newStock", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "mov-005",
          product_id: "P005",
          quantity: -5,
          type: "adjustment",
          reference_id: null,
          previous_stock: 2,
          new_stock: -3,
          reason: null,
          created_at: "2025-06-01T15:00:00Z",
        }),
        { status: 200 }
      )
    )

    const repository = createApiStockRepository()
    const movement = await repository.adjust({
      productId: "P005",
      quantity: -5,
    })

    expect(movement.newStock).toBe(-3)
    expect(movement.previousStock).toBe(2)
  })
})
