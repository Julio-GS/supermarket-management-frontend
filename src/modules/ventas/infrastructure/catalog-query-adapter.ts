import { productRepository, type ProductListQuery, type ProductPromotionSummary } from "@/modules/productos"
import type { CartProductPromotion } from "../domain/cart"
import type { CatalogProduct, CatalogFilters, CatalogQueryPort } from "../application/catalog-query-port"

function toProductQuery(filters: CatalogFilters): ProductListQuery {
  return {
    search: filters.search?.trim() || undefined,
    page: filters.page ?? 1,
    limit: filters.limit ?? 100,
    sort: "created_at:desc",
  }
}

function mapPromotion(promotion: ProductPromotionSummary): CartProductPromotion {
  return {
    id: promotion.id,
    name: promotion.name,
    description: promotion.description,
    scope: promotion.scope,
    type: promotion.type,
    discountPercent: promotion.discountPercent,
    startDate: promotion.startDate,
    endDate: promotion.endDate,
    weekdays: promotion.weekdays,
  }
}

function mapPromotions(
  promotions: ProductPromotionSummary[] | null
): CartProductPromotion[] | null {
  return promotions === null ? null : promotions.map(mapPromotion)
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
        manejaStock: product.manejaStock,
        unit: product.unit,
        promotions: mapPromotions(product.promotions),
        storePromotions: mapPromotions(product.storePromotions),
        pricingMode: product.pricingMode,
        isProtected: product.isProtected,
        iva: product.iva ?? null,
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
      manejaStock: product.manejaStock,
      unit: product.unit,
      promotions: mapPromotions(product.promotions),
      storePromotions: mapPromotions(product.storePromotions),
      pricingMode: product.pricingMode,
      isProtected: product.isProtected,
      iva: product.iva ?? null,
    }
  },
}
