export interface CatalogProduct {
  id: string
  name: string
  category: string
  sku: string
  price: number
  stock: number
  unit: string
}

export interface CatalogFilters {
  search?: string
  category?: string
}

export interface CatalogQueryPort {
  search(filters: CatalogFilters): Promise<CatalogProduct[]>
}
