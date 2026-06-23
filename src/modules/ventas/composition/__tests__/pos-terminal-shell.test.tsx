import { screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, type Mock } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { render } from "@/test/render"
import { matchesProductSearch } from "@/modules/productos"
import { PosTerminalShell } from "../pos-terminal-shell"
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

const testProduct = {
  id: "P001",
  name: "Test Product",
  category: "Bebidas",
  sku: "TEST-0001",
  price: 100,
  stock: 50,
  unit: "u",
}

function renderShell(initialProducts = [testProduct]) {
  return render(
    <SidebarProvider>
      <PosTerminalShell initialProducts={initialProducts} />
    </SidebarProvider>
  )
}

function createFakeCatalogQueryPort(products: CatalogProduct[]): CatalogQueryPort {
  return {
    async search(filters = {}) {
      return products.filter((product) => {
        const matchesSearch = !filters.search || matchesProductSearch(product, filters.search)
        return matchesSearch
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

function searchFor(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Buscar producto o SKU..."), {
    target: { value },
  })
}

function createProducts(count: number): CatalogProduct[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `P${String(i + 1).padStart(3, "0")}`,
    name: `Product ${i + 1}`,
    category: "Bebidas",
    sku: `SKU-${i + 1}`,
    price: 100,
    stock: 50,
    unit: "u",
  }))
}

describe("PosTerminalShell", () => {
  it("injects catalog and checkout ports into the presentation component", async () => {
    renderShell()

    searchFor("Test")

    expect(await screen.findByText("Test Product")).toBeInTheDocument()
  })

  it("keeps the product grid stable while updating cart state", async () => {
    renderShell()

    searchFor("Test")

    const productButton = await screen.findByText("Test Product")
    expect(productButton).toBeInTheDocument()

    fireEvent.click(productButton)

    expect(await screen.findByText("1 ítems")).toBeInTheDocument()
    expect(screen.getAllByText("Test Product").length).toBeGreaterThanOrEqual(2)
  })

  it("shows an empty state when no search is entered", async () => {
    renderShell()

    expect(await screen.findByText("Busca un producto")).toBeInTheDocument()
    expect(screen.queryByText("Test Product")).not.toBeInTheDocument()
  })

  it("does not render category navigation", async () => {
    renderShell()

    expect(screen.queryByRole("button", { name: "Bebidas" })).not.toBeInTheDocument()
  })

  it("filters products by search term", async () => {
    renderShell([
      testProduct,
      {
        id: "P002",
        name: "Another Product",
        category: "Lácteos",
        sku: "TEST-0002",
        price: 50,
        stock: 20,
        unit: "u",
      },
    ])

    searchFor("Another")

    expect(await screen.findByText("Another Product")).toBeInTheDocument()
    expect(screen.queryByText("Test Product")).not.toBeInTheDocument()
  })

  it("renders only the first page of products when results exceed the page size", async () => {
    const products = createProducts(26)
    renderTerminal(products)

    searchFor("Product")

    expect(await screen.findByText("Product 1")).toBeInTheDocument()
    expect(screen.getByText("Product 24")).toBeInTheDocument()
    expect(screen.queryByText("Product 25")).not.toBeInTheDocument()
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()
  })

  it("changes visible products when pagination controls are used", async () => {
    const products = createProducts(26)
    renderTerminal(products)

    searchFor("Product")

    expect(await screen.findByText("Product 1")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }))

    expect(await screen.findByText("Product 25")).toBeInTheDocument()
    expect(screen.getByText("Product 26")).toBeInTheDocument()
    expect(screen.queryByText("Product 1")).not.toBeInTheDocument()
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }))

    expect(await screen.findByText("Product 1")).toBeInTheDocument()
    expect(screen.getByText("Product 24")).toBeInTheDocument()
    expect(screen.queryByText("Product 25")).not.toBeInTheDocument()
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()
  })

  it("selects a payment method and completes a non-invoice checkout", async () => {
    const checkoutPort = createFakeCheckoutAdapter()
    renderTerminal([testProduct], createFakeCatalogQueryPort([testProduct]), checkoutPort)

    searchFor("Test")
    fireEvent.click(await screen.findByText("Test Product"))

    fireEvent.click(screen.getByRole("button", { name: "Efectivo" }))
    fireEvent.click(screen.getByRole("button", { name: "Ticket no fiscal" }))

    await waitFor(() => expect(checkoutPort.save).toHaveBeenCalledTimes(1))

    const draft = checkoutPort.save.mock.calls[0][0]
    expect(draft.paymentMethod).toBe("Efectivo")
    expect(draft.invoiceRequested).toBe(false)
    expect(draft.items).toHaveLength(1)
    expect(draft.items[0].productId).toBe("P001")
  })

  it("requests an invoice when Facturar is clicked", async () => {
    const checkoutPort = createFakeCheckoutAdapter()
    renderTerminal([testProduct], createFakeCatalogQueryPort([testProduct]), checkoutPort)

    searchFor("Test")
    fireEvent.click(await screen.findByText("Test Product"))

    fireEvent.click(screen.getByRole("button", { name: "Transferencia" }))
    fireEvent.click(screen.getByRole("button", { name: "Facturar" }))

    await waitFor(() => expect(checkoutPort.save).toHaveBeenCalledTimes(1))

    const draft = checkoutPort.save.mock.calls[0][0]
    expect(draft.paymentMethod).toBe("Transferencia")
    expect(draft.invoiceRequested).toBe(true)
  })
})
