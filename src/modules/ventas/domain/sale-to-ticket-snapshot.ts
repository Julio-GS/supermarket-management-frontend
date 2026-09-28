import type { Sale, SaleItem } from "./sale"
import type { CheckoutTicketSnapshot, TicketItemLine } from "./ticket"
import type { SplitTicketGroupDraft } from "../application/checkout-port"

/**
 * Pure adapter: persisted Sale → CheckoutTicketSnapshot for reprint.
 *
 * ALL data comes from the viewed sale. This adapter:
 * - Never queries the current product catalog.
 * - Never uses current cart state or discount rules.
 * - Never invents manual discount metadata for historical sales.
 *
 * manualDiscount / manualDiscountCents are always set to null / 0
 * because the Sale type does not carry manual-discount metadata.
 * The printed ticket will show stored totals without inventing labels.
 */
export function saleToCheckoutTicketSnapshot(sale: Sale): CheckoutTicketSnapshot {
  return {
    saleId: sale.id,
    saleDate: sale.createdAt,
    invoiceStatus: sale.invoiceStatus,

    items: sale.items.map(mapSaleItemToTicketLine),

    payments: sale.paymentMethods.map((pm) => ({
      method: pm.method,
      amount: pm.amount,
    })),

    cae: sale.cae,
    caeVto: sale.caeVto,
    cbteNro: sale.cbteNro,
    cbteTipo: sale.cbteTipo,
    ptoVta: sale.ptoVta,

    splitGroups: sale.splitTicketGroups
      ? sale.splitTicketGroups.map(mapSplitGroupToDraft)
      : undefined,

    // Authoritative sale total — MUST come from the persisted sale
    total: sale.total,

    // Historical sales do not carry manual discount metadata.
    // Do NOT invent labels; the printer will render stored totals as-is.
    manualDiscount: null,
    manualDiscountCents: 0,
    manualDiscountAmount: sale.manualDiscountAmount ?? null,
  }
}

// ---------------------------------------------------------------------------
// Internal mappers
// ---------------------------------------------------------------------------

function mapSaleItemToTicketLine(item: SaleItem): TicketItemLine {
  const isAdHoc = item.kind === "ad-hoc"
  return {
    productId: item.productId,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal,
    discountAmount: item.discountAmount,
    appliedPromotions: item.appliedPromotions.map((ap) => ({
      promotionId: ap.promotionId,
      promotionScope: ap.promotionScope,
      promotionType: ap.promotionType,
      discountAmount: ap.discountAmount,
    })),
    appliedPromotionType: item.appliedPromotionType,
    iva: item.iva != null ? item.iva : (isAdHoc ? 10.5 : null),
  }
}

function mapSplitGroupToDraft(group: {
  label: string
  items: Array<{ productId: string; quantity: number; unitPrice: string; subtotal: string }>
}): SplitTicketGroupDraft {
  return {
    label: group.label,
    items: group.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      // Historical sales do not carry row IDs — absent is correct.
    })),
  }
}
