import { apiRequest } from "@/shared/infrastructure/api-client"
import { Promotion, type PromotionScope } from '../domain/promotion';

const FRONTEND_SUNDAY = 0
const BACKEND_SUNDAY = 7

export interface BackendPromotionDto {
  id: string
  name: string
  description: string | null
  scope: PromotionScope
  product_id: string | null
  type: "percentage" | "two_x_one"
  discount_percent: number | null
  start_date: string | null
  end_date: string | null
  weekdays: number[] | null
  enabled: boolean
  created_at: string
  updated_at: string
}

function normalizeWeekdayFromBackend(weekday: number): number {
  return weekday === BACKEND_SUNDAY ? FRONTEND_SUNDAY : weekday
}

function normalizeWeekdayToBackend(weekday: number): number {
  return weekday === FRONTEND_SUNDAY ? BACKEND_SUNDAY : weekday
}

function normalizeWeekdaysFromBackend(weekdays: number[] | null): number[] | null {
  return weekdays === null ? null : weekdays.map(normalizeWeekdayFromBackend)
}

function normalizeWeekdaysToBackend(weekdays: number[] | null): number[] | null {
  return weekdays === null ? null : weekdays.map(normalizeWeekdayToBackend)
}

export function toDomain(dto: BackendPromotionDto): Promotion {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    scope: dto.scope,
    productId: dto.product_id,
    type: dto.type,
    discountPercent: dto.discount_percent,
    startDate: dto.start_date,
    endDate: dto.end_date,
    weekdays: normalizeWeekdaysFromBackend(dto.weekdays),
    enabled: dto.enabled,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  }
}

export function toBackend(domain: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Omit<BackendPromotionDto, 'id' | 'created_at' | 'updated_at' | 'enabled'> {
  return {
    name: domain.name,
    description: domain.description,
    scope: domain.scope,
    product_id: domain.productId,
    type: domain.type,
    discount_percent: domain.discountPercent,
    start_date: domain.startDate,
    end_date: domain.endDate,
    weekdays: normalizeWeekdaysToBackend(domain.weekdays),
    // NOTE: 'enabled' is intentionally omitted — the backend does not accept it on creation.
    // Use toBackendPatch to toggle enabled via PATCH/PUT.
  }
}

export function toBackendPatch(domainPatch: Partial<Promotion>): Partial<Omit<BackendPromotionDto, 'id' | 'created_at' | 'updated_at'>> {
  const patch: Partial<Omit<BackendPromotionDto, 'id' | 'created_at' | 'updated_at'>> = {};
  if (domainPatch.name !== undefined) patch.name = domainPatch.name;
  if (domainPatch.description !== undefined) patch.description = domainPatch.description;
  if (domainPatch.scope !== undefined) patch.scope = domainPatch.scope;
  if (domainPatch.productId !== undefined) patch.product_id = domainPatch.productId;
  if (domainPatch.type !== undefined) patch.type = domainPatch.type;
  if (domainPatch.discountPercent !== undefined) patch.discount_percent = domainPatch.discountPercent;
  if (domainPatch.startDate !== undefined) patch.start_date = domainPatch.startDate;
  if (domainPatch.endDate !== undefined) patch.end_date = domainPatch.endDate;
  if (domainPatch.weekdays !== undefined) {
    patch.weekdays = normalizeWeekdaysToBackend(domainPatch.weekdays)
  }
  if (domainPatch.enabled !== undefined) patch.enabled = domainPatch.enabled;
  return patch;
}

export class ApiPromotionRepository {
  async getPromotions(): Promise<Promotion[]> {
    try {
      const response = await apiRequest<BackendPromotionDto[]>("/promotions")
      return (response ?? []).map(toDomain)
    } catch (e) {
      console.warn("Failed to fetch promotions", e)
      return []
    }
  }

  async createPromotion(promo: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promise<Promotion> {
    const response = await apiRequest<BackendPromotionDto>("/promotions", {
      method: "POST",
      body: JSON.stringify(toBackend(promo)),
    })
    return toDomain(response)
  }

  async updatePromotion(id: string, promo: Partial<Promotion>): Promise<Promotion> {
    const response = await apiRequest<BackendPromotionDto>(`/promotions/${id}`, {
      method: "PUT",
      body: JSON.stringify(toBackendPatch(promo)),
    })
    return toDomain(response)
  }

  async deletePromotion(id: string): Promise<void> {
    await apiRequest<void>(`/promotions/${id}`, {
      method: "DELETE",
    })
  }
}

export const promotionRepository = new ApiPromotionRepository();
