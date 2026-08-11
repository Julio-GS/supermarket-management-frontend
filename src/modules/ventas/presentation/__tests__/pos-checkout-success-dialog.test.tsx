import { describe, expect, it, vi } from "vitest"
import { render } from "@/test/render"
import { screen, fireEvent } from "@testing-library/react"
import { PosCheckoutSuccessDialog } from "../pos-checkout-success-dialog"
import type { PosCheckoutSuccess } from "../use-pos-terminal"

// ---- helpers ----

function makeSuccess(
  overrides: Partial<PosCheckoutSuccess> = {},
): PosCheckoutSuccess {
  return {
    saleId: "V-TEST-001",
    saleDate: new Date().toISOString(),
    total: "150.00",
    paymentMethods: [{ method: "cash", amount: "150.00" }],
    invoiceStatus: "none",
    isSplit: false,
    items: [
      {
        productId: "P001",
        name: "Producto de prueba",
        quantity: 1,
        unitPrice: "150.00",
        subtotal: "150.00",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null,
      },
    ],
    fiscalError: null,
    cae: null,
    caeVto: null,
    cbteNro: null,
    cbteTipo: null,
    ptoVta: null,
    manualDiscount: null,
    manualDiscountCents: 0,
    ...overrides,
  }
}

const noop = vi.fn()
const onPrint = vi.fn().mockResolvedValue({ ok: true } as const)

function renderDialog(success: PosCheckoutSuccess) {
  return render(
    <PosCheckoutSuccessDialog
      success={success}
      onClose={noop}
      onPrint={onPrint}
      printError={null}
      isPrinting={false}
    />,
  )
}

// ---- ARCA fiscal invoice status rendering ----

describe("PosCheckoutSuccessDialog — ARCA invoice status feedback", () => {
  it("renders factura emitida label for issued status", () => {
    renderDialog(makeSuccess({ invoiceStatus: "issued" }))

    expect(screen.getByText("Factura electrónica emitida")).toBeInTheDocument()
    expect(screen.queryByText("Ticket no fiscal")).not.toBeInTheDocument()
  })

  it("renders ticket no fiscal label for none status", () => {
    renderDialog(makeSuccess({ invoiceStatus: "none" }))

    expect(screen.getByText("Ticket no fiscal")).toBeInTheDocument()
    expect(
      screen.queryByText("Factura electrónica emitida"),
    ).not.toBeInTheDocument()
  })

  it("does NOT render issued label for failed status", () => {
    renderDialog(makeSuccess({ invoiceStatus: "failed" }))

    expect(
      screen.queryByText("Factura electrónica emitida"),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Ticket no fiscal")).not.toBeInTheDocument()
  })

  it("renders failed-specific messaging for failed status", () => {
    renderDialog(makeSuccess({ invoiceStatus: "failed" }))

    expect(
      screen.getByText(/factura.*fallida|falló|no pudo/i),
    ).toBeInTheDocument()
    // Should NOT claim it's a non-fiscal ticket
    expect(screen.queryByText("Ticket no fiscal")).not.toBeInTheDocument()
  })

  it("does NOT render issued label for issuing status", () => {
    renderDialog(makeSuccess({ invoiceStatus: "issuing" }))

    expect(
      screen.queryByText("Factura electrónica emitida"),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Ticket no fiscal")).not.toBeInTheDocument()
  })

  it("renders processing/in-progress messaging for issuing status", () => {
    renderDialog(makeSuccess({ invoiceStatus: "issuing" }))

    // Should indicate processing, not failure and not generic non-fiscal
    expect(screen.getByText(/emisión|procesando|proceso/i)).toBeInTheDocument()
    expect(screen.queryByText("Ticket no fiscal")).not.toBeInTheDocument()
  })

  it("does NOT render issued label for ambiguous status", () => {
    renderDialog(makeSuccess({ invoiceStatus: "ambiguous" }))

    expect(
      screen.queryByText("Factura electrónica emitida"),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Ticket no fiscal")).not.toBeInTheDocument()
  })

  it("renders reconciliation-required messaging for ambiguous status", () => {
    renderDialog(makeSuccess({ invoiceStatus: "ambiguous" }))

    expect(
      screen.getByText(/conciliaci|requiere revisión|revisar/i),
    ).toBeInTheDocument()
    expect(screen.queryByText("Ticket no fiscal")).not.toBeInTheDocument()
  })

  it("sale is always presented as completed regardless of invoice status", () => {
    for (const status of ["none", "issuing", "issued", "failed", "ambiguous"] as const) {
      const { unmount } = renderDialog(makeSuccess({ invoiceStatus: status }))

      // The dialog header always says "Venta confirmada"
      expect(screen.getByText("Venta confirmada")).toBeInTheDocument()
      // Sale ID is always visible
      expect(screen.getByText("V-TEST-001")).toBeInTheDocument()

      unmount()
    }
  })
})

// ── Direct print trigger ────────────────────────────────────────

describe("PosCheckoutSuccessDialog — direct print", () => {
  it("calls onPrint immediately when 'Imprimir ticket' is clicked without extra confirmation modal", () => {
    onPrint.mockClear()
    renderDialog(makeSuccess({ invoiceStatus: "none" }))

    const printButton = screen.getByText("Imprimir ticket")
    expect(printButton).toBeInTheDocument()

    // Clicking the button should trigger onPrint directly
    fireEvent.click(printButton)

    expect(onPrint).toHaveBeenCalledTimes(1)
    // No intermediate confirmation dialog should appear
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
