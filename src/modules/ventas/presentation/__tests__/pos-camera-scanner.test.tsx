import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render } from "@/test/render"
import { screen, fireEvent, waitFor, act } from "@testing-library/react"
import { PosCameraScanner } from "../pos-camera-scanner"
import type { CameraScanResult } from "../pos-camera-scanner"

// ── Mocks ─────────────────────────────────────────────────────

const { mockDecodeFromConstraints } = vi.hoisted(() => ({
  mockDecodeFromConstraints: vi.fn(),
}))

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: vi.fn(function(this: any) {
    this.decodeFromConstraints = mockDecodeFromConstraints
  }),
}))

// Mock media track
function createMockTrack(kind: string): MediaStreamTrack {
  return {
    kind,
    stop: vi.fn(),
    id: Math.random().toString(36).slice(2),
    label: "Mock Track",
    enabled: true,
    muted: false,
    readyState: "live",
    applyConstraints: vi.fn(),
    clone: vi.fn(),
    getCapabilities: vi.fn(() => ({})),
    getConstraints: vi.fn(() => ({})),
    getSettings: vi.fn(() => ({})),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    contentHint: "",
    onended: null,
    onmute: null,
    onunmute: null,
  } as MediaStreamTrack
}

function createMockStream(): MediaStream {
  const videoTrack = createMockTrack("video")
  return {
    id: Math.random().toString(36).slice(2),
    active: true,
    getTracks: vi.fn(() => [videoTrack]),
    getVideoTracks: vi.fn(() => [videoTrack]),
    getAudioTracks: vi.fn(() => []),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    onaddtrack: null,
    onremovetrack: null,
  } as unknown as MediaStream
}

function createMockControls() {
  return {
    stop: vi.fn(),
  }
}

// ── Helpers ────────────────────────────────────────────────────

interface RenderProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onDecode?: (code: string) => Promise<CameraScanResult>
}

function renderScanner(props: RenderProps = {}) {
  const onOpenChange = props.onOpenChange ?? vi.fn()
  const onDecode =
    props.onDecode ??
    vi.fn().mockResolvedValue({ status: "not-found" as const })
  const result = render(
    <PosCameraScanner
      open={props.open ?? true}
      onOpenChange={onOpenChange}
      onDecode={onDecode}
    />
  )
  return { ...result, onOpenChange, onDecode }
}

// ── Tests ──────────────────────────────────────────────────────

describe("PosCameraScanner", () => {
  let mockStream: MediaStream
  let mockControls: ReturnType<typeof createMockControls>

  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure isSecureContext is true by default in jsdom
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      writable: true,
      configurable: true,
    })
    mockStream = createMockStream()
    mockControls = createMockControls()

    // Simulate ZXing: resolve with IScannerControls AND attach
    // the stream to the video element via srcObject so the
    // component can extract it for track cleanup on unmount.
    mockDecodeFromConstraints.mockImplementation(async () => {
      const videoEl = document.getElementById("zxing-video-preview") as HTMLVideoElement | null
      if (videoEl) {
        Object.defineProperty(videoEl, "srcObject", {
          value: mockStream,
          writable: true,
          configurable: true,
        })
      }
      return mockControls
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Lifecycle ────────────────────────────────────────

  it("starts ZXing decode with rear-camera constraint on mount", async () => {
    renderScanner()

    await waitFor(() => {
      expect(mockDecodeFromConstraints).toHaveBeenCalled()
    })

    // decodeFromConstraints(constraints, deviceId?, callback?)
    // constraints is at index 0
    const callArg = mockDecodeFromConstraints.mock.calls[0]?.[0] as
      | { video: { facingMode: { ideal: string } } }
      | undefined
    expect(callArg).toBeDefined()
    expect(callArg!.video).toBeDefined()
    expect(callArg!.video.facingMode).toEqual({ ideal: "environment" })
  })

  it("does not start decoding when open is false", async () => {
    renderScanner({ open: false })

    await waitFor(() => {
      expect(mockDecodeFromConstraints).not.toHaveBeenCalled()
    })
  })

  it("stops all tracks and controls on close", async () => {
    const { onOpenChange } = renderScanner()

    await waitFor(() => {
      expect(mockDecodeFromConstraints).toHaveBeenCalled()
    })

    // Wait for video to be present in DOM and close button to be available
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cerrar|cancelar|close/i })).toBeInTheDocument()
    })

    const closeButton = screen.getByRole("button", { name: /cerrar|cancelar|close/i })
    fireEvent.click(closeButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockControls.stop).toHaveBeenCalled()
    expect(mockStream.getVideoTracks()[0].stop).toHaveBeenCalled()
  })

  // ── Decode Lock (Duplicate Protection) ────────────────

  it("locks decoding after first successful scan and ignores subsequent callbacks", async () => {
    const onDecode = vi.fn().mockResolvedValue({
      status: "matched" as const,
      product: { id: "P1", name: "Test", sku: "S1", price: 1, stock: 10, manejaStock: true, unit: "u", promotions: null, storePromotions: null },
    })
    renderScanner({ onDecode })

    await waitFor(() => {
      expect(mockDecodeFromConstraints).toHaveBeenCalled()
    })

    // Extract the decode callback (index 2)
    const decodeCallback = mockDecodeFromConstraints.mock.calls[0]?.[2] as
      | ((result: { getText: () => string }) => void)
      | undefined
    expect(decodeCallback).toBeDefined()

    // First decode — should be accepted
    await act(async () => {
      decodeCallback!({ getText: () => "7791234567890" })
    })
    await waitFor(() => {
      expect(onDecode).toHaveBeenCalledTimes(1)
    })

    // Second call while locked — should be suppressed
    await act(async () => {
      decodeCallback!({ getText: () => "7791234567890" })
    })
    // onDecode should still have only been called once
    expect(onDecode).toHaveBeenCalledTimes(1)
  })

  // ── Cleanup on Successful Match ───────────────────────

  it("stops all tracks and controls after a successful match", async () => {
    const onDecode = vi.fn().mockResolvedValue({
      status: "matched" as const,
      product: { id: "P1", name: "Test", sku: "S1", price: 1, stock: 10, manejaStock: true, unit: "u", promotions: null, storePromotions: null },
    })
    renderScanner({ onDecode })

    await waitFor(() => {
      expect(mockDecodeFromConstraints).toHaveBeenCalled()
    })

    const decodeCallback = mockDecodeFromConstraints.mock.calls[0]?.[2] as
      | ((result: { getText: () => string }) => void)
      | undefined
    expect(decodeCallback).toBeDefined()

    // Trigger a successful match
    await act(async () => {
      decodeCallback!({ getText: () => "7791234567890" })
    })
    await waitFor(() => {
      expect(onDecode).toHaveBeenCalledTimes(1)
    })

    // After match, tracks must be stopped
    expect(mockControls.stop).toHaveBeenCalled()
    expect(mockStream.getVideoTracks()[0].stop).toHaveBeenCalled()
  })

  // ── Cleanup on Callback Error ──────────────────────────

  it("stops all tracks when the decode callback throws an error", async () => {
    const onDecode = vi.fn().mockRejectedValue(new Error("Processing error"))
    renderScanner({ onDecode })

    await waitFor(() => {
      expect(mockDecodeFromConstraints).toHaveBeenCalled()
    })

    const decodeCallback = mockDecodeFromConstraints.mock.calls[0]?.[2] as
      | ((result: { getText: () => string }) => void)
      | undefined
    expect(decodeCallback).toBeDefined()

    // Trigger a decode that throws
    await act(async () => {
      decodeCallback!({ getText: () => "CODE" })
    })
    await waitFor(() => {
      expect(screen.getByText(/error al procesar/i)).toBeInTheDocument()
    })

    // After callback error, tracks must be stopped
    expect(mockControls.stop).toHaveBeenCalled()
    expect(mockStream.getVideoTracks()[0].stop).toHaveBeenCalled()
  })

  // ── Cleanup on Unmount ────────────────────────────────

  it("stops all tracks when component unmounts", async () => {
    const { unmount } = renderScanner()

    await waitFor(() => {
      expect(mockDecodeFromConstraints).toHaveBeenCalled()
    })

    unmount()

    expect(mockControls.stop).toHaveBeenCalled()
    expect(mockStream.getVideoTracks()[0].stop).toHaveBeenCalled()
  })

  // ── Permission Denied ──────────────────────────────────

  it("displays a permission-denied alert when getUserMedia fails with NotAllowedError", async () => {
    mockDecodeFromConstraints.mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError")
    )

    renderScanner()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    expect(screen.getByText("Permiso de cámara denegado")).toBeInTheDocument()
  })

  // ── Error State ────────────────────────────────────────

  it("displays an error state when the browser throws a non-permission error", async () => {
    mockDecodeFromConstraints.mockRejectedValue(
      new DOMException("No camera available", "NotFoundError")
    )

    renderScanner()

    await waitFor(() => {
      expect(screen.getByText(/cámara no disponible/i)).toBeInTheDocument()
    })
  })

  // ── Insecure Context ──────────────────────────────────

  it("shows HTTPS-required error when the context is not secure", async () => {
    Object.defineProperty(window, "isSecureContext", {
      value: false,
      writable: true,
      configurable: true,
    })

    renderScanner()

    await waitFor(() => {
      expect(screen.getByText(/conexión segura/i)).toBeInTheDocument()
    })

    // Camera must NOT be requested in insecure context
    expect(mockDecodeFromConstraints).not.toHaveBeenCalled()
  })

  // ── No-Match Re-arm ────────────────────────────────────

  it("re-arms the decode lock after receiving a not-found result", async () => {
    const onDecode = vi.fn().mockResolvedValue({ status: "not-found" as const })
    renderScanner({ onDecode })

    await waitFor(() => {
      expect(mockDecodeFromConstraints).toHaveBeenCalled()
    })

    const decodeCallback = mockDecodeFromConstraints.mock.calls[0]?.[2] as
      | ((result: { getText: () => string }) => void)
      | undefined

    // First decode — not-found
    await act(async () => {
      decodeCallback!({ getText: () => "0000000000000" })
    })
    await waitFor(() => {
      expect(onDecode).toHaveBeenCalledTimes(1)
    })

    // Second decode — should be accepted (re-armed after not-found)
    await act(async () => {
      decodeCallback!({ getText: () => "0000000000000" })
    })
    await waitFor(() => {
      expect(onDecode).toHaveBeenCalledTimes(2)
    })
  })
})
