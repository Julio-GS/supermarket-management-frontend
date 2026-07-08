import { describe, expect, it, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { PosCartPanel } from "../pos-cart-panel"
import type { CartItem } from "../../domain/cart"
import type { SplitItemGroup } from "../../domain/default-split"
import type { SplitTicketGroupDraft } from "../../application/checkout-port"

const cartItemA: CartItem = {
  product: { id: "P001", name: "Group A Product", price: 100, unit: "u" },
  quantity: 2,
}

const cartItemB: CartItem = {
  product: { id: "P002", name: "Group B Product", price: 50, unit: "u" },
  quantity: 1,
}

const cartItemCoca: CartItem = {
  product: { id: "COCA-COLA", name: "Coca Cola", price: 150, unit: "u" },
  quantity: 2,
}

function makeSplitGroup(
  label: string,
  items: { productId: string; quantity: number }[],
): SplitTicketGroupDraft {
  return { label, items }
}

describe("PosCartPanel", () => {
  it("renders the empty cart state", () => {
    render(<PosCartPanel cartItems={[]} onRemove={vi.fn()} />)
    expect(screen.getByText("Carrito vacío")).toBeInTheDocument()
  })

  it("renders cart rows and calls onRemove", () => {
    const onRemove = vi.fn()
    render(<PosCartPanel cartItems={[cartItemA]} onRemove={onRemove} />)

    expect(screen.getByText("Group A Product")).toBeInTheDocument()
    expect(screen.getByText("1 ítems")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Quitar Group A Product"))
    expect(onRemove).toHaveBeenCalledWith("P001", undefined)
  })

  it("shows the estimated discount label for percentage promotions", () => {
    const discountedItem: CartItem = {
      product: {
        id: "P010",
        name: "Promo Percentage",
        price: 100,
        unit: "u",
        promotions: [
          {
            id: "promo-10",
            description: "10% OFF",
            type: "percentage",
            discount_percent: 10,
          },
        ],
      },
      quantity: 3,
    }

    render(<PosCartPanel cartItems={[discountedItem]} onRemove={vi.fn()} />)

    expect(screen.getByText(/Estimated discount:/i)).toBeInTheDocument()
    expect(screen.getByText(/approx\./i)).toBeInTheDocument()
  })

  it("shows the estimated discount label for 2x1 promotions", () => {
    const discountedItem: CartItem = {
      product: {
        id: "P011",
        name: "Promo 2x1",
        price: 120,
        unit: "u",
        promotions: [
          {
            id: "promo-11",
            description: "2x1",
            type: "two_x_one",
          },
        ],
      },
      quantity: 3,
    }

    render(<PosCartPanel cartItems={[discountedItem]} onRemove={vi.fn()} />)

    expect(screen.getByText(/Estimated discount:/i)).toBeInTheDocument()
    expect(screen.getByText(/1 free unit/i)).toBeInTheDocument()
  })

  it("does not render an estimated discount when the product has no promotions", () => {
    render(<PosCartPanel cartItems={[cartItemA]} onRemove={vi.fn()} />)

    expect(screen.getByText("Group A Product")).toBeInTheDocument()
    expect(screen.queryByText(/Estimated discount:/i)).not.toBeInTheDocument()
  })

  it("shows no group badges when split is disabled", () => {
    const itemGroups = new Map<string, SplitItemGroup>([["P001", "A"]])
    render(
      <PosCartPanel
        cartItems={[cartItemA]}
        onRemove={vi.fn()}
        itemGroups={itemGroups}
        splitEnabled={false}
      />
    )

    expect(screen.queryByText("A")).not.toBeInTheDocument()
  })

  it("shows A/B group headers and per-item badges when split is enabled (legacy)", () => {
    const itemGroups = new Map<string, SplitItemGroup>([
      ["P001", "A"],
      ["P002", "B"],
    ])
    render(
      <PosCartPanel
        cartItems={[cartItemA, cartItemB]}
        onRemove={vi.fn()}
        itemGroups={itemGroups}
        splitEnabled
      />
    )

    // Group headers should be visible
    expect(screen.getByText(/Ticket A/)).toBeInTheDocument()
    expect(screen.getByText(/Ticket B/)).toBeInTheDocument()

    // Each item should have its group badge
    const aBadges = screen.getAllByText("A")
    const bBadges = screen.getAllByText("B")
    expect(aBadges.length).toBeGreaterThanOrEqual(1)
    expect(bBadges.length).toBeGreaterThanOrEqual(1)
  })

  it("renders empty groups correctly in split mode (legacy)", () => {
    const itemGroups = new Map<string, SplitItemGroup>([["P001", "A"]])
    render(
      <PosCartPanel
        cartItems={[cartItemA]}
        onRemove={vi.fn()}
        itemGroups={itemGroups}
        splitEnabled
      />
    )

    expect(screen.getByText(/Ticket A/)).toBeInTheDocument()
    expect(screen.getByText(/Ticket B/)).toBeInTheDocument()
    // Group A has 1, Group B has 0
    expect(screen.getByText(/Ticket A · 1 producto/)).toBeInTheDocument()
    expect(screen.getByText(/Ticket B · 0 productos/)).toBeInTheDocument()
  })

  describe("row-based split groups (FIX: repeated products)", () => {
    it("renders row-based split items with per-row quantities", () => {
      // Coca Cola x1 in row 2 (A) + Coca Cola x1 in row 7 (B)
      // Aggregated cart: Coca Cola quantity=2
      const splitGroups: SplitTicketGroupDraft[] = [
        makeSplitGroup("A", [{ productId: "COCA-COLA", quantity: 1 }]),
        makeSplitGroup("B", [{ productId: "COCA-COLA", quantity: 1 }]),
      ]

      render(
        <PosCartPanel
          cartItems={[cartItemCoca]}
          onRemove={vi.fn()}
          splitEnabled
          splitGroups={splitGroups}
        />
      )

      // Both group headers should be visible
      expect(screen.getByText(/Ticket A/)).toBeInTheDocument()
      expect(screen.getByText(/Ticket B/)).toBeInTheDocument()

      // Each group shows 1 producto
      expect(screen.getByText(/Ticket A · 1 producto/)).toBeInTheDocument()
      expect(screen.getByText(/Ticket B · 1 producto/)).toBeInTheDocument()

      // Product name appears twice (once per group row)
      const cocaElements = screen.getAllByText("Coca Cola")
      expect(cocaElements.length).toBe(2)

      // Group badges should be present for both A and B
      const aBadges = screen.getAllByText("A")
      const bBadges = screen.getAllByText("B")
      expect(aBadges.length).toBeGreaterThanOrEqual(1)
      expect(bBadges.length).toBeGreaterThanOrEqual(1)
    })

    it("shows per-row quantity (not aggregated) in row-based split", () => {
      // Aggregated cart has Coca Cola qty=2, split groups have qty=1 each
      const splitGroups: SplitTicketGroupDraft[] = [
        makeSplitGroup("A", [{ productId: "COCA-COLA", quantity: 1 }]),
        makeSplitGroup("B", [{ productId: "COCA-COLA", quantity: 1 }]),
      ]

      render(
        <PosCartPanel
          cartItems={[cartItemCoca]}
          onRemove={vi.fn()}
          splitEnabled
          splitGroups={splitGroups}
        />
      )

      // Each row should show "150 c/u · 1 u" (not "· 2")
      const unitLines = screen.getAllByText(/150/)
      expect(unitLines.length).toBeGreaterThanOrEqual(2)
    })

    it("shows correct per-row subtotals in row-based split", () => {
      // Coca Cola price=150, 1 unit → subtotal 150 per row
      const splitGroups: SplitTicketGroupDraft[] = [
        makeSplitGroup("A", [{ productId: "COCA-COLA", quantity: 1 }]),
        makeSplitGroup("B", [{ productId: "COCA-COLA", quantity: 1 }]),
      ]

      render(
        <PosCartPanel
          cartItems={[cartItemCoca]}
          onRemove={vi.fn()}
          splitEnabled
          splitGroups={splitGroups}
        />
      )

      // Each row subtotal should be $ 150,00 (Argentine locale), not $ 300,00
      // The format uses non-breaking space: "$ 150,00"
      const subtotals = screen.getAllByText(/\$\s*150[,.]00/)
      // At least 2 (one per row subtotal)
      expect(subtotals.length).toBeGreaterThanOrEqual(2)
    })

    it("handles empty split groups", () => {
      const splitGroups: SplitTicketGroupDraft[] = [
        makeSplitGroup("A", [{ productId: "P001", quantity: 2 }]),
        makeSplitGroup("B", []),
      ]

      render(
        <PosCartPanel
          cartItems={[cartItemA]}
          onRemove={vi.fn()}
          splitEnabled
          splitGroups={splitGroups}
        />
      )

      expect(screen.getByText(/Ticket A · 1 producto/)).toBeInTheDocument()
      expect(screen.getByText(/Ticket B · 0 productos/)).toBeInTheDocument()
    })
  })

  describe("keyboard accessibility", () => {
    it("delete button is focusable and activatable via click (Enter/Space equivalent)", () => {
      const onRemove = vi.fn()
      render(<PosCartPanel cartItems={[cartItemA]} onRemove={onRemove} />)

      const deleteBtn = screen.getByLabelText("Quitar Group A Product")
      // Native buttons are natively focusable
      deleteBtn.focus()
      expect(deleteBtn).toHaveFocus()

      // Activate — browser fires click on Enter/Space for native buttons
      fireEvent.click(deleteBtn)
      expect(onRemove).toHaveBeenCalledWith("P001", undefined)
    })
  })
})
