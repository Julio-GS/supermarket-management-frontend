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
      cae_vto: invoiceRequested ? '20260715' : null,
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
      saleTotal: "2.64",
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
      saleTotal: "1.00",
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
      saleTotal: "2.64",
    })

    expect(sale.items[0]).toEqual({
      productId: "P001",
      name: "",
      description: undefined,
      quantity: 2,
      unitPrice: "1.20",
      subtotal: "2.40",
      discountAmount: "0.00",
      appliedPromotions: [],
      appliedPromotionId: null,
      appliedPromotionType: null,
      iva: null,
      kind: undefined,
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
      saleTotal: "2.40",
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
      saleTotal: "24.20",
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
      saleTotal: "2.64",
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
      saleTotal: "19.70",
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
      saleTotal: "399.98",
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
      saleTotal: "101.20",
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
      saleTotal: "1000",
    })

    const fetchMock = getFetchMock()
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body.items[0].split_ticket).toEqual({
      group_1_quantity: 1,
      group_2_quantity: 1,
    })
  })

  // ARCA five-status invoice mapping
  describe("invoice status mapping (ARCA contract)", () => {
    function backendWithStatus(invoiceStatus: string) {
      return {
        ...createBackendSaleResponse(false),
        invoice_status: invoiceStatus,
      }
    }

    it.each(["none", "issuing", "issued", "failed", "ambiguous"] as const)(
      "preserves invoice_status '%s' from checkout response",
      async (status) => {
        getFetchMock().mockResolvedValue(
          new Response(JSON.stringify(backendWithStatus(status)), { status: 201 })
        )

        const adapter = createApiCheckoutAdapter()
        const sale = await adapter.save({
          invoiceRequested: false,
          items: [{ kind: "catalog-fixed", productId: "P001", quantity: 1 }],
          paymentMethods: [{ method: "cash", amount: "1.00" }],
          saleTotal: "1.00",
        })

        expect(sale.invoiceStatus).toBe(status)
      },
    )

    it("throws when checkout response contains an unknown invoice_status", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(backendWithStatus("some_future_value")), { status: 201 })
      )

      const adapter = createApiCheckoutAdapter()

      await expect(
        adapter.save({
          invoiceRequested: false,
          items: [{ kind: "catalog-fixed", productId: "P001", quantity: 1 }],
          paymentMethods: [{ method: "cash", amount: "1.00" }],
          saleTotal: "1.00",
        }),
      ).rejects.toThrow(/unknown.*invoice.*status/i)
    })
  })
})

// ── Split-ticket exclusivity ────────────────────────────────────

describe("api-checkout-adapter — split-ticket exclusivity", () => {
  it("strips per-item split_ticket when top-level split_ticket_groups are present (catalog-only)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "V-TEST", total: "9.00", items: [], payment_methods: [], invoice_status: "none", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), split_ticket_groups: null, cae: null, cae_vto: null, cbte_nro: null, cbte_tipo: null, pto_vta: null, invoice_requested_at: null }), { status: 200 })
    )

    const adapter = createApiCheckoutAdapter()
    const saveSpy = vi.spyOn(globalThis, "fetch" as any)

    await adapter.save({
      invoiceRequested: false,
      items: [
        {
          kind: "catalog-fixed",
          productId: "P001",
          quantity: 2,
          splitTicket: { group_1_quantity: 1, group_2_quantity: 1 },
        },
      ],
      paymentMethods: [{ method: "cash", amount: "9.00" }],
      splitTicketGroups: [
        { label: "A", items: [{ productId: "P001", quantity: 1 }] },
        { label: "B", items: [{ productId: "P001", quantity: 1 }] },
      ],
      saleTotal: "9.00",
    })

    const body = JSON.parse((saveSpy.mock.calls[0]![1]! as { body: string }).body as string)
    // Top-level groups present
    expect(body.split_ticket_groups).toBeDefined()
    expect(body.split_ticket_groups).toHaveLength(2)
    // Per-item split_ticket MUST be absent
    expect(body.items[0].split_ticket).toBeUndefined()
  })

  it("omits top-level split_ticket_groups when ad-hoc items are present (ad-hoc/mixed)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "V-TEST", total: "15.00", items: [], payment_methods: [], invoice_status: "none", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), split_ticket_groups: null, cae: null, cae_vto: null, cbte_nro: null, cbte_tipo: null, pto_vta: null, invoice_requested_at: null }), { status: 200 })
    )

    const adapter = createApiCheckoutAdapter()
    const saveSpy = vi.spyOn(globalThis, "fetch" as any)

    await adapter.save({
      invoiceRequested: false,
      items: [
        {
          kind: "ad-hoc",
          draftId: "d1",
          name: "Service",
          unitPrice: "10.00",
          quantity: 1,
          splitTicket: { group_1_quantity: 1, group_2_quantity: 0 },
        },
      ],
      paymentMethods: [{ method: "cash", amount: "15.00" }],
      splitTicketGroups: [
        { label: "A", items: [{ productId: "d1", quantity: 1 }] },
        { label: "B", items: [{ productId: "d1", quantity: 0 }] },
      ],
      saleTotal: "15.00",
    })

    const body = JSON.parse((saveSpy.mock.calls[0]![1]! as { body: string }).body as string)
    // Top-level groups MUST be absent
    expect(body.split_ticket_groups).toBeUndefined()
    // Per-item split_ticket MUST be present
    expect(body.items[0].split_ticket).toBeDefined()
    expect(body.items[0].split_ticket).toEqual({ group_1_quantity: 1, group_2_quantity: 0 })
  })

  it("omits both representations when split is not enabled", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "V-TEST", total: "5.00", items: [], payment_methods: [], invoice_status: "none", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), split_ticket_groups: null, cae: null, cae_vto: null, cbte_nro: null, cbte_tipo: null, pto_vta: null, invoice_requested_at: null }), { status: 200 })
    )

    const adapter = createApiCheckoutAdapter()
    const saveSpy = vi.spyOn(globalThis, "fetch" as any)

    await adapter.save({
      invoiceRequested: false,
      items: [{ kind: "catalog-fixed", productId: "P001", quantity: 1 }],
      paymentMethods: [{ method: "cash", amount: "5.00" }],
      saleTotal: "5.00",
    })

    const body = JSON.parse((saveSpy.mock.calls[0]![1]! as { body: string }).body as string)
    expect(body.split_ticket_groups).toBeUndefined()
    expect(body.items[0].split_ticket).toBeUndefined()
  })
})

describe("api-checkout-adapter — manual_discount request mapping", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "V-MD", total: "9.00", payment_methods: [], items: [], split_ticket_groups: null, invoice_status: "none",
      cae: null, cae_vto: null, cbte_nro: null, cbte_tipo: null, pto_vta: null, invoice_requested_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }), { status: 201 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  type MD = { modality: "fixed"; amount: string } | { modality: "percentage"; percentage: string; amount: string }
  const save = (manualDiscount?: MD) => createApiCheckoutAdapter().save({
    invoiceRequested: false,
    items: [{ kind: "catalog-fixed", productId: "P001", quantity: 1 }],
    paymentMethods: [{ method: "cash", amount: "9.00" }],
    saleTotal: "9.00",
    manualDiscount,
  })
  const body = () => JSON.parse((vi.mocked(fetch).mock.calls[0][1] as { body: string }).body)

  it("sends fixed manual_discount payload", async () => {
    await save({ modality: "fixed", amount: "1.00" })
    expect(body().manual_discount).toEqual({ modality: "fixed", amount: "1.00" })
  })
  it("sends percentage manual_discount payload", async () => {
    await save({ modality: "percentage", percentage: "10", amount: "1.00" })
    expect(body().manual_discount).toEqual({ modality: "percentage", percentage: "10", amount: "1.00" })
  })
  it("omits manual_discount when absent", async () => {
    await save(undefined)
    expect(body()).not.toHaveProperty("manual_discount")
  })
})

describe("api-checkout-adapter — response VAT rate mapping", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "V-VAT-RESP",
      total: "300.00",
      payment_methods: [{ method: "cash", amount: "300.00" }],
      items: [
        {
          product_id: "P001",
          quantity: 1,
          unit_price: "100.00",
          subtotal: "100.00",
          discount_amount: "0.00",
          applied_promotions: [],
          applied_promotion_id: null,
          applied_promotion_type: null,
          iva: "21.00",
          kind: "catalog",
        },
        {
          product_id: "P002",
          quantity: 1,
          unit_price: "100.00",
          subtotal: "100.00",
          discount_amount: "0.00",
          applied_promotions: [],
          applied_promotion_id: null,
          applied_promotion_type: null,
          iva: "10.50",
        },
        {
          product_id: "P003",
          quantity: 1,
          unit_price: "100.00",
          subtotal: "100.00",
          discount_amount: "0.00",
          applied_promotions: [],
          applied_promotion_id: null,
          applied_promotion_type: null,
          iva: 0,
        },
      ],
      split_ticket_groups: null,
      invoice_status: "issued",
      cae: "12345678901234",
      cae_vto: "20260715",
      cbte_nro: "00000001",
      cbte_tipo: "1",
      pto_vta: "1",
      invoice_requested_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }), { status: 201 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it("normalizes VAT rates (21, 10.5, 0) on returned sale items", async () => {
    const adapter = createApiCheckoutAdapter()
    const sale = await adapter.save({
      invoiceRequested: true,
      items: [
        { kind: "catalog-fixed", productId: "P001", quantity: 1 },
        { kind: "catalog-fixed", productId: "P002", quantity: 1 },
        { kind: "catalog-fixed", productId: "P003", quantity: 1 },
      ],
      paymentMethods: [{ method: "cash", amount: "300.00" }],
      saleTotal: "300.00",
    })

    expect(sale.items).toHaveLength(3)
    expect(sale.items[0].iva).toBe(21)
    expect(sale.items[1].iva).toBe(10.5)
    expect(sale.items[2].iva).toBe(0)
    expect(sale.items[0].kind).toBe("catalog")
  })

  it("normalizes malformed response VAT rates (0x15, exponent, NaN, partial string) to null", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "V-VAT-MALFORMED",
          total: "300.00",
          payment_methods: [{ method: "cash", amount: "300.00" }],
          items: [
            {
              product_id: "P-HEX",
              quantity: 1,
              unit_price: "100.00",
              subtotal: "100.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "0x15",
              kind: "catalog",
            },
            {
              product_id: "P-EXP",
              quantity: 1,
              unit_price: "100.00",
              subtotal: "100.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "2.1e1",
            },
            {
              product_id: "P-PARTIAL",
              quantity: 1,
              unit_price: "100.00",
              subtotal: "100.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "21.00foo",
            },
            {
              product_id: "P-ADHOC",
              name: "Servicio",
              quantity: 1,
              unit_price: "100.00",
              subtotal: "100.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "10.50",
              kind: "ad-hoc",
            },
          ],
          split_ticket_groups: null,
          invoice_status: "issued",
          cae: "12345678901234",
          cae_vto: "20260715",
          cbte_nro: "00000001",
          cbte_tipo: "1",
          pto_vta: "1",
          invoice_requested_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        { status: 201 }
      )
    )

    const adapter = createApiCheckoutAdapter()
    const sale = await adapter.save({
      invoiceRequested: true,
      items: [
        { kind: "catalog-fixed", productId: "P-HEX", quantity: 1 },
        { kind: "catalog-fixed", productId: "P-EXP", quantity: 1 },
        { kind: "catalog-fixed", productId: "P-PARTIAL", quantity: 1 },
        { kind: "ad-hoc", draftId: "d1", name: "Servicio", unitPrice: "100.00", quantity: 1 },
      ],
      paymentMethods: [{ method: "cash", amount: "300.00" }],
      saleTotal: "300.00",
    })

    expect(sale.items[0].iva).toBeNull() // 0x15 rejected
    expect(sale.items[1].iva).toBeNull() // 2.1e1 rejected
    expect(sale.items[2].iva).toBeNull() // 21.00foo rejected
    expect(sale.items[3].iva).toBe(10.5)
    expect(sale.items[0].kind).toBe("catalog")
    expect(sale.items[3].kind).toBe("ad-hoc")
  })
})

describe("api-checkout-adapter — explicit item kind provenance", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
  })
  afterEach(() => vi.unstubAllGlobals())

  it("never infers ad-hoc or catalog kind from draft position even when length matches", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "V-NO-INFERRED-KIND",
          total: "620.00",
          payment_methods: [{ method: "cash", amount: "620.00" }],
          items: [
            {
              product_id: "synth-uuid-1",
              name: "Flete Especial",
              quantity: 1,
              unit_price: "500.00",
              subtotal: "500.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "10.50",
            },
            {
              product_id: "P001",
              name: "Servicio de Limpieza Express",
              description: "Limpieza profunda de salón",
              quantity: 1,
              unit_price: "120.00",
              subtotal: "120.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "21.00",
            },
          ],
          split_ticket_groups: null,
          invoice_status: "issued",
          cae: "12345678901234",
          cae_vto: "20260715",
          cbte_nro: "00000001",
          cbte_tipo: "1",
          pto_vta: "1",
          invoice_requested_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        { status: 201 }
      )
    )

    const adapter = createApiCheckoutAdapter()
    // Draft order: [catalog, ad-hoc] (length = 2)
    // Response order: [synth/adhoc, catalog] (length = 2, but reordered and missing wire kind)
    const sale = await adapter.save({
      invoiceRequested: true,
      items: [
        { kind: "catalog-fixed", productId: "P001", quantity: 1 },
        { kind: "ad-hoc", draftId: "adhoc-1", name: "Flete Especial", unitPrice: "500.00", quantity: 1 },
      ],
      paymentMethods: [{ method: "cash", amount: "620.00" }],
      saleTotal: "620.00",
    })

    // Fail closed: no positional inference is performed, items without explicit wire kind remain undefined
    expect(sale.items[0].kind).toBeUndefined()
    expect(sale.items[1].kind).toBeUndefined()
  })

  it("preserves explicit wire kind on equal-length reordered responses without overwriting", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "V-REORDERED-EXPLICIT",
          total: "620.00",
          payment_methods: [{ method: "cash", amount: "620.00" }],
          items: [
            {
              product_id: "synth-uuid-1",
              name: "Flete Especial",
              quantity: 1,
              unit_price: "500.00",
              subtotal: "500.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "10.50",
              kind: "ad-hoc",
            },
            {
              product_id: "P001",
              name: "Producto A",
              quantity: 1,
              unit_price: "120.00",
              subtotal: "120.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "21.00",
              kind: "catalog",
            },
          ],
          split_ticket_groups: null,
          invoice_status: "issued",
          cae: "12345678901234",
          cae_vto: "20260715",
          cbte_nro: "00000001",
          cbte_tipo: "1",
          pto_vta: "1",
          invoice_requested_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        { status: 201 }
      )
    )

    const adapter = createApiCheckoutAdapter()
    // Draft order: [catalog, ad-hoc]
    // Response order: [ad-hoc, catalog] with explicit wire kind
    const sale = await adapter.save({
      invoiceRequested: true,
      items: [
        { kind: "catalog-fixed", productId: "P001", quantity: 1 },
        { kind: "ad-hoc", draftId: "adhoc-1", name: "Flete Especial", unitPrice: "500.00", quantity: 1 },
      ],
      paymentMethods: [{ method: "cash", amount: "620.00" }],
      saleTotal: "620.00",
    })

    // Preserves wire kind without letting draft position overwrite it
    expect(sale.items[0].kind).toBe("ad-hoc")
    expect(sale.items[1].kind).toBe("catalog")
  })

  it("fails closed on missing, empty, or invalid wire kind", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "V-INVALID-WIRE-KIND",
          total: "300.00",
          payment_methods: [{ method: "cash", amount: "300.00" }],
          items: [
            {
              product_id: "P001",
              name: "Producto A",
              quantity: 1,
              unit_price: "100.00",
              subtotal: "100.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "21.00",
              kind: "invalid-kind",
            },
            {
              product_id: "P002",
              name: "Producto B",
              quantity: 1,
              unit_price: "100.00",
              subtotal: "100.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "10.50",
              kind: "",
            },
            {
              product_id: "P003",
              name: "Producto C",
              quantity: 1,
              unit_price: "100.00",
              subtotal: "100.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "21.00",
              kind: null,
            },
          ],
          split_ticket_groups: null,
          invoice_status: "issued",
          cae: "12345678901234",
          cae_vto: "20260715",
          cbte_nro: "00000001",
          cbte_tipo: "1",
          pto_vta: "1",
          invoice_requested_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        { status: 201 }
      )
    )

    const adapter = createApiCheckoutAdapter()
    const sale = await adapter.save({
      invoiceRequested: true,
      items: [
        { kind: "catalog-fixed", productId: "P001", quantity: 1 },
        { kind: "catalog-fixed", productId: "P002", quantity: 1 },
        { kind: "catalog-fixed", productId: "P003", quantity: 1 },
      ],
      paymentMethods: [{ method: "cash", amount: "300.00" }],
      saleTotal: "300.00",
    })

    expect(sale.items[0].kind).toBeUndefined()
    expect(sale.items[1].kind).toBeUndefined()
    expect(sale.items[2].kind).toBeUndefined()
  })

  it("preserves explicit wire kind even when item counts differ between draft and response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "V-EXPLICIT-WIRE-DIFF-COUNT",
          total: "300.00",
          payment_methods: [{ method: "cash", amount: "300.00" }],
          items: [
            {
              product_id: "P001",
              name: "Producto A",
              quantity: 1,
              unit_price: "100.00",
              subtotal: "100.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "21.00",
              kind: "catalog",
            },
            {
              product_id: "P002",
              name: "AdHoc B",
              quantity: 2,
              unit_price: "100.00",
              subtotal: "200.00",
              discount_amount: "0.00",
              applied_promotions: [],
              applied_promotion_id: null,
              applied_promotion_type: null,
              iva: "10.50",
              kind: "ad-hoc",
            },
          ],
          split_ticket_groups: null,
          invoice_status: "issued",
          cae: "12345678901234",
          cae_vto: "20260715",
          cbte_nro: "00000001",
          cbte_tipo: "1",
          pto_vta: "1",
          invoice_requested_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        { status: 201 }
      )
    )

    const adapter = createApiCheckoutAdapter()
    // Submitted 1 draft item, backend returned 2 items with explicit wire kind
    const sale = await adapter.save({
      invoiceRequested: true,
      items: [{ kind: "catalog-fixed", productId: "P001", quantity: 1 }],
      paymentMethods: [{ method: "cash", amount: "300.00" }],
      saleTotal: "300.00",
    })

    expect(sale.items[0].kind).toBe("catalog")
    expect(sale.items[1].kind).toBe("ad-hoc")
  })
})