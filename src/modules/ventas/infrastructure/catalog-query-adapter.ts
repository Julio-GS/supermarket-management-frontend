import { productRepository, type ProductListQuery } from "@/modules/productos"
import type { CatalogProduct, CatalogFilters, CatalogQueryPort } from "../application/catalog-query-port"

function toProductQuery(filters: CatalogFilters): ProductListQuery {
  return {
    search: filters.search?.trim() || undefined,
    page: filters.page ?? 1,
    limit: filters.limit ?? 100,
    sort: "created_at:desc",
  }
}

export const catalogQueryAdapter: CatalogQueryPort = {
  async search(filters = {}) {
    const page = await productRepository.list(toProductQuery(filters))
    return page.products.map(
      (product): CatalogProduct => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        stock: product.stock,
        unit: product.unit,
        promotions: product.promotions,
        storePromotions: product.storePromotions,
      })
    )
  },

  async findByCode(code: string) {
    const product = await productRepository.findByCode(code)
    if (!product) return null
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
      promotions: product.promotions,
      storePromotions: product.storePromotions,
    }
  },
}
