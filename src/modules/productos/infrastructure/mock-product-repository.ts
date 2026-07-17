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
import type { ProductListQuery, ProductPage, ProductRepository } from "../application/product-repository"

function paginateProducts(products: Product[], query: ProductListQuery = {}): ProductPage {
  const search = query.search?.trim()
  const filteredProducts = search ? products.filter((product) => matchesProductSearch(product, search)) : products
  const page = query.page ?? 1
  const limit = (query.limit ?? filteredProducts.length) || 1
  const start = (page - 1) * limit
  const paginatedProducts = filteredProducts.slice(start, start + limit)
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / limit))

  return {
    products: paginatedProducts,
    meta: {
      page,
      limit,
      total: filteredProducts.length,
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
        manejaStock: input.manejaStock,
        stock: input.manejaStock ? existing.stock ?? 0 : null,
        cost: calculateCost(input.price),
      }
      products = products.map((p) => (p.id === input.id ? updated : p))
      return updated
    },

    async findByCode(code: string) {
      const trimmed = code.trim()
      if (!trimmed) return null
      const found = products.find(
        (p) => p.sku === trimmed || p.id === trimmed
      )
      return found ?? null
    },

    async delete(id: string) {
      products = products.filter((p) => p.id !== id)
    },
  }
}
