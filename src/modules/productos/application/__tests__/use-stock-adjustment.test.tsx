import { describe, expect, it, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useStockAdjustment } from "../use-stock-adjustment"
import type { StockRepository } from "../stock-repository"
import type { StockMovement } from "../../domain/stock-adjustment"
import { PRODUCTS_QUERY_KEY, POS_CATALOG_QUERY_KEY, STOCK_QUERY_KEY } from "@/shared/infrastructure/query-keys"
import { triggerDesktopSync } from "@/modules/sync-status/trigger"

vi.mock("@/modules/sync-status/trigger", () => ({
  triggerDesktopSync: vi.fn().mockResolvedValue(undefined),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

function makeStockRepository(overrides: Partial<StockRepository> = {}): StockRepository {
  return {
    getStock: vi.fn().mockResolvedValue(10),
    adjust: vi.fn().mockResolvedValue({
      id: "mov-001",
      productId: "P001",
      quantity: 5,
      type: "adjustment",
      referenceId: null,
      previousStock: 10,
      newStock: 15,
      reason: null,
      createdAt: "2025-06-01T12:00:00Z",
    } satisfies StockMovement),
    ...overrides,
  }
}

describe("useStockAdjustment", () => {
  it("rejects decimal quantity before calling repository", async () => {
    const repository = makeStockRepository()

    const { result } = renderHook(() => useStockAdjustment(repository), { wrapper })

    await act(async () => {
      try {
        await result.current.adjustStock({ productId: "P001", quantity: 1.5 })
      } catch {
        // expected
      }
    })

    expect(repository.adjust).not.toHaveBeenCalled()
    expect(result.current.error).not.toBeNull()
  })

  it("rejects NaN quantity before calling repository", async () => {
    const repository = makeStockRepository()

    const { result } = renderHook(() => useStockAdjustment(repository), { wrapper })

    await act(async () => {
      try {
        await result.current.adjustStock({ productId: "P001", quantity: NaN })
      } catch {
        // expected
      }
    })

    expect(repository.adjust).not.toHaveBeenCalled()
    expect(result.current.error).not.toBeNull()
  })

  it("calls repository for valid integer quantity", async () => {
    const repository = makeStockRepository()

    const { result } = renderHook(() => useStockAdjustment(repository), { wrapper })

    await act(async () => {
      await result.current.adjustStock({ productId: "P001", quantity: 5, reason: "test" })
    })

    expect(repository.adjust).toHaveBeenCalledWith({
      productId: "P001",
      quantity: 5,
      reason: "test",
    })
  })

  it("invalidates product, POS catalog, and stock query keys on success", async () => {
    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const repository = makeStockRepository()

    const customWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useStockAdjustment(repository), { wrapper: customWrapper })

    await act(async () => {
      await result.current.adjustStock({ productId: "P001", quantity: 5 })
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [PRODUCTS_QUERY_KEY] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [POS_CATALOG_QUERY_KEY] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [STOCK_QUERY_KEY, "P001"] })
  })

  it("triggers a background desktop sync after a successful adjustment", async () => {
    const repository = makeStockRepository()

    const { result } = renderHook(() => useStockAdjustment(repository), { wrapper })

    await act(async () => {
      await result.current.adjustStock({ productId: "P001", quantity: 5 })
    })

    expect(triggerDesktopSync).toHaveBeenCalledWith({ reason: "stock-adjustment" })
  })

  it("does not optimistically mutate local stock on failure", async () => {
    let capturedMutationState: unknown = null

    const repository = makeStockRepository({
      adjust: vi.fn().mockRejectedValue(new Error("Backend error")),
    })

    const customQueryClient = createTestQueryClient()

    // seed some known stock data in the cache so we can prove it survives
    customQueryClient.setQueryData([STOCK_QUERY_KEY, "P001"], 10)

    const customWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={customQueryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useStockAdjustment(repository), { wrapper: customWrapper })

    await act(async () => {
      try {
        await result.current.adjustStock({ productId: "P001", quantity: 3 })
      } catch {
        capturedMutationState = result.current
      }
    })

    // Cache should still hold the original value
    const cachedStock = customQueryClient.getQueryData<number>([STOCK_QUERY_KEY, "P001"])
    expect(cachedStock).toBe(10)

    // The hook should expose the error
    expect(result.current.error).not.toBeNull()
  })

  it("exposes pending state during mutation", async () => {
    let resolveAdjust: (value: StockMovement) => void = () => {}
    const adjustPromise = new Promise<StockMovement>((resolve) => {
      resolveAdjust = resolve
    })

    const repository = makeStockRepository({
      adjust: vi.fn().mockReturnValue(adjustPromise),
    })

    const { result } = renderHook(() => useStockAdjustment(repository), { wrapper })

    act(() => {
      result.current.adjustStock({ productId: "P001", quantity: 5 }).catch(() => {})
    })

    // Should be pending while the promise hasn't resolved
    await waitFor(() => {
      expect(result.current.isPending).toBe(true)
    })

    await act(async () => {
      resolveAdjust({
        id: "mov-001",
        productId: "P001",
        quantity: 5,
        type: "adjustment",
        referenceId: null,
        previousStock: 10,
        newStock: 15,
        reason: null,
        createdAt: "2025-06-01T12:00:00Z",
      })
    })
  })

  it("accepts negative integer adjustments", async () => {
    const repository = makeStockRepository()

    const { result } = renderHook(() => useStockAdjustment(repository), { wrapper })

    await act(async () => {
      await result.current.adjustStock({ productId: "P001", quantity: -3 })
    })

    expect(repository.adjust).toHaveBeenCalledWith({
      productId: "P001",
      quantity: -3,
    })
  })
})
