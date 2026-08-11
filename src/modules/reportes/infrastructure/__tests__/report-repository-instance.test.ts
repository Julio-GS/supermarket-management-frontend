import { beforeEach, describe, expect, it, vi } from "vitest"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

async function loadAdapterModule() {
  vi.resetModules()
  return import("../desktop-report-adapter")
}

describe("createDesktopReportAdapter", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("builds the business report from the desktop sales bridge instead of HTTP", async () => {
    const now = new Date()
    const today = new Date(now)
    today.setHours(10, 0, 0, 0)

    const marketDesktop = {
      getConfig: () => ({ apiBaseUrl: "http://desktop.test/api/v1" }),
      sales: {
        list: vi.fn().mockResolvedValue([
          {
            id: "sale-1",
            total: "150.00",
            customer: "Mostrador",
            invoiceStatus: "none",
            invoiceRequested: false,
            createdAt: today.toISOString(),
            updatedAt: today.toISOString(),
            paymentMethods: [
              { method: "cash", amount: "100.00" },
              { method: "card", amount: "50.00" },
            ],
            items: [
              {
                productId: "prod-1",
                name: "Yerba",
                quantity: 2,
                unitPrice: "50.00",
                subtotal: "100.00",
                discountAmount: "0.00",
                appliedPromotions: [],
                appliedPromotionId: null,
                appliedPromotionType: null,
              },
              {
                productId: "prod-2",
                name: "Azúcar",
                quantity: 1,
                unitPrice: "50.00",
                subtotal: "50.00",
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
        ]),
        get: vi.fn(),
      },
    }

    ;(window as Window & typeof globalThis & { marketDesktop?: unknown }).marketDesktop = marketDesktop as unknown as NonNullable<Window["marketDesktop"]>
    ;(globalThis as typeof globalThis & { marketDesktop?: unknown }).marketDesktop = marketDesktop

    const { createDesktopReportAdapter } = await loadAdapterModule()
    const adapter = createDesktopReportAdapter()
    const report = await adapter.getBusinessReport({ kind: "fixed", window: "day" })

    expect(report.totalCollectedAmount).toBe("150.00")
    expect(report.paymentMethodBreakdown).toEqual([
      { method: "cash", amount: "100.00" },
      { method: "card", amount: "50.00" },
    ])
    expect(report.topProducts).toEqual([
      { productId: "prod-1", detalle: "Yerba", units_sold: 2 },
      { productId: "prod-2", detalle: "Azúcar", units_sold: 1 },
    ])
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
