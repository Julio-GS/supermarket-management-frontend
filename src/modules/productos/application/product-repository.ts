import type { Category } from "../domain/category"
import type { CreateProductInput, Product, UpdateProductInput } from "../domain/product"

export interface ProductFilters {
  search?: string
  category?: Category | "all"
}

export interface ProductRepository {
  list(filters?: ProductFilters): Promise<Product[]>
  create(input: CreateProductInput): Promise<Product>
  update(input: UpdateProductInput): Promise<Product>
  delete(id: string): Promise<void>
}
