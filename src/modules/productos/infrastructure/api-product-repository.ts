import { apiRequest, BackendRequestError } from "@/shared/infrastructure/api-client"
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

import type { ProductPromotionSummary } from "../domain/product"
import { generateIdempotencyKey, PendingCreationConflictError, readPendingCreations, removePendingCreation, writePendingCreations, type ProductCreationLabelJob, type ProductCreationLabelStatus, type ProductCreationResult } from "../domain/product-creation-operation"

interface BackendProductPromotionDto {
  id: string
  name: string
  description: string | null
  scope: "product" | "store"
  type: "percentage" | "two_x_one"
  discount_percent: number | null
  start_date: string | null
  end_date: string | null
  weekdays: number[] | null
}

interface BackendProductDto {
  id: string
  detalle: string
  codigos: string[]
  costo_final: string
  maneja_stock: boolean
  stock_actual: number | null
  promotions: BackendProductPromotionDto[] | null
  store_promotions: BackendProductPromotionDto[] | null
  pricing_mode?: "standard" | "manual"
  is_protected?: boolean
  label_status?: "pending" | "not_required"
  label_job?: ProductCreationLabelJob | null
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

const FRONTEND_SUNDAY = 0
const BACKEND_SUNDAY = 7

function toMoneyString(value: number): string {
  return value.toFixed(2)
}

function buildCreateProductRequestPayload(input: CreateProductInput, now: string): string {
  return JSON.stringify({
    detalle: input.name,
    codigos: [input.sku],
    costo_final: toMoneyString(input.price),
    costo_neto: toMoneyString(input.costo_neto ?? 0),
    iva: toMoneyString(input.iva ?? 0),
    cambio_costo: now,
    cambio_precio: now,
    facturable: true,
    maneja_stock: input.manejaStock,
    etiqueta: "true",
  })
}

/**
 * Extract the stable product identity from a serialized payload by stripping
 * the volatile `cambio_costo`/`cambio_precio` timestamps. Two payloads that
 * describe the same logical product share the same stable identity even when
 * their frozen timestamps differ.
 */
function stablePayloadIdentity(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>
    const stable: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (key === "cambio_costo" || key === "cambio_precio") continue
      stable[key] = value
    }
    return JSON.stringify(stable)
  } catch {
    return payload
  }
}

function normalizeWeekdayFromBackend(weekday: number): number {
  return weekday === BACKEND_SUNDAY ? FRONTEND_SUNDAY : weekday
}

function normalizeWeekdaysFromBackend(weekdays: number[] | null): number[] | null {
  return weekdays === null ? null : weekdays.map(normalizeWeekdayFromBackend)
}

function normalizePromotionDto(dto: BackendProductPromotionDto): ProductPromotionSummary {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    scope: dto.scope,
    type: dto.type,
    discountPercent: dto.discount_percent,
    startDate: dto.start_date,
    endDate: dto.end_date,
    weekdays: normalizeWeekdaysFromBackend(dto.weekdays),
  }
}

function mapDtoToProduct(dto: BackendProductDto): Product {
  const price = Number(dto.costo_final)
  return {
    id: dto.id,
    name: dto.detalle,
    sku: dto.codigos[0] ?? "",
    price,
    cost: calculateCost(price),
    manejaStock: dto.maneja_stock,
    stock: dto.stock_actual,
    stockMinimum: DEFAULT_STOCK_MINIMUM,
    unit: DEFAULT_UNIT,
    supplier: DEFAULT_SUPPLIER,
    promotions: dto.promotions?.map(normalizePromotionDto) ?? null,
    storePromotions: dto.store_promotions?.map(normalizePromotionDto) ?? null,
    pricingMode: dto.pricing_mode,
    isProtected: dto.is_protected,
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

function extractDtos(response: BackendProductDto[] | BackendProductsPageDto): BackendProductDto[] {
  return Array.isArray(response)
    ? response
    : response.data ?? response.products ?? response.items ?? []
}

function normalizeProductPage(
  response: BackendProductDto[] | BackendProductsPageDto,
  query: ProductListQuery
): ProductPage {
  const dtos = extractDtos(response)
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

async function listProducts(query: ProductListQuery): Promise<ProductPage> {
  const response = await apiRequest<BackendProductDto[] | BackendProductsPageDto>(
    `/products${buildQueryString(query)}`
  )
  return normalizeProductPage(response, query)
}

export function createApiProductRepository(): ProductRepository & { createIdempotent(input: CreateProductInput): Promise<ProductCreationResult>; recoverPendingCreation(): Promise<Product | null> } {
  return {
    async list(query = {}) {
      return listProducts(query)
    },

    /**
     * Resolves a product by its exact barcode/code via the dedicated
     * `GET /products/code/:code` endpoint. The backend is the authoritative
     * source for the product and its metadata.
     *
     * Returns null when the backend responds with 404 (no product found) or 400 (bad request).
     */
    async findByCode(code: string) {
      const trimmed = code.trim()
      if (!trimmed) return null

      try {
        const dto = await apiRequest<BackendProductDto>(
          `/products/code/${encodeURIComponent(trimmed)}`
        )
        return mapDtoToProduct(dto)
      } catch (err) {
        if (err instanceof BackendRequestError && (err.status === 404 || err.status === 400)) {
          return null
        }
        throw err
      }
    },

    async create(input: CreateProductInput) {
      const now = new Date().toISOString()
      const dto = await apiRequest<BackendProductDto>("/products", {
        method: "POST",
        body: buildCreateProductRequestPayload(input, now),
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
          maneja_stock: input.manejaStock,
          etiqueta: "true",
        } satisfies UpdateProductRequestDto),
      })
      return mapDtoToProduct(dto)
    },

    async updateStockControl(input) {
      const dto = await apiRequest<BackendProductDto>(`/products/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({ maneja_stock: input.manejaStock }),
      })
      return mapDtoToProduct(dto)
    },

    async delete(id: string) {
      await apiRequest<void>(`/products/${id}`, { method: "DELETE" })
    },

    async createIdempotent(input: CreateProductInput): Promise<ProductCreationResult> {
      const now = new Date().toISOString()
      const store = readPendingCreations()

      // If a pending operation exists, reuse its key and frozen payload — but
      // only when the operator is retrying the SAME product. A different product
      // while an operation is pending is a terminal conflict.
      let key: string
      let payload: string
      if (store.operations.length > 0) {
        const op = store.operations[0]
        const newPayload = buildCreateProductRequestPayload(input, now)
        if (stablePayloadIdentity(newPayload) !== stablePayloadIdentity(op.serializedPayload)) {
          throw new PendingCreationConflictError(
            op.idempotencyKey,
            "Hay una creación de producto pendiente que no coincide con este producto. " +
            "Recuperala o resolvela antes de crear otro producto."
          )
        }
        key = op.idempotencyKey
        payload = op.serializedPayload
        op.attempts += 1
        op.updatedAt = now
        writePendingCreations(store)
      } else {
        // New creation: generate fresh key and freeze payload
        key = generateIdempotencyKey()
        payload = buildCreateProductRequestPayload(input, now)
        store.operations.push({
          version: 1,
          id: key,
          idempotencyKey: key,
          serializedPayload: payload,
          createdAt: now,
          updatedAt: now,
          attempts: 1,
        })
        writePendingCreations(store)
      }

      try {
        const dto = await apiRequest<BackendProductDto>("/products", {
          method: "POST",
          body: payload,
          headers: { "Idempotency-Key": key },
        })
        const product = mapDtoToProduct(dto)
        const labelStatus: ProductCreationLabelStatus = dto.label_status ?? "unknown"
        const labelJob: ProductCreationLabelJob | null = dto.label_job ?? null
        removePendingCreation(key)
        return { product, labelStatus, labelJob }
      } catch (err: unknown) {
        const status: number | undefined = (err as { status?: number }).status
        if (status === 400 || status === 409 || status === 401) removePendingCreation(key)
        throw err
      }
    },

    async recoverPendingCreation(): Promise<Product | null> {
      const store = readPendingCreations()
      if (store.operations.length === 0) return null
      const op = store.operations[0]
      op.attempts += 1
      op.updatedAt = new Date().toISOString()
      writePendingCreations(store)

      try {
        const dto = await apiRequest<BackendProductDto>("/products", {
          method: "POST",
          body: op.serializedPayload,
          headers: { "Idempotency-Key": op.idempotencyKey },
        })
        const product = mapDtoToProduct(dto)
        removePendingCreation(op.idempotencyKey)
        return product
      } catch (err: unknown) {
        const status: number | undefined = (err as { status?: number }).status
        if (status === 400 || status === 409 || status === 401) removePendingCreation(op.idempotencyKey)
        throw err
      }
    },
  }
}
