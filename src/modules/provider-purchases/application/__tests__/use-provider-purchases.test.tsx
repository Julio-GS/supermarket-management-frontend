import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import type { ProviderPurchase, ProviderPurchaseInput } from "../../domain/provider-purchase"
import { useProviderPurchases } from "../use-provider-purchases"
import {
  PROVIDER_PURCHASES_LIST_KEY,
  REPORTS_QUERY_KEY,
} from "@/shared/infrastructure/query-keys"
import { triggerDesktopSync } from "@/modules/sync-status/trigger"

vi.mock("@/modules/sync-status/trigger", () => ({
  triggerDesktopSync: vi.fn().mockResolvedValue(undefined),
}))

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockList = vi.fn<() => Promise<ProviderPurchase[]>>()
const mockCreate = vi.fn<
  (input: ProviderPurchaseInput) => Promise<ProviderPurchase>
>()
const mockUpdate = vi.fn<
  (id: string, patch: Partial<ProviderPurchaseInput>) => Promise<ProviderPurchase>
>()
const mockDelete = vi.fn<(id: string) => Promise<void>>()

vi.mock(
  "../../infrastructure/api-provider-purchase-repository",
  () => ({
    providerPurchaseRepository: {
      list: () => mockList(),
      create: (input: ProviderPurchaseInput) => mockCreate(input),
      update: (id: string, patch: Partial<ProviderPurchaseInput>) =>
        mockUpdate(id, patch),
      delete: (id: string) => mockDelete(id),
    },
  })
)

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePurchase(
  overrides: Partial<ProviderPurchase> = {}
): ProviderPurchase {
  return {
    id: "pp-1",
    providerName: "Distribuidora ABC",
    amount: "15000.00",
    paymentMethod: "transferencia",
    createdAt: "2026-07-10T12:00:00.000Z",
    updatedAt: "2026-07-10T12:00:00.000Z",
    ...overrides,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useProviderPurchases", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  it("fetches list on mount and provides data", async () => {
    mockList.mockResolvedValue([makePurchase(), makePurchase({ id: "pp-2" })])

    const { result } = renderHook(() => useProviderPurchases(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.purchases).toHaveLength(2)
    })

    expect(result.current.purchases[0].providerName).toBe("Distribuidora ABC")
    expect(result.current.error).toBeNull()
  })

  it("exposes loading state during fetch", async () => {
    mockList.mockResolvedValue([makePurchase()])

    const { result } = renderHook(() => useProviderPurchases(), {
      wrapper: createWrapper(queryClient),
    })

    expect(result.current.isLoading).toBe(true)

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it("exposes error when list fails", async () => {
    mockList.mockRejectedValue(new Error("Network failure"))

    const { result } = renderHook(() => useProviderPurchases(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })

    expect(result.current.error?.message).toBe("Network failure")
  })

  it("inserts created purchase into cache optimistically", async () => {
    mockList.mockResolvedValue([makePurchase()])
    const created = makePurchase({
      id: "pp-new",
      providerName: "Nuevo Proveedor",
      amount: "5000.00",
    })
    mockCreate.mockResolvedValue(created)

    const { result } = renderHook(() => useProviderPurchases(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.createPurchase({
        providerName: "Nuevo Proveedor",
        amount: "5000.00",
        paymentMethod: "efectivo",
      })
    })

    await vi.waitFor(() => {
      expect(result.current.purchases.some((p) => p.id === "pp-new")).toBe(
        true
      )
    })
  })

  it("invalidates report query after create", async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue(makePurchase({ id: "pp-new" }))

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useProviderPurchases(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.createPurchase({
        providerName: "X",
        amount: "100",
      })
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: REPORTS_QUERY_KEY })
    )
  })

  it("triggers a background desktop sync after create", async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue(makePurchase({ id: "pp-new" }))

    const { result } = renderHook(() => useProviderPurchases(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.createPurchase({
        providerName: "X",
        amount: "100",
      })
    })

    expect(triggerDesktopSync).toHaveBeenCalledWith({ reason: "provider-purchase-create" })
  })

  it("replaces updated purchase in cache", async () => {
    const existing = makePurchase({ id: "pp-1", providerName: "Original" })
    mockList.mockResolvedValue([existing])
    const updated = makePurchase({ id: "pp-1", providerName: "Actualizado" })
    mockUpdate.mockResolvedValue(updated)

    const { result } = renderHook(() => useProviderPurchases(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updatePurchase("pp-1", {
        providerName: "Actualizado",
      })
    })

    await vi.waitFor(() => {
      expect(
        result.current.purchases.find((p) => p.id === "pp-1")?.providerName
      ).toBe("Actualizado")
    })
  })

  it("invalidates report query after update", async () => {
    mockList.mockResolvedValue([makePurchase()])
    mockUpdate.mockResolvedValue(makePurchase())

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useProviderPurchases(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updatePurchase("pp-1", { amount: "200" })
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: REPORTS_QUERY_KEY })
    )
  })

  it("removes deleted purchase from cache", async () => {
    mockList.mockResolvedValue([makePurchase(), makePurchase({ id: "pp-2" })])
    mockDelete.mockResolvedValue(undefined)

    const { result } = renderHook(() => useProviderPurchases(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deletePurchase("pp-1")
    })

    await vi.waitFor(() => {
      expect(
        result.current.purchases.find((p) => p.id === "pp-1")
      ).toBeUndefined()
    })

    expect(result.current.purchases).toHaveLength(1)
  })

  it("invalidates report query after delete", async () => {
    mockList.mockResolvedValue([makePurchase()])
    mockDelete.mockResolvedValue(undefined)

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useProviderPurchases(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deletePurchase("pp-1")
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: REPORTS_QUERY_KEY })
    )
  })
})
