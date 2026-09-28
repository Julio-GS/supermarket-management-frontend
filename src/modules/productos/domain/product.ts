import { evaluateStockStatus, type StockStatus } from "./stock-status"
import type { ProductError } from "./product-error"

export type PromotionScope = "product" | "store"

export interface ProductPromotionSummary {
  id: string
  name: string
  description: string | null
  scope: PromotionScope
  type: "percentage" | "two_x_one"
  discountPercent: number | null
  startDate: string | null
  endDate: string | null
  weekdays: number[] | null
}

export interface Product {
  id: string
  name: string
  sku: string
  price: number
  cost: number
  manejaStock: boolean
  stock: number | null
  stockMinimum: number
  unit: string
  supplier: string
  promotions: ProductPromotionSummary[] | null
  storePromotions: ProductPromotionSummary[] | null
  /** Backend-defined pricing mode: "standard" (default) or "manual" (special product). */
  pricingMode?: "standard" | "manual"
  /** Whether the product is backend-protected (manual-price only, non-editable). */
  isProtected?: boolean
  /** VAT rate (e.g. 10.5 or 21). Preserved from backend DTO. */
  iva?: number | null
}

export interface CreateProductInput {
  name: string
  sku: string
  price: number
  manejaStock: boolean
  costo_neto?: number
  iva?: number
}

export interface UpdateProductInput {
  id: string
  name: string
  sku: string
  price: number
  manejaStock: boolean
  iva: number
}

export const DEFAULT_STOCK_MINIMUM = 20
export const DEFAULT_UNIT = "u"
export const DEFAULT_SUPPLIER = "Sin asignar"

export function calculateCost(price: number): number {
  return Number((price * 0.6).toFixed(2))
}

export function generateSku(sequence: number): string {
  return `NEW-${String(sequence).padStart(4, "0")}`
}

export function createProduct(input: CreateProductInput, sequence: number): Product {
  return {
    id: `P${String(sequence).padStart(3, "0")}`,
    name: input.name,
    sku: input.sku || generateSku(sequence),
    price: input.price,
    cost: calculateCost(input.price),
    manejaStock: input.manejaStock,
    stock: input.manejaStock ? 0 : null,
    stockMinimum: DEFAULT_STOCK_MINIMUM,
    unit: DEFAULT_UNIT,
    supplier: DEFAULT_SUPPLIER,
    promotions: null,
    storePromotions: null,
    iva: input.iva ?? null,
  }
}

export function getStockStatus(product: Pick<Product, "stock" | "stockMinimum">): StockStatus {
  return evaluateStockStatus(product.stock, product.stockMinimum)
}

export function validateProductPrice(price: number): ProductError | null {
  if (!Number.isFinite(price) || price < 0) {
    return {
      code: "INVALID_PRICE",
      message: "El precio debe ser un número mayor o igual a cero",
    }
  }
  return null
}
