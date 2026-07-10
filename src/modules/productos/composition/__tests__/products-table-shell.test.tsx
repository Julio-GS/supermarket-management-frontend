import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { render } from "@/test/render"
import { ProductsTableShell } from "../products-table-shell"

describe("ProductsTableShell", () => {
  it("injects the product repository into the presentation component", () => {
    render(
      <ProductsTableShell
        initialProducts={[
          {
            id: "P001",
            sku: "TEST-0001",
            name: "Test Product",
            price: 100,
            cost: 60,
            stock: 50,
            stockMinimum: 20,
            unit: "u",
            supplier: "Test Supplier",
    promotions: null,
    storePromotions: null,
          },
        ]}
      />
    )

    expect(screen.getByText("Test Product")).toBeInTheDocument()
    expect(screen.getByText("TEST-0001")).toBeInTheDocument()
  })
})
