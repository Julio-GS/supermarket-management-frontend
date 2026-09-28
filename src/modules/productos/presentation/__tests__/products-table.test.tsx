import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor, fireEvent, within } from "@testing-library/react"
import { render } from "@/test/render"
import { ProductsTable } from "../products-table"
import type { ProductListQuery, ProductPage, ProductRepository } from "../../application/product-repository"
import type { CreateProductInput, Product, UpdateProductInput } from "../../domain/product"
import { matchesProductSearch } from "../../domain/product-search"
import type { LabelPrintJobsPort } from "@/modules/label-print-jobs"
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
      warning: vi.fn(),
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
    iva: 21,
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
      iva: 21,
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
              iva: input.iva,
            }
          : p
      )
      const updated = products.find((p) => p.id === input.id)
      if (!updated) throw new Error(`Product ${input.id} not found`)
      return updated
    },
    async updateStockControl(input) {
      const existing = products.find((p) => p.id === input.id)
      if (!existing) throw new Error(`Product ${input.id} not found`)
      const updated = {
        ...existing,
        manejaStock: input.manejaStock,
        stock: input.manejaStock ? (existing.stock ?? 0) : null,
      }
      products = products.map((p) => (p.id === input.id ? updated : p))
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
    vi.mocked(toast.warning).mockClear()
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
        iva: 21,
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

  it("forwards product loaded 10.5% IVA without exposing an editable IVA field in edit dialog", async () => {
    const product = makeProduct({ id: "P002", name: "Leche 10.5", price: 2.0, iva: 10.5 })
    const repository = createMemoryRepository([product])
    const updateSpy = vi.spyOn(repository, "update")

    render(<ProductsTable repository={repository} initialProducts={[product]} />)

    fireEvent.click(screen.getByLabelText("Editar Leche 10.5"))
    const dialog = await screen.findByRole("dialog")

    // The cashier never edits IVA — ensure no input for IVA exists in edit dialog
    expect(within(dialog).queryByLabelText(/alícuota/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/iva/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "2.5" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        id: "P002",
        name: "Leche 10.5",
        sku: "FRV-0001",
        price: 2.5,
        manejaStock: true,
        iva: 10.5,
      })
    })
  })

  it("shows an error toast and prevents update if product has null iva", async () => {
    const productWithoutIva = makeProduct({ id: "P003", name: "Producto Sin IVA", iva: null })
    const repository = createMemoryRepository([productWithoutIva])
    const updateSpy = vi.spyOn(repository, "update")

    render(<ProductsTable repository={repository} initialProducts={[productWithoutIva]} />)

    fireEvent.click(screen.getByLabelText("Editar Producto Sin IVA"))
    await screen.findByRole("dialog")

    fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "3.0" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("El producto no tiene una alícuota de IVA configurada.")
    })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it("shows an error toast and prevents update if product has undefined iva", async () => {
    const productWithUndefinedIva = makeProduct({ id: "P004", name: "Producto IVA Undefined", iva: undefined })
    const repository = createMemoryRepository([productWithUndefinedIva])
    const updateSpy = vi.spyOn(repository, "update")

    render(<ProductsTable repository={repository} initialProducts={[productWithUndefinedIva]} />)

    fireEvent.click(screen.getByLabelText("Editar Producto IVA Undefined"))
    await screen.findByRole("dialog")

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("El producto no tiene una alícuota de IVA configurada.")
    })
    expect(updateSpy).not.toHaveBeenCalled()
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

// ── Backend-persisted label requests ─────────────────────────────

describe("ProductsTable — backend-persisted label requests", () => {
  function makeLabelPort(overrides: Partial<LabelPrintJobsPort> = {}): LabelPrintJobsPort {
    return {
      getPendingJobs: vi.fn().mockResolvedValue([]),
      claim: vi.fn().mockResolvedValue(null),
      claimBatch: vi.fn().mockResolvedValue([]),
      claimAllForPrint: vi.fn().mockResolvedValue({ jobs: [] }),
      createJob: vi.fn().mockResolvedValue(undefined),
      completeJob: vi.fn(),
      failJob: vi.fn(),
      blockJob: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }
  }

  it("persists a loose label via createJob and refreshes pending jobs", async () => {
    const product = makeProduct({ id: "P001", name: "Manzana", sku: "FRV-0001", price: 120 })
    const repository = createMemoryRepository([product])
    const createJobSpy = vi.fn().mockResolvedValue(undefined)
    const getPendingJobsSpy = vi.fn().mockResolvedValue([])
    const labelPort = makeLabelPort({ createJob: createJobSpy, getPendingJobs: getPendingJobsSpy })

    render(<ProductsTable repository={repository} initialProducts={[product]} labelPrintJobsPort={labelPort} />)
    await screen.findByText("Manzana")
    const refreshCallsBefore = getPendingJobsSpy.mock.calls.length

    fireEvent.click(screen.getByLabelText("Imprimir etiqueta de Manzana"))

    await waitFor(() => {
      expect(createJobSpy).toHaveBeenCalledWith({
        product_id: "P001",
        sku: "FRV-0001",
        product_name: "Manzana",
        sale_price: "120.00",
      })
    })
    expect(toast.success).toHaveBeenCalled()
    await waitFor(() => {
      expect(getPendingJobsSpy.mock.calls.length).toBeGreaterThan(refreshCallsBefore)
    })
    expect(screen.queryByText(/etiqueta pendiente/)).not.toBeInTheDocument()
  })

  it("shows a visible error and does not refresh when persistence fails", async () => {
    const product = makeProduct({ id: "P001", name: "Manzana", price: 120 })
    const repository = createMemoryRepository([product])
    const createJobSpy = vi.fn().mockRejectedValue(new Error("Network error"))
    const getPendingJobsSpy = vi.fn().mockResolvedValue([])
    const labelPort = makeLabelPort({ createJob: createJobSpy, getPendingJobs: getPendingJobsSpy })

    render(<ProductsTable repository={repository} initialProducts={[product]} labelPrintJobsPort={labelPort} />)
    await screen.findByText("Manzana")
    const refreshCallsBefore = getPendingJobsSpy.mock.calls.length

    fireEvent.click(screen.getByLabelText("Imprimir etiqueta de Manzana"))

    await waitFor(() => {
      expect(createJobSpy).toHaveBeenCalled()
    })
    expect(toast.error).toHaveBeenCalled()
    expect(getPendingJobsSpy.mock.calls.length).toBe(refreshCallsBefore)
    expect(screen.queryByText(/etiqueta pendiente/)).not.toBeInTheDocument()
  })

  it("refreshes backend pending jobs on price change instead of enqueuing locally", async () => {
    const product = makeProduct({ id: "P001", name: "Priced Product", price: 100 })
    const repository = createMemoryRepository([product])
    const createJobSpy = vi.fn()
    const getPendingJobsSpy = vi.fn().mockResolvedValue([])
    const labelPort = makeLabelPort({ createJob: createJobSpy, getPendingJobs: getPendingJobsSpy })

    render(<ProductsTable repository={repository} initialProducts={[product]} labelPrintJobsPort={labelPort} />)
    await screen.findByText("Priced Product")
    const refreshCallsBefore = getPendingJobsSpy.mock.calls.length

    fireEvent.click(screen.getByLabelText("Editar Priced Product"))
    await screen.findByRole("dialog")
    fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "150" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(getPendingJobsSpy.mock.calls.length).toBeGreaterThan(refreshCallsBefore)
    })
    expect(createJobSpy).not.toHaveBeenCalled()
    expect(screen.queryByText(/etiqueta pendiente/)).not.toBeInTheDocument()
  })

  it("does not create or refresh label jobs for non-price edits", async () => {
    const product = makeProduct({ id: "P001", name: "Original Name", price: 120 })
    const repository = createMemoryRepository([product])
    const createJobSpy = vi.fn()
    const getPendingJobsSpy = vi.fn().mockResolvedValue([])
    const labelPort = makeLabelPort({ createJob: createJobSpy, getPendingJobs: getPendingJobsSpy })

    render(<ProductsTable repository={repository} initialProducts={[product]} labelPrintJobsPort={labelPort} />)
    await screen.findByText("Original Name")
    const refreshCallsBefore = getPendingJobsSpy.mock.calls.length

    fireEvent.click(screen.getByLabelText("Editar Original Name"))
    await screen.findByRole("dialog")
    fireEvent.change(screen.getByLabelText("Nombre del producto"), {
      target: { value: "Renamed Product" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    expect(createJobSpy).not.toHaveBeenCalled()
    expect(getPendingJobsSpy.mock.calls.length).toBe(refreshCallsBefore)
  })
})

    // ── Barcode scan clear ─────────────────────────────────────────

    describe("ProductsTable — barcode scan clear", () => {
      it("clears the search input after Enter when the query is an exact SKU match, keeping the matched product visible", async () => {
        const product = makeProduct({ id: "P001", name: "Manzana Roja", sku: "FRV-0001" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)
        await screen.findByText("Manzana Roja")

        const input = screen.getByLabelText("Buscar por nombre o SKU")
        fireEvent.change(input, { target: { value: "FRV-0001" } })

        await waitFor(() => {
          expect(screen.getByText("Manzana Roja")).toBeInTheDocument()
        })

        fireEvent.keyDown(input, { key: "Enter" })

        await waitFor(() => {
          expect(input).toHaveValue("")
          expect(screen.getByText("Manzana Roja")).toBeInTheDocument()
        })
      })

      it("retains the search input after Enter when the query is not an exact SKU match", async () => {
        const product = makeProduct({ id: "P001", name: "Manzana Roja", sku: "FRV-0001" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)
        await screen.findByText("Manzana Roja")

        const input = screen.getByLabelText("Buscar por nombre o SKU")
        fireEvent.change(input, { target: { value: "Manzana" } })

        await waitFor(() => {
          expect(screen.getByText("Manzana Roja")).toBeInTheDocument()
        })

        fireEvent.keyDown(input, { key: "Enter" })

        await waitFor(() => {
          expect(input).toHaveValue("Manzana")
          expect(screen.getByText("Manzana Roja")).toBeInTheDocument()
        })
      })

      it("does not clear the input during ordinary typing without Enter", async () => {
        const product = makeProduct({ id: "P001", name: "Manzana Roja", sku: "FRV-0001" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)
        await screen.findByText("Manzana Roja")

        const input = screen.getByLabelText("Buscar por nombre o SKU")
        fireEvent.change(input, { target: { value: "Manz" } })

        await waitFor(() => {
          expect(input).toHaveValue("Manz")
          expect(screen.getByText("Manzana Roja")).toBeInTheDocument()
        })
      })

      it("supports consecutive scans: first Enter clears, second scan also clears", async () => {
        const product1 = makeProduct({ id: "P001", name: "Manzana Roja", sku: "FRV-0001" })
        const product2 = makeProduct({ id: "P002", name: "Leche Entera", sku: "LAC-0011" })
        const repository = createMemoryRepository([product1, product2])

        render(<ProductsTable repository={repository} initialProducts={[product1, product2]} />)
        await screen.findByText("Manzana Roja")

        const input = screen.getByLabelText("Buscar por nombre o SKU")

        // First scan
        fireEvent.change(input, { target: { value: "FRV-0001" } })
        await waitFor(() => {
          expect(screen.getByText("Manzana Roja")).toBeInTheDocument()
        })
        fireEvent.keyDown(input, { key: "Enter" })
        await waitFor(() => {
          expect(input).toHaveValue("")
          expect(screen.getByText("Manzana Roja")).toBeInTheDocument()
        })

        // Second scan — type a different barcode
        fireEvent.change(input, { target: { value: "LAC-0011" } })
        await waitFor(() => {
          expect(screen.getByText("Leche Entera")).toBeInTheDocument()
        })
        fireEvent.keyDown(input, { key: "Enter" })
        await waitFor(() => {
          expect(input).toHaveValue("")
          expect(screen.getByText("Leche Entera")).toBeInTheDocument()
        })
      })
    })

    // ── T3: Stock-control toggle ────────────────────────────────────

    describe("ProductsTable — stock-control toggle", () => {
      it("shows a toggle-stock button for stock-managed products", () => {
        const product = makeProduct({ manejaStock: true, stock: 10, name: "Stock On" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        expect(screen.getByLabelText(/desactivar control de stock de Stock On/i)).toBeInTheDocument()
      })

      it("shows a toggle-stock button for non-stock products", () => {
        const product = makeProduct({ manejaStock: false, stock: null, name: "Stock Off" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        expect(screen.getByLabelText(/activar control de stock de Stock Off/i)).toBeInTheDocument()
      })

      it("toggles stock control off via the repository when button is clicked", async () => {
        const product = makeProduct({ id: "P001", manejaStock: true, stock: 42, name: "Toggle Me" })
        const repository = createMemoryRepository([product])
        const toggleSpy = vi.spyOn(repository, "updateStockControl")

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        fireEvent.click(screen.getByLabelText(/desactivar control de stock de Toggle Me/i))

        await waitFor(() => {
          expect(toggleSpy).toHaveBeenCalledWith({ id: "P001", manejaStock: false })
        })
      })

      it("toggles stock control on via the repository when disabled product button is clicked", async () => {
        const product = makeProduct({ id: "P002", manejaStock: false, stock: null, name: "Enable Me" })
        const repository = createMemoryRepository([product])
        const toggleSpy = vi.spyOn(repository, "updateStockControl")

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        fireEvent.click(screen.getByLabelText(/activar control de stock de Enable Me/i))

        await waitFor(() => {
          expect(toggleSpy).toHaveBeenCalledWith({ id: "P002", manejaStock: true })
        })
      })

      it("shows toast error on toggle failure and does not update UI", async () => {
        const product = makeProduct({ id: "P001", manejaStock: true, stock: 42, name: "Fail Toggle" })
        const repository = createMemoryRepository([product])
        vi.spyOn(repository, "updateStockControl").mockRejectedValue(new Error("Backend 400"))

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        fireEvent.click(screen.getByLabelText(/desactivar control de stock de Fail Toggle/i))

        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith("Backend 400")
        })
      })

      it("shows 'No controla stock' badge and N/D stock when product has manejaStock false and stock null", () => {
        const product = makeProduct({ manejaStock: false, stock: null, name: "No Stock" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        expect(screen.getByText("No controla stock")).toBeInTheDocument()
        expect(screen.getByText("N/D")).toBeInTheDocument()
      })
    })

    // ── T6: Action icon strengthening ─────────────────────────

    describe("ProductsTable — action icon strengthening (Products scope)", () => {
      it("action button SVGs have increased visual size (size-4) on products table", () => {
        const product = makeProduct({ manejaStock: true, stock: 10, name: "Icon Product" })
        const repository = createMemoryRepository([product])

        const { container } = render(<ProductsTable repository={repository} initialProducts={[product]} />)

        // Find all action buttons in the actions column (last column)
        const actionsCell = container.querySelector("tbody td:last-child")
        expect(actionsCell).not.toBeNull()

        // Each SVG inside action buttons should have size-4 class (increased from default size-3)
        const svgs = actionsCell!.querySelectorAll("svg")
        expect(svgs.length).toBeGreaterThanOrEqual(3) // Printer, Power, Pencil at minimum
        svgs.forEach((svg) => {
          expect(svg.className.baseVal || svg.getAttribute("class")).toContain("size-4")
        })
      })

      it("T3 Power toggle icon receives the same stronger treatment", () => {
        const product = makeProduct({ manejaStock: true, stock: 10, name: "Power Icon" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        const toggleButton = screen.getByLabelText(/desactivar control de stock de Power Icon/i)
        const svg = toggleButton.querySelector("svg")
        expect(svg).not.toBeNull()
        expect(svg!.className.baseVal || svg!.getAttribute("class")).toContain("size-4")
      })

      it("T4 ArrowUpDown adjust-stock icon receives the same stronger treatment", () => {
        const product = makeProduct({ manejaStock: true, stock: 10, name: "Adjust Icon" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        const adjustButton = screen.getByLabelText(/ajustar stock de Adjust Icon/i)
        const svg = adjustButton.querySelector("svg")
        expect(svg).not.toBeNull()
        expect(svg!.className.baseVal || svg!.getAttribute("class")).toContain("size-4")
      })

      it("preserves aria-labels on all action buttons after strengthening", () => {
        const product = makeProduct({ manejaStock: true, stock: 10, name: "Aria Icon" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        expect(screen.getByLabelText("Imprimir etiqueta de Aria Icon")).toBeInTheDocument()
        expect(screen.getByLabelText(/desactivar control de stock de Aria Icon/i)).toBeInTheDocument()
        expect(screen.getByLabelText("Ajustar stock de Aria Icon")).toBeInTheDocument()
        expect(screen.getByLabelText("Editar Aria Icon")).toBeInTheDocument()
      })

      it("action buttons remain enabled for interactive products", () => {
        const product = makeProduct({ manejaStock: true, stock: 10, name: "Enabled Check" })
        const repository = createMemoryRepository([product])

        render(<ProductsTable repository={repository} initialProducts={[product]} />)

        const editButton = screen.getByLabelText("Editar Enabled Check")
        expect(editButton).not.toBeDisabled()
      })
    })

    // ── Label refresh after product creation ───────────────────────

    function makeLabelPort(overrides: Partial<LabelPrintJobsPort> = {}): LabelPrintJobsPort {
      return {
        getPendingJobs: vi.fn().mockResolvedValue([]),
        claim: vi.fn().mockResolvedValue(null),
        claimBatch: vi.fn().mockResolvedValue([]),
        claimAllForPrint: vi.fn().mockResolvedValue({ jobs: [] }),
        createJob: vi.fn().mockResolvedValue(undefined),
        completeJob: vi.fn(),
        failJob: vi.fn(),
        blockJob: vi.fn().mockResolvedValue(undefined),
        ...overrides,
      }
    }

    describe("ProductsTable — label refresh after creation", () => {
      it("triggers pending-jobs refresh after successful product creation", async () => {
        const repository = createMemoryRepository()
        const getPendingJobsSpy = vi.fn().mockResolvedValue([])
        const labelPort = makeLabelPort({ getPendingJobs: getPendingJobsSpy })

        render(<ProductsTable repository={repository} labelPrintJobsPort={labelPort} />)

        await waitFor(() => {
          expect(screen.queryByText("Cargando productos...")).not.toBeInTheDocument()
        })

        const callsBeforeCreate = getPendingJobsSpy.mock.calls.length

        // Create a product via the dialog
        fireEvent.click(screen.getByRole("button", { name: "Nuevo producto" }))
        await screen.findByRole("dialog")
        fireEvent.change(screen.getByLabelText("Nombre del producto"), {
          target: { value: "Refresh Test" },
        })
        fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "100" } })
        fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }))

        await waitFor(() => {
          expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        })

        // Refresh should have triggered another getPendingJobs call
        expect(getPendingJobsSpy.mock.calls.length).toBeGreaterThan(callsBeforeCreate)

        // Normal success notification only — no failure warning on refresh success
        expect(toast.success).toHaveBeenCalled()
        expect(toast.warning).not.toHaveBeenCalled()
      })

      it("does not undo creation or close/reset when refresh fails", async () => {
        const repository = createMemoryRepository()
        const getPendingJobsSpy = vi.fn()
          .mockResolvedValueOnce([])
          .mockRejectedValueOnce(new Error("Network error"))
        const labelPort = makeLabelPort({ getPendingJobs: getPendingJobsSpy })

        render(<ProductsTable repository={repository} labelPrintJobsPort={labelPort} />)

        // Create product
        fireEvent.click(screen.getByRole("button", { name: "Nuevo producto" }))
        await screen.findByRole("dialog")
        fireEvent.change(screen.getByLabelText("Nombre del producto"), {
          target: { value: "Fail Refresh" },
        })
        fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "200" } })
        fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }))

        // Dialog MUST close — creation succeeded regardless of refresh failure
        await waitFor(() => {
          expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        })

        // Success toast should appear for the creation
        expect(toast.success).toHaveBeenCalled()
        // Distinct warning notifies the operator that label refresh failed
        expect(toast.warning).toHaveBeenCalledWith(
          "El producto se creó correctamente, pero no se pudo actualizar la cola de etiquetas pendientes. Podés reintentar el refresco más tarde."
        )
      })

      it("does not manually enqueue a label after product creation", async () => {
        const repository = createMemoryRepository()
        const labelPort = makeLabelPort()

        render(<ProductsTable repository={repository} labelPrintJobsPort={labelPort} />)

        // Create product
        fireEvent.click(screen.getByRole("button", { name: "Nuevo producto" }))
        await screen.findByRole("dialog")
        fireEvent.change(screen.getByLabelText("Nombre del producto"), {
          target: { value: "No Enqueue" },
        })
        fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "300" } })
        fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }))

        await waitFor(() => {
          expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        })

        // No manual label enqueue — no "etiqueta pendiente" indicator should appear
        expect(screen.queryByText(/etiqueta pendiente/)).not.toBeInTheDocument()
      })
    })
