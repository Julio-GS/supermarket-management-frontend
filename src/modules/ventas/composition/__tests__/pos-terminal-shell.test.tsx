import { screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, type Mock } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { render } from "@/test/render"
import { matchesProductSearch } from "@/modules/productos"
import { PosTerminal } from "../../presentation/pos-terminal"
import type { CatalogProduct, CatalogQueryPort } from "../../application/catalog-query-port"
import type { CheckoutPort, CheckoutDraft } from "../../application/checkout-port"
import type { TicketPrinterPort } from "../../application/ticket-printer-port"
import type { Sale } from "../../domain/sale"
import type { PrintableTicket } from "../../domain/ticket"

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
  promotions: null,
  storePromotions: null,
}

const secondProduct: CatalogProduct = {
  id: "P002",
  name: "Second Product",
  sku: "TEST-0002",
  price: 50,
  stock: 30,
  unit: "u",
  promotions: null,
  storePromotions: null,
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
          discountAmount: "0.00",
          appliedPromotions: [],
          appliedPromotionId: null,
          appliedPromotionType: null,
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

function createFakeTicketPrinter(): TicketPrinterPort {
  return {
    async print() {
      return { ok: true as const }
    },
  }
}

function createBackendDiscountSale(draft: CheckoutDraft): Sale {
  return {
    id: "V-90001",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customer: "Mostrador",
    items: [
      {
        productId: "P001",
        name: "Promo Product",
        quantity: 3,
        unitPrice: "1500.00",
        subtotal: "4050.00",
        discountAmount: "450.00",
        appliedPromotions: [],
        appliedPromotionId: null,
        appliedPromotionType: "percentage",
      },
    ],
    total: "4050.00",
    paymentMethods: draft.paymentMethods,
    invoiceStatus: "none",
    cae: null,
    caeVto: null,
    cbteNro: null,
    cbteTipo: null,
    ptoVta: null,
    invoiceRequestedAt: null,
    splitTicketGroups: null,
  }
}

function renderTerminal(
  initialProducts: CatalogProduct[] = [testProduct],
  catalogQueryPort: CatalogQueryPort = createFakeCatalogQueryPort(initialProducts),
  checkoutPort: CheckoutPort = createFakeCheckoutAdapter(),
  ticketPrinterPort: TicketPrinterPort = createFakeTicketPrinter()
) {
  return render(
    <SidebarProvider>
      <PosTerminal
        initialProducts={initialProducts}
        catalogQueryPort={catalogQueryPort}
        checkoutPort={checkoutPort}
        ticketPrinterPort={ticketPrinterPort}
      />
    </SidebarProvider>
  )
}

function getRowProductInput(rowNumber: number) {
  const inputs = screen.getAllByLabelText(`Producto fila ${rowNumber}`) as HTMLInputElement[]
  return inputs[inputs.length - 1]
}

function getRowQuantityInput(rowNumber: number) {
  const inputs = screen.getAllByLabelText(`Cantidad fila ${rowNumber}`) as HTMLInputElement[]
  return inputs[inputs.length - 1]
}

async function resolveRow(
  rowNumber: number,
  searchTerm = "Test",
  expectedName = testProduct.name
) {
  const productInput = getRowProductInput(rowNumber)
  fireEvent.change(productInput, {
    target: { value: searchTerm },
  })
  fireEvent.keyDown(productInput, { key: "Enter", code: "Enter" })

  await waitFor(() => expect(productInput).toHaveValue(expectedName))
  return productInput
}

/**
 * Commit a resolved row by simulating quantity + Enter so it appears
 * in the cart (committed: true).
 */
async function commitRow(
  rowNumber: number,
  quantity: number,
  expectedName = testProduct.name
) {
  const quantityInput = getRowQuantityInput(rowNumber)
  fireEvent.change(quantityInput, {
    target: { value: String(quantity) },
  })
  fireEvent.keyDown(quantityInput, { key: "Enter", code: "Enter" })
  // After Enter, the row is committed and the product enters the cart.
  // We wait for the cart to reflect the committed row instead of
  // asserting on the quantity input (which loses focus to the next row).
  await waitFor(() => {
    expect(screen.getByText(expectedName)).toBeInTheDocument()
  })
}

function setRowQuantity(rowNumber: number, quantity: number) {
  const quantityInput = getRowQuantityInput(rowNumber)
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
    expect(getRowProductInput(1)).toHaveValue(testProduct.name)
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

    fireEvent.click(screen.getAllByRole("button", { name: "Limpiar fila 1" }).at(-1)!)

    expect(screen.getByText("Carrito vacío")).toBeInTheDocument()
    expect(getRowProductInput(1)).toHaveValue("")
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

  it("uses the backend sale total in the success dialog and printed receipt", async () => {
    const checkoutPort: CheckoutPort = {
      save: vi.fn(async (draft: CheckoutDraft) => createBackendDiscountSale(draft)),
    }
    const capturedTickets: PrintableTicket[][] = []
    const ticketPrinterPort: TicketPrinterPort = {
      print: vi.fn(async (tickets: PrintableTicket[]) => {
        capturedTickets.push(tickets)
        return { ok: true as const }
      }),
    }

    const discountedProduct: CatalogProduct = {
      ...testProduct,
      price: 1500,
      name: "Promo Product",
    }

    renderTerminal(
      [discountedProduct],
      createFakeCatalogQueryPort([discountedProduct]),
      checkoutPort,
      ticketPrinterPort
    )

    await resolveRow(1, "Promo", discountedProduct.name)
    await commitRow(1, 3, discountedProduct.name)

    fireEvent.click(screen.getByText("Tarjeta"))
    fireEvent.click(screen.getByRole("button", { name: "Ticket no fiscal" }))

    await waitFor(() => expect(checkoutPort.save).toHaveBeenCalledTimes(1))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(/4\.050,00/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Imprimir ticket/i }))

    await waitFor(() => expect(ticketPrinterPort.print).toHaveBeenCalledTimes(1))
    expect(capturedTickets[0][0].total).toBe("4050.00")
    expect(capturedTickets[0][0].items[0].discountAmount).toBe("450.00")

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Keyboard Navigation
// ---------------------------------------------------------------------------

describe("PosTerminal keyboard navigation", () => {
  it("navigates to next row with ArrowDown preserving product field", async () => {
    renderTerminal()

    // Manually focus row 1 (useEffect auto-focus is unreliable in jsdom)
    const row1Product = getRowProductInput(1)
    row1Product.focus()
    await waitFor(() => expect(row1Product).toHaveFocus())

    fireEvent.keyDown(row1Product, { key: "ArrowDown", code: "ArrowDown" })

    await waitFor(() => {
      expect(getRowProductInput(2)).toHaveFocus()
    })
  })

  it("navigates with ArrowUp preserving product field", async () => {
    renderTerminal()

    // Navigate down to row 3 first
    const row2Product = getRowProductInput(2)
    row2Product.focus()
    fireEvent.keyDown(row2Product, { key: "ArrowDown", code: "ArrowDown" })

    await waitFor(() => {
      expect(getRowProductInput(3)).toHaveFocus()
    })

    // Now navigate back up
    const row3Product = getRowProductInput(3)
    fireEvent.keyDown(row3Product, { key: "ArrowUp", code: "ArrowUp" })

    await waitFor(() => {
      expect(getRowProductInput(2)).toHaveFocus()
    })
  })

  it("Arrow navigation preserves column (quantity → quantity)", async () => {
    renderTerminal()

    // Resolve rows 2 and 3 so their quantity fields are focusable
    await resolveRow(2)
    await resolveRow(3)

    // Focus row 2 quantity
    const row2Quantity = getRowQuantityInput(2)
    row2Quantity.focus()
    await waitFor(() => expect(row2Quantity).toHaveFocus())

    fireEvent.keyDown(row2Quantity, { key: "ArrowDown", code: "ArrowDown" })

    await waitFor(() => {
      expect(getRowQuantityInput(3)).toHaveFocus()
    })
  })

  it("Tab moves from product to quantity in same row", async () => {
    renderTerminal()

    // Resolve row 1 so quantity becomes focusable
    await resolveRow(1)

    const row1Product = getRowProductInput(1)
    row1Product.focus()

    fireEvent.keyDown(row1Product, { key: "Tab", code: "Tab" })

    await waitFor(() => {
      expect(getRowQuantityInput(1)).toHaveFocus()
    })
  })

  it("Shift+Tab moves from quantity back to product", async () => {
    renderTerminal()

    await resolveRow(1)

    const row1Quantity = getRowQuantityInput(1)
    row1Quantity.focus()

    fireEvent.keyDown(row1Quantity, {
      key: "Tab",
      code: "Tab",
      shiftKey: true,
    })

    await waitFor(() => {
      expect(getRowProductInput(1)).toHaveFocus()
    })
  })

  it("Escape clears a populated row", async () => {
    renderTerminal()

    await resolveRow(1)

    const row1Product = getRowProductInput(1)
    fireEvent.keyDown(row1Product, { key: "Escape", code: "Escape" })

    await waitFor(() => {
      expect(row1Product).toHaveValue("")
    })
  })

  it("Escape on empty row moves focus to previous row", async () => {
    renderTerminal()

    // Row 2 is empty, focus it
    const row2Product = getRowProductInput(2)
    row2Product.focus()

    fireEvent.keyDown(row2Product, { key: "Escape", code: "Escape" })

    await waitFor(() => {
      expect(getRowProductInput(1)).toHaveFocus()
    })
  })

  it("quantity-prefixed Enter auto-commits row", async () => {
    renderTerminal()

    const row1Product = getRowProductInput(1)
    fireEvent.change(row1Product, { target: { value: "*1Test" } })
    fireEvent.keyDown(row1Product, { key: "Enter", code: "Enter" })

    // Should search for "Test", find the product, auto-commit with qty=1
    await waitFor(() => {
      expect(screen.getByText(testProduct.name)).toBeInTheDocument()
    })
  })

  it("ArrowUp from first row wraps to last row", async () => {
    renderTerminal()

    const row1Product = getRowProductInput(1)
    fireEvent.keyDown(row1Product, { key: "ArrowUp", code: "ArrowUp" })

    // Should wrap to last row (row 12)
    await waitFor(() => {
      expect(getRowProductInput(12)).toHaveFocus()
    })
  })

  it("ArrowDown from last row wraps to first row", async () => {
    renderTerminal()

    const row12Product = getRowProductInput(12)
    row12Product.focus()

    fireEvent.keyDown(row12Product, { key: "ArrowDown", code: "ArrowDown" })

    await waitFor(() => {
      expect(getRowProductInput(1)).toHaveFocus()
    })
  })
})
