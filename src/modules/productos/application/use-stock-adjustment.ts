"use client"

import { useState, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PRODUCTS_QUERY_KEY, POS_CATALOG_QUERY_KEY, STOCK_QUERY_KEY } from "@/shared/infrastructure/query-keys"
import { validateAdjustmentQuantity, type AdjustStockInput } from "../domain/stock-adjustment"
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
      // Client-side integer validation
      const validationError = validateAdjustmentQuantity(input.quantity)
      if (validationError) {
        throw new Error(validationError)
      }

      return repository.adjust(input)
    },
    onSuccess: (_movement, variables) => {
      void queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [POS_CATALOG_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [STOCK_QUERY_KEY, variables.productId] })
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
