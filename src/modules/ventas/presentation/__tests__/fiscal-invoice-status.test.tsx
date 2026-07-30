import { describe, expect, it, vi } from "vitest"
import { render } from "@/test/render"
import { screen } from "@testing-library/react"

import {
  FiscalInvoiceHistoryIndicator,
  FiscalInvoiceDetailPanel,
} from "../fiscal-invoice-status"

describe("Fiscal invoice status UI", () => {
  it("shows reconciliation indicator for issuing history rows", () => {
    render(<FiscalInvoiceHistoryIndicator status="issuing" />)

    expect(screen.getByText("En proceso")).toBeInTheDocument()
  })

  it("shows reconciliation indicator for ambiguous history rows", () => {
    render(<FiscalInvoiceHistoryIndicator status="ambiguous" />)

    expect(screen.getByText("Revisar")).toBeInTheDocument()
  })

  it("does not show a history indicator for failed rows", () => {
    const { container } = render(<FiscalInvoiceHistoryIndicator status="failed" />)

    expect(container).toBeEmptyDOMElement()
  })

  it("shows retry action only for failed detail state", () => {
    render(
      <FiscalInvoiceDetailPanel
        status="failed"
        isRetrying={false}
        retryError={null}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /reintentar factura/i })).toBeInTheDocument()
    expect(screen.getByText(/no pudo emitirse/i)).toBeInTheDocument()
  })

  it("shows issuing reconciliation messaging without retry action", () => {
    render(
      <FiscalInvoiceDetailPanel
        status="issuing"
        isRetrying={false}
        retryError={null}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText(/procesada por arca/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /reintentar factura/i })).not.toBeInTheDocument()
  })

  it("shows ambiguous reconciliation messaging without retry action", () => {
    render(
      <FiscalInvoiceDetailPanel
        status="ambiguous"
        isRetrying={false}
        retryError={null}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText(/requiere conciliación/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /reintentar factura/i })).not.toBeInTheDocument()
  })
})
