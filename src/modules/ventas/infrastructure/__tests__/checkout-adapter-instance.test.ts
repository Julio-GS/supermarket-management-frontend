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

const fiscalCheckout = {
  ...nonFiscalCheckout,
  invoiceRequested: true,
}

type ConnectivityState = "online" | "offline" | "unknown" | "reconnecting"

async function loadCheckoutAdapter(options?: {
  desktopAvailable?: boolean
  connectivity?: ConnectivityState
  getStateError?: Error
}) {
  const desktopSave = vi.fn().mockResolvedValue({ id: "desktop-sale" })
  const apiSave = vi.fn().mockResolvedValue({ id: "api-sale" })
  const getState = options?.getStateError
    ? vi.fn().mockRejectedValue(options.getStateError)
    : vi.fn().mockResolvedValue({
        connectivity: options?.connectivity ?? "offline",
      })

  vi.doMock("../desktop-checkout-adapter", () => ({
    isDesktopSalesAvailable: () => options?.desktopAvailable ?? true,
    createDesktopCheckoutAdapter: () => ({ save: desktopSave }),
  }))
  vi.doMock("../api-checkout-adapter", () => ({
    createApiCheckoutAdapter: () => ({ save: apiSave }),
  }))

  vi.stubGlobal("window", {
    marketDesktop: {
      sales: { complete: vi.fn() },
      offline: { getState },
    },
  })

  const { checkoutAdapter } = await import("../checkout-adapter-instance")

  return { checkoutAdapter, desktopSave, apiSave, getState }
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

  it("routes fiscal sales to the API adapter when desktop connectivity is online", async () => {
    const { checkoutAdapter, apiSave, desktopSave, getState } = await loadCheckoutAdapter({
      connectivity: "online",
    })

    await checkoutAdapter.save(fiscalCheckout as any)

    expect(getState).toHaveBeenCalledTimes(1)
    expect(apiSave).toHaveBeenCalledTimes(1)
    expect(apiSave).toHaveBeenCalledWith(fiscalCheckout)
    expect(desktopSave).not.toHaveBeenCalled()
  })

  it("routes fiscal sales to the desktop adapter when desktop connectivity is offline", async () => {
    const { checkoutAdapter, apiSave, desktopSave, getState } = await loadCheckoutAdapter({
      connectivity: "offline",
    })

    await checkoutAdapter.save(fiscalCheckout as any)

    expect(getState).toHaveBeenCalledTimes(1)
    expect(desktopSave).toHaveBeenCalledTimes(1)
    expect(desktopSave).toHaveBeenCalledWith(fiscalCheckout)
    expect(apiSave).not.toHaveBeenCalled()
  })

  it.each(["unknown", "reconnecting"] as const)(
    "routes fiscal sales to the desktop adapter when desktop connectivity is %s",
    async (connectivity) => {
      const { checkoutAdapter, apiSave, desktopSave, getState } = await loadCheckoutAdapter({
        connectivity,
      })

      await checkoutAdapter.save(fiscalCheckout as any)

      expect(getState).toHaveBeenCalledTimes(1)
      expect(desktopSave).toHaveBeenCalledTimes(1)
      expect(desktopSave).toHaveBeenCalledWith(fiscalCheckout)
      expect(apiSave).not.toHaveBeenCalled()
    },
  )

  it("routes fiscal sales to the desktop adapter when connectivity lookup fails", async () => {
    const { checkoutAdapter, apiSave, desktopSave, getState } = await loadCheckoutAdapter({
      getStateError: new Error("offline bridge failed"),
    })

    await checkoutAdapter.save(fiscalCheckout as any)

    expect(getState).toHaveBeenCalledTimes(1)
    expect(desktopSave).toHaveBeenCalledTimes(1)
    expect(desktopSave).toHaveBeenCalledWith(fiscalCheckout)
    expect(apiSave).not.toHaveBeenCalled()
  })

  it("keeps desktop-first routing for non-fiscal sales", async () => {
    const { checkoutAdapter, apiSave, desktopSave, getState } = await loadCheckoutAdapter({
      connectivity: "online",
    })

    await checkoutAdapter.save(nonFiscalCheckout as any)

    expect(getState).not.toHaveBeenCalled()
    expect(desktopSave).toHaveBeenCalledTimes(1)
    expect(desktopSave).toHaveBeenCalledWith(nonFiscalCheckout)
    expect(apiSave).not.toHaveBeenCalled()
  })
})
