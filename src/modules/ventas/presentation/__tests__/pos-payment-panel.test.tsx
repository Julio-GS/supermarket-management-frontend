import { describe, expect, it, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { PosPaymentPanel } from "../pos-payment-panel"

describe("PosPaymentPanel", () => {
  it("renders totals without IVA row and fires checkout actions", () => {
    const onCheckout = vi.fn()
    const onSelectPaymentMethod = vi.fn()

    render(
      <PosPaymentPanel
        subtotal={1000}
        selectedPaymentMethod="cash"
        onSelectPaymentMethod={onSelectPaymentMethod}
        splitEnabled={false}
        onToggleSplit={vi.fn()}
        splitErrors={null}
        isCartEmpty={false}
        isCheckingOut={false}
        checkoutError={null}
        onCheckout={onCheckout}
      />
    )

    // Totals should show — but no IVA row
    expect(screen.getByText("Total")).toBeInTheDocument()
    expect(screen.getByText("Subtotal")).toBeInTheDocument()
    expect(screen.queryByText(/IVA/)).not.toBeInTheDocument()

    // Payment method is rendered
    expect(screen.getByText("Efectivo")).toBeInTheDocument()

    // Checkout buttons work
    fireEvent.click(screen.getByRole("button", { name: "Ticket no fiscal" }))
    expect(onCheckout).toHaveBeenCalledWith(false)

    fireEvent.click(screen.getByRole("button", { name: "Facturar" }))
    expect(onCheckout).toHaveBeenCalledWith(true)
  })

  it("disables checkout buttons when the cart is empty", () => {
    render(
      <PosPaymentPanel
        subtotal={0}
        selectedPaymentMethod="card"
        onSelectPaymentMethod={vi.fn()}
        splitEnabled={false}
        onToggleSplit={vi.fn()}
        splitErrors={null}
        isCartEmpty
        isCheckingOut={false}
        checkoutError={null}
        onCheckout={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "Ticket no fiscal" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Facturar" })).toBeDisabled()
  })

  it("disables checkout when no payment method is selected", () => {
    render(
      <PosPaymentPanel
        subtotal={100}
        selectedPaymentMethod={null}
        onSelectPaymentMethod={vi.fn()}
        splitEnabled={false}
        onToggleSplit={vi.fn()}
        splitErrors={null}
        isCartEmpty={false}
        isCheckingOut={false}
        checkoutError={null}
        onCheckout={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "Ticket no fiscal" })).toBeDisabled()
    expect(screen.getByText("Seleccione un método de pago")).toBeInTheDocument()
  })

  it("calls onSelectPaymentMethod when a radio card is clicked", () => {
    const onSelect = vi.fn()
    render(
      <PosPaymentPanel
        subtotal={100}
        selectedPaymentMethod="cash"
        onSelectPaymentMethod={onSelect}
        splitEnabled={false}
        onToggleSplit={vi.fn()}
        splitErrors={null}
        isCartEmpty={false}
        isCheckingOut={false}
        checkoutError={null}
        onCheckout={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText("Tarjeta"))
    expect(onSelect).toHaveBeenCalledWith("card")
  })
})
