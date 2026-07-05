import { screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, type Mock } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { render } from "@/test/render"
import { matchesProductSearch } from "@/modules/productos"
import { PosTerminal } from "../../presentation/pos-terminal"
import type { CatalogProduct, CatalogQueryPort } from "../../application/catalog-query-port"
import type { CheckoutPort, CheckoutDraft } from "../../application/checkout-port"
import type { Sale } from "../../domain/sale"

vi.mock("sonner", async () => {
  const actual = await vi.importActual<typeof import("sonner")>("sonner")
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
  }
})

const testProduct: CatalogProduct = {
  id: "P001",
  name: "Test Product",
  sku: "TEST-0001",
  price: 100,
  stock: 50,
  unit: "u",
}

const secondProduct: CatalogProduct = {
  id: "P002",
  name: "Second Product",
  sku: "TEST-0002",
  price: 50,
  stock: 30,
  unit: "u",
}

function createFakeCatalogQueryPort(products: CatalogProduct[]): CatalogQueryPort {
  return {
    async search(filters = {}) {
      return products.filter((product) => {
        return !filters.search || matchesProductSearch(product, filters.search)
      })
    },
  }
}

function createFakeCheckoutAdapter(): CheckoutPort & { save: Mock } {
  let sequence = 1
  return {
    save: vi.fn(async (draft: CheckoutDraft) => {
      const sale: Sale = {
        id: `V-${String(sequence).padStart(5, "0")}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: "Mostrador",
        items: draft.items.map((item) => ({
          productId: item.productId,
          name: "",
          quantity: item.quantity,
          unitPrice: "0.00",
          subtotal: "0.00",
        })),
        total: "0.00",
        paymentMethods: draft.paymentMethods,
        invoiceStatus: draft.invoiceRequested ? "none" : "none",
        cae: null,
        caeVto: null,
        cbteNro: null,
        cbteTipo: null,
        ptoVta: null,
        invoiceRequestedAt: draft.invoiceRequested ? new Date().toISOString() : null,
        splitTicketGroups: draft.splitTicketGroups
          ? draft.splitTicketGroups.map((g) => ({
              label: g.label,
              items: g.items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: "0.00",
                subtotal: "0.00",
              })),
            }))
          : null,
      }
      sequence += 1
      return sale
    }),
  }
}

function renderTerminal(
  initialProducts: CatalogProduct[] = [testProduct],
  catalogQueryPort: CatalogQueryPort = createFakeCatalogQueryPort(initialProducts),
  checkoutPort: CheckoutPort = createFakeCheckoutAdapter()
) {
  return render(
    <SidebarProvider>
      <PosTerminal
        initialProducts={initialProducts}
        catalogQueryPort={catalogQueryPort}
        checkoutPort={checkoutPort}
      />
    </SidebarProvider>
  )
}

async function resolveRow(rowNumber: number, searchTerm = "Test") {
  const productInput = screen.getByLabelText(`Producto fila ${rowNumber}`)
  fireEvent.change(productInput, {
    target: { value: searchTerm },
  })
  fireEvent.keyDown(productInput, { key: "Enter", code: "Enter" })

  await waitFor(() => expect(productInput).toHaveValue(testProduct.name))
  return productInput
}

/**
 * Commit a resolved row by simulating quantity + Enter so it appears
 * in the cart (committed: true).
 */
async function commitRow(rowNumber: number, quantity: number) {
  const quantityInput = screen.getByLabelText(`Cantidad fila ${rowNumber}`)
  fireEvent.change(quantityInput, {
    target: { value: String(quantity) },
  })
  fireEvent.keyDown(quantityInput, { key: "Enter", code: "Enter" })
  // After Enter, the row is committed and the product enters the cart.
  // We wait for the cart to reflect the committed row instead of
  // asserting on the quantity input (which loses focus to the next row).
  await waitFor(() => {
    expect(screen.getByText(testProduct.name)).toBeInTheDocument()
  })
}

function setRowQuantity(rowNumber: number, quantity: number) {
  const quantityInput = screen.getByLabelText(`Cantidad fila ${rowNumber}`)
  fireEvent.change(quantityInput, {
    target: { value: String(quantity) },
  })
  return quantityInput
}

describe("PosTerminal sales flow", () => {
  it("shows committed row products in the cart", async () => {
    renderTerminal()

    await resolveRow(1)
    await commitRow(1, 1)

    expect(screen.getByText(testProduct.name)).toBeInTheDocument()
    expect(screen.getByText("1 ítems")).toBeInTheDocument()
    expect(screen.getByLabelText("Producto fila 1")).toHaveValue(testProduct.name)
  })

  it("updates the cart when a committed row quantity changes", async () => {
    renderTerminal()

    await resolveRow(1)
    await commitRow(1, 4)

    expect(screen.getByText(testProduct.name)).toBeInTheDocument()
    expect(screen.getByText(/4 u/)).toBeInTheDocument()
  })

  it("merges duplicate products committed in multiple rows", async () => {
    renderTerminal()

    await resolveRow(1)
    await commitRow(1, 2)

    await resolveRow(2)
    await commitRow(2, 3)

    expect(screen.getAllByText(testProduct.name)).toHaveLength(1)
    expect(screen.getByText(/5 u/)).toBeInTheDocument()
    expect(screen.getByText("1 ítems")).toBeInTheDocument()
  })

  it("clears the cart when a committed row is removed", async () => {
    renderTerminal()

    await resolveRow(1)
    await commitRow(1, 1)

    fireEvent.click(screen.getByRole("button", { name: "Limpiar fila 1" }))

    expect(screen.getByText("Carrito vacío")).toBeInTheDocument()
    expect(screen.getByLabelText("Producto fila 1")).toHaveValue("")
  })

  it("saves a sale through the checkout port", async () => {
    const checkoutPort = createFakeCheckoutAdapter()
    renderTerminal([testProduct], createFakeCatalogQueryPort([testProduct]), checkoutPort)

    await resolveRow(1)
    await commitRow(1, 2)

    // Toggle "Tarjeta" allocation to activate the payment method
    fireEvent.click(screen.getByText("Tarjeta"))

    fireEvent.click(screen.getByRole("button", { name: "Facturar" }))

    await waitFor(() => expect(checkoutPort.save).toHaveBeenCalledTimes(1))

    const draft = checkoutPort.save.mock.calls[0][0] as CheckoutDraft
    expect(draft.paymentMethods).toEqual([{ method: "card", amount: "200" }])
    expect(draft.invoiceRequested).toBe(true)
    expect(draft.items).toHaveLength(1)
    expect(draft.items[0].productId).toBe("P001")
    expect(draft.items[0].quantity).toBe(2)
  })

  it("shows success dialog after checkout and clears cart on print click", async () => {
    const checkoutPort = createFakeCheckoutAdapter()
    renderTerminal([testProduct], createFakeCatalogQueryPort([testProduct]), checkoutPort)

    await resolveRow(1)
    await commitRow(1, 2)

    // Toggle a payment method allocation to activate checkout
    fireEvent.click(screen.getByText("Tarjeta"))

    fireEvent.click(screen.getByRole("button", { name: "Facturar" }))

    // Wait for success dialog
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    // Dialog shows sale info
    expect(screen.getByText("Venta confirmada")).toBeInTheDocument()

    // Cart should be empty after success
    await waitFor(() => {
      expect(screen.queryByText("Test Product")).not.toBeInTheDocument()
    })

    // Click print button to dismiss
    fireEvent.click(screen.getByRole("button", { name: /Imprimir ticket/ }))

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("sends single-method backend-compatible paymentMethods array", async () => {
    const checkoutPort = createFakeCheckoutAdapter()
    renderTerminal([testProduct], createFakeCatalogQueryPort([testProduct]), checkoutPort)

    await resolveRow(1)
    await commitRow(1, 1)

    // Toggle "Transferencia" to activate payment method allocation
    fireEvent.click(screen.getByText("Transferencia"))

    fireEvent.click(screen.getByRole("button", { name: "Ticket no fiscal" }))

    await waitFor(() => expect(checkoutPort.save).toHaveBeenCalledTimes(1))

    const draft = checkoutPort.save.mock.calls[0][0] as CheckoutDraft
    // Backend expects allocation objects
    expect(draft.paymentMethods).toEqual([{ method: "transfer", amount: "100" }])
    expect(draft.paymentMethods).toHaveLength(1)
  })

  it("clears cart when product is removed from results grid via clearRowsForProduct", async () => {
    const checkoutPort = createFakeCheckoutAdapter()
    renderTerminal([testProduct], createFakeCatalogQueryPort([testProduct]), checkoutPort)

    await resolveRow(1)
    await commitRow(1, 1)

    expect(screen.getByText("Test Product")).toBeInTheDocument()

    // Remove via cart remove button
    fireEvent.click(screen.getByLabelText("Quitar Test Product"))

    await waitFor(() => {
      expect(screen.getByText("Carrito vacío")).toBeInTheDocument()
    })
  })
})
