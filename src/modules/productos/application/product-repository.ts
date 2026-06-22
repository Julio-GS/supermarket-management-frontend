import type { Category } from "../domain/category"
import type { CreateProductInput, Product } from "../domain/product"

export interface ProductFilters {
  search?: string
  category?: Category | "all"
}

export interface ProductRepository {
  list(filters?: ProductFilters): Promise<Product[]>
  create(input: CreateProductInput): Promise<Product>
  update(product: Product): Promise<Product>
  delete(id: string): Promise<void>
}
