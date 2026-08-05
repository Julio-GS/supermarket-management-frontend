import { describe, expect, it } from "vitest"
import { act } from "@testing-library/react"
import { renderHook } from "@/test/render"
import { useLabelQueue } from "../use-label-queue"
import type { Product } from "../../domain/product"

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "P001",
    name: "Test Product",
    sku: "TST-0001",
    price: 100,
    cost: 60,
    manejaStock: true,
    stock: 10,
    stockMinimum: 20,
    unit: "u",
    supplier: "Test",
    promotions: null,
    storePromotions: null,
    ...overrides,
  }
}

describe("useLabelQueue", () => {
  it("starts with an empty queue and closed dialog", () => {
    const { result } = renderHook(() => useLabelQueue())

    expect(result.current.queue).toEqual([])
    expect(result.current.isOpen).toBe(false)
  })

  it("enqueues a product into an empty queue", () => {
    const { result } = renderHook(() => useLabelQueue())
    const product = makeProduct()

    act(() => {
      result.current.enqueue(product, new Date("2025-01-15"))
    })

    expect(result.current.queue).toHaveLength(1)
    expect(result.current.queue[0].product.id).toBe("P001")
    expect(result.current.queue[0].changedAt).toEqual(new Date("2025-01-15"))
  })

  it("replaces an existing product when the same ID is enqueued again", () => {
    const { result } = renderHook(() => useLabelQueue())
    const product = makeProduct({ id: "P001", name: "Original" })
    const updated = makeProduct({ id: "P001", name: "Updated", price: 150 })

    act(() => {
      result.current.enqueue(product, new Date("2025-01-15"))
    })
    act(() => {
      result.current.enqueue(updated, new Date("2025-01-16"))
    })

    // Only one entry, the newest one
    expect(result.current.queue).toHaveLength(1)
    expect(result.current.queue[0].product.name).toBe("Updated")
    expect(result.current.queue[0].product.price).toBe(150)
    expect(result.current.queue[0].changedAt).toEqual(new Date("2025-01-16"))
  })

  it("keeps distinct products when different IDs are enqueued", () => {
    const { result } = renderHook(() => useLabelQueue())
    const productA = makeProduct({ id: "P001", name: "Product A" })
    const productB = makeProduct({ id: "P002", name: "Product B" })
    const productC = makeProduct({ id: "P003", name: "Product C" })

    act(() => {
      result.current.enqueue(productA, new Date("2025-01-15"))
    })
    act(() => {
      result.current.enqueue(productB, new Date("2025-01-15"))
    })
    act(() => {
      result.current.enqueue(productC, new Date("2025-01-15"))
    })

    expect(result.current.queue).toHaveLength(3)
    expect(result.current.queue.map((i) => i.product.id)).toEqual([
      "P001",
      "P002",
      "P003",
    ])
  })

  it("moves a repeated product to the end of the queue when re-enqueued", () => {
    const { result } = renderHook(() => useLabelQueue())
    const productA = makeProduct({ id: "P001", name: "Product A" })
    const productB = makeProduct({ id: "P002", name: "Product B" })
    const productAUpdated = makeProduct({
      id: "P001",
      name: "Product A Updated",
      price: 200,
    })

    act(() => {
      result.current.enqueue(productA, new Date("2025-01-15"))
    })
    act(() => {
      result.current.enqueue(productB, new Date("2025-01-15"))
    })
    act(() => {
      result.current.enqueue(productAUpdated, new Date("2025-01-16"))
    })

    expect(result.current.queue).toHaveLength(2)
    // Product A (updated) should now be last, after Product B
    expect(result.current.queue[0].product.id).toBe("P002")
    expect(result.current.queue[1].product.id).toBe("P001")
    expect(result.current.queue[1].product.name).toBe("Product A Updated")
    expect(result.current.queue[1].product.price).toBe(200)
  })

  it("clearQueue empties the queue and closes the dialog", () => {
    const { result } = renderHook(() => useLabelQueue())
    const product = makeProduct()

    act(() => {
      result.current.enqueue(product, new Date())
      result.current.openDialog()
    })

    expect(result.current.queue).toHaveLength(1)
    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.clearQueue()
    })

    expect(result.current.queue).toEqual([])
    expect(result.current.isOpen).toBe(false)
  })

  it("openDialog sets isOpen to true, closeDialog sets it to false", () => {
    const { result } = renderHook(() => useLabelQueue())

    expect(result.current.isOpen).toBe(false)

    act(() => {
      result.current.openDialog()
    })
    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.closeDialog()
    })
    expect(result.current.isOpen).toBe(false)
  })
})
