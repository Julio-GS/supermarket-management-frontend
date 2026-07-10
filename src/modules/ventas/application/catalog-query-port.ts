import type { ProductPromotionSummary } from "@/modules/productos/domain/product"

export interface CatalogProduct {
  id: string
  name: string
  sku: string
  price: number
  stock: number | null
  unit: string
  promotions: ProductPromotionSummary[] | null
  storePromotions: ProductPromotionSummary[] | null
}

export interface CatalogFilters {
  search?: string
  page?: number
  limit?: number
}

export interface CatalogQueryPort {
  search(filters?: CatalogFilters): Promise<CatalogProduct[]>
}
