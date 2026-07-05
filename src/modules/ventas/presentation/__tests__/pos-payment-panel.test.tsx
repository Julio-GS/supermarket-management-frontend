import { describe, expect, it, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { PosPaymentPanel } from "../pos-payment-panel"

describe("PosPaymentPanel", () => {
  it("renders totals and fires checkout actions", () => {
    const onCheckout = vi.fn()
    const onTogglePaymentMethod = vi.fn()

    render(
      <PosPaymentPanel
        subtotal={1000}
        paymentMethods={["cash"]}
        onTogglePaymentMethod={onTogglePaymentMethod}
        splitEnabled={false}
        onToggleSplit={vi.fn()}
        splitErrors={null}
        isCartEmpty={false}
        isCheckingOut={false}
        checkoutError={null}
        onCheckout={onCheckout}
      />
    )

    expect(screen.getByText("Total")).toBeInTheDocument()
    expect(screen.getByText("Efectivo")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ticket no fiscal" }))
    expect(onCheckout).toHaveBeenCalledWith(false)

    fireEvent.click(screen.getByRole("button", { name: "Facturar" }))
    expect(onCheckout).toHaveBeenCalledWith(true)
  })

  it("disables checkout buttons when the cart is empty", () => {
    render(
      <PosPaymentPanel
        subtotal={0}
        paymentMethods={["card"]}
        onTogglePaymentMethod={vi.fn()}
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
        paymentMethods={[]}
        onTogglePaymentMethod={vi.fn()}
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
    expect(screen.getByText("Seleccione al menos un método")).toBeInTheDocument()
  })
})
