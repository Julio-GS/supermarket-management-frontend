import { afterEach, describe, expect, it, vi } from "vitest"
import { createDesktopBootstrapAdapter } from "../infrastructure/desktop-bootstrap-adapter"

describe("createDesktopBootstrapAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes connectivity as unknown when getState reports unknown", async () => {
    vi.stubGlobal("window", {
      marketDesktop: {
        bootstrap: {
          status: vi.fn().mockResolvedValue({
            status: "pending",
            ready: false,
            syncCursor: null,
          }),
          start: vi.fn(),
          resume: vi.fn(),
        },
        offline: {
          getState: vi.fn().mockResolvedValue({
            ready: false,
            bootstrap: "pending",
            connectivity: "unknown",
            sync: "idle",
            pendingCount: 0,
            failureCount: 0,
            degraded: false,
            lastSyncAt: null,
          }),
        },
      },
    })

    const adapter = createDesktopBootstrapAdapter()
    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "pending",
      ready: false,
      isOfflineMode: false,
      connectivity: "unknown",
    })
  })

  it("reports offline mode only when connectivity is offline", async () => {
    vi.stubGlobal("window", {
      marketDesktop: {
        bootstrap: {
          status: vi.fn().mockResolvedValue({
            status: "pending",
            ready: false,
            syncCursor: null,
          }),
          start: vi.fn(),
          resume: vi.fn(),
        },
        offline: {
          getState: vi.fn().mockResolvedValue({
            ready: false,
            bootstrap: "pending",
            connectivity: "offline",
            sync: "idle",
            pendingCount: 0,
            failureCount: 0,
            degraded: false,
            lastSyncAt: null,
          }),
        },
      },
    })

    const adapter = createDesktopBootstrapAdapter()
    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "pending",
      ready: false,
      isOfflineMode: true,
      connectivity: "offline",
    })
  })

  it("exposes connectivity as reconnecting when getState reports reconnecting", async () => {
    vi.stubGlobal("window", {
      marketDesktop: {
        bootstrap: {
          status: vi.fn().mockResolvedValue({
            status: "pending",
            ready: false,
            syncCursor: null,
          }),
          start: vi.fn(),
          resume: vi.fn(),
        },
        offline: {
          getState: vi.fn().mockResolvedValue({
            ready: false,
            bootstrap: "pending",
            connectivity: "reconnecting",
            sync: "idle",
            pendingCount: 0,
            failureCount: 0,
            degraded: false,
            lastSyncAt: null,
          }),
        },
      },
    })

    const adapter = createDesktopBootstrapAdapter()
    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "pending",
      ready: false,
      isOfflineMode: false,
      connectivity: "reconnecting",
    })
  })

  it("exposes connectivity as unknown when offline.getState fails", async () => {
    vi.stubGlobal("window", {
      marketDesktop: {
        bootstrap: {
          status: vi.fn().mockResolvedValue({
            status: "pending",
            ready: false,
            syncCursor: null,
          }),
          start: vi.fn(),
          resume: vi.fn(),
        },
        offline: {
          getState: vi.fn().mockRejectedValue(new Error("offline bridge failed")),
        },
      },
    })

    const adapter = createDesktopBootstrapAdapter()
    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "pending",
      ready: false,
      isOfflineMode: false,
      connectivity: "unknown",
    })
  })

  it("exposes connectivity as unknown when offline bridge is unavailable", async () => {
    vi.stubGlobal("window", {
      marketDesktop: {
        bootstrap: {
          status: vi.fn().mockResolvedValue({
            status: "pending",
            ready: false,
            syncCursor: null,
          }),
          start: vi.fn(),
          resume: vi.fn(),
        },
      },
    })

    const adapter = createDesktopBootstrapAdapter()
    await expect(adapter.getStatus()).resolves.toMatchObject({
      status: "pending",
      ready: false,
      isOfflineMode: false,
      connectivity: "unknown",
    })
  })

  it("delegates manual retry to offline.checkConnectivity and refreshes status", async () => {
    // Simulate: getState initially returns offline but after checkConnectivity
    // the main process updates connectivity; the next getState returns online.
    let connectivity: "online" | "offline" | "unknown" | "reconnecting" = "offline"

    const getState = vi.fn().mockImplementation(async () => ({
      ready: connectivity === "online",
      bootstrap: connectivity === "online" ? ("complete" as const) : ("pending" as const),
      connectivity,
      sync: "idle" as const,
      pendingCount: 0,
      failureCount: 0,
      degraded: false,
      lastSyncAt: null,
    }))

    vi.stubGlobal("window", {
      marketDesktop: {
        bootstrap: {
          status: vi.fn().mockResolvedValue({
            status: "complete",
            ready: true,
            syncCursor: null,
          }),
          start: vi.fn(),
          resume: vi.fn(),
        },
        offline: {
          getState,
          checkConnectivity: vi.fn().mockImplementation(async () => {
            connectivity = "online"
            return { connectivity: "online" }
          }),
        },
      },
    })

    const adapter = createDesktopBootstrapAdapter()

    const result = await adapter.retryConnectivity({ apiBaseUrl: "http://localhost:3000/api/v1" })

    expect(result.connectivity).toBe("online")
  })
})
