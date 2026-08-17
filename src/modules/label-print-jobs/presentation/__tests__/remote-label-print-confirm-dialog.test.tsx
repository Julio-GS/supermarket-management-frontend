import { describe, expect, it, vi } from "vitest"
import { fireEvent, screen } from "@testing-library/react"
import { render } from "@/test/render"

import { RemoteLabelPrintConfirmDialog } from "../remote-label-print-confirm-dialog"

function renderDialog(overrides: Partial<Parameters<typeof RemoteLabelPrintConfirmDialog>[0]> = {}) {
  const props = {
    open: true,
    jobCount: 3,
    onComplete: vi.fn(),
    onRequeue: vi.fn(),
    onBlock: vi.fn(),
    isProcessing: false,
    ...overrides,
  }
  const utils = render(<RemoteLabelPrintConfirmDialog {...props} />)
  return { ...utils, props }
}

describe("RemoteLabelPrintConfirmDialog", () => {
  it("renders exactly three outcome actions: complete, requeue, block", () => {
    renderDialog()

    expect(screen.getByRole("button", { name: /impreso correctamente/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /no se imprimió/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /resultado incierto/i })).toBeInTheDocument()

    // No legacy "Cancelar" (which used to requeue everything) is allowed
    expect(screen.queryByRole("button", { name: /cancelar/i })).toBeNull()
  })

  it("does not render a close (X) button", () => {
    renderDialog()

    // Base UI close part carries data-slot="dialog-close"
    expect(document.querySelector('[data-slot="dialog-close"]')).toBeNull()
  })

  it("stays open when the operator presses Escape", () => {
    renderDialog()

    fireEvent.keyDown(document, { key: "Escape" })

    expect(screen.getByRole("button", { name: /impreso correctamente/i })).toBeInTheDocument()
  })

  it("stays open when the backdrop is clicked", () => {
    renderDialog()

    const overlay = document.querySelector('[data-slot="dialog-overlay"]')
    expect(overlay).not.toBeNull()
    fireEvent.click(overlay!)

    expect(screen.getByRole("button", { name: /impreso correctamente/i })).toBeInTheDocument()
  })

  it("invokes onComplete when 'printed correctly' is selected", () => {
    const { props } = renderDialog()

    fireEvent.click(screen.getByRole("button", { name: /impreso correctamente/i }))

    expect(props.onComplete).toHaveBeenCalledTimes(1)
    expect(props.onRequeue).not.toHaveBeenCalled()
    expect(props.onBlock).not.toHaveBeenCalled()
  })

  it("invokes onRequeue when 'not printed' is selected", () => {
    const { props } = renderDialog()

    fireEvent.click(screen.getByRole("button", { name: /no se imprimió/i }))

    expect(props.onRequeue).toHaveBeenCalledTimes(1)
    expect(props.onComplete).not.toHaveBeenCalled()
    expect(props.onBlock).not.toHaveBeenCalled()
  })

  it("invokes onBlock when 'uncertain outcome' is selected", () => {
    const { props } = renderDialog()

    fireEvent.click(screen.getByRole("button", { name: /resultado incierto/i }))

    expect(props.onBlock).toHaveBeenCalledTimes(1)
    expect(props.onComplete).not.toHaveBeenCalled()
    expect(props.onRequeue).not.toHaveBeenCalled()
  })

  it("renders a retry action when a partial settlement message is present", () => {
    renderDialog({
      pendingMessage: "1 completada, 1 pendiente. Reintentá.",
      onRetry: vi.fn(),
    })

    expect(screen.getByText("1 completada, 1 pendiente. Reintentá.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument()
  })
})
