import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { ProductStockAdjustDialog } from "../product-stock-adjust-dialog"
import type { StockMovement } from "../../domain/stock-adjustment"

describe("ProductStockAdjustDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    productId: "P001",
    productName: "Leche Entera 1L",
    currentStock: 10,
    onAdjusted: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("displays the product name in the dialog", () => {
    render(<ProductStockAdjustDialog {...defaultProps} />)

    expect(screen.getByText("Leche Entera 1L")).toBeInTheDocument()
  })

  it("displays the current stock value", () => {
    render(<ProductStockAdjustDialog {...defaultProps} />)

    expect(screen.getByText(/10/)).toBeInTheDocument()
  })

  it("shows validation error for decimal quantity before calling onAdjusted", async () => {
    const onAdjusted = vi.fn()

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={5}
      />
    )

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "2.5" } })

    const submitButton = screen.getByRole("button", { name: /ajustar|confirmar|guardar/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAdjusted).not.toHaveBeenCalled()
    })

    // Should show validation feedback
    expect(screen.getByText(/entero/i)).toBeInTheDocument()
  })

  it("allows negative integer quantity submission", async () => {
    const onAdjusted = vi.fn().mockResolvedValue({
      id: "mov-001",
      productId: "P001",
      quantity: -3,
      type: "adjustment",
      referenceId: null,
      previousStock: 2,
      newStock: -1,
      reason: null,
      createdAt: "2025-06-01T12:00:00Z",
    } satisfies StockMovement)

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={2}
      />
    )

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "-3" } })

    const submitButton = screen.getByRole("button", { name: /ajustar|confirmar|guardar/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAdjusted).toHaveBeenCalledWith({
        productId: "P001",
        quantity: -3,
        reason: "",
      })
    })
  })

  it("displays backend error from onAdjusted rejection", async () => {
    const onAdjusted = vi.fn().mockRejectedValue(new Error("El producto no maneja stock"))

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={10}
      />
    )

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "5" } })

    const submitButton = screen.getByRole("button", { name: /ajustar|confirmar|guardar/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/no maneja stock/i)).toBeInTheDocument()
    })
  })

  it("sends optional reason when provided", async () => {
    const onAdjusted = vi.fn().mockResolvedValue({
      id: "mov-002",
      productId: "P001",
      quantity: 10,
      type: "adjustment",
      referenceId: null,
      previousStock: 0,
      newStock: 10,
      reason: "Reposición",
      createdAt: "2025-06-01T12:00:00Z",
    } satisfies StockMovement)

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={0}
      />
    )

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "10" } })

    const reasonInput = screen.getByLabelText(/motivo/i)
    fireEvent.change(reasonInput, { target: { value: "Reposición" } })

    const submitButton = screen.getByRole("button", { name: /ajustar|confirmar|guardar/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAdjusted).toHaveBeenCalledWith({
        productId: "P001",
        quantity: 10,
        reason: "Reposición",
      })
    })
  })

  it("does not render when open is false", () => {
    render(<ProductStockAdjustDialog {...defaultProps} open={false} />)

    expect(screen.queryByText("Leche Entera 1L")).not.toBeInTheDocument()
  })

  it("calls onClose when cancel is clicked", () => {
    const onClose = vi.fn()
    render(<ProductStockAdjustDialog {...defaultProps} onClose={onClose} />)

    const cancelButton = screen.getByRole("button", { name: /cancelar/i })
    fireEvent.click(cancelButton)

    expect(onClose).toHaveBeenCalled()
  })

  // ── TRIANGULATE ───────────────────────────────────────────

  it("produces negative newStock on negative adjustment and calls onAdjusted", async () => {
    const onAdjusted = vi.fn().mockResolvedValue({
      id: "mov-003",
      productId: "P001",
      quantity: -5,
      type: "adjustment",
      referenceId: null,
      previousStock: 2,
      newStock: -3,
      reason: null,
      createdAt: "2025-06-01T12:00:00Z",
    } satisfies StockMovement)

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={2}
      />
    )

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "-5" } })

    const submitButton = screen.getByRole("button", { name: /ajustar|confirmar|guardar/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAdjusted).toHaveBeenCalledWith({
        productId: "P001",
        quantity: -5,
        reason: "",
      })
    })
  })

  it("safely omits reason when input is whitespace only", async () => {
    const onAdjusted = vi.fn().mockResolvedValue({
      id: "mov-004",
      productId: "P001",
      quantity: 3,
      type: "adjustment",
      referenceId: null,
      previousStock: 5,
      newStock: 8,
      reason: null,
      createdAt: "2025-06-01T12:00:00Z",
    } satisfies StockMovement)

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
      />
    )

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "3" } })

    const reasonInput = screen.getByLabelText(/motivo/i)
    fireEvent.change(reasonInput, { target: { value: "   " } })

    const submitButton = screen.getByRole("button", { name: /ajustar|confirmar|guardar/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAdjusted).toHaveBeenCalledWith({
        productId: "P001",
        quantity: 3,
        reason: "",
      })
    })
  })

  it("preserves previous stock display on backend not-found error", async () => {
    const onAdjusted = vi.fn().mockRejectedValue(new Error("Producto no encontrado"))

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={10}
      />
    )

    // Current stock is still displayed
    expect(screen.getByText(/10/)).toBeInTheDocument()

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "5" } })

    const submitButton = screen.getByRole("button", { name: /ajustar|confirmar|guardar/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/no encontrado/i)).toBeInTheDocument()
    })

    // The current stock display should still be 10 (unchanged)
    expect(screen.getByText(/10/)).toBeInTheDocument()
  })

  it("preserves previous stock display on non-stock backend error", async () => {
    const onAdjusted = vi.fn().mockRejectedValue(new Error("El producto no maneja stock"))

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={5}
      />
    )

    expect(screen.getByText(/5/)).toBeInTheDocument()

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "1" } })

    const submitButton = screen.getByRole("button", { name: /ajustar|confirmar|guardar/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/no maneja stock/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/5/)).toBeInTheDocument()
  })
})
