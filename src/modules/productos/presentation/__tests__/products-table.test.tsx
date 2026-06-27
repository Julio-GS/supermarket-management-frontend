import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { ProductsTable } from "../products-table"
import type { ProductListQuery, ProductPage, ProductRepository } from "../../application/product-repository"
import type { CreateProductInput, Product, UpdateProductInput } from "../../domain/product"
import { matchesProductSearch } from "../../domain/product-search"
import { toast } from "sonner"

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
    stock: 50,
    stockMinimum: 20,
    unit: "kg",
    supplier: "Test",
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
      stock: 10,
      stockMinimum: 20,
      unit: "u",
      supplier: "Test",
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
    async create(input: CreateProductInput) {
      const product: Product = {
        id: `P${String(products.length + 1).padStart(3, "0")}`,
        name: input.name,
        sku: input.sku,
        price: input.price,
        cost: Number((input.price * 0.6).toFixed(2)),
        stock: input.stock,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test Supplier",
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
      })
    })

    await waitFor(() => {
      expect(screen.getByText("Manzana Verde")).toBeInTheDocument()
      expect(screen.getByText("FRV-0002")).toBeInTheDocument()
    })
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
    fireEvent.change(screen.getByLabelText("Precio ($)"), { target: { value: "2.5" } })
    fireEvent.change(screen.getByLabelText("Stock inicial"), { target: { value: "10" } })

    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        name: "Nuevo producto",
        sku: "NUE-0001",
        price: 2.5,
        stock: 10,
      })
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
    fireEvent.change(screen.getByLabelText("Stock inicial"), {
      target: { value: "10" },
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

  it("renders a large catalog using virtualization", () => {
    const products = makeProducts(150)
    const repository = createMemoryRepository(products)

    render(<ProductsTable repository={repository} initialProducts={products} />)

    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Página 1 de 2")
    expect(screen.getAllByRole("row").length).toBeLessThan(products.length)
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

    fireEvent.change(screen.getByPlaceholderText("Buscar por nombre o SKU"), {
      target: { value: "Producto 50" },
    })

    expect(await screen.findByText("Producto 50")).toBeInTheDocument()
    expect(screen.queryByTestId("pagination-info")).not.toBeInTheDocument()
  })
})
