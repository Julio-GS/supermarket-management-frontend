import { describe, expect, it, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { PosPaymentPanel } from "../pos-payment-panel"

describe("PosPaymentPanel", () => {
  it("renders totals without IVA row and fires checkout actions", () => {
    const onCheckout = vi.fn()
    const onToggleAllocation = vi.fn()
    const onAmountChange = vi.fn()

    render(
      <PosPaymentPanel
        subtotal={1000}
        cartItems={[]}
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
        cartItems={[]}
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
        cartItems={[]}
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
        cartItems={[]}
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
        cartItems={[]}
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

// ── Keyboard navigation (Task 3.4) ────────────────────────────

describe("PosPaymentPanel keyboard navigation", () => {
  it("moves focus between payment method buttons with ArrowDown", () => {
    render(
      <PosPaymentPanel
        subtotal={100}
        cartItems={[]}
        allocations={[{ method: "cash", amount: "50" }]}
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

    // Focus the first payment button (Efectivo/cash)
    const cashBtn = screen.getByText("Efectivo").closest("button")!
    cashBtn.focus()
    expect(document.activeElement?.textContent).toContain("Efectivo")

    // ArrowDown should move to next method
    fireEvent.keyDown(cashBtn, { key: "ArrowDown" })
    expect(document.activeElement?.textContent).toContain("Transferencia")
  })

  it("moves focus between payment method buttons with ArrowUp", () => {
    render(
      <PosPaymentPanel
        subtotal={100}
        cartItems={[]}
        allocations={[{ method: "card", amount: "50" }]}
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

    // Focus "Tarjeta" (card)
    const cardBtn = screen.getByText("Tarjeta").closest("button")!
    cardBtn.focus()
    expect(document.activeElement?.textContent).toContain("Tarjeta")

    // ArrowUp should move to previous method
    fireEvent.keyDown(cardBtn, { key: "ArrowUp" })
    expect(document.activeElement?.textContent).toContain("Transferencia")
  })

  it("activates focused payment method with Enter", () => {
    const onToggle = vi.fn()
    render(
      <PosPaymentPanel
        subtotal={100}
        cartItems={[]}
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

    const cashBtn = screen.getByText("Efectivo").closest("button")!
    cashBtn.focus()

    fireEvent.keyDown(cashBtn, { key: "Enter" })
    expect(onToggle).toHaveBeenCalledWith("cash")
  })

  it("renders estimated discount for ad-hoc items when activeStorePromotions is provided", () => {
    const adHocItem = {
      kind: "ad-hoc" as const,
      draftId: "draft-1",
      name: "Servicio Especial",
      unitPrice: 100,
      quantity: 2,
      description: "un servicio",
    }
    const storePromotions = [
      {
        id: "store-promo-10",
        name: "10% OFF Tienda",
        description: "10% OFF",
        scope: "store" as const,
        type: "percentage" as const,
        discountPercent: 10,
        startDate: null,
        endDate: null,
        weekdays: null,
      },
    ]

    render(
      <PosPaymentPanel
        subtotal={200}
        cartItems={[adHocItem]}
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
        activeStorePromotions={storePromotions}
      />
    )

    expect(screen.getByText("Servicio Especial — 10% OFF Tienda")).toBeInTheDocument()
    expect(screen.getAllByText(/-\s*\$\s*20[,.]00/)).toHaveLength(2)
  })
})
