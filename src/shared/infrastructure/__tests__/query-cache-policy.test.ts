import { describe, it, expect, vi } from "vitest"
import {
  invalidateDesktopCatalogQueries,
  invalidatePostCheckoutQueries,
  invalidateStockAdjustmentQueries,
  invalidatePromotionAdminQueries,
  invalidateProviderPurchaseQueries,
  invalidateProductCatalogQueries,
  type QueryInvalidator,
} from "../query-cache-policy"
import {
  POS_CATALOG_QUERY_KEY,
  PRODUCTS_QUERY_KEY,
  PROMOTIONS_QUERY_KEY,
  PROVIDER_PURCHASES_LIST_KEY,
  PROVIDER_PURCHASES_REPORT_KEY,
  REPORTS_QUERY_KEY,
  STOCK_QUERY_KEY,
} from "../query-keys"

describe("query-cache-policy", () => {
  it("invalidateDesktopCatalogQueries invalidates the unified 5 desktop sync keys with default options", async () => {
    const calls: { queryKey: readonly unknown[]; refetchType?: "active" }[] = []
    const invalidator: QueryInvalidator = {
      invalidateQueries: vi.fn(async (params) => {
        calls.push(params)
      }),
    }

    await invalidateDesktopCatalogQueries(invalidator)

    expect(invalidator.invalidateQueries).toHaveBeenCalledTimes(5)
    expect(calls).toEqual([
      { queryKey: [PRODUCTS_QUERY_KEY] },
      { queryKey: PROMOTIONS_QUERY_KEY },
      { queryKey: [POS_CATALOG_QUERY_KEY] },
      { queryKey: [STOCK_QUERY_KEY] },
      { queryKey: REPORTS_QUERY_KEY },
    ])
    // Verify none of the desktop queries enforce refetchType active (default behavior)
    expect(calls.every((c) => c.refetchType === undefined)).toBe(true)
  })

  it("invalidatePostCheckoutQueries invalidates 7 dependent keys with refetchType active", async () => {
    const calls: { queryKey: readonly unknown[]; refetchType?: "active" }[] = []
    const invalidator: QueryInvalidator = {
      invalidateQueries: vi.fn(async (params) => {
        calls.push(params)
      }),
    }

    await invalidatePostCheckoutQueries(invalidator)

    expect(invalidator.invalidateQueries).toHaveBeenCalledTimes(7)
    expect(calls).toEqual([
      { queryKey: [POS_CATALOG_QUERY_KEY], refetchType: "active" },
      { queryKey: [PRODUCTS_QUERY_KEY], refetchType: "active" },
      { queryKey: [STOCK_QUERY_KEY], refetchType: "active" },
      { queryKey: REPORTS_QUERY_KEY, refetchType: "active" },
      { queryKey: PROMOTIONS_QUERY_KEY, refetchType: "active" },
      { queryKey: PROVIDER_PURCHASES_LIST_KEY, refetchType: "active" },
      { queryKey: ["sync-status"], refetchType: "active" },
    ])
    // Verify every single checkout invalidation specifies refetchType active
    expect(calls.every((c) => c.refetchType === "active")).toBe(true)
  })

  it("invalidateStockAdjustmentQueries invalidates products, pos-catalog, and product-specific stock key", async () => {
    const calls: { queryKey: readonly unknown[]; refetchType?: "active" }[] = []
    const invalidator: QueryInvalidator = {
      invalidateQueries: vi.fn(async (params) => {
        calls.push(params)
      }),
    }

    await invalidateStockAdjustmentQueries(invalidator, "prod-999")

    expect(invalidator.invalidateQueries).toHaveBeenCalledTimes(3)
    expect(calls).toEqual([
      { queryKey: [PRODUCTS_QUERY_KEY] },
      { queryKey: [POS_CATALOG_QUERY_KEY] },
      { queryKey: [STOCK_QUERY_KEY, "prod-999"] },
    ])
  })

  it("invalidateStockAdjustmentQueries targets distinct product IDs properly", async () => {
    const calls: { queryKey: readonly unknown[]; refetchType?: "active" }[] = []
    const invalidator: QueryInvalidator = {
      invalidateQueries: vi.fn(async (params) => {
        calls.push(params)
      }),
    }

    await invalidateStockAdjustmentQueries(invalidator, "uuid-abc-123")

    expect(calls[2]).toEqual({ queryKey: [STOCK_QUERY_KEY, "uuid-abc-123"] })
  })

  it("invalidatePromotionAdminQueries invalidates only products query key", async () => {
    const calls: { queryKey: readonly unknown[]; refetchType?: "active" }[] = []
    const invalidator: QueryInvalidator = {
      invalidateQueries: vi.fn(async (params) => {
        calls.push(params)
      }),
    }

    await invalidatePromotionAdminQueries(invalidator)

    expect(invalidator.invalidateQueries).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([{ queryKey: [PRODUCTS_QUERY_KEY] }])
  })

  it("invalidateProviderPurchaseQueries invalidates reports and provider-purchases report query keys", async () => {
    const calls: { queryKey: readonly unknown[]; refetchType?: "active" }[] = []
    const invalidator: QueryInvalidator = {
      invalidateQueries: vi.fn(async (params) => {
        calls.push(params)
      }),
    }

    await invalidateProviderPurchaseQueries(invalidator)

    expect(invalidator.invalidateQueries).toHaveBeenCalledTimes(2)
    expect(calls).toEqual([
      { queryKey: REPORTS_QUERY_KEY },
      { queryKey: PROVIDER_PURCHASES_REPORT_KEY },
    ])
  })

  it("launches desktop sync invalidations concurrently rather than sequentially", async () => {
    let unblockPromises: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      unblockPromises = resolve
    })

    const startedKeys: string[] = []

    const invalidator: QueryInvalidator = {
      invalidateQueries: vi.fn(async ({ queryKey }) => {
        startedKeys.push(JSON.stringify(queryKey))
        await gate
      }),
    }

    const invalidationPromise = invalidateDesktopCatalogQueries(invalidator)

    // All 5 invalidations must have started before any resolves
    expect(startedKeys).toHaveLength(5)
    expect(invalidator.invalidateQueries).toHaveBeenCalledTimes(5)

    unblockPromises()
    await invalidationPromise
  })

  it("launches checkout invalidations concurrently rather than sequentially", async () => {
    let unblockPromises: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      unblockPromises = resolve
    })

    const startedKeys: string[] = []

    const invalidator: QueryInvalidator = {
      invalidateQueries: vi.fn(async ({ queryKey }) => {
        startedKeys.push(JSON.stringify(queryKey))
        await gate
      }),
    }

    const invalidationPromise = invalidatePostCheckoutQueries(invalidator)

    // All 7 invalidations must have started before any resolves
    expect(startedKeys).toHaveLength(7)
    expect(invalidator.invalidateQueries).toHaveBeenCalledTimes(7)

    unblockPromises()
    await invalidationPromise
  })

  it("invalidateProductCatalogQueries invalidates products and POS catalog in parallel with no refetchType", async () => {
    const calls: { queryKey: readonly unknown[]; refetchType?: "active" }[] = []
    const invalidator: QueryInvalidator = {
      invalidateQueries: vi.fn(async (params) => {
        calls.push(params)
      }),
    }

    await invalidateProductCatalogQueries(invalidator)

    expect(invalidator.invalidateQueries).toHaveBeenCalledTimes(2)
    expect(calls).toContainEqual({ queryKey: [PRODUCTS_QUERY_KEY] })
    expect(calls).toContainEqual({ queryKey: [POS_CATALOG_QUERY_KEY] })
    // No refetchType override
    expect(calls.every((c) => c.refetchType === undefined)).toBe(true)
  })

  it("launches product catalog invalidations concurrently rather than sequentially", async () => {
    let unblockPromises: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      unblockPromises = resolve
    })

    const startedKeys: string[] = []

    const invalidator: QueryInvalidator = {
      invalidateQueries: vi.fn(async ({ queryKey }) => {
        startedKeys.push(JSON.stringify(queryKey))
        await gate
      }),
    }

    const invalidationPromise = invalidateProductCatalogQueries(invalidator)

    // Both invalidations must have started before any resolves
    expect(startedKeys).toHaveLength(2)
    expect(invalidator.invalidateQueries).toHaveBeenCalledTimes(2)

    unblockPromises()
    await invalidationPromise
  })
})
