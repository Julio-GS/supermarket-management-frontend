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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total: "2.64",
      payment_methods: [{ method: "card", amount: "2.64" }],
      items: [{ product_id: "P001", quantity: 2, unit_price: "1.20", subtotal: "2.40", discount_amount: "0.00", applied_promotions: [], applied_promotion_id: null, applied_promotion_type: null }],
      split_ticket_groups: null,
      invoice_status: invoiceRequested ? "issued" : "none",
      cae: invoiceRequested ? "12345678901234" : null,
      cae_vto: invoiceRequested ? new Date().toISOString() : null,
      cbte_nro: invoiceRequested ? "00000001" : null,
      cbte_tipo: invoiceRequested ? "1" : null,
      pto_vta: invoiceRequested ? "1" : null,
      invoice_requested_at: invoiceRequested ? new Date().toISOString() : null,
    }
  }

  it("posts a sale with invoice_requested false for ticket no fiscal", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(false)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    const sale = await adapter.save({
      invoiceRequested: false,
      items: [{ productId: "P001", quantity: 2 }],
      paymentMethods: [{ method: "card", amount: "2.64" }],
    })

    expect(sale.total).toBe("2.64")

    const fetchMock = getFetchMock()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/sales")
    expect(options?.method).toBe("POST")
    expect(JSON.parse(options?.body as string)).toEqual({
      invoice_requested: false,
      items: [{ product_id: "P001", quantity: 2 }],
      payment_methods: [{ method: "card", amount: "2.64" }],
    })
  })

  it("posts a sale with invoice_requested true for facturar", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(true)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    await adapter.save({
      invoiceRequested: true,
      items: [{ productId: "P001", quantity: 1 }],
      paymentMethods: [{ method: "cash", amount: "1.00" }],
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
      items: [{ productId: "P001", quantity: 2 }],
      paymentMethods: [{ method: "card", amount: "2.64" }],
    })

    expect(sale.items[0]).toEqual({
      productId: "P001",
      name: "",
      quantity: 2,
      unitPrice: "1.20",
      subtotal: "2.40",
      discountAmount: "0.00",
      appliedPromotions: [],
      appliedPromotionId: null,
      appliedPromotionType: null,
    })
  })

  it("posts split_ticket_groups when provided", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({
        ...createBackendSaleResponse(false),
        split_ticket_groups: [
          {
            label: "A",
            items: [{ product_id: "P001", quantity: 1, unit_price: "1.20", subtotal: "1.20" }],
          },
          {
            label: "B",
            items: [{ product_id: "P001", quantity: 1, unit_price: "1.20", subtotal: "1.20" }],
          },
        ],
      }), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    await adapter.save({
      invoiceRequested: false,
      items: [{ productId: "P001", quantity: 2 }],
      paymentMethods: [{ method: "cash", amount: "1.20" }, { method: "card", amount: "1.20" }],
      splitTicketGroups: [
        { label: "A", items: [{ productId: "P001", quantity: 1 }] },
        { label: "B", items: [{ productId: "P001", quantity: 1 }] },
      ],
    })

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body.split_ticket_groups).toHaveLength(2)
    expect(body.split_ticket_groups[0].label).toBe("A")
  })
})
