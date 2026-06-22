import { seedProducts } from "./mock-product-data"
import { createProduct, type CreateProductInput, type Product } from "../domain/product"
import type { ProductFilters, ProductRepository } from "../application/product-repository"

function applyFilters(products: Product[], filters: ProductFilters): Product[] {
  let result = [...products]

  if (filters.category && filters.category !== "all") {
    result = result.filter((product) => product.category === filters.category)
  }

  if (filters.search) {
    const term = filters.search.toLowerCase()
    result = result.filter(
      (product) =>
        product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term)
    )
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
      const product = createProduct(input, sequence++)
      products = [product, ...products]
      return product
    },

    async update(product: Product) {
      products = products.map((p) => (p.id === product.id ? product : p))
      return product
    },

    async delete(id: string) {
      products = products.filter((p) => p.id !== id)
    },
  }
}
