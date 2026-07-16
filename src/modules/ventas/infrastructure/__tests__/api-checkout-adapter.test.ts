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
      items: [{ kind: "catalog-fixed", productId: "P001", quantity: 2 }],
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
      items: [{ kind: "catalog-fixed", productId: "P001", quantity: 1 }],
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
      items: [{ kind: "catalog-fixed", productId: "P001", quantity: 2 }],
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
      items: [{ kind: "catalog-fixed", productId: "P001", quantity: 2 }],
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

  // ── Special product line_total serialization ─────────────────

  it("includes line_total on items that have it (special products)", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(false)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    await adapter.save({
      invoiceRequested: false,
      items: [
        { kind: "catalog-manual", productId: "SP001", quantity: 1 as const, lineTotal: "20.00" },
        { kind: "catalog-fixed", productId: "P002", quantity: 2 },
      ],
      paymentMethods: [{ method: "cash", amount: "24.20" }],
    })

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body.items).toHaveLength(2)
    expect(body.items[0]).toEqual({ product_id: "SP001", quantity: 1, line_total: "20.00" })
    expect(body.items[1]).toEqual({ product_id: "P002", quantity: 2 })
  })

  it("does not include line_total on items that lack it (normal products)", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(false)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    await adapter.save({
      invoiceRequested: false,
      items: [{ kind: "catalog-fixed", productId: "P001", quantity: 2 }],
      paymentMethods: [{ method: "card", amount: "2.64" }],
    })

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body.items[0]).not.toHaveProperty("line_total")
    expect(body.items[0]).toEqual({ product_id: "P001", quantity: 2 })
  })

  it("preserves both line_total and invoice_requested: true in same payload", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(true)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    await adapter.save({
      invoiceRequested: true,
      items: [
        { kind: "catalog-manual", productId: "SP001", quantity: 1 as const, lineTotal: "15.50" },
        { kind: "catalog-fixed", productId: "P002", quantity: 2 },
      ],
      paymentMethods: [{ method: "cash", amount: "19.70" }],
    })

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body.invoice_requested).toBe(true)
    expect(body.items[0]).toEqual({ product_id: "SP001", quantity: 1, line_total: "15.50" })
    expect(body.items[1]).toEqual({ product_id: "P002", quantity: 2 })
  })

  // ── Ad-hoc item serialization ────────────────────────────────

  it("serializes ad-hoc items without product_id, iva, or line_total", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(false)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    await adapter.save({
      invoiceRequested: false,
      items: [{
        kind: "ad-hoc",
        draftId: "d1",
        name: "Counter Service",
        description: "Manual entry",
        unitPrice: "199.99",
        quantity: 2,
      }],
      paymentMethods: [{ method: "cash", amount: "399.98" }],
    })

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body.items[0]).toEqual({
      name: "Counter Service",
      description: "Manual entry",
      unit_price: "199.99",
      quantity: 2,
    })
    expect(body.items[0]).not.toHaveProperty("product_id")
    expect(body.items[0]).not.toHaveProperty("line_total")
  })

  it("omits top-level split_ticket_groups when ad-hoc items present", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(false)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    await adapter.save({
      invoiceRequested: false,
      items: [
        { kind: "catalog-fixed", productId: "P001", quantity: 1 },
        { kind: "ad-hoc", draftId: "d1", name: "Service", unitPrice: "100", quantity: 1 },
      ],
      paymentMethods: [{ method: "cash", amount: "101.20" }],
      splitTicketGroups: [
        { label: "A", items: [{ productId: "P001", quantity: 1 }] },
        { label: "B", items: [{ productId: "d1", quantity: 1 }] },
      ],
    })

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body).not.toHaveProperty("split_ticket_groups")
  })

  it("sends per-item split_ticket for ad-hoc items", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createBackendSaleResponse(false)), { status: 201 })
    )

    const adapter = createApiCheckoutAdapter()
    await adapter.save({
      invoiceRequested: false,
      items: [{
        kind: "ad-hoc",
        draftId: "d1",
        name: "Service",
        unitPrice: "500",
        quantity: 2,
        splitTicket: { group_1_quantity: 1, group_2_quantity: 1 },
      }],
      paymentMethods: [{ method: "cash", amount: "1000" }],
    })

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body.items[0].split_ticket).toEqual({
      group_1_quantity: 1,
      group_2_quantity: 1,
    })
  })
})
