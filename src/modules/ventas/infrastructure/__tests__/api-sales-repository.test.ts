import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createApiSalesRepository } from "../api-sales-repository"

vi.mock("@/shared/infrastructure/auth-token-store", () => ({
  getAccessToken: vi.fn(() => "token123"),
  clearAccessToken: vi.fn(),
}))

function getFetchMock() {
  return vi.mocked(fetch)
}

function makeBackendSale(id: string, total: string, invoiceStatus = "none") {
  return {
    id,
    total,
    payment_methods: [{ method: "cash", amount: "0.00" }],
    items: [{ product_id: "P001", quantity: 1, unit_price: total, subtotal: total, discount_amount: "10.00", applied_promotion_id: "promo-1", applied_promotion_type: "percentage" }],
    split_ticket_groups: null,
    invoice_status: invoiceStatus,
    cae: null,
    cae_vto: null,
    cbte_nro: null,
    cbte_tipo: null,
    pto_vta: null,
    invoice_requested_at: null,
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
  }
}

describe("createApiSalesRepository", () => {
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

  describe("getSales (sales history)", () => {
    it("normalizes legacy array response into SalesPage", async () => {
      const backendArray = [makeBackendSale("V-1", "100.00"), makeBackendSale("V-2", "200.50")]

      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(backendArray), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const page = await repo.getSales()

      expect(page.data).toHaveLength(2)
      expect(page.data[0].id).toBe("V-1")
      expect(page.data[0].total).toBe("100.00")
      expect(page.data[0].paymentMethods).toEqual([{ method: "cash", amount: "0.00" }])
      expect(page.meta).toBeUndefined()
    })

    it("normalizes paginated response into SalesPage with meta", async () => {
      const backendPage = {
        data: [makeBackendSale("V-10", "50.00")],
        meta: {
          page: 1,
          limit: 20,
          total: 42,
          totalPages: 3,
          hasNext: true,
        },
      }

      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(backendPage), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const page = await repo.getSales({ page: 1, limit: 20 })

      expect(page.data).toHaveLength(1)
      expect(page.data[0].id).toBe("V-10")
      expect(page.meta).toEqual({
        page: 1,
        limit: 20,
        total: 42,
        totalPages: 3,
        hasNext: true,
      })
    })

    it("returns empty data for unknown response shape", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify({ weird: true }), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const page = await repo.getSales()

      expect(page.data).toEqual([])
      expect(page.meta).toBeUndefined()
    })

    it("forwards query params to the API", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify([makeBackendSale("V-5", "99.99")]), { status: 200 })
      )

      const repo = createApiSalesRepository()
      await repo.getSales({ page: 2, limit: 10, sort: "desc" })

      const fetchMock = getFetchMock()
      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain("page=2")
      expect(url).toContain("limit=10")
      expect(url).toContain("sort=desc")
    })

    it("maps invoice_status correctly", async () => {
      const sale = makeBackendSale("V-I", "75.00", "issued")
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify([sale]), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const page = await repo.getSales()

      expect(page.data[0].invoiceStatus).toBe("issued")
    })
  })

  describe("getById (sale detail)", () => {
    it("fetches and normalizes a single sale", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(makeBackendSale("V-42", "333.33")), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const sale = await repo.getById("V-42")

      expect(sale.id).toBe("V-42")
      expect(sale.total).toBe("333.33")
      expect(sale.items).toHaveLength(1)
      expect(sale.items[0].unitPrice).toBe("333.33")
      expect(sale.items[0].discountAmount).toBe("10.00")
      expect(sale.items[0].appliedPromotionType).toBe("percentage")
      expect(sale.paymentMethods).toEqual([{ method: "cash", amount: "0.00" }])
      expect(sale.invoiceStatus).toBe("none")
    })

    it("normalizes split_ticket_groups when present", async () => {
      const backendSale = {
        ...makeBackendSale("V-SPLIT", "100.00"),
        split_ticket_groups: [
          {
            label: "A",
            items: [{ product_id: "P001", quantity: 1, unit_price: "50.00", subtotal: "50.00" }],
          },
          {
            label: "B",
            items: [{ product_id: "P002", quantity: 1, unit_price: "50.00", subtotal: "50.00" }],
          },
        ],
      }

      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(backendSale), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const sale = await repo.getById("V-SPLIT")

      expect(sale.splitTicketGroups).toHaveLength(2)
      expect(sale.splitTicketGroups![0].label).toBe("A")
      expect(sale.splitTicketGroups![0].items[0].productId).toBe("P001")
    })

    it("maps invoice_status 'failed' correctly", async () => {
      const backendSale = makeBackendSale("V-FAIL", "55.00", "failed")
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(backendSale), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const sale = await repo.getById("V-FAIL")

      expect(sale.invoiceStatus).toBe("failed")
    })

    it("maps ARCA fiscal fields when present", async () => {
      const backendSale = {
        ...makeBackendSale("V-ARCA", "88.00", "issued"),
        cae: "12345678901234",
        cae_vto: "20260715",
        cbte_nro: "00000042",
        cbte_tipo: "1",
        pto_vta: "2",
        invoice_requested_at: "2026-07-01T12:05:00.000Z",
      }

      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(backendSale), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const sale = await repo.getById("V-ARCA")

      expect(sale.cae).toBe("12345678901234")
      expect(sale.caeVto).toBe("20260715")
      expect(sale.cbteNro).toBe("00000042")
      expect(sale.ptoVta).toBe("2")
      expect(sale.invoiceRequestedAt).toBe("2026-07-01T12:05:00.000Z")
    })

    it("normalizes ad-hoc name and description from backend response", async () => {
      const backendSale = {
        ...makeBackendSale("V-ADHOC", "500.00"),
        items: [{
          product_id: "ad-hoc-synthetic-uuid",
          name: "Servicio técnico",
          description: "Reparación de balanza",
          quantity: 1,
          unit_price: "500.00",
          subtotal: "500.00",
          discount_amount: "0.00",
          applied_promotions: [],
          applied_promotion_id: null,
          applied_promotion_type: null,
        }],
      }

      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(backendSale), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const sale = await repo.getById("V-ADHOC")

      expect(sale.items).toHaveLength(1)
      expect(sale.items[0].name).toBe("Servicio técnico")
      expect(sale.items[0].description).toBe("Reparación de balanza")
      expect(sale.items[0].productId).toBe("ad-hoc-synthetic-uuid")
    })

    it("defaults ad-hoc description to undefined when absent from response", async () => {
      const backendSale = {
        ...makeBackendSale("V-ADHOC2", "199.00"),
        items: [{
          product_id: "ad-hoc-synthetic-uuid-2",
          name: "Counter Service",
          quantity: 1,
          unit_price: "199.00",
          subtotal: "199.00",
          discount_amount: "0.00",
          applied_promotions: [],
          applied_promotion_id: null,
          applied_promotion_type: null,
        }],
      }

      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(backendSale), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const sale = await repo.getById("V-ADHOC2")

      expect(sale.items[0].name).toBe("Counter Service")
      expect(sale.items[0].description).toBeUndefined()
    })
  // ARCA five-status invoice mapping
  describe("invoice status mapping (ARCA contract)", () => {
    it.each(["none", "issuing", "issued", "failed", "ambiguous"] as const)(
      "preserves invoice_status '%s' from getById response",
      async (status) => {
        getFetchMock().mockResolvedValue(
          new Response(JSON.stringify(makeBackendSale("V-ARCA", "99.99", status)), { status: 200 })
        )

        const repo = createApiSalesRepository()
        const sale = await repo.getById("V-ARCA")

        expect(sale.invoiceStatus).toBe(status)
      },
    )

    it("throws when getById response contains an unknown invoice_status", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(makeBackendSale("V-BAD", "1.00", "some_future_value")), { status: 200 })
      )

      const repo = createApiSalesRepository()

      await expect(repo.getById("V-BAD")).rejects.toThrow(
        /unknown.*invoice.*status/i,
      )
    })

    it("preserves all five statuses in getSales list response", async () => {
      const backendArray = [
        makeBackendSale("V-NO", "1.00", "none"),
        makeBackendSale("V-ISS", "2.00", "issuing"),
        makeBackendSale("V-OK", "3.00", "issued"),
        makeBackendSale("V-FL", "4.00", "failed"),
        makeBackendSale("V-AMB", "5.00", "ambiguous"),
      ]

      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(backendArray), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const page = await repo.getSales()

      expect(page.data).toHaveLength(5)
      expect(page.data.map((s) => s.invoiceStatus)).toEqual([
        "none",
        "issuing",
        "issued",
        "failed",
        "ambiguous",
      ])
    })

    it("throws when getSales response contains an unknown invoice_status", async () => {
      const backendArray = [
        makeBackendSale("V-OK", "1.00", "issued"),
        makeBackendSale("V-BAD", "2.00", "future_status"),
      ]

      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(backendArray), { status: 200 })
      )

      const repo = createApiSalesRepository()

      await expect(repo.getSales()).rejects.toThrow(
        /unknown.*invoice.*status/i,
      )
    })
  })

  // Retry execution
  describe("retryFiscalInvoice", () => {
    it("calls the retry endpoint and returns the updated sale", async () => {
      const returned = makeBackendSale("V-RTY", "150.00", "issued")
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(returned), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const sale = await repo.retryFiscalInvoice("V-RTY")

      expect(sale.id).toBe("V-RTY")
      expect(sale.invoiceStatus).toBe("issued")

      const fetchMock = getFetchMock()
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe("https://api.example.com/api/v1/sales/V-RTY/fiscal-invoice/retry")
      expect(options?.method).toBe("POST")
    })

    it("returns updated status when backend returns failed", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(makeBackendSale("V-RTY", "150.00", "failed")), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const sale = await repo.retryFiscalInvoice("V-RTY")

      expect(sale.invoiceStatus).toBe("failed")
    })

    it("returns issuing status when backend returns issuing", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(makeBackendSale("V-RTY", "150.00", "issuing")), { status: 200 })
      )

      const repo = createApiSalesRepository()
      const sale = await repo.retryFiscalInvoice("V-RTY")

      expect(sale.invoiceStatus).toBe("issuing")
    })

    it("throws when retry response contains an unknown invoice_status", async () => {
      getFetchMock().mockResolvedValue(
        new Response(JSON.stringify(makeBackendSale("V-BAD", "1.00", "unexpected")), { status: 200 })
      )

      const repo = createApiSalesRepository()

      await expect(repo.retryFiscalInvoice("V-BAD")).rejects.toThrow(
        /unknown.*invoice.*status/i,
      )
    })
  })

  })
})

  describe("manual discount mapping (null vs confirmed zero)", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })))
    })
    afterEach(() => vi.unstubAllGlobals())

    it("maps null, confirmed zero, and real fixed manual discount", async () => {
      const repo = createApiSalesRepository()
      const fetchSale = async (md: Record<string, unknown>) => {
        getFetchMock().mockResolvedValue(new Response(JSON.stringify({ ...makeBackendSale("V-MD", "90.00"), ...md }), { status: 200 }))
        return repo.getById("V-MD")
      }

      const nullSale = await fetchSale({ manual_discount_amount: null, manual_discount_modality: null, manual_discount_percentage: null })
      expect(nullSale.manualDiscountAmount).toBeNull()
      expect(nullSale.manualDiscountModality).toBeNull()

      const zeroSale = await fetchSale({ manual_discount_amount: "0.00", manual_discount_modality: null, manual_discount_percentage: null })
      expect(zeroSale.manualDiscountAmount).toBe("0.00")

      const realSale = await fetchSale({ manual_discount_amount: "5.00", manual_discount_modality: "fixed", manual_discount_percentage: null })
      expect(realSale.manualDiscountAmount).toBe("5.00")
      expect(realSale.manualDiscountModality).toBe("fixed")
    })
  })