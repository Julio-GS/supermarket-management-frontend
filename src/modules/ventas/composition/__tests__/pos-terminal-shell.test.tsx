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
        customer: draft.customer,
        items: draft.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: draft.subtotal,
        vat: draft.vat,
        total: draft.total,
        paymentMethod: draft.paymentMethod,
        cashier: draft.cashier,
        id: `V-${String(sequence).padStart(5, "0")}`,
        date: new Date().toISOString(),
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

function setRowQuantity(rowNumber: number, quantity: number) {
  const quantityInput = screen.getByLabelText(`Cantidad fila ${rowNumber}`)
  fireEvent.change(quantityInput, {
    target: { value: String(quantity) },
  })
  return quantityInput
}

describe("PosTerminal sales flow", () => {
  it("shows resolved row products in the cart", async () => {
    renderTerminal()

    await resolveRow(1)

    expect(screen.getByText(testProduct.name)).toBeInTheDocument()
    expect(screen.getByText("1 ítems")).toBeInTheDocument()
    expect(screen.getByLabelText("Producto fila 1")).toHaveValue(testProduct.name)
  })

  it("updates the cart when a resolved row quantity changes", async () => {
    renderTerminal()

    await resolveRow(1)
    setRowQuantity(1, 4)

    expect(screen.getByText(testProduct.name)).toBeInTheDocument()
    expect(screen.getByText(/4 u/)).toBeInTheDocument()
  })

  it("merges duplicate products selected in multiple rows", async () => {
    renderTerminal()

    await resolveRow(1)
    setRowQuantity(1, 2)

    await resolveRow(2)
    setRowQuantity(2, 3)

    expect(screen.getAllByText(testProduct.name)).toHaveLength(1)
    expect(screen.getByText(/5 u/)).toBeInTheDocument()
    expect(screen.getByText("1 ítems")).toBeInTheDocument()
  })

  it("clears the cart when a row is removed", async () => {
    renderTerminal()

    await resolveRow(1)

    fireEvent.click(screen.getByRole("button", { name: "Limpiar fila 1" }))

    expect(screen.getByText("Carrito vacío")).toBeInTheDocument()
    expect(screen.getByLabelText("Producto fila 1")).toHaveValue("")
  })

  it("saves a sale through the checkout port", async () => {
    const checkoutPort = createFakeCheckoutAdapter()
    renderTerminal([testProduct], createFakeCatalogQueryPort([testProduct]), checkoutPort)

    await resolveRow(1)
    setRowQuantity(1, 2)

    fireEvent.click(screen.getByRole("button", { name: "Efectivo" }))
    fireEvent.click(screen.getByRole("button", { name: "Facturar" }))

    await waitFor(() => expect(checkoutPort.save).toHaveBeenCalledTimes(1))

    const draft = checkoutPort.save.mock.calls[0][0]
    expect(draft.paymentMethod).toBe("Efectivo")
    expect(draft.invoiceRequested).toBe(true)
    expect(draft.items).toHaveLength(1)
    expect(draft.items[0].productId).toBe("P001")
    expect(draft.items[0].quantity).toBe(2)
  })
})
