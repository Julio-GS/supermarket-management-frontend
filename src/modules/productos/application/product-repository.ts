import type { CreateProductInput, Product, UpdateProductInput } from "../domain/product"

export interface ProductFilters {
  search?: string
}

export type ProductSort = "created_at:desc" | "created_at:asc" | "detalle:asc" | "detalle:desc"

export interface ProductListQuery {
  page?: number
  limit?: number
  sort?: ProductSort
}

export interface ProductPageMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
}

export interface ProductPage {
  products: Product[]
  meta: ProductPageMeta
}

export interface ProductRepository {
  list(query?: ProductListQuery): Promise<ProductPage>
  create(input: CreateProductInput): Promise<Product>
  update(input: UpdateProductInput): Promise<Product>
  delete(id: string): Promise<void>
}
