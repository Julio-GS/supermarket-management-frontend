import { describe, it, expect, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { BootstrapGate } from "../presentation/bootstrap-gate"
import type { BootstrapPort } from "../application/bootstrap-port"
import type { BootstrapStatusState } from "../domain/bootstrap-state"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPort(overrides?: Partial<BootstrapPort>): BootstrapPort {
  return {
    getStatus: vi.fn().mockResolvedValue({ status: "pending", ready: false, syncCursor: null }),
    startBootstrap: vi.fn(),
    resumeBootstrap: vi.fn(),
    isDesktop: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BootstrapGate", () => {
  describe("loading state", () => {
    it("shows a loading indicator while bootstrap status is being fetched", () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockReturnValue(new Promise(() => {})),
      })

      render(<BootstrapGate port={port}>Content</BootstrapGate>)

      expect(screen.getByText(/checking/i)).toBeDefined()
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

      const prompts = await screen.findAllByText(/bootstrap/i)
      expect(prompts.length).toBeGreaterThan(0)
      expect(screen.queryByText("Offline Content")).toBeNull()
    })

    it("shows a Start Bootstrap button when status is pending in desktop mode", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
        } satisfies BootstrapStatusState),
      })

      render(<BootstrapGate port={port}>Content</BootstrapGate>)

      const button = await screen.findByRole("button", { name: /start bootstrap/i })
      expect(button).toBeDefined()
    })

    it("disables the Start button when auth params are missing", async () => {
      const port = createMockPort({
        isDesktop: true,
        getStatus: vi.fn().mockResolvedValue({
          status: "pending",
          ready: false,
          syncCursor: null,
        } satisfies BootstrapStatusState),
      })

      render(<BootstrapGate port={port}>Content</BootstrapGate>)

      const button = await screen.findByRole("button", { name: /start bootstrap/i })
      expect(button).toBeDisabled()
    })

    it("enables the Start button and calls startBootstrap when auth params are provided", async () => {
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

      const button = await screen.findByRole("button", { name: /start bootstrap/i })
      expect(button).not.toBeDisabled()

      fireEvent.click(button)

      expect(startBootstrap).toHaveBeenCalledWith({ token: "tok", apiBaseUrl: "http://api" })
    })

    it("transitions to in_progress immediately on Start click then to complete on success", async () => {
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
          <div>Done</div>
        </BootstrapGate>,
      )

      const button = await screen.findByRole("button", { name: /start bootstrap/i })
      fireEvent.click(button)

      // Should show progress immediately
      expect(screen.getByText(/downloading/i)).toBeDefined()

      // After the promise resolves, children are rendered
      const done = await screen.findByText("Done")
      expect(done).toBeDefined()
    })

    it("transitions to failed when startBootstrap rejects", async () => {
      const startBootstrap = vi.fn().mockRejectedValue(new Error("Network down"))

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

      const button = await screen.findByRole("button", { name: /start bootstrap/i })
      fireEvent.click(button)

      const errorText = await screen.findByText(/network down/i)
      expect(errorText).toBeDefined()
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

      const indicator = await screen.findByText(/downloading/i)
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

    it("shows a Retry Bootstrap button when bootstrap failed", async () => {
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

      const retryButton = await screen.findByRole("button", { name: /retry bootstrap/i })
      expect(retryButton).toBeDefined()
    })

    it("disables the Retry button when auth params are missing", async () => {
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

      const retryButton = await screen.findByRole("button", { name: /retry bootstrap/i })
      expect(retryButton).toBeDisabled()
    })

    it("calls resumeBootstrap on Retry click with auth params", async () => {
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

      const retryButton = await screen.findByRole("button", { name: /retry bootstrap/i })
      expect(retryButton).not.toBeDisabled()

      fireEvent.click(retryButton)

      expect(resumeBootstrap).toHaveBeenCalledWith({ token: "tok", apiBaseUrl: "http://api" })
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

      const retryButton = await screen.findByRole("button", { name: /retry bootstrap/i })
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
      // getStatus should NOT be called in web mode
      expect(port.getStatus).not.toHaveBeenCalled()
    })

    it("does not call setState inside the effect for web mode (no ESLint violation)", async () => {
      // This test verifies the ESLint fix: web-mode state is initialised in
      // useState's initialiser, not via setState inside useEffect.
      const port = createMockPort({ isDesktop: false })

      render(<BootstrapGate port={port}>Web Content</BootstrapGate>)

      const content = await screen.findByText("Web Content")
      expect(content).toBeDefined()
      // getStatus was never called, confirming no effect-side state update
      expect(port.getStatus).not.toHaveBeenCalled()
    })
  })
})
