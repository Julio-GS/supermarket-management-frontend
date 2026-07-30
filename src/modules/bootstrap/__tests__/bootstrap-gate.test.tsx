import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { render } from "@/test/render"
import { BootstrapGate } from "../presentation/bootstrap-gate"
import type { BootstrapPort } from "../application/bootstrap-port"
import type { BootstrapStatusState } from "../domain/bootstrap-state"

function createMockPort(overrides?: Partial<BootstrapPort>): BootstrapPort {
  return {
    getStatus: vi.fn().mockResolvedValue({ status: "pending", ready: false, syncCursor: null }),
    startBootstrap: vi.fn(),
    resumeBootstrap: vi.fn(),
    retryConnectivity: vi.fn().mockResolvedValue({ status: "complete", ready: true, syncCursor: null, connectivity: "online" }),
    isDesktop: false,
    ...overrides,
  }
}

function stubDesktopSync(overrides?: {
  start?: ReturnType<typeof vi.fn>
  pull?: ReturnType<typeof vi.fn>
  getState?: ReturnType<typeof vi.fn>
}) {
  ;(window as unknown as { marketDesktop?: Record<string, unknown> }).marketDesktop = {
    getConfig: vi.fn().mockReturnValue({ apiBaseUrl: "http://api" }),
    sync: {
      start:
        overrides?.start ??
        vi.fn().mockResolvedValue({
          synced: 3,
          failed: 0,
          blocked: 0,
          skipped: 0,
          revalidationBlocked: false,
        }),
      pull:
        overrides?.pull ??
        vi.fn().mockResolvedValue({
          applied: 3,
          skipped: 0,
          cursor: "cursor-1",
          hasMore: false,
        }),
      getState:
        overrides?.getState ??
        vi.fn().mockResolvedValue({
          pendingCount: 0,
          failedCount: 0,
          revalidationRequired: false,
          lastSyncAt: null,
        }),
    },
    offline: {
      getState: vi.fn().mockResolvedValue({
        ready: true,
        bootstrap: "complete",
        connectivity: "online",
        sync: "idle",
        pendingCount: 0,
        failureCount: 0,
        degraded: false,
        lastSyncAt: null,
      }),
      getSession: vi.fn().mockResolvedValue(null),
      login: vi.fn(),
    },
  }
}

describe("BootstrapGate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.localStorage.setItem("sg-access-token", "tok")
    delete (window as unknown as { marketDesktop?: Window["marketDesktop"] }).marketDesktop
  })

  afterEach(() => {
    window.localStorage.clear()
    delete (window as unknown as { marketDesktop?: Window["marketDesktop"] }).marketDesktop
  })
  describe("loading state", () => {
    it("shows a loading indicator while bootstrap status is being fetched", () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockReturnValue(new Promise(() => {})),
      })

      render(<BootstrapGate port={port}>Content</BootstrapGate>)

      expect(screen.getByRole("status", { name: /checking bootstrap status/i })).toBeDefined()
      expect(screen.getByText(/verificando estado offline/i)).toBeDefined()
    })
  })

  describe("pending state", () => {
    it("blocks children and shows bootstrap-start prompt when status is pending", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
        } satisfies BootstrapStatusState),
      })

      render(<BootstrapGate port={port}>Offline Content</BootstrapGate>)

      expect(await screen.findByRole("status", { name: /bootstrap required/i })).toBeDefined()
      expect(screen.queryByText("Offline Content")).toBeNull()
    })

    it("shows a start button when status is pending in desktop mode", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
        } satisfies BootstrapStatusState),
      })

      render(<BootstrapGate port={port}>Content</BootstrapGate>)

      const button = await screen.findByRole("button", { name: /iniciar descarga/i })
      expect(button).toBeDefined()
    })

    it("disables the start button when auth params are missing", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
        } satisfies BootstrapStatusState),
      })

      render(<BootstrapGate port={port}>Content</BootstrapGate>)

      const button = await screen.findByRole("button", { name: /iniciar descarga/i })
      expect(button).toBeDisabled()
    })

    it("automatically starts bootstrap once when auth params are provided and device is not offline", async () => {
      const startBootstrap = vi.fn().mockResolvedValue({
        status: "complete",
        ready: true,
        syncCursor: "c1",
      } satisfies BootstrapStatusState)

      const port = createMockPort({
        isDesktop: true,
        startBootstrap,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
          isOfflineMode: false,
          connectivity: "online",
        } satisfies BootstrapStatusState),
      })

      const view = render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Done</div>
        </BootstrapGate>,
      )

      await waitFor(() => {
        expect(startBootstrap).toHaveBeenCalledTimes(1)
      })
      expect(startBootstrap).toHaveBeenCalledWith({ token: "tok", apiBaseUrl: "http://api" })

      view.rerender(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Done</div>
        </BootstrapGate>,
      )

      await waitFor(() => {
        expect(startBootstrap).toHaveBeenCalledTimes(1)
      })
    })

    it("does not auto-start bootstrap when offline mode is active", async () => {
      const startBootstrap = vi.fn()
      const port = createMockPort({
        isDesktop: true,
        startBootstrap,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
          isOfflineMode: true,
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      expect(await screen.findByRole("status", { name: /modo offline activo/i })).toBeDefined()
      expect(screen.getByText("Offline Content")).toBeDefined()
      expect(startBootstrap).not.toHaveBeenCalled()
    })

    it("shows the failure state when automatic bootstrap rejects", async () => {
      const startBootstrap = vi.fn().mockRejectedValue(new Error("Network down"))

      const port = createMockPort({
        isDesktop: true,
        startBootstrap,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
          isOfflineMode: false,
          connectivity: "online",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          Content
        </BootstrapGate>,
      )

      expect(await screen.findByRole("alert", { name: /bootstrap failed/i })).toBeDefined()
      expect(await screen.findByText(/network down/i)).toBeDefined()
    })

    it("allows manual start when auth params are provided", async () => {
      const startBootstrap = vi.fn().mockResolvedValue({
        status: "complete",
        ready: true,
        syncCursor: "c1",
      } satisfies BootstrapStatusState)

      const port = createMockPort({
        isDesktop: true,
        startBootstrap,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          Content
        </BootstrapGate>,
      )

      const button = await screen.findByRole("button", { name: /iniciar descarga/i })
      expect(button).not.toBeDisabled()

      fireEvent.click(button)

      await waitFor(() => {
        expect(startBootstrap).toHaveBeenCalledWith({ token: "tok", apiBaseUrl: "http://api" })
      })
    })
  })

  describe("in_progress state", () => {
    it("blocks children and shows progress indicator when bootstrap is in progress", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "in_progress",
          ready: false,
          syncCursor: null,
        } satisfies BootstrapStatusState),
      })

      render(<BootstrapGate port={port}>Content</BootstrapGate>)

      const indicator = await screen.findByText(/descargando datos operativos/i)
      expect(indicator).toBeDefined()
      expect(screen.queryByText("Content")).toBeNull()
    })
  })

  describe("failed state", () => {
    it("blocks children and shows failure with retry option when bootstrap failed", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "failed",
          ready: false,
          syncCursor: null,
          error: "Network error",
        } satisfies BootstrapStatusState),
      })

      render(<BootstrapGate port={port}>Content</BootstrapGate>)

      const errorText = await screen.findByText(/network error/i)
      expect(errorText).toBeDefined()
      expect(screen.queryByText("Content")).toBeNull()
    })

    it("shows a retry button when bootstrap failed", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "failed",
          ready: false,
          syncCursor: null,
          error: "Timeout",
        } satisfies BootstrapStatusState),
      })

      render(<BootstrapGate port={port}>Content</BootstrapGate>)

      const retryButton = await screen.findByRole("button", { name: /reintentar/i })
      expect(retryButton).toBeDefined()
    })

    it("disables the retry button when auth params are missing", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "failed",
          ready: false,
          syncCursor: null,
          error: "Timeout",
        } satisfies BootstrapStatusState),
      })

      render(<BootstrapGate port={port}>Content</BootstrapGate>)

      const retryButton = await screen.findByRole("button", { name: /reintentar/i })
      expect(retryButton).toBeDisabled()
    })

    it("calls resumeBootstrap on retry click with auth params", async () => {
      const resumeBootstrap = vi.fn().mockResolvedValue({
        status: "complete",
        ready: true,
        syncCursor: "c1",
      } satisfies BootstrapStatusState)

      const port = createMockPort({
        isDesktop: true,
        resumeBootstrap,
        getStatus: vi.fn().mockResolvedValue({
          status: "failed",
          ready: false,
          syncCursor: null,
          error: "Timeout",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          Content
        </BootstrapGate>,
      )

      const retryButton = await screen.findByRole("button", { name: /reintentar/i })
      expect(retryButton).not.toBeDisabled()

      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(resumeBootstrap).toHaveBeenCalledWith({ token: "tok", apiBaseUrl: "http://api" })
      })
    })

    it("transitions to failed with error when resumeBootstrap rejects", async () => {
      const resumeBootstrap = vi.fn().mockRejectedValue(new Error("Still offline"))

      const port = createMockPort({
        isDesktop: true,
        resumeBootstrap,
        getStatus: vi.fn().mockResolvedValue({
          status: "failed",
          ready: false,
          syncCursor: null,
          error: "Timeout",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          Content
        </BootstrapGate>,
      )

      const retryButton = await screen.findByRole("button", { name: /reintentar/i })
      fireEvent.click(retryButton)

      const errorText = await screen.findByText(/still offline/i)
      expect(errorText).toBeDefined()
    })
  })

  describe("connectivity-aware gating", () => {
    it("shows checking feedback and does not auto-start bootstrap when connectivity is unknown", async () => {
      const startBootstrap = vi.fn()
      const port = createMockPort({
        isDesktop: true,
        startBootstrap,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
          connectivity: "unknown",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Content</div>
        </BootstrapGate>,
      )

      expect(
        await screen.findByRole("status", { name: /checking connection/i }),
      ).toBeDefined()
      expect(screen.getByText(/verificando conexión/i)).toBeDefined()
      expect(startBootstrap).not.toHaveBeenCalled()
      expect(screen.queryByText("Content")).toBeNull()
    })

    it("shows checking feedback and does not auto-start bootstrap when connectivity is reconnecting", async () => {
      const startBootstrap = vi.fn()
      const port = createMockPort({
        isDesktop: true,
        startBootstrap,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
          connectivity: "reconnecting",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Content</div>
        </BootstrapGate>,
      )

      expect(
        await screen.findByRole("status", { name: /checking connection/i }),
      ).toBeDefined()
      expect(screen.getByText(/verificando conexión/i)).toBeDefined()
      expect(startBootstrap).not.toHaveBeenCalled()
    })

    it("does not auto-start bootstrap when desktop connectivity is undefined", async () => {
      const startBootstrap = vi.fn()
      const port = createMockPort({
        isDesktop: true,
        startBootstrap,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
          isOfflineMode: false,
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Content</div>
        </BootstrapGate>,
      )

      expect(await screen.findByRole("status", { name: /bootstrap required/i })).toBeDefined()
      expect(startBootstrap).not.toHaveBeenCalled()
    })

    it("shows service-unreachable feedback and retry affordance when offline with pending bootstrap", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
          isOfflineMode: true,
          connectivity: "offline",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Content</div>
        </BootstrapGate>,
      )

      expect(
        await screen.findByRole("status", { name: /modo offline activo/i }),
      ).toBeDefined()
      expect(screen.getByText("Content")).toBeDefined()

      const retryButton = screen.getByRole("button", { name: /reintentar conexión/i })
      expect(retryButton).toBeDefined()
    })

    it("calls retryConnectivity on manual retry and refreshes status", async () => {
      const retryConnectivity = vi
        .fn()
        .mockResolvedValue({ status: "complete", ready: true, syncCursor: null, connectivity: "online" } satisfies BootstrapStatusState)

      const getStatus = vi
        .fn()
        .mockResolvedValue({
          status: "failed",
          ready: false,
          syncCursor: null,
          isOfflineMode: true,
          connectivity: "offline",
          error: "Timeout",
        } satisfies BootstrapStatusState)

      const port = createMockPort({
        isDesktop: true,
        retryConnectivity,
        getStatus,
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Content</div>
        </BootstrapGate>,
      )

      const retryButton = await screen.findByRole("button", {
        name: /reintentar conexión/i,
      })

      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(retryConnectivity).toHaveBeenCalledWith({ apiBaseUrl: "http://api" })
      })
      // After successful retry, children should be visible
      await waitFor(() => {
        expect(screen.getByText("Content")).toBeDefined()
      })
    })

    it("auto-starts bootstrap when connectivity is online and status is pending", async () => {
      const startBootstrap = vi.fn().mockResolvedValue({
        status: "complete",
        ready: true,
        syncCursor: "c1",
        connectivity: "online",
      } satisfies BootstrapStatusState)

      const port = createMockPort({
        isDesktop: true,
        startBootstrap,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
          connectivity: "online",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Done</div>
        </BootstrapGate>,
      )

      await waitFor(() => {
        expect(startBootstrap).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("complete state (ready)", () => {
    it("renders children when bootstrap is complete and ready", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "complete",
          ready: true,
          syncCursor: "2024-01-01T00:00:00.000Z",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port}>
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      const content = await screen.findByText("Offline Content")
      expect(content).toBeDefined()
    })

    it("runs one guarded snapshot refresh before paginated pull and invalidates caches after the full sequence", async () => {
      const pullSync = vi
        .fn()
        .mockResolvedValueOnce({
          applied: 3,
          skipped: 1,
          cursor: "cursor-1",
          hasMore: true,
        })
        .mockResolvedValueOnce({
          applied: 2,
          skipped: 4,
          cursor: "cursor-2",
          hasMore: false,
        })
      const refreshSnapshot = vi.fn().mockResolvedValue({
        status: "complete",
        ready: true,
        syncCursor: "cursor-bootstrap",
      } satisfies BootstrapStatusState)
      const invalidateQueries = vi
        .spyOn(QueryClient.prototype, "invalidateQueries")
        .mockResolvedValue()
      const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined)
      stubDesktopSync({ pull: pullSync })

      const port = createMockPort({
        isDesktop: true,
        startBootstrap: refreshSnapshot,
        getStatus: vi.fn().mockResolvedValue({
          status: "complete",
          ready: true,
          syncCursor: "2024-01-01T00:00:00.000Z",
          connectivity: "online",
        } satisfies BootstrapStatusState),
      })

      const view = render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      await waitFor(() => {
        expect(refreshSnapshot).toHaveBeenCalledTimes(1)
      })
      expect(refreshSnapshot).toHaveBeenCalledWith({ apiBaseUrl: "http://api", token: "tok" })
      await waitFor(() => {
        expect(pullSync).toHaveBeenCalledTimes(2)
      })
      expect(pullSync).toHaveBeenNthCalledWith(1, { apiBaseUrl: "http://api", token: "tok" })
      expect(pullSync).toHaveBeenNthCalledWith(2, { apiBaseUrl: "http://api", token: "tok" })
      await waitFor(() => {
        expect(invalidateQueries).toHaveBeenCalledTimes(4)
      })
      expect(consoleInfo).toHaveBeenCalledWith("Desktop catalog refresh page completed", {
        applied: 3,
        skipped: 1,
        cursor: "cursor-1",
        hasMore: true,
        page: 1,
        totalApplied: 3,
        totalSkipped: 1,
      })
      expect(consoleInfo).toHaveBeenCalledWith("Desktop catalog refresh page completed", {
        applied: 2,
        skipped: 4,
        cursor: "cursor-2",
        hasMore: false,
        page: 2,
        totalApplied: 5,
        totalSkipped: 5,
      })
      expect(consoleInfo).toHaveBeenCalledWith("Desktop catalog refresh completed", {
        totalApplied: 5,
        totalSkipped: 5,
        pages: 2,
        lastCursor: "cursor-2",
        hasMore: false,
      })
      expect(window.localStorage.getItem("sg-desktop-bootstrap-refresh:http://api")).toBe("complete")

      view.rerender(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      await waitFor(() => {
        expect(refreshSnapshot).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(pullSync).toHaveBeenCalledTimes(2)
      })

      invalidateQueries.mockRestore()
      consoleInfo.mockRestore()
    })

    it("does not run desktop refresh when connectivity is unknown", async () => {
      const pullSync = vi.fn()
      const refreshSnapshot = vi.fn()
      stubDesktopSync({ pull: pullSync })

      const port = createMockPort({
        isDesktop: true,
        startBootstrap: refreshSnapshot,
        getStatus: vi.fn().mockResolvedValue({
          status: "complete",
          ready: true,
          syncCursor: "2024-01-01T00:00:00.000Z",
          connectivity: "unknown",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      expect(
        await screen.findByRole("status", { name: /checking connection/i }),
      ).toBeDefined()
      await waitFor(() => {
        expect(refreshSnapshot).not.toHaveBeenCalled()
        expect(pullSync).not.toHaveBeenCalled()
      })
    })

    it("does not run desktop refresh when connectivity is reconnecting", async () => {
      const pullSync = vi.fn()
      const refreshSnapshot = vi.fn()
      stubDesktopSync({ pull: pullSync })

      const port = createMockPort({
        isDesktop: true,
        startBootstrap: refreshSnapshot,
        getStatus: vi.fn().mockResolvedValue({
          status: "complete",
          ready: true,
          syncCursor: "2024-01-01T00:00:00.000Z",
          connectivity: "reconnecting",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      expect(
        await screen.findByRole("status", { name: /checking connection/i }),
      ).toBeDefined()
      await waitFor(() => {
        expect(refreshSnapshot).not.toHaveBeenCalled()
        expect(pullSync).not.toHaveBeenCalled()
      })
    })

    it("warns when desktop catalog refresh reaches max pages and still invalidates caches once", async () => {
      let page = 0
      const pullSync = vi.fn().mockImplementation(async () => {
        page += 1
        return {
          applied: 1,
          skipped: 0,
          cursor: `cursor-${page}`,
          hasMore: true,
        }
      })
      const invalidateQueries = vi
        .spyOn(QueryClient.prototype, "invalidateQueries")
        .mockResolvedValue()
      const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined)
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
      stubDesktopSync({ pull: pullSync })

      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "complete",
          ready: true,
          syncCursor: "2024-01-01T00:00:00.000Z",
          connectivity: "online",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      await waitFor(() => {
        expect(pullSync).toHaveBeenCalledTimes(200)
      })
      await waitFor(() => {
        expect(invalidateQueries).toHaveBeenCalledTimes(4)
      })
      expect(consoleWarn).toHaveBeenCalledWith("Desktop catalog refresh reached max pages", {
        maxPages: 200,
        totalApplied: 200,
        totalSkipped: 0,
        pages: 200,
        lastCursor: "cursor-200",
        hasMore: true,
      })
      expect(consoleInfo).toHaveBeenCalledWith("Desktop catalog refresh completed", {
        totalApplied: 200,
        totalSkipped: 0,
        pages: 200,
        lastCursor: "cursor-200",
        hasMore: true,
      })

      invalidateQueries.mockRestore()
      consoleInfo.mockRestore()
      consoleWarn.mockRestore()
    })

    it("warns and skips desktop catalog refresh when pull API is unavailable", async () => {
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
      ;(window as unknown as { marketDesktop?: Record<string, unknown> }).marketDesktop = {
        getConfig: vi.fn().mockReturnValue({ apiBaseUrl: "http://api" }),
        sync: {
          start: vi.fn(),
          getState: vi.fn().mockResolvedValue({
            pendingCount: 0,
            failedCount: 0,
            revalidationRequired: false,
            lastSyncAt: null,
          }),
        },
      }

      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "complete",
          ready: true,
          syncCursor: "2024-01-01T00:00:00.000Z",
          connectivity: "online",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      expect(await screen.findByText("Offline Content")).toBeDefined()
      await waitFor(() => {
        expect(consoleWarn).toHaveBeenCalledWith(
          "Desktop catalog refresh skipped: sync.pull API unavailable",
        )
      })

      consoleWarn.mockRestore()
    })

    it("skips the snapshot refresh when sync state reports unresolved outbox work and still runs paginated pull", async () => {
      const pullSync = vi.fn().mockResolvedValue({
        applied: 1,
        skipped: 0,
        cursor: "cursor-1",
        hasMore: false,
      })
      const refreshSnapshot = vi.fn()
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
      const invalidateQueries = vi
        .spyOn(QueryClient.prototype, "invalidateQueries")
        .mockResolvedValue()
      stubDesktopSync({
        pull: pullSync,
        getState: vi.fn().mockResolvedValue({
          pendingCount: 1,
          failedCount: 0,
          inFlightCount: 0,
          blockingCount: 0,
          revalidationRequired: false,
          lastSyncAt: null,
        }),
      })

      const port = createMockPort({
        isDesktop: true,
        startBootstrap: refreshSnapshot,
        getStatus: vi.fn().mockResolvedValue({
          status: "complete",
          ready: true,
          syncCursor: "2024-01-01T00:00:00.000Z",
          connectivity: "online",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      expect(await screen.findByText("Offline Content")).toBeDefined()
      await waitFor(() => {
        expect(pullSync).toHaveBeenCalledTimes(1)
      })
      expect(refreshSnapshot).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledWith(
        "Desktop bootstrap refresh skipped: unresolved outbox work detected",
        expect.objectContaining({ pendingCount: 1 }),
      )
      await waitFor(() => {
        expect(invalidateQueries).toHaveBeenCalledTimes(4)
      })

      invalidateQueries.mockRestore()
      consoleWarn.mockRestore()
    })

    it("logs snapshot refresh failures and continues with paginated pull", async () => {
      const pullSync = vi.fn().mockResolvedValue({
        applied: 1,
        skipped: 0,
        cursor: "cursor-1",
        hasMore: false,
      })
      const refreshSnapshot = vi.fn().mockRejectedValue(new Error("Bootstrap refresh failed"))
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
      stubDesktopSync({ pull: pullSync })

      const port = createMockPort({
        isDesktop: true,
        startBootstrap: refreshSnapshot,
        getStatus: vi.fn().mockResolvedValue({
          status: "complete",
          ready: true,
          syncCursor: "2024-01-01T00:00:00.000Z",
          connectivity: "online",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      expect(await screen.findByText("Offline Content")).toBeDefined()
      await waitFor(() => {
        expect(refreshSnapshot).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(pullSync).toHaveBeenCalledTimes(1)
      })
      expect(consoleError).toHaveBeenCalledWith(
        "Desktop bootstrap refresh failed; continuing with paginated pull",
        expect.any(Error),
      )
      expect(window.localStorage.getItem("sg-desktop-bootstrap-refresh:http://api")).toBeNull()

      consoleError.mockRestore()
    })

    it("logs sync failures without blocking ready content", async () => {
      const pullSync = vi.fn().mockRejectedValue(new Error("Sync down"))
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
      stubDesktopSync({ pull: pullSync })

      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "complete",
          ready: true,
          syncCursor: "2024-01-01T00:00:00.000Z",
          connectivity: "online",
        } satisfies BootstrapStatusState),
      })

      render(
        <BootstrapGate port={port} token="tok" apiBaseUrl="http://api">
          <div>Offline Content</div>
        </BootstrapGate>,
      )

      expect(await screen.findByText("Offline Content")).toBeDefined()
      await waitFor(() => {
        expect(pullSync).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith("Desktop auto-sync failed", expect.any(Error))
      })

      consoleError.mockRestore()
    })
  })

  describe("non-desktop (web) mode", () => {
    it("renders children immediately without bootstrap when isDesktop is false", async () => {
      const port = createMockPort({
        isDesktop: false,
        getStatus: vi.fn().mockResolvedValue({
          status: "complete",
          ready: true,
          syncCursor: null,
        } satisfies BootstrapStatusState),
      })

      render(<BootstrapGate port={port}>Web Content</BootstrapGate>)

      const content = await screen.findByText("Web Content")
      expect(content).toBeDefined()
      expect(port.getStatus).not.toHaveBeenCalled()
    })

    it("does not call getStatus in web mode", async () => {
      const port = createMockPort({ isDesktop: false })

      render(<BootstrapGate port={port}>Web Content</BootstrapGate>)

      const content = await screen.findByText("Web Content")
      expect(content).toBeDefined()
      expect(port.getStatus).not.toHaveBeenCalled()
    })
  })
})
