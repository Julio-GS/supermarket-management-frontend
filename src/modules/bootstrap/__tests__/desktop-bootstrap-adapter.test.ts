import { afterEach, describe, expect, it, vi } from "vitest"
import { createDesktopBootstrapAdapter } from "../infrastructure/desktop-bootstrap-adapter"

describe("createDesktopBootstrapAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("allows bootstrap when connectivity is unknown", async () => {
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
    })
  })
})
