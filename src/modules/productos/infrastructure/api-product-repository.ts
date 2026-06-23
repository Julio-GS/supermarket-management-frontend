import { apiRequest } from "@/shared/infrastructure/api-client"
import type { ProductRepository, ProductFilters } from "../application/product-repository"
import type { Category, categories } from "../domain/category"
import {
  calculateCost,
  DEFAULT_STOCK_MINIMUM,
  DEFAULT_SUPPLIER,
  DEFAULT_UNIT,
  type CreateProductInput,
  type Product,
  type UpdateProductInput,
} from "../domain/product"

interface BackendProductDto {
  id: string
  detalle: string
  codigos: string[]
  costo_final: string
  maneja_stock: boolean
  categoria?: string
}

interface CreateProductRequestDto {
  detalle: string
  codigos: string[]
  costo_final: string
  categoria: Category
}

interface UpdateProductRequestDto {
  detalle: string
  codigos: string[]
  costo_final: string
}

type CategoryValue = (typeof categories)[number]

function normalizeCategory(raw: string | undefined): CategoryValue {
  const value = raw?.trim()
  if (!value) return "Despensa"

  const knownCategories: Record<string, CategoryValue> = {
    "Frutas y Verduras": "Frutas y Verduras",
    "Lácteos": "Lácteos",
    Carnes: "Carnes",
    Panadería: "Panadería",
    Bebidas: "Bebidas",
    Limpieza: "Limpieza",
    Despensa: "Despensa",
    Congelados: "Congelados",
  }

  return knownCategories[value] ?? "Despensa"
}

function toMoneyString(value: number): string {
  return value.toFixed(2)
}

function mapDtoToProduct(dto: BackendProductDto): Product {
  const price = Number(dto.costo_final)
  return {
    id: dto.id,
    name: dto.detalle,
    sku: dto.codigos[0] ?? "",
    category: normalizeCategory(dto.categoria),
    price,
    cost: calculateCost(price),
    stock: null,
    stockMinimum: DEFAULT_STOCK_MINIMUM,
    unit: DEFAULT_UNIT,
    supplier: DEFAULT_SUPPLIER,
  }
}

function buildQueryString(filters: ProductFilters): string {
  const params = new URLSearchParams()
  if (filters.search) {
    params.set("search", filters.search)
  }
  if (filters.category && filters.category !== "all") {
    params.set("category", filters.category)
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}

export function createApiProductRepository(): ProductRepository {
  return {
    async list(filters = {}) {
      const dtos = await apiRequest<BackendProductDto[]>(`/products${buildQueryString(filters)}`)
      return dtos.map(mapDtoToProduct)
    },

    async create(input: CreateProductInput) {
      const dto = await apiRequest<BackendProductDto>("/products", {
        method: "POST",
        body: JSON.stringify({
          detalle: input.name,
          codigos: [input.sku],
          costo_final: toMoneyString(input.price),
          categoria: input.category,
        } satisfies CreateProductRequestDto),
      })
      return mapDtoToProduct(dto)
    },

    async update(input: UpdateProductInput) {
      const dto = await apiRequest<BackendProductDto>(`/products/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          detalle: input.name,
          codigos: [input.sku],
          costo_final: toMoneyString(input.price),
        } satisfies UpdateProductRequestDto),
      })
      return mapDtoToProduct(dto)
    },

    async delete(id: string) {
      await apiRequest<void>(`/products/${id}`, { method: "DELETE" })
    },
  }
}
