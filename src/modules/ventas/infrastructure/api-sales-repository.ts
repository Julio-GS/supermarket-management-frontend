import { apiRequest } from "@/shared/infrastructure/api-client"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { Sale, SaleItem, SplitTicketGroup, SplitTicketGroupItem } from "../domain/sale"
import type { SalesHistoryPort, SalesHistoryQuery, SalesPage, PaginationMeta } from "../application/sales-history-port"
import type { SaleDetailPort } from "../application/sale-detail-port"

// ---- Backend DTOs ----

interface BackendSaleItemDto {
  id?: string
  product_id: string
  quantity: number
  unit_price: string
  subtotal: string
}

interface BackendSplitGroupDto {
  label: string
  items: BackendSaleItemDto[]
}

interface BackendSaleDto {
  id: string
  total: string
  payment_methods: string[]
  items: BackendSaleItemDto[]
  split_ticket_groups: BackendSplitGroupDto[] | null
  invoice_status: string
  cae: string | null
  cae_vto: string | null
  cbte_nro: string | null
  cbte_tipo: string | null
  pto_vta: string | null
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

function normalizePaymentMethod(value: string): PaymentMethodCode {
  const valid: PaymentMethodCode[] = ["cash", "transfer", "card", "qr"]
  if (valid.includes(value as PaymentMethodCode)) return value as PaymentMethodCode
  return "cash"
}

function normalizeInvoiceStatus(value: string | undefined): Sale["invoiceStatus"] {
  if (value === "issued" || value === "failed") return value
  return "none"
}

function normalizeSaleItem(dto: BackendSaleItemDto): SaleItem {
  return {
    productId: dto.product_id,
    name: "",
    quantity: dto.quantity,
    unitPrice: dto.unit_price,
    subtotal: dto.subtotal,
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
    paymentMethods: (dto.payment_methods ?? []).map(normalizePaymentMethod),
    invoiceStatus: normalizeInvoiceStatus(dto.invoice_status),
    cae: dto.cae ?? null,
    caeVto: dto.cae_vto ?? null,
    cbteNro: dto.cbte_nro ?? null,
    cbteTipo: dto.cbte_tipo ?? null,
    ptoVta: dto.pto_vta ?? null,
    invoiceRequestedAt: dto.invoice_requested_at ?? null,
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

// ---- Repository factory ----

export interface ApiSalesRepository extends SalesHistoryPort, SaleDetailPort {}

export function createApiSalesRepository(): ApiSalesRepository {
  return {
    async getSales(query?: SalesHistoryQuery): Promise<SalesPage> {
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
      const dto = await apiRequest<BackendSaleDto>(`/sales/${id}`)
      return normalizeSale(dto)
    },
  }
}
