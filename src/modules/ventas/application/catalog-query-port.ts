export interface CatalogProduct {
  id: string
  name: string
  category: string
  sku: string
  price: number
  stock: number | null
  unit: string
}

export interface CatalogFilters {
  search?: string
  page?: number
  limit?: number
}

export interface CatalogQueryPort {
  search(filters?: CatalogFilters): Promise<CatalogProduct[]>
}
