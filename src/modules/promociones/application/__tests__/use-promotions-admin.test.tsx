import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import type { Promotion } from "../../domain/promotion"
import { usePromotionsAdmin } from "../use-promotions-admin"
import { PRODUCTS_QUERY_KEY } from "@/shared/infrastructure/query-keys"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockGetPromotions = vi.fn<() => Promise<Promotion[]>>()
const mockCreatePromotion = vi.fn<
  (promo: Omit<Promotion, "id" | "createdAt" | "updatedAt">) => Promise<Promotion>
>()
const mockUpdatePromotion = vi.fn<
  (id: string, patch: Partial<Promotion>) => Promise<Promotion>
>()
const mockDeletePromotion = vi.fn<(id: string) => Promise<void>>()

vi.mock("../../infrastructure/api-promotion-repository", () => ({
  promotionRepository: {
    getPromotions: () => mockGetPromotions(),
    createPromotion: (promo: Omit<Promotion, "id" | "createdAt" | "updatedAt">) =>
      mockCreatePromotion(promo),
    updatePromotion: (id: string, patch: Partial<Promotion>) =>
      mockUpdatePromotion(id, patch),
    deletePromotion: (id: string) => mockDeletePromotion(id),
  },
}))

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "promo-1",
    name: "Test Promo",
    description: null,
    scope: "product",
    productId: "P001",
    type: "percentage",
    discountPercent: 10,
    startDate: null,
    endDate: null,
    weekdays: null,
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("usePromotionsAdmin", () => {
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

  // ── Loading ───────────────────────────────────────────────────────────────

  it("loads promotions on mount and exposes loading state", async () => {
    mockGetPromotions.mockResolvedValue([makePromotion()])

    const { result } = renderHook(() => usePromotionsAdmin(), {
      wrapper: createWrapper(queryClient),
    })

    // Before resolve: loading
    expect(result.current.isLoading).toBe(true)

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.promotions).toHaveLength(1)
    expect(result.current.promotions[0].name).toBe("Test Promo")
    expect(result.current.error).toBeNull()
  })

  it("exposes error when loading fails", async () => {
    mockGetPromotions.mockRejectedValue(new Error("Network failure"))

    const { result } = renderHook(() => usePromotionsAdmin(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe("Network failure")
  })

  // ── Product invalidation regression ───────────────────────────────────────

  it("invalidates products query after creating a promotion", async () => {
    mockGetPromotions.mockResolvedValue([])
    const created = makePromotion({ id: "promo-new", name: "New Promo", scope: "store", productId: null })
    mockCreatePromotion.mockResolvedValue(created)

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => usePromotionsAdmin(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.createPromotion({
        name: "New Promo",
        description: null,
        scope: "store",
        productId: null,
        type: "percentage",
        discountPercent: 10,
        startDate: null,
        endDate: null,
        weekdays: null,
        enabled: true,
      })
    })

    // Products were invalidated — key contract for stale-promotion fix
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [PRODUCTS_QUERY_KEY] })
    )

    // Cache reflects the created promotion (wait for React Query re-render)
    await vi.waitFor(() => {
      expect(result.current.promotions.some((p) => p.id === "promo-new")).toBe(true)
    })
  })

  it("invalidates products query after updating a promotion", async () => {
    const existing = makePromotion({ id: "promo-1", name: "Original" })
    mockGetPromotions.mockResolvedValue([existing])
    const updated = makePromotion({ id: "promo-1", name: "Updated" })
    mockUpdatePromotion.mockResolvedValue(updated)

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => usePromotionsAdmin(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updatePromotion("promo-1", { name: "Updated" })
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [PRODUCTS_QUERY_KEY] })
    )

    await vi.waitFor(() => {
      expect(result.current.promotions.find((p) => p.id === "promo-1")?.name).toBe("Updated")
    })
  })

  it("invalidates products query after deleting (removing) a promotion", async () => {
    const existing = makePromotion({ id: "promo-1", enabled: true })
    mockGetPromotions.mockResolvedValue([existing])
    mockDeletePromotion.mockResolvedValue(undefined)

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => usePromotionsAdmin(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.deletePromotion("promo-1")
    })

    // Stale-promotion fix: products are invalidated
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [PRODUCTS_QUERY_KEY] })
    )

    // Cache reflects removal (wait for React Query re-render)
    await vi.waitFor(() => {
      expect(result.current.promotions.find((p) => p.id === "promo-1")).toBeUndefined()
    })
  })

  // ── Conflict validation ───────────────────────────────────────────────────

  it("blocks creating a promotion when an active one already exists for the same product", async () => {
    const existing = makePromotion({ id: "promo-1", productId: "P001", enabled: true })
    mockGetPromotions.mockResolvedValue([existing])

    const { result } = renderHook(() => usePromotionsAdmin(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await expect(
      result.current.createPromotion({
        name: "Duplicate",
        description: null,
        scope: "product",
        productId: "P001",
        type: "percentage",
        discountPercent: 15,
        startDate: null,
        endDate: null,
        weekdays: null,
        enabled: true,
      })
    ).rejects.toThrow("This product already has an active promotion.")

    expect(mockCreatePromotion).not.toHaveBeenCalled()
  })

  it("blocks re-enabling a disabled promotion when another active one exists", async () => {
    const active = makePromotion({ id: "promo-1", productId: "P001", enabled: true })
    const disabled = makePromotion({ id: "promo-2", productId: "P001", name: "Disabled", enabled: false })
    mockGetPromotions.mockResolvedValue([active, disabled])

    const { result } = renderHook(() => usePromotionsAdmin(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await expect(
      result.current.updatePromotion("promo-2", { enabled: true })
    ).rejects.toThrow("This product already has an active promotion.")

    expect(mockUpdatePromotion).not.toHaveBeenCalled()
  })

  it("allows updating a promotion when no conflict exists", async () => {
    const existing = makePromotion({ id: "promo-1", name: "Original" })
    mockGetPromotions.mockResolvedValue([existing])
    const updated = makePromotion({ id: "promo-1", name: "Updated" })
    mockUpdatePromotion.mockResolvedValue(updated)

    const { result } = renderHook(() => usePromotionsAdmin(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updatePromotion("promo-1", { name: "Updated" })
    })

    expect(mockUpdatePromotion).toHaveBeenCalledWith("promo-1", { name: "Updated" })

    await vi.waitFor(() => {
      expect(result.current.promotions.find((p) => p.id === "promo-1")?.name).toBe("Updated")
    })
  })

  // ── Toggle (enable/disable) ────────────────────────────────────────────

  it("allows toggling a product-scoped promotion from disabled back to enabled", async () => {
    const disabled = makePromotion({ id: "promo-1", name: "Disabled Promo", enabled: false, scope: "product", productId: "P001" })
    mockGetPromotions.mockResolvedValue([disabled])
    const reEnabled = makePromotion({ id: "promo-1", name: "Disabled Promo", enabled: true, scope: "product", productId: "P001" })
    mockUpdatePromotion.mockResolvedValue(reEnabled)

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => usePromotionsAdmin(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updatePromotion("promo-1", { enabled: true })
    })

    expect(mockUpdatePromotion).toHaveBeenCalledWith("promo-1", { enabled: true })

    // Products must be invalidated so they reflect the re-enabled promotion
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [PRODUCTS_QUERY_KEY] })
    )

    // Cache reflects the re-enabled state
    await vi.waitFor(() => {
      expect(result.current.promotions.find((p) => p.id === "promo-1")?.enabled).toBe(true)
    })
  })

  it("allows toggling a store-scoped promotion from disabled back to enabled", async () => {
    const disabled = makePromotion({ id: "promo-2", name: "Store Promo", enabled: false, scope: "store", productId: null })
    mockGetPromotions.mockResolvedValue([disabled])
    const reEnabled = makePromotion({ id: "promo-2", name: "Store Promo", enabled: true, scope: "store", productId: null })
    mockUpdatePromotion.mockResolvedValue(reEnabled)

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => usePromotionsAdmin(), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.updatePromotion("promo-2", { enabled: true })
    })

    expect(mockUpdatePromotion).toHaveBeenCalledWith("promo-2", { enabled: true })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [PRODUCTS_QUERY_KEY] })
    )

    await vi.waitFor(() => {
      expect(result.current.promotions.find((p) => p.id === "promo-2")?.enabled).toBe(true)
    })
  })
})
