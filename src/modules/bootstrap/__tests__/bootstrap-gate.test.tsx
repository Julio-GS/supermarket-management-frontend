import { describe, it, expect, vi } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { render } from "@/test/render"
import { BootstrapGate } from "../presentation/bootstrap-gate"
import type { BootstrapPort } from "../application/bootstrap-port"
import type { BootstrapStatusState } from "../domain/bootstrap-state"

function createMockPort(overrides?: Partial<BootstrapPort>): BootstrapPort {
  return {
    getStatus: vi.fn().mockResolvedValue({ status: "pending", ready: false, syncCursor: null }),
    startBootstrap: vi.fn(),
    resumeBootstrap: vi.fn(),
    isDesktop: false,
    ...overrides,
  }
}

describe("BootstrapGate", () => {
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
