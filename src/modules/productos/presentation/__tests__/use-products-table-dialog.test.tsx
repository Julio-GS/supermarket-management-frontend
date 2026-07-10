import { describe, expect, it } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useProductsTableDialog } from "../use-products-table-dialog"
import type { Product } from "../../domain/product"

const product: Product = {
  id: "P001",
  name: "Manzana Roja",
  sku: "FRV-0001",
  price: 1.2,
  cost: 0.72,
  stock: 50,
  stockMinimum: 20,
  unit: "kg",
  supplier: "Test",
    promotions: null,
    storePromotions: null,
}

describe("useProductsTableDialog", () => {
  it("groups create dialog state in one logical update", () => {
    const { result } = renderHook(() => useProductsTableDialog())

    act(() => result.current.openCreate())
    expect(result.current.create.open).toBe(true)

    act(() => result.current.setCreateField("name", "Nuevo producto"))
    expect(result.current.create.name).toBe("Nuevo producto")

    act(() => result.current.resetCreate())
    expect(result.current.create.name).toBe("")
  })

  it("groups edit dialog state in one logical update", () => {
    const { result } = renderHook(() => useProductsTableDialog())

    act(() => result.current.openEdit(product))
    expect(result.current.edit.product).toBe(product)
    expect(result.current.edit.name).toBe("Manzana Roja")
    expect(result.current.edit.price).toBe("1.2")

    act(() => result.current.setEditField("price", "2.5"))
    expect(result.current.edit.price).toBe("2.5")

    act(() => result.current.setEditSaving(true))
    expect(result.current.edit.saving).toBe(true)

    act(() => result.current.closeEdit())
    expect(result.current.edit.product).toBeNull()
  })
})
