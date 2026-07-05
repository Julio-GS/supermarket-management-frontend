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
    payment_methods: ["cash"],
    items: [{ product_id: "P001", quantity: 1, unit_price: total, subtotal: total }],
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
      expect(page.data[0].paymentMethods).toEqual(["cash"])
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
      expect(sale.paymentMethods).toEqual(["cash"])
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
        cae_vto: "2026-07-15T00:00:00.000Z",
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
      expect(sale.caeVto).toBe("2026-07-15T00:00:00.000Z")
      expect(sale.cbteNro).toBe("00000042")
      expect(sale.ptoVta).toBe("2")
      expect(sale.invoiceRequestedAt).toBe("2026-07-01T12:05:00.000Z")
    })
  })
})
