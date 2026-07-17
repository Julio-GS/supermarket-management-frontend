import { describe, expect, it, vi } from "vitest"
import { render } from "@/test/render"
import type { Product } from "../../domain/product"
import { stockRepository } from "../../infrastructure/stock-repository-instance"

const productsTableSpy = vi.fn((props: unknown) => {
  void props
  return <div data-testid="products-table" />
})

vi.mock("../../presentation/products-table", () => ({
  ProductsTable: (props: unknown) => productsTableSpy(props),
}))

import { ProductsTableShell } from "../products-table-shell"

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "P001",
    sku: "TEST-0001",
    name: "Test Product",
    price: 100,
    cost: 60,
    manejaStock: true,
    stock: 50,
    stockMinimum: 20,
    unit: "u",
    supplier: "Test Supplier",
    promotions: null,
    storePromotions: null,
    ...overrides,
  }
}

describe("ProductsTableShell", () => {
  it("passes the concrete stock repository into the presentation component", () => {
    render(<ProductsTableShell initialProducts={[makeProduct()]} />)

    expect(productsTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stockRepository,
        initialProducts: [expect.objectContaining({ id: "P001" })],
      })
    )
  })
})
