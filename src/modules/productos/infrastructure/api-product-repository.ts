import { apiRequest } from "@/shared/infrastructure/api-client"
import type { ProductListQuery, ProductPage, ProductPageMeta, ProductRepository } from "../application/product-repository"
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
  promotions?: {
    id: string
    description: string
    type?: string
    discount_percent?: number
  }[] | null
}

interface BackendProductsPageDto {
  data?: BackendProductDto[]
  products?: BackendProductDto[]
  items?: BackendProductDto[]
  meta?: Partial<ProductPageMeta>
  page?: number
  limit?: number
  total?: number
  totalPages?: number
}

interface CreateProductRequestDto {
  detalle: string
  codigos: string[]
  costo_final: string
  costo_neto: string
  iva: string
  cambio_costo: string
  cambio_precio: string
  facturable: boolean
  maneja_stock: boolean
  etiqueta: string
}

interface UpdateProductRequestDto {
  detalle: string
  codigos: string[]
  costo_final: string
  costo_neto: string
  iva: string
  cambio_costo: string
  cambio_precio: string
  facturable: boolean
  maneja_stock: boolean
  etiqueta: string
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
    price,
    cost: calculateCost(price),
    stock: null,
    stockMinimum: DEFAULT_STOCK_MINIMUM,
    unit: DEFAULT_UNIT,
    supplier: DEFAULT_SUPPLIER,
    promotions: dto.promotions ?? null,
  }
}

function buildQueryString(query: ProductListQuery): string {
  const params = new URLSearchParams()
  if (query.search?.trim()) {
    params.set("search", query.search.trim())
  }
  if (query.page) {
    params.set("page", String(query.page))
  }
  if (query.limit) {
    params.set("limit", String(query.limit))
  }
  if (query.sort) {
    params.set("sort", query.sort)
  }
  const queryString = params.toString()
  return queryString ? `?${queryString}` : ""
}

function normalizeProductPage(
  response: BackendProductDto[] | BackendProductsPageDto,
  query: ProductListQuery
): ProductPage {
  const dtos = Array.isArray(response)
    ? response
    : response.data ?? response.products ?? response.items ?? []
  const page = Array.isArray(response)
    ? query.page ?? 1
    : response.meta?.page ?? response.page ?? query.page ?? 1
  const limit = Array.isArray(response)
    ? (query.limit ?? dtos.length) || 1
    : (response.meta?.limit ?? response.limit ?? query.limit ?? dtos.length) || 1
  const total = Array.isArray(response)
    ? dtos.length
    : response.meta?.total ?? response.total ?? dtos.length
  const totalPages = Array.isArray(response)
    ? Math.max(1, Math.ceil(total / limit))
    : response.meta?.totalPages ?? response.totalPages ?? Math.max(1, Math.ceil(total / limit))

  return {
    products: dtos.map(mapDtoToProduct),
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: responseHasNext(response, page, totalPages),
    },
  }
}

function responseHasNext(
  response: BackendProductDto[] | BackendProductsPageDto,
  page: number,
  totalPages: number
): boolean {
  if (!Array.isArray(response) && typeof response.meta?.hasNext === "boolean") {
    return response.meta.hasNext
  }
  return page < totalPages
}

export function createApiProductRepository(): ProductRepository {
  return {
    async list(query = {}) {
      const response = await apiRequest<BackendProductDto[] | BackendProductsPageDto>(
        `/products${buildQueryString(query)}`
      )
      return normalizeProductPage(response, query)
    },

    async create(input: CreateProductInput) {
      const now = new Date().toISOString()
      const dto = await apiRequest<BackendProductDto>("/products", {
        method: "POST",
        body: JSON.stringify({
          detalle: input.name,
          codigos: [input.sku],
          costo_final: toMoneyString(input.price),
          costo_neto: toMoneyString(input.costo_neto ?? 0),
          iva: toMoneyString(input.iva ?? 0),
          cambio_costo: now,
          cambio_precio: now,
          facturable: true,
          maneja_stock: false,
          etiqueta: "true",
        } satisfies CreateProductRequestDto),
      })
      return mapDtoToProduct(dto)
    },

    async update(input: UpdateProductInput) {
      const now = new Date().toISOString()
      const dto = await apiRequest<BackendProductDto>(`/products/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          detalle: input.name,
          codigos: [input.sku],
          costo_final: toMoneyString(input.price),
          costo_neto: toMoneyString(input.price * 0.6),
          iva: toMoneyString(0),
          cambio_costo: now,
          cambio_precio: now,
          facturable: true,
          maneja_stock: false,
          etiqueta: "true",
        } satisfies UpdateProductRequestDto),
      })
      return mapDtoToProduct(dto)
    },

    async delete(id: string) {
      await apiRequest<void>(`/products/${id}`, { method: "DELETE" })
    },
  }
}
