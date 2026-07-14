import { apiRequest } from "@/shared/infrastructure/api-client"
import type { CheckoutPort, CheckoutDraft } from "../application/checkout-port"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { Sale, SaleItem, AppliedPromotion, SplitTicketGroup, SplitTicketGroupItem, PaymentAllocation } from "../domain/sale"

interface BackendSaleItemRequestDto {
  product_id: string
  quantity: number
  line_total?: string
}

interface SplitTicketGroupRequestDto {
  label: string
  items: BackendSaleItemRequestDto[]
}

interface BackendPaymentMethodDto {
  method: string
  amount: string
}

interface CreateSaleRequestDto {
  invoice_requested: boolean
  items: BackendSaleItemRequestDto[]
  payment_methods: BackendPaymentMethodDto[]
  split_ticket_groups?: SplitTicketGroupRequestDto[]
}

interface BackendAppliedPromotionDto {
  promotion_id: string
  promotion_scope: "product" | "store"
  promotion_type: "percentage" | "two_x_one"
  discount_amount: string
}

interface BackendSaleItemDto {
  id?: string
  product_id: string
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

interface BackendSaleResponseDto {
  id: string
  user_id?: string
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

function normalizePaymentMethod(method: string): PaymentMethodCode {
  const valid: PaymentMethodCode[] = ["cash", "transfer", "card", "qr"]
  if (valid.includes(method as PaymentMethodCode)) {
    return method as PaymentMethodCode
  }
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
 * to `string | null`. The backend sends fiscal fields like `cbte_tipo` and
 * `pto_vta` as integers, not strings.
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
    name: "", // Name is not returned by backend for sale items; filled by presentation layer
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

export function createApiCheckoutAdapter(): CheckoutPort {
  return {
    async save(draft: CheckoutDraft): Promise<Sale> {
      const items: BackendSaleItemRequestDto[] = draft.items.map((item) => {
        const dto: BackendSaleItemRequestDto = {
          product_id: item.productId,
          quantity: item.quantity,
        }
        // Only include line_total for special (protected) items
        if (item.lineTotal) {
          dto.line_total = item.lineTotal
        }
        return dto
      })

      const body: CreateSaleRequestDto = {
        invoice_requested: draft.invoiceRequested,
        items,
        payment_methods: draft.paymentMethods.map((pm) => ({
          method: pm.method,
          amount: pm.amount,
        })),
      }

      // Omit split_ticket_groups unless we actually have split groups
      if (draft.splitTicketGroups && draft.splitTicketGroups.length > 0) {
        body.split_ticket_groups = draft.splitTicketGroups.map((group) => ({
          label: group.label,
          items: group.items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
          })),
        }))
      }

      const dto = await apiRequest<BackendSaleResponseDto>("/sales", {
        method: "POST",
        body: JSON.stringify(body),
      })

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
    },
  }
}
