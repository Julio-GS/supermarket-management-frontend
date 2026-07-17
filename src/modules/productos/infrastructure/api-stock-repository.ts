import { apiRequest } from "@/shared/infrastructure/api-client"
import type { AdjustStockInput, StockMovement } from "../domain/stock-adjustment"
import type { StockRepository } from "../application/stock-repository"

// ── DTOs ───────────────────────────────────────────────────────────

interface StockResponseDto {
  stock_actual: number | null
}

interface AdjustStockRequestDto {
  product_id: string
  quantity: number
  reason?: string
}

interface StockMovementDto {
  id: string
  product_id: string
  quantity: number
  type: "sale" | "adjustment" | "initialization"
  reference_id: string | null
  previous_stock: number
  new_stock: number
  reason: string | null
  created_at: string
}

// ── Mappers ────────────────────────────────────────────────────────

function mapMovementDto(dto: StockMovementDto): StockMovement {
  return {
    id: dto.id,
    productId: dto.product_id,
    quantity: dto.quantity,
    type: dto.type,
    referenceId: dto.reference_id,
    previousStock: dto.previous_stock,
    newStock: dto.new_stock,
    reason: dto.reason,
    createdAt: dto.created_at,
  }
}

// ── Factory ────────────────────────────────────────────────────────

export function createApiStockRepository(): StockRepository {
  return {
    async getStock(productId: string) {
      const dto = await apiRequest<StockResponseDto>(
        `/stock/${encodeURIComponent(productId)}`
      )
      return dto.stock_actual
    },

    async adjust(input: AdjustStockInput) {
      const body: AdjustStockRequestDto = {
        product_id: input.productId,
        quantity: input.quantity,
      }

      if (input.reason && input.reason.trim()) {
        body.reason = input.reason.trim()
      }

      const dto = await apiRequest<StockMovementDto>("/stock/adjust", {
        method: "POST",
        body: JSON.stringify(body),
      })

      return mapMovementDto(dto)
    },
  }
}
