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

  // ── Basic rendering ───────────────────────────────────────────

  it("displays the product name in the dialog", () => {
    render(<ProductStockAdjustDialog {...defaultProps} />)

    expect(screen.getByText("Leche Entera 1L")).toBeInTheDocument()
  })

  it("displays the current stock value", () => {
    render(<ProductStockAdjustDialog {...defaultProps} />)

    expect(screen.getByText(/10/)).toBeInTheDocument()
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

  // ── T4: Add/Remove mode ───────────────────────────────────────

  it("shows Add and Remove mode toggle buttons", () => {
    render(<ProductStockAdjustDialog {...defaultProps} />)

    // Expect both mode toggle buttons to be present (exact aria-label match)
    expect(screen.getByRole("button", { name: "Agregar stock" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Quitar stock" })).toBeInTheDocument()
  })

  it("defaults to Add mode with positive quantity sent", async () => {
    const onAdjusted = vi.fn().mockResolvedValue({
      id: "mov-001",
      productId: "P001",
      quantity: 10,
      type: "adjustment",
      referenceId: null,
      previousStock: 0,
      newStock: 10,
      reason: null,
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

    const submitButton = screen.getByRole("button", { name: /confirmar agregar stock/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAdjusted).toHaveBeenCalledWith({
        productId: "P001",
        quantity: 10,
        reason: "",
      })
    })
  })

  it("sends negative quantity in Remove mode", async () => {
    const onAdjusted = vi.fn().mockResolvedValue({
      id: "mov-002",
      productId: "P001",
      quantity: -5,
      type: "adjustment",
      referenceId: null,
      previousStock: 10,
      newStock: 5,
      reason: null,
      createdAt: "2025-06-01T13:00:00Z",
    } satisfies StockMovement)

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={10}
      />
    )

    // Click "Quitar stock" mode button
    const removeButton = screen.getByRole("button", { name: "Quitar stock" })
    fireEvent.click(removeButton)

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "5" } })

    const submitButton = screen.getByRole("button", { name: /confirmar quitar stock/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAdjusted).toHaveBeenCalledWith({
        productId: "P001",
        quantity: -5,
        reason: "",
      })
    })
  })

  it("rejects zero quantity before calling onAdjusted", async () => {
    const onAdjusted = vi.fn()

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={10}
      />
    )

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "0" } })

    const submitButton = screen.getByRole("button", { name: /confirmar agregar stock/i })
    fireEvent.click(submitButton)

    // Should show validation feedback (zero is not allowed)
    await waitFor(() => {
      expect(screen.getByText(/positivo/i)).toBeInTheDocument()
    })

    expect(onAdjusted).not.toHaveBeenCalled()
  })

  it("rejects decimal quantity before calling onAdjusted", async () => {
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

    const submitButton = screen.getByRole("button", { name: /confirmar agregar stock/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/entero/i)).toBeInTheDocument()
    })

    expect(onAdjusted).not.toHaveBeenCalled()
  })

  it("sends optional reason when provided", async () => {
    const onAdjusted = vi.fn().mockResolvedValue({
      id: "mov-003",
      productId: "P001",
      quantity: 10,
      type: "adjustment",
      referenceId: null,
      previousStock: 0,
      newStock: 10,
      reason: "Reposición",
      createdAt: "2025-06-01T14:00:00Z",
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

    const submitButton = screen.getByRole("button", { name: /confirmar agregar stock/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAdjusted).toHaveBeenCalledWith({
        productId: "P001",
        quantity: 10,
        reason: "Reposición",
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
      createdAt: "2025-06-01T15:00:00Z",
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

    const submitButton = screen.getByRole("button", { name: /confirmar agregar stock/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAdjusted).toHaveBeenCalledWith({
        productId: "P001",
        quantity: 3,
        reason: "",
      })
    })
  })

  // ── T4: Negative resulting balances allowed ───────────────────

  it("allows Remove mode producing negative resulting stock", async () => {
    const onAdjusted = vi.fn().mockResolvedValue({
      id: "mov-005",
      productId: "P001",
      quantity: -15,
      type: "adjustment",
      referenceId: null,
      previousStock: 10,
      newStock: -5,
      reason: null,
      createdAt: "2025-06-01T16:00:00Z",
    } satisfies StockMovement)

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={10}
      />
    )

    // Click "Quitar stock" mode button
    const removeButton = screen.getByRole("button", { name: "Quitar stock" })
    fireEvent.click(removeButton)

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "15" } })

    const submitButton = screen.getByRole("button", { name: /confirmar quitar stock/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onAdjusted).toHaveBeenCalledWith({
        productId: "P001",
        quantity: -15,
        reason: "",
      })
    })
  })

  // ── T4 correction: typed negative input rejected in both modes ─

  it("rejects negative quantity in Add mode before calling onAdjusted", async () => {
    const onAdjusted = vi.fn()

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={10}
      />
    )

    // Default mode is Add — type a negative value
    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "-5" } })

    const submitButton = screen.getByRole("button", { name: /confirmar agregar stock/i })
    fireEvent.click(submitButton)

    // Should show validation feedback (negative is not allowed)
    await waitFor(() => {
      expect(screen.getByText(/positivo/i)).toBeInTheDocument()
    })

    expect(onAdjusted).not.toHaveBeenCalled()
  })

  it("rejects negative quantity in Remove mode before calling onAdjusted", async () => {
    const onAdjusted = vi.fn()

    render(
      <ProductStockAdjustDialog
        {...defaultProps}
        onAdjusted={onAdjusted}
        currentStock={10}
      />
    )

    // Switch to Remove mode
    const removeButton = screen.getByRole("button", { name: "Quitar stock" })
    fireEvent.click(removeButton)

    // Type a negative value
    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "-5" } })

    const submitButton = screen.getByRole("button", { name: /confirmar quitar stock/i })
    fireEvent.click(submitButton)

    // Should show validation feedback (negative is not allowed)
    await waitFor(() => {
      expect(screen.getByText(/positivo/i)).toBeInTheDocument()
    })

    expect(onAdjusted).not.toHaveBeenCalled()
  })

  // ── Error handling ────────────────────────────────────────────

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

    const submitButton = screen.getByRole("button", { name: /confirmar agregar stock/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/no maneja stock/i)).toBeInTheDocument()
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

    expect(screen.getByText(/10/)).toBeInTheDocument()

    const quantityInput = screen.getByLabelText(/cantidad/i)
    fireEvent.change(quantityInput, { target: { value: "5" } })

    const submitButton = screen.getByRole("button", { name: /confirmar agregar stock/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/no encontrado/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/10/)).toBeInTheDocument()
  })
})
