import type { Category } from "./category"
import { evaluateStockStatus, type StockStatus } from "./stock-status"

export interface Product {
  id: string
  name: string
  category: Category
  sku: string
  price: number
  cost: number
  stock: number
  stockMinimum: number
  unit: string
  supplier: string
}

export interface CreateProductInput {
  name: string
  category: Category
  price: number
  stock: number
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
    category: input.category,
    sku: generateSku(sequence),
    price: input.price,
    cost: calculateCost(input.price),
    stock: input.stock,
    stockMinimum: DEFAULT_STOCK_MINIMUM,
    unit: DEFAULT_UNIT,
    supplier: DEFAULT_SUPPLIER,
  }
}

export function getStockStatus(product: Pick<Product, "stock" | "stockMinimum">): StockStatus {
  return evaluateStockStatus(product.stock, product.stockMinimum)
}
