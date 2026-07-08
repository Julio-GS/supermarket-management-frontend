import { useCallback, useEffect, useState } from "react"

import {
  hasActivePromotionConflict,
  type Promotion,
} from "../domain/promotion"
import { promotionRepository } from "../infrastructure/api-promotion-repository"

export function usePromotionsAdmin(
  repository: typeof promotionRepository = promotionRepository
) {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isCancelled = false

    Promise.resolve(repository.getPromotions())
      .then((data) => {
        if (isCancelled) return
        setPromotions(data ?? [])
        setError(null)
      })
      .catch((exception) => {
        if (isCancelled) return
        setError(exception instanceof Error ? exception : new Error("Failed to load promotions"))
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [repository])

  const createPromotion = useCallback(
    async (promotion: Omit<Promotion, "id">) => {
      if (hasActivePromotionConflict(promotions, promotion)) {
        throw new Error("This product already has an active promotion.")
      }

      const createdPromotion = await repository.createPromotion(promotion)
      setPromotions((current) => [...current, createdPromotion])
      return createdPromotion
    },
    [promotions, repository]
  )

  const updatePromotion = useCallback(
    async (id: string, patch: Partial<Promotion>) => {
      const existingPromotion = promotions.find((promotion) => promotion.id === id)
      if (!existingPromotion) {
        throw new Error("Promotion not found")
      }

      const candidate = { ...existingPromotion, ...patch }
      if (hasActivePromotionConflict(promotions, candidate, id)) {
        throw new Error("This product already has an active promotion.")
      }

      const updatedPromotion = await repository.updatePromotion(id, patch)
      setPromotions((current) =>
        current.map((promotion) => (promotion.id === id ? updatedPromotion : promotion))
      )
      return updatedPromotion
    },
    [promotions, repository]
  )

  const deletePromotion = useCallback(
    async (id: string) => {
      await repository.deletePromotion(id)
      setPromotions((current) =>
        current.map((promotion) =>
          promotion.id === id ? { ...promotion, active: false } : promotion
        )
      )
    },
    [repository]
  )

  return {
    promotions,
    isLoading,
    error,
    createPromotion,
    updatePromotion,
    deletePromotion,
  }
}
