import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest"
import {
  refreshDesktopCatalog,
  hasUnresolvedOutboxWork,
  type DesktopCatalogRefresherDependencies,
  type QueryInvalidator,
  type DesktopSyncApi,
} from "../desktop-catalog-refresher"
import type { BootstrapPort } from "../bootstrap-port"
import {
  POS_CATALOG_QUERY_KEY,
  PRODUCTS_QUERY_KEY,
  PROMOTIONS_QUERY_KEY,
  REPORTS_QUERY_KEY,
  STOCK_QUERY_KEY,
} from "@/shared"

describe("desktop-catalog-refresher", () => {
  let mockBootstrapPort: { startBootstrap: Mock<BootstrapPort["startBootstrap"]> }
  let mockQueryInvalidator: QueryInvalidator
  let mockSyncApi: DesktopSyncApi
  let invalidatedKeys: unknown[]

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    invalidatedKeys = []

    mockBootstrapPort = {
      startBootstrap: vi.fn().mockResolvedValue({
        status: "complete",
        ready: true,
        syncCursor: "cursor-snap",
      }),
    }

    mockQueryInvalidator = {
      invalidateQueries: vi.fn().mockImplementation(async ({ queryKey }) => {
        invalidatedKeys.push(queryKey)
      }),
    }

    mockSyncApi = {
      getState: vi.fn().mockResolvedValue({
        pendingCount: 0,
        failedCount: 0,
        inFlightCount: 0,
        blockingCount: 0,
      }),
      pull: vi.fn().mockResolvedValue({
        applied: 5,
        skipped: 1,
        cursor: "cursor-1",
        hasMore: false,
      }),
    }
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("executes the full ordered workflow on clean state and invalidates exact query keys", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined)

    const deps: DesktopCatalogRefresherDependencies = {
      bootstrapPort: mockBootstrapPort,
      syncApi: mockSyncApi,
      queryInvalidator: mockQueryInvalidator,
    }

    const result = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api.local",
    })

    expect(result.status).toBe("success")
    expect(mockBootstrapPort.startBootstrap).toHaveBeenCalledTimes(1)
    expect(mockBootstrapPort.startBootstrap).toHaveBeenCalledWith({
      token: "tok-123",
      apiBaseUrl: "http://api.local",
    })
    expect(mockSyncApi.pull).toHaveBeenCalledTimes(1)
    expect(mockSyncApi.pull).toHaveBeenCalledWith({
      token: "tok-123",
      apiBaseUrl: "http://api.local",
    })

    // Assert exact 5 invalidation keys
    expect(mockQueryInvalidator.invalidateQueries).toHaveBeenCalledTimes(5)
    expect(invalidatedKeys).toEqual([
      [PRODUCTS_QUERY_KEY],
      PROMOTIONS_QUERY_KEY,
      [POS_CATALOG_QUERY_KEY],
      [STOCK_QUERY_KEY],
      REPORTS_QUERY_KEY,
    ])

    // Assert guard is set in storage
    expect(window.localStorage.getItem("sg-desktop-bootstrap-refresh:http://api.local")).toBe("complete")

    consoleInfo.mockRestore()
  })

  it("skips snapshot refresh if guard is already complete, but still executes pull and invalidations", async () => {
    window.localStorage.setItem("sg-desktop-bootstrap-refresh:http://api.local", "complete")

    const deps: DesktopCatalogRefresherDependencies = {
      bootstrapPort: mockBootstrapPort,
      syncApi: mockSyncApi,
      queryInvalidator: mockQueryInvalidator,
    }

    const result = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api.local",
    })

    expect(result.status).toBe("success")
    expect(mockBootstrapPort.startBootstrap).not.toHaveBeenCalled()
    expect(mockSyncApi.pull).toHaveBeenCalledTimes(1)
    expect(mockQueryInvalidator.invalidateQueries).toHaveBeenCalledTimes(5)
  })

  it("skips snapshot refresh when outbox has unresolved work, still executes pull and returns outbox-blocked", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    mockSyncApi.getState = vi.fn().mockResolvedValue({
      pendingCount: 2,
      failedCount: 0,
      inFlightCount: 0,
      blockingCount: 0,
    })

    const deps: DesktopCatalogRefresherDependencies = {
      bootstrapPort: mockBootstrapPort,
      syncApi: mockSyncApi,
      queryInvalidator: mockQueryInvalidator,
    }

    const result = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api.local",
    })

    expect(result.status).toBe("outbox-blocked")
    expect(mockBootstrapPort.startBootstrap).not.toHaveBeenCalled()
    expect(consoleWarn).toHaveBeenCalledWith(
      "Desktop bootstrap refresh skipped: unresolved outbox work detected",
      expect.objectContaining({ pendingCount: 2 }),
    )
    expect(mockSyncApi.pull).toHaveBeenCalledTimes(1)
    expect(mockQueryInvalidator.invalidateQueries).toHaveBeenCalledTimes(5)

    consoleWarn.mockRestore()
  })

  describe("outbox variants in hasUnresolvedOutboxWork", () => {
    it("identifies blocked outbox across failedCount, inFlightCount, and blockingCount", () => {
      expect(hasUnresolvedOutboxWork(null)).toBe(false)
      expect(hasUnresolvedOutboxWork(undefined)).toBe(false)
      expect(hasUnresolvedOutboxWork({})).toBe(false)
      expect(hasUnresolvedOutboxWork({ pendingCount: 0, failedCount: 0 })).toBe(false)
      expect(hasUnresolvedOutboxWork({ failedCount: 3 })).toBe(true)
      expect(hasUnresolvedOutboxWork({ inFlightCount: 1 })).toBe(true)
      expect(hasUnresolvedOutboxWork({ blockingCount: 2 })).toBe(true)
    })
  })

  it("returns pull-unavailable and does not invalidate caches if syncApi.pull is missing", async () => {
    const deps: DesktopCatalogRefresherDependencies = {
      bootstrapPort: mockBootstrapPort,
      syncApi: {
        getState: vi.fn().mockResolvedValue({ pendingCount: 0 }),
      },
      queryInvalidator: mockQueryInvalidator,
    }

    const result = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api.local",
    })

    expect(result.status).toBe("pull-unavailable")
    expect(mockQueryInvalidator.invalidateQueries).not.toHaveBeenCalled()
  })

  it("stops pull loop at max 200 pages, warns, and still invalidates caches once", async () => {
    let pageCount = 0
    mockSyncApi.pull = vi.fn().mockImplementation(async () => {
      pageCount += 1
      return {
        applied: 1,
        skipped: 0,
        cursor: `cursor-${pageCount}`,
        hasMore: true,
      }
    })

    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined)

    const deps: DesktopCatalogRefresherDependencies = {
      bootstrapPort: mockBootstrapPort,
      syncApi: mockSyncApi,
      queryInvalidator: mockQueryInvalidator,
    }

    const result = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api.local",
    })

    expect(result.status).toBe("success")
    expect(mockSyncApi.pull).toHaveBeenCalledTimes(200)
    expect(consoleWarn).toHaveBeenCalledWith(
      "Desktop catalog refresh reached max pages",
      expect.objectContaining({ maxPages: 200, pages: 200, hasMore: true }),
    )
    expect(mockQueryInvalidator.invalidateQueries).toHaveBeenCalledTimes(5)

    consoleWarn.mockRestore()
    consoleInfo.mockRestore()
  })

  it("handles non-complete snapshot status without setting guard, logging error and continuing to pull", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    mockBootstrapPort.startBootstrap = vi.fn().mockResolvedValue({
      status: "failed",
      ready: false,
      syncCursor: null,
      error: "Service unavailable",
    })

    const deps: DesktopCatalogRefresherDependencies = {
      bootstrapPort: mockBootstrapPort,
      syncApi: mockSyncApi,
      queryInvalidator: mockQueryInvalidator,
    }

    const result = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api.local",
    })

    expect(result.status).toBe("success")
    expect(consoleError).toHaveBeenCalledWith(
      "Desktop bootstrap refresh failed; continuing with paginated pull",
      expect.any(Error),
    )
    expect(window.localStorage.getItem("sg-desktop-bootstrap-refresh:http://api.local")).toBeNull()
    expect(mockSyncApi.pull).toHaveBeenCalledTimes(1)
    expect(mockQueryInvalidator.invalidateQueries).toHaveBeenCalledTimes(5)

    consoleError.mockRestore()
  })

  it("logs error and does not set guard if snapshot refresh rejects, but continues with pull", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    mockBootstrapPort.startBootstrap = vi.fn().mockRejectedValue(new Error("Snapshot failed"))

    const deps: DesktopCatalogRefresherDependencies = {
      bootstrapPort: mockBootstrapPort,
      syncApi: mockSyncApi,
      queryInvalidator: mockQueryInvalidator,
    }

    const result = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api.local",
    })

    expect(result.status).toBe("success")
    expect(consoleError).toHaveBeenCalledWith(
      "Desktop bootstrap refresh failed; continuing with paginated pull",
      expect.any(Error),
    )
    expect(window.localStorage.getItem("sg-desktop-bootstrap-refresh:http://api.local")).toBeNull()
    expect(mockSyncApi.pull).toHaveBeenCalledTimes(1)
    expect(mockQueryInvalidator.invalidateQueries).toHaveBeenCalledTimes(5)

    consoleError.mockRestore()
  })

  it("returns fatal-error and does not invalidate if pull throws an error", async () => {
    mockSyncApi.pull = vi.fn().mockRejectedValue(new Error("Pull network failure"))

    const deps: DesktopCatalogRefresherDependencies = {
      bootstrapPort: mockBootstrapPort,
      syncApi: mockSyncApi,
      queryInvalidator: mockQueryInvalidator,
    }

    const result = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api.local",
    })

    expect(result.status).toBe("fatal-error")
    if (result.status === "fatal-error") {
      expect(result.error).toBeInstanceOf(Error)
    }
    expect(mockQueryInvalidator.invalidateQueries).not.toHaveBeenCalled()
  })

  it("falls back to in-memory guard when localStorage throws", async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage disabled")
    })
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage disabled")
    })

    const deps: DesktopCatalogRefresherDependencies = {
      bootstrapPort: mockBootstrapPort,
      syncApi: mockSyncApi,
      queryInvalidator: mockQueryInvalidator,
    }

    // First call sets in-memory guard
    const result1 = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api-mem.local",
    })
    expect(result1.status).toBe("success")
    expect(mockBootstrapPort.startBootstrap).toHaveBeenCalledTimes(1)

    // Second call for same URL in same bundle should hit in-memory guard
    const result2 = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api-mem.local",
    })
    expect(result2.status).toBe("success")
    expect(mockBootstrapPort.startBootstrap).toHaveBeenCalledTimes(1) // not called again

    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
  })

  it("aborts loop and avoids invalidation when isCancelled returns true", async () => {
    const deps: DesktopCatalogRefresherDependencies = {
      bootstrapPort: mockBootstrapPort,
      syncApi: mockSyncApi,
      queryInvalidator: mockQueryInvalidator,
    }

    const result = await refreshDesktopCatalog(deps, {
      token: "tok-123",
      apiBaseUrl: "http://api.local",
      isCancelled: () => true,
    })

    expect(result.status).toBe("success")
    expect(mockSyncApi.pull).not.toHaveBeenCalled()
    expect(mockQueryInvalidator.invalidateQueries).not.toHaveBeenCalled()
  })
})
