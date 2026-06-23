// Domain
export type { Category } from "./domain/category"
export { categories } from "./domain/category"
export type { StockStatus } from "./domain/stock-status"
export { evaluateStockStatus } from "./domain/stock-status"
export type { Product, CreateProductInput, UpdateProductInput } from "./domain/product"
export {
  calculateCost,
  createProduct,
  generateSku,
  getStockStatus,
  validateProductPrice,
  DEFAULT_STOCK_MINIMUM,
} from "./domain/product"
export type { ProductError, ProductErrorCode } from "./domain/product-error"
export { matchesProductSearch } from "./domain/product-search"
export type { ProductSearchable } from "./domain/product-search"

// Application
export type {
  ProductRepository,
  ProductFilters,
  ProductListQuery,
  ProductPage,
  ProductPageMeta,
  ProductSort,
} from "./application/product-repository"
export { useProductCatalog } from "./application/use-product-catalog"
export type {
  UseProductCatalogResult,
  UseProductCatalogOptions,
} from "./application/use-product-catalog"

// Infrastructure
export { createMockProductRepository } from "./infrastructure/mock-product-repository"
export { createApiProductRepository } from "./infrastructure/api-product-repository"
export { productRepository } from "./infrastructure/product-repository-instance"

// Composition
export { ProductsTableShell } from "./composition/products-table-shell"

// Presentation
export { ProductsTable } from "./presentation/products-table"
