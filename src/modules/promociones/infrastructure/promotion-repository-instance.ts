import { promotionRepository as apiRepo } from "./api-promotion-repository"
import { createDesktopPromotionAdapter, isDesktopPromotionsAvailable } from "./desktop-promotion-adapter"
import type { Promotion, PromotionScope } from "../domain/promotion"

let desktopAdapter: ReturnType<typeof createDesktopPromotionAdapter> | null = null

function getDesktopAdapter() {
  if (desktopAdapter) {
    return desktopAdapter
  }

  if (!isDesktopPromotionsAvailable()) {
    return null
  }

  desktopAdapter = createDesktopPromotionAdapter()
  return desktopAdapter
}

function unwrapPromotion(result: { success: boolean; promotion?: { id: string; name: string; description: string | null; scope: string; productId: string | null; type: string; discountPercent: number | null; startDate: string | null; endDate: string | null; weekdays: number[] | null; enabled: boolean; createdAt: string; updatedAt: string }; error?: string }): Promotion {
  if (!result.success || !result.promotion) throw new Error(result.error ?? "Desktop promotion operation failed")
  const p = result.promotion
  return {
    ...p,
    scope: p.scope as PromotionScope,
    type: p.type as Promotion["type"],
  }
}

function unwrapPromotionList(results: { success: boolean; promotion?: { id: string; name: string; description: string | null; scope: string; productId: string | null; type: string; discountPercent: number | null; startDate: string | null; endDate: string | null; weekdays: number[] | null; enabled: boolean; createdAt: string; updatedAt: string }; error?: string }[]): Promotion[] {
  return results.map((r) => unwrapPromotion(r))
}

/**
 * Desktop-first promotion repository.
 * When the desktop bridge is available, routes through IPC to the main-process SQLite store.
 * Falls back to the API repository for browser and non-desktop environments.
 */
export const promotionRepository = {
  getPromotions: async (): Promise<Promotion[]> => {
    const desktopAdapter = getDesktopAdapter()
    if (desktopAdapter) {
      const results = await desktopAdapter.list()
      return unwrapPromotionList(results)
    }
    return apiRepo.getPromotions()
  },

  createPromotion: async (promo: Omit<Promotion, "id" | "createdAt" | "updatedAt">): Promise<Promotion> => {
    const desktopAdapter = getDesktopAdapter()
    if (desktopAdapter) {
      const result = await desktopAdapter.create({
        name: promo.name,
        description: promo.description,
        scope: promo.scope,
        product_id: promo.productId,
        type: promo.type,
        discount_percent: promo.discountPercent,
        start_date: promo.startDate,
        end_date: promo.endDate,
        weekdays: promo.weekdays,
      })
      return unwrapPromotion(result)
    }
    return apiRepo.createPromotion(promo)
  },

  updatePromotion: async (id: string, promo: Partial<Promotion>): Promise<Promotion> => {
    const desktopAdapter = getDesktopAdapter()
    if (desktopAdapter) {
      const result = await desktopAdapter.update(id, {
        name: promo.name,
        description: promo.description,
        scope: promo.scope,
        product_id: promo.productId,
        type: promo.type,
        discount_percent: promo.discountPercent,
        start_date: promo.startDate,
        end_date: promo.endDate,
        weekdays: promo.weekdays,
        enabled: promo.enabled,
      })
      return unwrapPromotion(result)
    }
    return apiRepo.updatePromotion(id, promo)
  },

  deletePromotion: async (id: string): Promise<void> => {
    const desktopAdapter = getDesktopAdapter()
    if (desktopAdapter) {
      const result = await desktopAdapter.delete(id)
      if (!result.success) throw new Error(result.error ?? "Failed to delete promotion")
      return
    }
    return apiRepo.deletePromotion(id)
  },
}
