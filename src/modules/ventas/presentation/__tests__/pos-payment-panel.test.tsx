import { describe, expect, it, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { PosPaymentPanel } from "../pos-payment-panel"
import type { PaymentAllocation } from "../../domain/sale"

describe("PosPaymentPanel", () => {
  it("renders totals without IVA row and fires checkout actions", () => {
    const onCheckout = vi.fn()
    const onToggleAllocation = vi.fn()
    const onAmountChange = vi.fn()

    render(
      <PosPaymentPanel
        subtotal={1000}
        allocations={[{ method: "cash", amount: "1000" }]}
        onToggleAllocation={onToggleAllocation}
        onRemoveAllocation={vi.fn()}
        onAmountChange={onAmountChange}
        allocationErrors={null}
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

    // Payment method label is rendered
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
        allocations={[{ method: "card", amount: "0" }]}
        onToggleAllocation={vi.fn()}
        onRemoveAllocation={vi.fn()}
        onAmountChange={vi.fn()}
        allocationErrors={null}
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

  it("disables checkout when no allocation is active", () => {
    render(
      <PosPaymentPanel
        subtotal={100}
        allocations={[]}
        onToggleAllocation={vi.fn()}
        onRemoveAllocation={vi.fn()}
        onAmountChange={vi.fn()}
        allocationErrors={null}
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
    expect(screen.getByText("Seleccione al menos un método de pago")).toBeInTheDocument()
  })

  it("shows allocation errors inline", () => {
    render(
      <PosPaymentPanel
        subtotal={100}
        allocations={[{ method: "cash", amount: "50" }]}
        onToggleAllocation={vi.fn()}
        onRemoveAllocation={vi.fn()}
        onAmountChange={vi.fn()}
        allocationErrors="El total de las asignaciones no coincide con el total de la venta"
        splitEnabled={false}
        onToggleSplit={vi.fn()}
        splitErrors={null}
        isCartEmpty={false}
        isCheckingOut={false}
        checkoutError={null}
        onCheckout={vi.fn()}
      />
    )

    expect(screen.getByText("El total de las asignaciones no coincide con el total de la venta")).toBeInTheDocument()
  })

  it("calls onToggleAllocation when a method button is clicked", () => {
    const onToggle = vi.fn()
    render(
      <PosPaymentPanel
        subtotal={100}
        allocations={[]}
        onToggleAllocation={onToggle}
        onRemoveAllocation={vi.fn()}
        onAmountChange={vi.fn()}
        allocationErrors={null}
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
    expect(onToggle).toHaveBeenCalledWith("card")
  })
})
