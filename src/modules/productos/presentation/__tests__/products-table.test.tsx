import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, waitFor, fireEvent } from "@testing-library/react"
import { render } from "@/test/render"
import { ProductsTable } from "../products-table"
import { categories } from "../../domain/category"
import type { ProductRepository } from "../../application/product-repository"
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

function createMemoryRepository(initial: Product[] = []): ProductRepository {
  let products = [...initial]

  return {
    async list() {
      return products
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
    async list() {
      return initial
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
