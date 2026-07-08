export interface CatalogProduct {
  id: string
  name: string
  sku: string
  price: number
  stock: number | null
  unit: string
  promotions?: {
    id: string
    description: string
    type?: string
    discount_percent?: number
  }[] | null
}

export interface CatalogFilters {
  search?: string
  page?: number
  limit?: number
}

export interface CatalogQueryPort {
  search(filters?: CatalogFilters): Promise<CatalogProduct[]>
}
