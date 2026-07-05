import { apiRequest } from "@/shared/infrastructure/api-client"
import type { CheckoutPort, CheckoutDraft } from "../application/checkout-port"
import type { PaymentMethodCode } from "../domain/payment-method"
import type { Sale, SaleItem, SplitTicketGroup, SplitTicketGroupItem } from "../domain/sale"

interface BackendSaleItemRequestDto {
  product_id: string
  quantity: number
}

interface SplitTicketGroupRequestDto {
  label: string
  items: BackendSaleItemRequestDto[]
}

interface CreateSaleRequestDto {
  invoice_requested: boolean
  items: BackendSaleItemRequestDto[]
  payment_methods: string[]
  split_ticket_groups?: SplitTicketGroupRequestDto[]
}

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

interface BackendSaleResponseDto {
  id: string
  user_id?: string
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

function normalizePaymentMethod(value: string): PaymentMethodCode {
  const valid: PaymentMethodCode[] = ["cash", "transfer", "card", "qr"]
  if (valid.includes(value as PaymentMethodCode)) {
    return value as PaymentMethodCode
  }
  return "cash"
}

function normalizeInvoiceStatus(value: string | undefined): Sale["invoiceStatus"] {
  if (value === "issued" || value === "failed") return value
  return "none"
}

function normalizeSaleItem(dto: BackendSaleItemDto): SaleItem {
  return {
    productId: dto.product_id,
    name: "", // Name is not returned by backend for sale items; filled by presentation layer
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

export function createApiCheckoutAdapter(): CheckoutPort {
  return {
    async save(draft: CheckoutDraft): Promise<Sale> {
      const items: BackendSaleItemRequestDto[] = draft.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      }))

      const body: CreateSaleRequestDto = {
        invoice_requested: draft.invoiceRequested,
        items,
        payment_methods: draft.paymentMethods,
      }

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
    },
  }
}
