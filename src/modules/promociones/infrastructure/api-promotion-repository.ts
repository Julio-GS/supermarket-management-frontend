import { apiRequest } from "@/shared/infrastructure/api-client"
import { Promotion } from '../domain/promotion';

export class ApiPromotionRepository {
  async getPromotions(): Promise<Promotion[]> {
    try {
      const response = await apiRequest<Promotion[]>("/promotions")
      return response
    } catch (e) {
      console.warn("Failed to fetch promotions", e)
      return []
    }
  }

  async createPromotion(promo: Omit<Promotion, 'id'>): Promise<Promotion> {
    const response = await apiRequest<Promotion>("/promotions", {
      method: "POST",
      body: JSON.stringify(promo),
    })
    return response
  }

  async updatePromotion(id: string, promo: Partial<Promotion>): Promise<Promotion> {
    const response = await apiRequest<Promotion>(`/promotions/${id}`, {
      method: "PUT",
      body: JSON.stringify(promo),
    })
    return response
  }

  async deletePromotion(id: string): Promise<void> {
    await apiRequest<void>(`/promotions/${id}`, {
      method: "DELETE",
    })
  }
}

export const promotionRepository = new ApiPromotionRepository();
