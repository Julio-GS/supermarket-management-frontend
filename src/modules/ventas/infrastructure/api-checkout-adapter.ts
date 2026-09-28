import { apiRequest } from "@/shared/infrastructure/api-client"
import type { CheckoutPort, CheckoutDraft, CheckoutItemDraft, ItemSplitTicketDraft, ManualDiscountDraft } from "../application/checkout-port"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { Sale, SaleItem, AppliedPromotion, SplitTicketGroup, SplitTicketGroupItem, PaymentAllocation } from "../domain/sale"
import { parseInvoiceStatus, parseSaleItemKind } from "../domain/sale"

// ---- Backend request DTOs ----

interface BackendCatalogItemRequestDto {
  product_id: string
  quantity: number
  line_total?: string
  split_ticket?: BackendItemSplitDto
}

interface BackendAdHocItemRequestDto {
  name: string
  description?: string
  unit_price: string
  quantity: number
  split_ticket?: BackendItemSplitDto
}

type BackendSaleItemRequestDto = BackendCatalogItemRequestDto | BackendAdHocItemRequestDto

interface BackendItemSplitDto {
  group_1_quantity: number
  group_2_quantity: number
}

interface SplitTicketGroupRequestDto {
  label: string
  items: { product_id: string; quantity: number }[]
}

interface BackendPaymentMethodDto {
  method: string
  amount: string
}

interface BackendManualDiscountRequestDto {
  modality: "fixed" | "percentage"
  amount: string
  percentage?: string
}

interface CreateSaleRequestDto {
  invoice_requested: boolean
  items: BackendSaleItemRequestDto[]
  payment_methods: BackendPaymentMethodDto[]
  split_ticket_groups?: SplitTicketGroupRequestDto[]
  manual_discount?: BackendManualDiscountRequestDto
}

function serializeManualDiscount(
  discount: ManualDiscountDraft | undefined
): BackendManualDiscountRequestDto | undefined {
  if (!discount) return undefined
  if (discount.modality === "fixed") {
    return { modality: "fixed", amount: discount.amount }
  }
  return { modality: "percentage", percentage: discount.percentage, amount: discount.amount }
}

// ---- Backend response DTOs ----

interface BackendAppliedPromotionDto {
  promotion_id: string
  promotion_scope: "product" | "store"
  promotion_type: "percentage" | "two_x_one"
  discount_amount: string
}

interface BackendSaleItemDto {
  id?: string
  product_id: string
  /** Ad-hoc name from backend response (empty string for catalog items). */
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
  iva?: string | number | null
  kind?: string | null
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
  cae_vto: string | null  // compact YYYYMMDD per backend contract
  cbte_nro: string | number | null
  cbte_tipo: string | number | null
  pto_vta: string | number | null
  invoice_requested_at: string | null
  created_at: string
  updated_at: string
  manual_discount_amount: string | null
  manual_discount_modality: "fixed" | "percentage" | null
  manual_discount_percentage: string | null
}

// ---- Normalization helpers ----

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
      return parseInvoiceStatus(value)
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

function parseVatRate(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
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
    iva: parseVatRate(dto.iva),
    kind: parseSaleItemKind(dto.kind),
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

// ---- Serialization helpers ----

function serializeSplitTicket(split?: ItemSplitTicketDraft): BackendItemSplitDto | undefined {
  if (!split) return undefined
  return {
    group_1_quantity: split.group_1_quantity,
    group_2_quantity: split.group_2_quantity,
  }
}

function serializeCheckoutItem(item: CheckoutItemDraft): BackendSaleItemRequestDto {
  switch (item.kind) {
    case "catalog-fixed":
      return {
        product_id: item.productId,
        quantity: item.quantity,
        split_ticket: serializeSplitTicket(item.splitTicket),
      }
    case "catalog-manual":
      return {
        product_id: item.productId,
        quantity: 1,
        line_total: item.lineTotal,
        split_ticket: serializeSplitTicket(item.splitTicket),
      }
    case "ad-hoc": {
      const dto: BackendAdHocItemRequestDto = {
        name: item.name,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        split_ticket: serializeSplitTicket(item.splitTicket),
      }
      if (item.description) {
        dto.description = item.description
      }
      return dto
    }
  }
}

/**
 * Returns true when any checkout item is ad-hoc.
 * Used to decide whether to omit top-level split_ticket_groups.
 */
function hasAdHocItems(items: CheckoutItemDraft[]): boolean {
  return items.some((item) => item.kind === "ad-hoc")
}

// ---- Adapter factory ----

export function createApiCheckoutAdapter(): CheckoutPort {
  return {
    async save(draft: CheckoutDraft): Promise<Sale> {
      // Decide split-ticket serialization mode once
      const mixedWithAdHoc = hasAdHocItems(draft.items)
      const useTopLevelGroups =
        !mixedWithAdHoc && draft.splitTicketGroups && draft.splitTicketGroups.length > 0

      // Serialize items: strip per-item split_ticket when top-level groups are used
      const requestItems: BackendSaleItemRequestDto[] = draft.items.map((item) => {
        const dto = serializeCheckoutItem(item)
        if (useTopLevelGroups && "split_ticket" in dto) {
          delete dto.split_ticket
        }
        return dto
      })

      const body: CreateSaleRequestDto = {
        invoice_requested: draft.invoiceRequested,
        items: requestItems,
        payment_methods: draft.paymentMethods.map((pm) => ({
          method: pm.method,
          amount: pm.amount,
        })),
      }

      const manualDiscount = serializeManualDiscount(draft.manualDiscount)
      if (manualDiscount) {
        body.manual_discount = manualDiscount
      }

      // Top-level split_ticket_groups reference items by product_id.
      // When any ad-hoc item is present, those items lack a client-known product_id,
      // so we MUST NOT send top-level groups. Per-item split_ticket handles ad-hoc/mixed splits.
      if (useTopLevelGroups) {
        body.split_ticket_groups = draft.splitTicketGroups!.map((group) => ({
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

      const responseItems = dto.items ?? []
      const items: SaleItem[] = responseItems.map(normalizeSaleItem)

      return {
        id: dto.id,
        createdAt: dto.created_at,
        updatedAt: dto.updated_at,
        customer: "Mostrador",
        items,
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
        manualDiscountAmount: dto.manual_discount_amount ?? null,
        manualDiscountModality: dto.manual_discount_modality ?? null,
        manualDiscountPercentage: dto.manual_discount_percentage ?? null,
      }
    },
  }
}
