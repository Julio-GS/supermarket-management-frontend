"use client"

import { useState, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { invalidateStockAdjustmentQueries } from "@/shared/infrastructure/query-cache-policy"
import { triggerDesktopSync } from "@/modules/sync-status/trigger"
import { validateSignedAdjustmentQuantity, type AdjustStockInput } from "../domain/stock-adjustment"
import type { StockRepository } from "./stock-repository"

export interface UseStockAdjustmentResult {
  adjustStock: (input: AdjustStockInput) => Promise<void>
  isPending: boolean
  error: string | null
  resetError: () => void
}

export function useStockAdjustment(repository: StockRepository): UseStockAdjustmentResult {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const resetError = useCallback(() => setError(null), [])

  const mutation = useMutation({
    mutationFn: async (input: AdjustStockInput) => {
      // Client-side signed non-zero integer validation (application boundary)
      const validationError = validateSignedAdjustmentQuantity(input.quantity)
      if (validationError) {
        throw new Error(validationError)
      }

      return repository.adjust(input)
    },
    onSuccess: (_movement, variables) => {
      void invalidateStockAdjustmentQueries(queryClient, variables.productId)
      void triggerDesktopSync({ reason: "stock-adjustment" })
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "No se pudo completar el ajuste de stock."
      setError(message)
    },
  })

  const adjustStock = useCallback(
    async (input: AdjustStockInput) => {
      setError(null)
      await mutation.mutateAsync(input)
    },
    [mutation]
  )

  return {
    adjustStock,
    isPending: mutation.isPending,
    error,
    resetError,
  }
}
