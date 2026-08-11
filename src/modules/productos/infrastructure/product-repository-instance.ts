import type { ProductRepository, ProductPage } from "../application/product-repository"
import type { CreateProductInput, Product, UpdateProductInput } from "../domain/product"
import { createApiProductRepository } from "./api-product-repository"
import { createDesktopProductAdapter, isDesktopProductsAvailable } from "./desktop-product-adapter"
import { calculateCost } from "../domain/product"

// ---------------------------------------------------------------------------
// Desktop-aware product repository
// ---------------------------------------------------------------------------
//
// When running inside the Electron desktop shell with the offline products
// bridge available, ALL product operations — reads AND writes — are routed
// through the local-first desktop adapter. Reads (list/search/findByCode)
// query the local SQLite store without requiring a backend API call, so
// POS product search and barcode lookup work fully offline.
//
// Client-side pagination is applied to desktop list results so the
// repository contract (ProductPage) is preserved.
//
// Fallback: when the desktop bridge is absent, all operations go to the API.

const apiRepo = createApiProductRepository()

/**
 * Lazily resolved desktop adapter.
 *
 * The adapter is NOT resolved at module load time because
 * window.marketDesktop.products may not be available yet (e.g., Electron
 * preload timing, or a renderer refresh before the bridge is injected).
 * Each repository method re-checks availability per-call so the desktop
 * path is taken as soon as the bridge becomes available.
 */
let _desktopAdapter: ReturnType<typeof createDesktopProductAdapter> | null = null

function getDesktopAdapter() {
  if (_desktopAdapter) {
    return _desktopAdapter
  }

  if (!isDesktopProductsAvailable()) {
    return null
  }

  _desktopAdapter = createDesktopProductAdapter()
  return _desktopAdapter
}

/** Map a desktop OfflineProductResult to a domain Product shape. */
function desktopResultToProduct(
  result: { id: string; detalle: string; costoNeto: string | null; costoFinal: string | null;
            manejaStock: boolean; codigos: string[]; pricingMode: string; isProtected: boolean; stock?: number | null },
  overrides?: { name?: string; sku?: string; price?: number },
): Product {
  const price = overrides?.price ?? (result.costoFinal ? Number(result.costoFinal) : 0)
  return {
    id: result.id,
    name: overrides?.name ?? result.detalle,
    sku: overrides?.sku ?? result.codigos[0] ?? "",
    price,
    cost: calculateCost(price),
    manejaStock: result.manejaStock,
    stock: result.stock ?? null,
    stockMinimum: 20,
    unit: "u",
    supplier: "Sin asignar",
    promotions: null,
    storePromotions: null,
    pricingMode: result.pricingMode as "standard" | "manual" | undefined,
    isProtected: result.isProtected,
  }
}

/**
 * Primary product repository — desktop-first for reads AND writes when the
 * offline bridge is available; API fallback for browser / non-desktop runtime.
 */
export const productRepository: ProductRepository = {
  list: async (query) => {
    const desktopAdapter = getDesktopAdapter()
    if (desktopAdapter) {
      const results = await desktopAdapter.list({ search: query?.search })
      const products = results
        .filter((r) => r.success && r.product)
        .map((r) => desktopResultToProduct(r.product!))
      // Apply client-side pagination to match the ProductPage contract
      const page = query?.page ?? 1
      const limit = query?.limit ?? 100
      const total = products.length
      const totalPages = Math.max(1, Math.ceil(total / limit))
      const start = (Math.min(page, totalPages) - 1) * limit
      const paged = products.slice(start, start + limit)
      return {
        products: paged,
        meta: { page, limit, total, totalPages, hasNext: page < totalPages },
      }
    }
    return apiRepo.list(query)
  },

  findByCode: async (code) => {
    const desktopAdapter = getDesktopAdapter()
    if (desktopAdapter) {
      const result = await desktopAdapter.findByCode(code)
      if (!result.success || !result.product) return null
      return desktopResultToProduct(result.product)
    }
    return apiRepo.findByCode(code)
  },

  create: async (input: CreateProductInput): Promise<Product> => {
    const desktopAdapter = getDesktopAdapter()
    if (desktopAdapter) {
      const result = await desktopAdapter.create({
        detalle: input.name,
        costo_final: input.price ? input.price.toString() : null,
        costo_neto: input.costo_neto?.toString() ?? null,
        iva: input.iva?.toString() ?? null,
        maneja_stock: input.manejaStock,
        codigos: input.sku ? [input.sku] : [],
      })
      if (!result.success || !result.product) {
        throw new Error(result.error ?? "Desktop product create failed")
      }
      // Return product from desktop result — no API call required.
      // The write is durably persisted to SQLite + outbox by the main process.
      return desktopResultToProduct(result.product, {
        name: input.name,
        sku: input.sku,
        price: input.price,
      })
    }
    return apiRepo.create(input)
  },

  update: async (input: UpdateProductInput): Promise<Product> => {
    const desktopAdapter = getDesktopAdapter()
    if (desktopAdapter) {
      const updatePayload: Record<string, unknown> = {}
      if (input.name !== undefined) updatePayload.detalle = input.name
      if (input.price !== undefined) updatePayload.costo_final = input.price.toString()
      if (input.sku !== undefined) updatePayload.codigos = input.sku ? [input.sku] : []
      if (input.manejaStock !== undefined) updatePayload.maneja_stock = input.manejaStock
      const result = await desktopAdapter.update(input.id, updatePayload as Parameters<typeof desktopAdapter.update>[1])
      if (!result.success || !result.product) {
        throw new Error(result.error ?? "Desktop product update failed")
      }
      // Return product from desktop result — no API call required.
      return desktopResultToProduct(result.product, {
        name: input.name,
        sku: input.sku,
        price: input.price,
      })
    }
    return apiRepo.update(input)
  },

  updateStockControl: async (input): Promise<Product> => {
    const desktopAdapter = getDesktopAdapter()
    if (desktopAdapter) {
      const result = await desktopAdapter.update(input.id, { maneja_stock: input.manejaStock })
      if (!result.success || !result.product) {
        throw new Error(result.error ?? "Desktop stock-control toggle failed")
      }
      return desktopResultToProduct(result.product)
    }
    return apiRepo.updateStockControl(input)
  },

  delete: async (id: string): Promise<void> => {
    const desktopAdapter = getDesktopAdapter()
    if (desktopAdapter) {
      await desktopAdapter.delete(id)
      return
    }
    return apiRepo.delete(id)
  },
}

/**
 * Returns a direct reference to the desktop product adapter when available.
 * Use for admin components that need offline-first semantics and are willing
 * to handle the narrower type surface themselves.
 */
export function getDesktopProductAdapter() {
  return getDesktopAdapter()
}

export { isDesktopProductsAvailable }
