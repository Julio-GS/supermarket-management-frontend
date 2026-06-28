import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createApiCheckoutAdapter } from "../api-checkout-adapter"

vi.mock("@/shared/infrastructure/auth-token-store", () => ({
  getAccessToken: vi.fn(() => "token123"),
  clearAccessToken: vi.fn(),
}))

describe("createApiCheckoutAdapter", () => {
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

  function createBackendSaleResponse(invoiceRequested: boolean) {
    return {
      id: "V-00001",
      date: new Date().toISOString(),
      customer: "Mostrador",
      items: [{ product_id: "P001", name: "Manzana", quantity: 2, price: 1.2 }],
      subtotal: 2.4,
      vat: 0.24,
      total: 2.64,
      payment_method: "Tarjeta",
      cashier: "Ana López",
      invoice_requested: invoiceRequested,
    }
  }

  it("posts a sale with invoice_requested false for ticket no fiscal", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(false)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    const sale = await adapter.save({
      invoiceRequested: false,
      customer: "Mostrador",
      items: [{ productId: "P001", name: "Manzana", quantity: 2, price: 1.2 }],
      subtotal: 2.4,
      vat: 0.24,
      total: 2.64,
      paymentMethod: "Tarjeta",
      cashier: "Ana López",
    })

    expect(sale.total).toBe(2.64)

    const fetchMock = getFetchMock()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/sales")
    expect(options?.method).toBe("POST")
    expect(JSON.parse(options?.body as string)).toEqual({
      invoice_requested: false,
      items: [{ product_id: "P001", quantity: 2 }],
    })
  })

  it("posts a sale with invoice_requested true for facturar", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(true)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    await adapter.save({
      invoiceRequested: true,
      customer: "Mostrador",
      items: [{ productId: "P001", name: "Manzana", quantity: 1, price: 1.2 }],
      subtotal: 1.2,
      vat: 0.12,
      total: 1.32,
      paymentMethod: "Efectivo",
      cashier: "Ana López",
    })

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    expect(JSON.parse(options?.body as string).invoice_requested).toBe(true)
  })

  it("maps backend response items to domain sale items", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(false)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    const sale = await adapter.save({
      invoiceRequested: false,
      customer: "Mostrador",
      items: [{ productId: "P001", name: "Manzana", quantity: 2, price: 1.2 }],
      subtotal: 2.4,
      vat: 0.24,
      total: 2.64,
      paymentMethod: "Tarjeta",
      cashier: "Ana López",
    })

    expect(sale.items[0]).toEqual({
      productId: "P001",
      name: "Manzana",
      quantity: 2,
      price: 1.2,
    })
  })
})
