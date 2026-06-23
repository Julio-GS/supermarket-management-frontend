import { seedProducts } from "./mock-product-data"
import {
  calculateCost,
  createProduct,
  generateSku,
  type CreateProductInput,
  type Product,
  type UpdateProductInput,
} from "../domain/product"
import { matchesProductSearch } from "../domain/product-search"
import type { ProductFilters, ProductRepository } from "../application/product-repository"

function applyFilters(products: Product[], filters: ProductFilters): Product[] {
  let result = [...products]

  if (filters.category && filters.category !== "all") {
    result = result.filter((product) => product.category === filters.category)
  }

  if (filters.search) {
    result = result.filter((product) => matchesProductSearch(product, filters.search!))
  }

  return result
}

export function createMockProductRepository(initialProducts?: Product[]): ProductRepository {
  let products = initialProducts ? [...initialProducts] : [...seedProducts]
  let sequence = products.length + 1

  return {
    async list(filters = {}) {
      return applyFilters(products, filters)
    },

    async create(input: CreateProductInput) {
      const product = createProduct(
        {
          ...input,
          sku: input.sku || generateSku(sequence),
        },
        sequence++
      )
      products = [product, ...products]
      return product
    },

    async update(input: UpdateProductInput) {
      const existing = products.find((p) => p.id === input.id)
      if (!existing) {
        throw new Error(`Product ${input.id} not found`)
      }
      const updated: Product = {
        ...existing,
        name: input.name,
        sku: input.sku,
        price: input.price,
        cost: calculateCost(input.price),
      }
      products = products.map((p) => (p.id === input.id ? updated : p))
      return updated
    },

    async delete(id: string) {
      products = products.filter((p) => p.id !== id)
    },
  }
}
