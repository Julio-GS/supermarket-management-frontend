import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { PRODUCTS_QUERY_KEY, PROMOTIONS_QUERY_KEY } from "@/shared/infrastructure/query-keys"
import {
  hasActivePromotionConflict,
  type Promotion,
} from "../domain/promotion"
import { promotionRepository } from "../infrastructure/promotion-repository-instance"

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
      // Invalidate without awaiting — the product list refetch will happen in
      // the background once connectivity is available, without blocking offline flow.
      void queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] })
    },
  })

  /**
   * Sends DELETE /promotions/:id to the backend and removes the promotion
   * from the local cache so it disappears from the UI.
   *
   * IMPORTANT — backend limitation: the current backend DELETE endpoint
   * soft-deletes the record (sets enabled=false) rather than destroying it.
   * On the next full page load / query re-fetch, the promotion will reappear
   * in the list as disabled. This is a backend constraint — the frontend
   * cannot permanently remove it.
   */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => repository.deletePromotion(id),
    onSuccess: async (_data, id) => {
      // Remove from cache entirely so it disappears from the promotions table.
      queryClient.setQueryData<Promotion[]>(PROMOTIONS_QUERY_KEY, (old) =>
        (old ?? []).filter((p) => p.id !== id)
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
   * Removes a promotion from the UI and sends DELETE to the backend.
   *
   * The promotion is immediately removed from the local cache so it
   * disappears from the promotions table. The backend DELETE endpoint
   * currently soft-deletes (sets enabled=false) — see deleteMutation
   * JSDoc for the backend limitation.
   *
   * Use updatePromotion with { enabled } for enable/disable toggling.
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
