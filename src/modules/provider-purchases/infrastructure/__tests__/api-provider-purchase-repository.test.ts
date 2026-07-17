import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiRequest } from "@/shared/infrastructure/api-client"
import { ApiProviderPurchaseRepository } from "../api-provider-purchase-repository"
import type { BackendProviderPurchaseDto } from "../../domain/provider-purchase"

vi.mock("@/shared/infrastructure/api-client", () => ({
  apiRequest: vi.fn(),
}))

const mockApiRequest = vi.mocked(apiRequest)

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDto(
  overrides: Partial<BackendProviderPurchaseDto> = {}
): BackendProviderPurchaseDto {
  return {
    id: "pp-1",
    provider_name: "Distribuidora ABC",
    amount: "15000.00",
    payment_method: "transferencia",
    created_at: "2026-07-10T12:00:00.000Z",
    updated_at: "2026-07-10T12:00:00.000Z",
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ApiProviderPurchaseRepository", () => {
  let repo: ApiProviderPurchaseRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new ApiProviderPurchaseRepository()
  })

  describe("list", () => {
    it("calls GET /reports/provider-purchases and returns domain objects", async () => {
      mockApiRequest.mockResolvedValue([makeDto(), makeDto({ id: "pp-2", provider_name: "Otro" })])

      const result = await repo.list()

      expect(mockApiRequest).toHaveBeenCalledWith("/reports/provider-purchases")
      expect(result).toHaveLength(2)
      expect(result[0].providerName).toBe("Distribuidora ABC")
      expect(result[1].providerName).toBe("Otro")
    })

    it("returns empty array when apiRequest returns undefined/null (empty backend)", async () => {
      mockApiRequest.mockResolvedValue(undefined)

      const result = await repo.list()

      expect(result).toEqual([])
    })

    it("lets errors bubble up (no silent catch)", async () => {
      const err = new Error("Network failure")
      mockApiRequest.mockRejectedValue(err)

      await expect(repo.list()).rejects.toThrow("Network failure")
    })
  })

  describe("create", () => {
    it("sends POST with snake_case body and returns normalized domain", async () => {
      mockApiRequest.mockResolvedValue(makeDto())

      const result = await repo.create({
        providerName: "Nuevo Proveedor",
        amount: "5000.00",
        paymentMethod: "efectivo",
      })

      expect(mockApiRequest).toHaveBeenCalledWith("/reports/provider-purchases", {
        method: "POST",
        body: JSON.stringify({
          provider_name: "Nuevo Proveedor",
          amount: "5000.00",
          payment_method: "efectivo",
        }),
      })

      expect(result.providerName).toBe("Distribuidora ABC")
    })

    it("sends null payment_method when not provided", async () => {
      mockApiRequest.mockResolvedValue(makeDto({ payment_method: null }))

      const result = await repo.create({
        providerName: "Sin Pago",
        amount: "100.00",
      })

      expect(mockApiRequest).toHaveBeenCalledWith(
        "/reports/provider-purchases",
        expect.objectContaining({
          body: JSON.stringify({
            provider_name: "Sin Pago",
            amount: "100.00",
            payment_method: null,
          }),
        })
      )

      expect(result.paymentMethod).toBeNull()
    })
  })

  describe("update", () => {
    it("sends PUT with snake_case partial patch", async () => {
      mockApiRequest.mockResolvedValue(
        makeDto({ provider_name: "Actualizado", amount: "9999.99" })
      )

      const result = await repo.update("pp-1", {
        providerName: "Actualizado",
        amount: "9999.99",
      })

      expect(mockApiRequest).toHaveBeenCalledWith("/reports/provider-purchases/pp-1", {
        method: "PUT",
        body: JSON.stringify({
          provider_name: "Actualizado",
          amount: "9999.99",
        }),
      })

      expect(result.providerName).toBe("Actualizado")
      expect(result.amount).toBe("9999.99")
    })

    it("sends null payment_method when clearing", async () => {
      mockApiRequest.mockResolvedValue(makeDto({ payment_method: null }))

      const result = await repo.update("pp-1", { paymentMethod: null })

      expect(mockApiRequest).toHaveBeenCalledWith(
        "/reports/provider-purchases/pp-1",
        expect.objectContaining({
          body: JSON.stringify({
            payment_method: null,
          }),
        })
      )

      expect(result.paymentMethod).toBeNull()
    })
  })

  describe("delete", () => {
    it("sends DELETE with no body and handles 204", async () => {
      mockApiRequest.mockResolvedValue(undefined)

      await expect(repo.delete("pp-1")).resolves.toBeUndefined()

      expect(mockApiRequest).toHaveBeenCalledWith("/reports/provider-purchases/pp-1", {
        method: "DELETE",
      })
    })
  })

  describe("report", () => {
    it("calls GET with window query param and normalizes response", async () => {
      mockApiRequest.mockResolvedValue({
        window: "week",
        range: { starts_at: "2026-07-01T00:00:00.000+00:00", ends_at: "2026-07-07T23:59:59.000+00:00" },
        total_amount: "45000.00",
        purchase_count: 3,
        payment_method_breakdown: [
          { method: "transferencia", amount: "30000.00" },
          { method: "efectivo", amount: "15000.00" },
        ],
      })

      const result = await repo.report("week")

      expect(mockApiRequest).toHaveBeenCalledWith(
        "/reports/provider-purchases/report?window=week"
      )

      expect(result.window).toBe("week")
      expect(result.totalAmount).toBe("45000.00")
      expect(result.purchaseCount).toBe(3)
      expect(result.range.startsAt).toBe("2026-07-01T00:00:00.000+00:00")
      expect(result.paymentMethodBreakdown).toHaveLength(2)
      expect(result.paymentMethodBreakdown[0].method).toBe("transferencia")
      expect(result.paymentMethodBreakdown[0].amount).toBe("30000.00")
    })
  })
})
