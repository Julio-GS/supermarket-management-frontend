import type { CreateProductInput, Product, UpdateProductInput } from "../domain/product"

export interface ProductFilters {
  search?: string
}

export type ProductSort = "created_at:desc" | "created_at:asc" | "detalle:asc" | "detalle:desc"

export interface ProductListQuery {
  search?: string
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
  findByCode(code: string): Promise<Product | null>
  create(input: CreateProductInput): Promise<Product>
  update(input: UpdateProductInput): Promise<Product>
  /**
   * Toggle stock control for a product without sending the full product payload.
   * Sends only `{ maneja_stock: boolean }` to PUT /products/:id.
   * The backend preserves the hidden stock balance internally and restores it on re-enable.
   */
  updateStockControl(input: { id: string; manejaStock: boolean }): Promise<Product>
  delete(id: string): Promise<void>
}
