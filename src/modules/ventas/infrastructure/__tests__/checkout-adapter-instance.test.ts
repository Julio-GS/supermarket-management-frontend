import { afterEach, describe, expect, it, vi } from "vitest"

const nonFiscalCheckout = {
  items: [
    {
      kind: "catalog-fixed" as const,
      productId: "prod-1",
      quantity: 2,
    },
  ],
  paymentMethods: [{ method: "cash", amount: "100.00" }],
  invoiceRequested: false,
}

describe("checkout adapter instance", () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it("uses the desktop adapter when the bridge appears after import", async () => {
    const desktopSave = vi.fn().mockResolvedValue({ id: "desktop-sale" })
    const apiSave = vi.fn().mockResolvedValue({ id: "api-sale" })

    vi.doMock("../desktop-checkout-adapter", () => ({
      isDesktopSalesAvailable: () => typeof window !== "undefined" && Boolean((window as any).marketDesktop?.sales?.complete),
      createDesktopCheckoutAdapter: () => ({ save: desktopSave }),
    }))
    vi.doMock("../api-checkout-adapter", () => ({
      createApiCheckoutAdapter: () => ({ save: apiSave }),
    }))

    vi.stubGlobal("window", {})
    const { checkoutAdapter } = await import("../checkout-adapter-instance")

    ;(window as any).marketDesktop = {
      sales: { complete: vi.fn() },
    }

    await checkoutAdapter.save(nonFiscalCheckout as any)

    expect(desktopSave).toHaveBeenCalledTimes(1)
    expect(desktopSave).toHaveBeenCalledWith(nonFiscalCheckout)
    expect(apiSave).not.toHaveBeenCalled()
  })

  it("falls back to the API adapter when no desktop bridge exists", async () => {
    const desktopSave = vi.fn()
    const apiSave = vi.fn().mockResolvedValue({ id: "api-sale" })

    vi.doMock("../desktop-checkout-adapter", () => ({
      isDesktopSalesAvailable: () => false,
      createDesktopCheckoutAdapter: () => ({ save: desktopSave }),
    }))
    vi.doMock("../api-checkout-adapter", () => ({
      createApiCheckoutAdapter: () => ({ save: apiSave }),
    }))

    vi.stubGlobal("window", {})
    const { checkoutAdapter } = await import("../checkout-adapter-instance")

    await checkoutAdapter.save(nonFiscalCheckout as any)

    expect(apiSave).toHaveBeenCalledTimes(1)
    expect(apiSave).toHaveBeenCalledWith(nonFiscalCheckout)
    expect(desktopSave).not.toHaveBeenCalled()
  })
})
