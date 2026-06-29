import { describe, expect, it, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { PosPaymentPanel } from "../pos-payment-panel"

describe("PosPaymentPanel", () => {
  it("renders totals and fires checkout actions", () => {
    const onCheckout = vi.fn()
    const onPaymentMethodChange = vi.fn()

    render(
      <PosPaymentPanel
        subtotal={1000}
        paymentMethod="Efectivo"
        onPaymentMethodChange={onPaymentMethodChange}
        isCartEmpty={false}
        isCheckingOut={false}
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
        paymentMethod="Tarjeta"
        onPaymentMethodChange={vi.fn()}
        isCartEmpty
        isCheckingOut={false}
        onCheckout={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "Ticket no fiscal" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Facturar" })).toBeDisabled()
  })
})
