import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { PRODUCTS_QUERY_KEY, PROMOTIONS_QUERY_KEY } from "@/shared/infrastructure/query-keys"
import {
  hasActivePromotionConflict,
  type Promotion,
} from "../domain/promotion"
import { promotionRepository } from "../infrastructure/api-promotion-repository"

export function usePromotionsAdmin(
  repository: typeof promotionRepository = promotionRepository
) {
  const queryClient = useQueryClient()

  const {
    data: promotions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: PROMOTIONS_QUERY_KEY,
    queryFn: () => repository.getPromotions(),
  })

  const createMutation = useMutation({
    mutationFn: (promotion: Omit<Promotion, "id" | "createdAt" | "updatedAt">) =>
      repository.createPromotion(promotion),
    onSuccess: async (created) => {
      queryClient.setQueryData<Promotion[]>(PROMOTIONS_QUERY_KEY, (old) => [
        ...(old ?? []),
        created,
      ])
      await queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Promotion> }) =>
      repository.updatePromotion(id, patch),
    onSuccess: async (updated) => {
      queryClient.setQueryData<Promotion[]>(PROMOTIONS_QUERY_KEY, (old) =>
        (old ?? []).map((p) => (p.id === updated.id ? updated : p))
      )
      await queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] })
    },
  })

  /**
   * Soft-deletes a promotion by setting enabled=false.
   *
   * Named "delete" to match the backend REST verb (DELETE /promotions/:id),
   * but the backend preserves the record so it can be reactivated later.
   * The cache is updated locally to reflect the disabled state.
   */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => repository.deletePromotion(id),
    onSuccess: async (_data, id) => {
      queryClient.setQueryData<Promotion[]>(PROMOTIONS_QUERY_KEY, (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, enabled: false } : p))
      )
      await queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] })
    },
  })

  const createPromotion = useCallback(
    async (promotion: Omit<Promotion, "id" | "createdAt" | "updatedAt">) => {
      if (hasActivePromotionConflict(promotions, promotion)) {
        throw new Error("This product already has an active promotion.")
      }
      return await createMutation.mutateAsync(promotion)
    },
    [promotions, createMutation]
  )

  const updatePromotion = useCallback(
    async (id: string, patch: Partial<Promotion>) => {
      const existingPromotion = promotions.find((p) => p.id === id)
      if (!existingPromotion) {
        throw new Error("Promotion not found")
      }

      const candidate = { ...existingPromotion, ...patch }
      if (hasActivePromotionConflict(promotions, candidate, id)) {
        throw new Error("This product already has an active promotion.")
      }

      return await updateMutation.mutateAsync({ id, patch })
    },
    [promotions, updateMutation]
  )

  /**
   * Soft-deletes (disables) a promotion.
   *
   * Kept as "deletePromotion" for UI consistency despite being a soft-delete.
   * The backend DELETE endpoint sets enabled=false and preserves the record.
   * See deleteMutation JSDoc for details.
   */
  const deletePromotion = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id)
    },
    [deleteMutation]
  )

  return {
    promotions,
    isLoading,
    error: error ?? null,
    createPromotion,
    updatePromotion,
    deletePromotion,
  }
}
