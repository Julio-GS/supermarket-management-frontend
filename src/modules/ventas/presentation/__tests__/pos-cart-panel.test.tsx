import { describe, expect, it, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { PosCartPanel } from "../pos-cart-panel"
import type { CartItem } from "../../domain/cart"

const cartItem: CartItem = {
  product: {
    id: "P001",
    name: "Test Product",
    price: 100,
    unit: "u",
  },
  quantity: 2,
}

describe("PosCartPanel", () => {
  it("renders the empty cart state", () => {
    render(<PosCartPanel cartItems={[]} onRemove={vi.fn()} />)
    expect(screen.getByText("Carrito vacío")).toBeInTheDocument()
  })

  it("renders cart rows and calls onRemove", () => {
    const onRemove = vi.fn()
    render(<PosCartPanel cartItems={[cartItem]} onRemove={onRemove} />)

    expect(screen.getByText("Test Product")).toBeInTheDocument()
    expect(screen.getByText("1 ítems")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Quitar Test Product"))
    expect(onRemove).toHaveBeenCalledWith("P001")
  })
})
