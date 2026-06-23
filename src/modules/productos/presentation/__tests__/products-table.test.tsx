import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { ProductsTable } from "../products-table"
import { categories } from "../../domain/category"
import type { ProductListQuery, ProductPage, ProductRepository } from "../../application/product-repository"
import type { CreateProductInput, Product, UpdateProductInput } from "../../domain/product"
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
      return toPage(products, query)
    },
    async create(input: CreateProductInput) {
      const product: Product = {
        id: `P${String(products.length + 1).padStart(3, "0")}`,
        name: input.name,
        category: input.category,
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

function createFailingRepository(error: Error, initial: Product[] = []): ProductRepository {
  return {
    async list(query = {}) {
      return toPage(initial, query)
    },
    async create() {
      throw error
    },
    async update() {
      throw error
    },
    async delete() {
      throw error
    },
  }
}

describe("ProductsTable", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
  })
  it("opens the edit dialog prefilled with the selected product values", async () => {
    const repository = createMemoryRepository([
      {
        id: "P001",
        name: "Manzana Roja",
        category: categories[0],
        sku: "FRV-0001",
        price: 1.2,
        cost: 0.72,
        stock: 50,
        stockMinimum: 20,
        unit: "kg",
        supplier: "Test",
      },
    ])

    render(
      <ProductsTable
        repository={repository}
        initialProducts={[
          {
            id: "P001",
            name: "Manzana Roja",
            category: categories[0],
            sku: "FRV-0001",
            price: 1.2,
            cost: 0.72,
            stock: 50,
            stockMinimum: 20,
            unit: "kg",
            supplier: "Test",
          },
        ]}
      />
    )

    fireEvent.click(screen.getByLabelText("Editar Manzana Roja"))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Editar producto")).toBeInTheDocument()
    expect(screen.getByLabelText("Nombre del producto")).toHaveValue("Manzana Roja")
    expect(screen.getByLabelText("Código SKU")).toHaveValue("FRV-0001")
    expect(screen.getByLabelText("Precio ($)")).toHaveValue(1.2)
  })

  it("calls the repository update when saving the edit dialog", async () => {
    const repository = createMemoryRepository([
      {
        id: "P001",
        name: "Manzana Roja",
        category: categories[0],
        sku: "FRV-0001",
        price: 1.2,
        cost: 0.72,
        stock: 50,
        stockMinimum: 20,
        unit: "kg",
        supplier: "Test",
      },
    ])
    const updateSpy = vi.spyOn(repository, "update")

    render(
      <ProductsTable
        repository={repository}
        initialProducts={[
          {
            id: "P001",
            name: "Manzana Roja",
            category: categories[0],
            sku: "FRV-0001",
            price: 1.2,
            cost: 0.72,
            stock: 50,
            stockMinimum: 20,
            unit: "kg",
            supplier: "Test",
          },
        ]}
      />
    )

    fireEvent.click(screen.getByLabelText("Editar Manzana Roja"))
    await screen.findByRole("dialog")

    const nameInput = screen.getByLabelText("Nombre del producto")
    fireEvent.change(nameInput, { target: { value: "Manzana Verde" } })

    const skuInput = screen.getByLabelText("Código SKU")
    fireEvent.change(skuInput, { target: { value: "FRV-0002" } })

    const priceInput = screen.getByLabelText("Precio ($)")
    fireEvent.change(priceInput, { target: { value: "1.5" } })

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
      expect(screen.getByText(categories[0])).toBeInTheDocument()
    })
  })

  it("shows an error toast and does not call update when saving the edit dialog with a negative price", async () => {
    const repository = createMemoryRepository([
      {
        id: "P001",
        name: "Manzana Roja",
        category: categories[0],
        sku: "FRV-0001",
        price: 1.2,
        cost: 0.72,
        stock: 50,
        stockMinimum: 20,
        unit: "kg",
        supplier: "Test",
      },
    ])
    const updateSpy = vi.spyOn(repository, "update")

    render(
      <ProductsTable
        repository={repository}
        initialProducts={[
          {
            id: "P001",
            name: "Manzana Roja",
            category: categories[0],
            sku: "FRV-0001",
            price: 1.2,
            cost: 0.72,
            stock: 50,
            stockMinimum: 20,
            unit: "kg",
            supplier: "Test",
          },
        ]}
      />
    )

    fireEvent.click(screen.getByLabelText("Editar Manzana Roja"))
    await screen.findByRole("dialog")

    const priceInput = screen.getByLabelText("Precio ($)")
    fireEvent.change(priceInput, { target: { value: "-1" } })

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("El precio debe ser un número mayor o igual a cero")
    })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it("shows an error toast and does not call create when saving the create dialog with a negative price", async () => {
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
      expect(toast.error).toHaveBeenCalledWith("El precio debe ser un número mayor o igual a cero")
    })
    expect(createSpy).not.toHaveBeenCalled()
  })

  it("renders a large catalog using virtualization", () => {
    const repository = createMemoryRepository(
      Array.from({ length: 150 }, (_, i) => ({
        id: `P${String(i + 1).padStart(3, "0")}`,
        name: `Producto ${i + 1}`,
        category: categories[0],
        sku: `SKU-${i + 1}`,
        price: 1,
        cost: 0.6,
        stock: 10,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test",
      }))
    )

    render(
      <ProductsTable
        repository={repository}
        initialProducts={Array.from({ length: 150 }, (_, i) => ({
          id: `P${String(i + 1).padStart(3, "0")}`,
          name: `Producto ${i + 1}`,
          category: categories[0],
          sku: `SKU-${i + 1}`,
          price: 1,
          cost: 0.6,
          stock: 10,
          stockMinimum: 20,
          unit: "u",
          supplier: "Test",
        }))}
      />
    )

    const rows = screen.getAllByRole("row")
    expect(rows.length).toBeLessThan(150)
  })

  it("does not render pagination when the catalog fits on one page", () => {
    const repository = createMemoryRepository(
      Array.from({ length: 50 }, (_, i) => ({
        id: `P${String(i + 1).padStart(3, "0")}`,
        name: `Producto ${i + 1}`,
        category: categories[0],
        sku: `SKU-${i + 1}`,
        price: 1,
        cost: 0.6,
        stock: 10,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test",
      }))
    )

    render(
      <ProductsTable
        repository={repository}
        initialProducts={Array.from({ length: 50 }, (_, i) => ({
          id: `P${String(i + 1).padStart(3, "0")}`,
          name: `Producto ${i + 1}`,
          category: categories[0],
          sku: `SKU-${i + 1}`,
          price: 1,
          cost: 0.6,
          stock: 10,
          stockMinimum: 20,
          unit: "u",
          supplier: "Test",
        }))}
      />
    )

    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument()
  })

  it("paginates the catalog and navigates between pages", async () => {
    const repository = createMemoryRepository(
      Array.from({ length: 250 }, (_, i) => ({
        id: `P${String(i + 1).padStart(3, "0")}`,
        name: `Producto ${i + 1}`,
        category: categories[0],
        sku: `SKU-${i + 1}`,
        price: 1,
        cost: 0.6,
        stock: 10,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test",
      }))
    )

    render(
      <ProductsTable
        repository={repository}
        initialProducts={Array.from({ length: 250 }, (_, i) => ({
          id: `P${String(i + 1).padStart(3, "0")}`,
          name: `Producto ${i + 1}`,
          category: categories[0],
          sku: `SKU-${i + 1}`,
          price: 1,
          cost: 0.6,
          stock: 10,
          stockMinimum: 20,
          unit: "u",
          supplier: "Test",
        }))}
      />
    )

    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Página 1 de 3")

    fireEvent.click(screen.getByRole("button", { name: "Última página" }))

    await waitFor(() => {
      expect(screen.getByTestId("pagination-info")).toHaveTextContent("Página 3 de 3")
      expect(screen.getByText("Producto 201")).toBeInTheDocument()
    })
  })

  it("resets to the first page when the search term changes", () => {
    const repository = createMemoryRepository(
      Array.from({ length: 250 }, (_, i) => ({
        id: `P${String(i + 1).padStart(3, "0")}`,
        name: `Producto ${i + 1}`,
        category: categories[0],
        sku: `SKU-${i + 1}`,
        price: 1,
        cost: 0.6,
        stock: 10,
        stockMinimum: 20,
        unit: "u",
        supplier: "Test",
      }))
    )

    render(
      <ProductsTable
        repository={repository}
        initialProducts={Array.from({ length: 250 }, (_, i) => ({
          id: `P${String(i + 1).padStart(3, "0")}`,
          name: `Producto ${i + 1}`,
          category: categories[0],
          sku: `SKU-${i + 1}`,
          price: 1,
          cost: 0.6,
          stock: 10,
          stockMinimum: 20,
          unit: "u",
          supplier: "Test",
        }))}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Última página" }))
    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Página 3 de 3")

    fireEvent.change(screen.getByPlaceholderText("Buscar por nombre o SKU"), {
      target: { value: "Producto 50" },
    })

    expect(screen.queryByTestId("pagination-info")).not.toBeInTheDocument()
    expect(screen.getByText("Producto 50")).toBeInTheDocument()
  })

  it("displays an error toast when the update fails", async () => {
    const repository = createFailingRepository(new Error("Backend rejected the update"), [
      {
        id: "P001",
        name: "Manzana Roja",
        category: categories[0],
        sku: "FRV-0001",
        price: 1.2,
        cost: 0.72,
        stock: 50,
        stockMinimum: 20,
        unit: "kg",
        supplier: "Test",
      },
    ])

    render(
      <ProductsTable
        repository={repository}
        initialProducts={[
          {
            id: "P001",
            name: "Manzana Roja",
            category: categories[0],
            sku: "FRV-0001",
            price: 1.2,
            cost: 0.72,
            stock: 50,
            stockMinimum: 20,
            unit: "kg",
            supplier: "Test",
          },
        ]}
      />
    )

    fireEvent.click(screen.getByLabelText("Editar Manzana Roja"))
    await screen.findByRole("dialog")

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Backend rejected the update")
    })
  })
})
