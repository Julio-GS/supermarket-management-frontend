import { seedProducts } from "./mock-product-data"
import {
  calculateCost,
  createProduct,
  generateSku,
  type CreateProductInput,
  type Product,
  type UpdateProductInput,
} from "../domain/product"
import type { ProductListQuery, ProductPage, ProductRepository } from "../application/product-repository"

function paginateProducts(products: Product[], query: ProductListQuery = {}): ProductPage {
  const page = query.page ?? 1
  const limit = (query.limit ?? products.length) || 1
  const start = (page - 1) * limit
  const paginatedProducts = products.slice(start, start + limit)
  const totalPages = Math.max(1, Math.ceil(products.length / limit))

  return {
    products: paginatedProducts,
    meta: {
      page,
      limit,
      total: products.length,
      totalPages,
      hasNext: page < totalPages,
    },
  }
}

export function createMockProductRepository(initialProducts?: Product[]): ProductRepository {
  let products = initialProducts ? [...initialProducts] : [...seedProducts]
  let sequence = products.length + 1

  return {
    async list(query = {}) {
      return paginateProducts(products, query)
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
