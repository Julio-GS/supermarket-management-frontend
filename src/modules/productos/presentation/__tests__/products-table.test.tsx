import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor, fireEvent, within } from "@testing-library/react"
import { render } from "@/test/render"
import { ProductsTable } from "../products-table"
import type { ProductListQuery, ProductPage, ProductRepository } from "../../application/product-repository"
import type { CreateProductInput, Product, UpdateProductInput } from "../../domain/product"
import { matchesProductSearch } from "../../domain/product-search"
import { toast } from "sonner"

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

vi.mock("sonner", async () => {
  const actual = await vi.importActual<typeof import("sonner")>("sonner")
  return {
    ...actual,
    toast: {
      ...actual.toast,
      error: vi.fn(),
      success: vi.fn(),
    },
  }
})

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "P001",
    name: "Manzana Roja",
    sku: "FRV-0001",
    price: 1.2,
    cost: 0.72,
        manejaStock: true,
    stock: 50,
    stockMinimum: 20,
    unit: "kg",
    supplier: "Test",
    promotions: null,
    storePromotions: null,
    ...overrides,
  }
}

function makeProducts(count: number): Product[] {
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1
    return {
      id: `P${String(position).padStart(3, "0")}`,
      name: `Producto ${position}`,
      sku: `SKU-${position}`,
      price: 1,
      cost: 0.6,
      manejaStock: true,
          stock: 10,
      stockMinimum: 20,
      unit: "u",
      supplier: "Test",
    promotions: null,
    storePromotions: null,
    }
  })
}

const INVALID_PRICE_MESSAGE = "El precio debe ser un número mayor o igual a cero"

function toPage(products: Product[], query: ProductListQuery = {}): ProductPage {
  const page = query.page ?? 1
  const limit = (query.limit ?? products.length) || 1
  const start = (page - 1) * limit
  const totalPages = Math.max(1, Math.ceil(products.length / limit))

  return {
    products: products.slice(start, start + limit),
    meta: {
      page,
      limit,
      total: products.length,
      totalPages,
      hasNext: page < totalPages,
    },
  }
}

function createMemoryRepository(initial: Product[] = []): ProductRepository {
  let products = [...initial]

  return {
    async list(query = {}) {
      const search = query.search?.trim()
      const filteredProducts = search
        ? products.filter((product) => matchesProductSearch(product, search))
        : products

      return toPage(filteredProducts, query)
    },
    async findByCode(_code: string) {
      return null
    },
    async create(input: CreateProductInput) {
      const product: Product = {
        id: `P${String(products.length + 1).padStart(3, "0")}`,
        name: input.name,
        sku: input.sku,
        price: input.price,
        cost: Number((input.price * 0.6).toFixed(2)),
        manejaStock: input.manejaStock,
            stock: input.manejaStock ? 0 : null,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test Supplier",
    promotions: null,
    storePromotions: null,
      }
      products = [product, ...products]
      return product
    },
    async update(input: UpdateProductInput) {
      products = products.map((p) =>
        p.id === input.id
          ? {
              ...p,
              name: input.name,
              sku: input.sku,
              price: input.price,
              cost: Number((input.price * 0.6).toFixed(2)),
            }
          : p
      )
      const updated = products.find((p) => p.id === input.id)
      if (!updated) throw new Error(`Product ${input.id} not found`)
      return updated
    },
    async delete(id: string) {
      products = products.filter((p) => p.id !== id)
    },
  }
}

describe("ProductsTable", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
  })

  it("does not render a category column and opens the edit dialog prefilled", async () => {
    const repository = createMemoryRepository([makeProduct()])

    render(<ProductsTable repository={repository} initialProducts={[makeProduct()]} />)

    expect(screen.queryByRole("columnheader", { name: "Categoría" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Editar Manzana Roja"))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Editar producto")).toBeInTheDocument()
    expect(screen.getByLabelText("Nombre del producto")).toHaveValue("Manzana Roja")
    expect(screen.getByLabelText("Código SKU")).toHaveValue("FRV-0001")
    expect(screen.getByLabelText("Precio ($)")).toHaveValue(1.2)
  })

  it("renders promotion badges for percentage and 2x1 products", () => {
    const repository = createMemoryRepository([
      makeProduct({
        id: "P001",
        name: "Manzana Roja",
        promotions: [
          {
            id: "promo-1",
            name: "Promo 10%",
            description: "Promo 10%",
            scope: "product" as const,
            type: "percentage" as const,
            discountPercent: 10,
            startDate: null,
            endDate: null,
            weekdays: null,
          },
        ],
      }),
      makeProduct({
        id: "P002",
        name: "Combo gaseosa",
        sku: "COM-0001",
        promotions: [
          {
            id: "promo-2",
            name: "2x1",
            description: "2x1",
            scope: "product" as const,
            type: "two_x_one" as const,
            discountPercent: null,
            startDate: null,
            endDate: null,
            weekdays: null,
          },
        ],
      }),
    ])

    render(
      <ProductsTable
        repository={repository}
        initialProducts={[
          makeProduct({
            id: "P001",
            name: "Manzana Roja",
            promotions: [
              {
                id: "promo-1",
                name: "Promo 10%",
                description: "Promo 10%",
                scope: "product" as const,
                type: "percentage" as const,
                discountPercent: 10,
                startDate: null,
                endDate: null,
                weekdays: null,
              },
            ],
          }),
          makeProduct({
            id: "P002",
            name: "Combo gaseosa",
            sku: "COM-0001",
            promotions: [
              {
                id: "promo-2",
                name: "2x1",
                description: "2x1",
                scope: "product" as const,
                type: "two_x_one" as const,
                discountPercent: null,
                startDate: null,
                endDate: null,
                weekdays: null,
              },
            ],
          }),
        ]}
      />
    )

    expect(screen.getByText("10% OFF")).toBeInTheDocument()
    expect(screen.getByText("2x1")).toBeInTheDocument()
  })

  it("does not render a promotion badge when the product has no promotions", () => {
    const repository = createMemoryRepository([
      makeProduct({
        id: "P003",
        name: "Sin promoción",
        promotions: null,
      }),
    ])

    render(
      <ProductsTable
        repository={repository}
        initialProducts={[
          makeProduct({
            id: "P003",
            name: "Sin promoción",
            promotions: null,
          }),
        ]}
      />
    )

    expect(screen.getByText("Sin promoción")).toBeInTheDocument()
    expect(screen.queryByText("10% OFF")).not.toBeInTheDocument()
    expect(screen.queryByText("2x1")).not.toBeInTheDocument()
  })

  it("calls the repository update when saving the edit dialog", async () => {
    const repository = createMemoryRepository([makeProduct()])
    const updateSpy = vi.spyOn(repository, "update")

    render(<ProductsTable repository={repository} initialProducts={[makeProduct()]} />)

    fireEvent.click(screen.getByLabelText("Editar Manzana Roja"))
    await screen.findByRole("dialog")

    fireEvent.change(screen.getByLabelText("Nombre del producto"), {
      target: { value: "Manzana Verde" },
    })
    fireEvent.change(screen.getByLabelText("Código SKU"), {
      target: { value: "FRV-0002" },
    })
    fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "1.5" } })

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        id: "P001",
        name: "Manzana Verde",
        sku: "FRV-0002",
        price: 1.5,
        manejaStock: true,
      })
    })

    // Wait for edit dialog to close so product name text is unambiguous
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    // Scope to table body to avoid the hidden print-label area matching product name too
    const tableBody = screen.getByRole("table").querySelector("tbody")!
    expect(within(tableBody).getByText("Manzana Verde")).toBeInTheDocument()
    expect(within(tableBody).getByText("FRV-0002")).toBeInTheDocument()
  })

  it("creates products without category fields", async () => {
    const repository = createMemoryRepository()
    const createSpy = vi.spyOn(repository, "create")

    render(<ProductsTable repository={repository} />)

    fireEvent.click(screen.getByRole("button", { name: "Nuevo producto" }))
    await screen.findByRole("dialog")

    expect(screen.queryByLabelText("Categoría")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nombre del producto"), {
      target: { value: "Nuevo producto" },
    })
    fireEvent.change(screen.getByLabelText("Código SKU"), {
      target: { value: "NUE-0001" },
    })
        fireEvent.click(screen.getByLabelText("Controla stock"))
    fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "2.5" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        name: "Nuevo producto",
        sku: "NUE-0001",
        price: 2.5,
        manejaStock: true,
      })
    })
  })

  it("disables the create button while a product create is pending", async () => {
    const gate = deferred<Product>()
    const repository = createMemoryRepository()
    const createSpy = vi.spyOn(repository, "create").mockImplementation(async (input) => gate.promise.then(() => ({
      id: "P999",
      name: input.name,
      sku: input.sku,
      price: input.price,
      cost: Number((input.price * 0.6).toFixed(2)),
      manejaStock: input.manejaStock,
      stock: input.manejaStock ? 0 : null,
      stockMinimum: 20,
      unit: "u",
      supplier: "Deferred Supplier",
      promotions: null,
      storePromotions: null,
    })))

    render(<ProductsTable repository={repository} />)

    fireEvent.click(screen.getByRole("button", { name: "Nuevo producto" }))
    await screen.findByRole("dialog")

    fireEvent.change(screen.getByLabelText("Nombre del producto"), {
      target: { value: "Nuevo producto" },
    })
    fireEvent.change(screen.getByLabelText("Código SKU"), {
      target: { value: "NUE-0001" },
    })
    fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "2.5" } })

    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Guardar producto" })).toBeDisabled()
      expect(createSpy).toHaveBeenCalledTimes(1)
    })

    gate.resolve(makeProduct({
      id: "P999",
      name: "Nuevo producto",
      sku: "NUE-0001",
      price: 2.5,
      cost: 1.5,
      stock: 0,
    }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("shows the expected invalid-price message and does not call create when saving the create dialog with a negative price", async () => {
    const repository = createMemoryRepository()
    const createSpy = vi.spyOn(repository, "create")

    render(<ProductsTable repository={repository} initialProducts={[]} />)

    fireEvent.click(screen.getByRole("button", { name: "Nuevo producto" }))
    await screen.findByRole("dialog")

    fireEvent.change(screen.getByLabelText("Nombre del producto"), {
      target: { value: "Producto inválido" },
    })
    fireEvent.change(screen.getByLabelText("Código SKU"), {
      target: { value: "INV-0001" },
    })
    fireEvent.change(screen.getByLabelText("Precio ($)"), {
      target: { value: "-5" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(INVALID_PRICE_MESSAGE)
    })
    expect(createSpy).not.toHaveBeenCalled()
  })

  it("shows the expected invalid-price message and does not call update when saving the edit dialog with a negative price", async () => {
    const repository = createMemoryRepository([makeProduct()])
    const updateSpy = vi.spyOn(repository, "update")

    render(<ProductsTable repository={repository} initialProducts={[makeProduct()]} />)

    fireEvent.click(screen.getByLabelText("Editar Manzana Roja"))
    await screen.findByRole("dialog")

    fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "-1" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(INVALID_PRICE_MESSAGE)
    })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it("surfaces backend update failures in the edit flow", async () => {
    const repository = createMemoryRepository([makeProduct()])
    vi.spyOn(repository, "update").mockRejectedValue(new Error("Backend rejected the update"))

    render(<ProductsTable repository={repository} initialProducts={[makeProduct()]} />)

    fireEvent.click(screen.getByLabelText("Editar Manzana Roja"))
    await screen.findByRole("dialog")

    fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "1.5" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Backend rejected the update")
    })
  })

  it("renders a large catalog using pagination (no virtualization)", () => {
    const products = makeProducts(150)
    const repository = createMemoryRepository(products)

    render(<ProductsTable repository={repository} initialProducts={products} />)

    // Pagination controls appear when there are multiple pages
    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Página 1 de 2")
    // All rows are rendered normally (no virtualization breaking layout)
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1)
  })

  it("resets pagination when the search term changes", async () => {
    const products = makeProducts(250)
    const repository = createMemoryRepository(products)

    render(<ProductsTable repository={repository} initialProducts={products} />)

    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Página 1 de 3")

    fireEvent.click(screen.getByRole("button", { name: "Última página" }))

    await waitFor(() => {
      expect(screen.getByTestId("pagination-info")).toHaveTextContent("Página 3 de 3")
      expect(screen.getByText("Producto 201")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText("Buscar por nombre o SKU"), {
      target: { value: "Producto 50" },
    })

    expect(await screen.findByText("Producto 50")).toBeInTheDocument()
    expect(screen.queryByTestId("pagination-info")).not.toBeInTheDocument()
  })

      // ── Manual stock adjustment row action ────────────────────

      it("shows an adjust-stock action for stock-managed products", () => {
        const product = makeProduct({ manejaStock: true, stock: 10, name: "Stock Product" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        expect(screen.getByLabelText(/ajustar stock de Stock Product/i)).toBeInTheDocument()
      })

      it("does not show an adjust-stock action for non-stock products", () => {
        const product = makeProduct({
          manejaStock: false,
          stock: null,
          name: "Non-Stock Product",
        })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        expect(
          screen.queryByLabelText(/ajustar stock de Non-Stock Product/i)
        ).not.toBeInTheDocument()
      })
})

// ── Loose label printing ────────────────────────────────────────

describe("ProductsTable — loose label printing", () => {
  it("enqueues a label via the printer icon without calling repository.update", async () => {
    const product = makeProduct({ id: "P001", name: "Manzana", price: 120 })
    // Spy on the update method of the repository
    const baseRepo = createMemoryRepository([product])
    const updateSpy = vi.spyOn(baseRepo, "update")

    render(<ProductsTable repository={baseRepo} initialProducts={[product]} />)
    await screen.findByText("Manzana")

    // Click the printer icon button
    const printButton = screen.getByLabelText("Imprimir etiqueta de Manzana")
    fireEvent.click(printButton)

    // Label queue should have one entry — the "pendiente" button should appear
    await screen.findByText(/1 etiqueta pendiente/)

    // repository.update MUST NOT have been called
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
