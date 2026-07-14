import type { ProductPromotionSummary } from "@/modules/productos"

export interface CatalogProduct {
  id: string
  name: string
  sku: string
  price: number
  stock: number | null
  unit: string
  promotions: ProductPromotionSummary[] | null
  storePromotions: ProductPromotionSummary[] | null
  /** Backend-defined pricing mode: "standard" (default) or "manual" (special product). */
  pricingMode?: "standard" | "manual"
  /** Whether the product is backend-protected (manual-price only, non-editable). */
  isProtected?: boolean
}

export interface CatalogFilters {
  search?: string
  page?: number
  limit?: number
}

export interface CatalogQueryPort {
  search(filters?: CatalogFilters): Promise<CatalogProduct[]>
  findByCode(code: string): Promise<CatalogProduct | null>
}
