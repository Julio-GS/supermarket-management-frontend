import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.test.example.com/api/v1"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

async function getRepositoryFactory() {
  const mod = await import("../api-sales-repository")
  return mod.createApiSalesRepository
}

describe("createApiSalesRepository in desktop mode", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads sales history from the desktop bridge instead of HTTP", async () => {
    vi.stubGlobal("window", {
      marketDesktop: {
        getConfig: () => ({ apiBaseUrl: "https://api.test.example.com/api/v1" }),
        sales: {
          list: vi.fn().mockResolvedValue([
            {
              id: "sale-1",
              total: "100.00",
              customer: "Mostrador",
              invoiceStatus: "none",
              invoiceRequested: false,
              createdAt: "2026-01-01T10:00:00.000Z",
              paymentMethods: [{ method: "cash", amount: "100.00" }],
              items: [],
              updatedAt: "2026-01-01T10:00:00.000Z",
            },
          ]),
          get: vi.fn(),
        },
      },
    })

    const createApiSalesRepository = await getRepositoryFactory()
    const repo = createApiSalesRepository()
    const page = await repo.getSales({ page: 1, limit: 20 })

    expect(page.data).toHaveLength(1)
    expect(page.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("reads sale detail from the desktop bridge instead of HTTP", async () => {
    vi.stubGlobal("window", {
      marketDesktop: {
        getConfig: () => ({ apiBaseUrl: "https://api.test.example.com/api/v1" }),
        sales: {
          list: vi.fn(),
          get: vi.fn().mockResolvedValue({
            success: true,
            sale: {
              id: "sale-42",
              total: "100.00",
              customer: "Mostrador",
              invoiceStatus: "none",
              createdAt: "2026-01-01T10:00:00.000Z",
              updatedAt: "2026-01-01T10:00:00.000Z",
              paymentMethods: [{ method: "cash", amount: "100.00" }],
              items: [
                {
                  productId: "prod-1",
                  name: "Leche",
                  quantity: 1,
                  unitPrice: "100.00",
                  subtotal: "100.00",
                  discountAmount: "0.00",
                  appliedPromotions: [],
                  appliedPromotionId: null,
                  appliedPromotionType: null,
                },
              ],
              splitTicketGroups: null,
              cae: null,
              caeVto: null,
              cbteNro: null,
              cbteTipo: null,
              ptoVta: null,
              invoiceRequestedAt: null,
            },
          }),
        },
      },
    })

    const createApiSalesRepository = await getRepositoryFactory()
    const repo = createApiSalesRepository()
    const sale = await repo.getById("sale-42")

    expect(sale.id).toBe("sale-42")
    expect(sale.items[0]?.name).toBe("Leche")
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
