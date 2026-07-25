import { apiRequest } from "@/shared/infrastructure/api-client"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { Sale, SaleItem, AppliedPromotion, SplitTicketGroup, SplitTicketGroupItem, PaymentAllocation } from "../domain/sale"
import type { SalesHistoryPort, SalesHistoryQuery, SalesPage, PaginationMeta } from "../application/sales-history-port"
import type { SaleDetailPort } from "../application/sale-detail-port"

// ---- Backend DTOs ----

interface BackendAppliedPromotionDto {
  promotion_id: string
  promotion_scope: "product" | "store"
  promotion_type: "percentage" | "two_x_one"
  discount_amount: string
}

interface BackendSaleItemDto {
  id?: string
  product_id: string
  /** Ad-hoc name from backend response — empty string for catalog items. */
  name?: string
  /** Ad-hoc description from backend response. */
  description?: string
  quantity: number
  unit_price: string
  subtotal: string
  discount_amount: string
  applied_promotions: BackendAppliedPromotionDto[]
  applied_promotion_id: string | null
  applied_promotion_type: string | null
}

interface BackendSplitGroupDto {
  label: string
  items: BackendSaleItemDto[]
}

interface BackendPaymentMethodDto {
  method: string
  amount: string
}

interface BackendSaleDto {
  id: string
  total: string
  payment_methods: BackendPaymentMethodDto[]
  items: BackendSaleItemDto[]
  split_ticket_groups: BackendSplitGroupDto[] | null
  invoice_status: string
  /** May arrive as string or number from the backend */
  cae: string | number | null
  cae_vto: string | number | null
  cbte_nro: string | number | null
  cbte_tipo: string | number | null
  pto_vta: string | number | null
  invoice_requested_at: string | null
  created_at: string
  updated_at: string
}

interface PaginatedResponseDto {
  data: BackendSaleDto[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
  }
}

// ---- Normalization helpers ----

function normalizePaymentMethod(method: string): PaymentMethodCode {
  const valid: PaymentMethodCode[] = ["cash", "transfer", "card", "qr"]
  if (valid.includes(method as PaymentMethodCode)) return method as PaymentMethodCode
  return "cash"
}

function normalizePaymentAllocation(dto: BackendPaymentMethodDto): PaymentAllocation {
  return {
    method: normalizePaymentMethod(dto.method),
    amount: dto.amount,
  }
}

function normalizeInvoiceStatus(value: string | undefined): Sale["invoiceStatus"] {
  if (value === "issued" || value === "failed") return value
  return "none"
}

/**
 * Converts a backend value that may arrive as string, number, or null/undefined
 * to `string | null`. Fiscal fields like `cbte_tipo` and `pto_vta` may be
 * returned as integers by the backend.
 */
function toStringOrNull(value: string | number | null | undefined): string | null {
  if (value == null) return null
  return String(value)
}

function normalizeAppliedPromotions(dtos: BackendAppliedPromotionDto[] | undefined): AppliedPromotion[] {
  if (!dtos || !Array.isArray(dtos)) return []
  return dtos.map((dto) => ({
    promotionId: dto.promotion_id,
    promotionScope: dto.promotion_scope,
    promotionType: dto.promotion_type,
    discountAmount: dto.discount_amount,
  }))
}

function normalizeSaleItem(dto: BackendSaleItemDto): SaleItem {
  return {
    productId: dto.product_id,
    name: dto.name ?? "",
    description: dto.description,
    quantity: dto.quantity,
    unitPrice: dto.unit_price,
    subtotal: dto.subtotal,
    discountAmount: dto.discount_amount ?? "0.00",
    appliedPromotions: normalizeAppliedPromotions(dto.applied_promotions),
    appliedPromotionId: dto.applied_promotion_id ?? null,
    appliedPromotionType: dto.applied_promotion_type ?? null,
  }
}

function normalizeSplitGroup(dto: BackendSplitGroupDto): SplitTicketGroup {
  return {
    label: dto.label,
    items: dto.items.map(
      (item): SplitTicketGroupItem => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal,
      })
    ),
  }
}

function normalizeSale(dto: BackendSaleDto): Sale {
  return {
    id: dto.id,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    customer: "Mostrador",
    items: (dto.items ?? []).map(normalizeSaleItem),
    total: dto.total,
    paymentMethods: (dto.payment_methods ?? []).map(normalizePaymentAllocation),
    invoiceStatus: normalizeInvoiceStatus(dto.invoice_status),
    cae: toStringOrNull(dto.cae),
    caeVto: toStringOrNull(dto.cae_vto),
    cbteNro: toStringOrNull(dto.cbte_nro),
    cbteTipo: toStringOrNull(dto.cbte_tipo),
    ptoVta: toStringOrNull(dto.pto_vta),
    invoiceRequestedAt: toStringOrNull(dto.invoice_requested_at),
    splitTicketGroups: dto.split_ticket_groups
      ? dto.split_ticket_groups.map(normalizeSplitGroup)
      : null,
  }
}

/**
 * Detects whether the raw GET /sales response is a legacy plain array
 * or a paginated wrapper `{ data, meta }`, and normalizes both to `SalesPage`.
 */
function normalizeSalesPage(raw: unknown): SalesPage {
  // Legacy: plain array
  if (Array.isArray(raw)) {
    return {
      data: (raw as BackendSaleDto[]).map(normalizeSale),
    }
  }

  // Paginated: { data, meta }
  if (raw && typeof raw === "object" && "data" in raw && Array.isArray((raw as PaginatedResponseDto).data)) {
    const paginated = raw as PaginatedResponseDto
    return {
      data: paginated.data.map(normalizeSale),
      meta: paginated.meta
        ? {
            page: paginated.meta.page,
            limit: paginated.meta.limit,
            total: paginated.meta.total,
            totalPages: paginated.meta.totalPages,
            hasNext: paginated.meta.hasNext,
          }
        : undefined,
    }
  }

  // Unknown — return empty
  return { data: [] }
}

// ---- Desktop bridge normalization ----

function isDesktopSalesBridgeAvailable(): boolean {
  if (typeof window === "undefined") return false
  return window.marketDesktop?.sales?.list !== undefined && window.marketDesktop?.sales?.get !== undefined
}

function paginateSales(data: Sale[], query?: SalesHistoryQuery): SalesPage {
  const page = query?.page ?? 1
  const limit = (query?.limit ?? data.length) || 1
  const start = (page - 1) * limit
  const paged = data.slice(start, start + limit)
  const total = data.length
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return {
    data: paged,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
    },
  }
}

function normalizeDesktopSale(sale: {
  id: string
  total: string
  customer: string
  invoiceStatus: Sale["invoiceStatus"]
  createdAt: string
  updatedAt?: string
  items?: Array<{
    productId: string
    name: string
    description?: string
    quantity: number
    unitPrice: string
    subtotal: string
    discountAmount?: string
    appliedPromotions?: AppliedPromotion[]
    appliedPromotionId?: string | null
    appliedPromotionType?: string | null
  }>
  paymentMethods?: Array<{ method: string; amount: string }>
  splitTicketGroups?: Sale["splitTicketGroups"]
  cae?: string | null
  caeVto?: string | null
  cbteNro?: string | null
  cbteTipo?: string | null
  ptoVta?: string | null
  invoiceRequestedAt?: string | null
}): Sale {
  return {
    id: sale.id,
    total: sale.total,
    customer: sale.customer,
    invoiceStatus: sale.invoiceStatus,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt ?? sale.createdAt,
    items: (sale.items ?? []).map((item) => ({
      ...item,
      name: item.name ?? "",
      discountAmount: item.discountAmount ?? "0.00",
      appliedPromotions: item.appliedPromotions ?? [],
      appliedPromotionId: item.appliedPromotionId ?? null,
      appliedPromotionType: item.appliedPromotionType ?? null,
    })),
    paymentMethods: (sale.paymentMethods ?? []).map((payment) => ({
      method: normalizePaymentMethod(payment.method),
      amount: payment.amount,
    })),
    splitTicketGroups: sale.splitTicketGroups ?? null,
    cae: sale.cae ?? null,
    caeVto: sale.caeVto ?? null,
    cbteNro: sale.cbteNro ?? null,
    cbteTipo: sale.cbteTipo ?? null,
    ptoVta: sale.ptoVta ?? null,
    invoiceRequestedAt: sale.invoiceRequestedAt ?? null,
  }
}

// ---- Repository factory ----

export interface ApiSalesRepository extends SalesHistoryPort, SaleDetailPort {}

export function createApiSalesRepository(): ApiSalesRepository {
  return {
    async getSales(query?: SalesHistoryQuery): Promise<SalesPage> {
      if (isDesktopSalesBridgeAvailable()) {
        const sales = await window.marketDesktop!.sales!.list()
        return paginateSales(sales.map(normalizeDesktopSale), query)
      }

      const params = new URLSearchParams()
      if (query?.page) params.set("page", String(query.page))
      if (query?.limit) params.set("limit", String(query.limit))
      if (query?.sort) params.set("sort", query.sort)

      const queryString = params.toString()
      const path = queryString ? `/sales?${queryString}` : "/sales"

      const raw = await apiRequest<unknown>(path)
      return normalizeSalesPage(raw)
    },

    async getById(id: string): Promise<Sale> {
      if (isDesktopSalesBridgeAvailable()) {
        const result = await window.marketDesktop!.sales!.get(id)
        if (!result.success || !result.sale) {
          throw new Error(result.error ?? "Sale not found")
        }
        return normalizeDesktopSale(result.sale)
      }

      const dto = await apiRequest<BackendSaleDto>(`/sales/${id}`)
      return normalizeSale(dto)
    },
  }
}
