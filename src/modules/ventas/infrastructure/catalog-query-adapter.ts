import { productRepository } from "@/modules/productos"
import type { CatalogProduct, CatalogQueryPort } from "../application/catalog-query-port"

export const catalogQueryAdapter: CatalogQueryPort = {
  async search() {
    const products = await productRepository.list()
    return products.map(
      (product): CatalogProduct => ({
        id: product.id,
        name: product.name,
        category: product.category,
        sku: product.sku,
        price: product.price,
        stock: product.stock,
        unit: product.unit,
      })
    )
  },
}
