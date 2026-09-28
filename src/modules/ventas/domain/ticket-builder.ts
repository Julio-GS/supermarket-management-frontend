import type { PaymentAllocation } from "./sale"
import type {
  CheckoutTicketSnapshot,
  FiscalInfo,
  FiscalValidationResult,
  PrintableTicket,
  TicketItemLine,
} from "./ticket"

/** AFIP fiscal field keys required for a valid fiscal ticket */
export const FISCAL_REQUIRED_FIELDS = [
  "cae",
  "caeVto",
  "cbteNro",
  "cbteTipo",
  "ptoVta",
] as const

/**
 * Checks whether a VAT rate is business-supported for fiscal emission (10.5% or 21%).
 */
export function isSupportedVatRate(rate: unknown): rate is 10.5 | 21 {
  return rate === 10.5 || rate === 21
}

/**
 * Validates that every line in a fiscal ticket has a supported VAT rate (10.5% or 21%).
 * Returns FiscalValidationResult on the first invalid item, or null if all are valid.
 */
export function validateFiscalItemVat(items: TicketItemLine[]): FiscalValidationResult | null {
  for (const item of items) {
    if (!isSupportedVatRate(item.iva)) {
      return {
        ok: false,
        reason: `Alícuota de IVA inválida para el producto "${item.name}": se requiere 10.5% o 21% (recibido: ${item.iva ?? "sin IVA"})`,
        missingFields: !item.iva && item.iva !== 0 ? ["iva"] : [],
      }
    }
  }
  return null
}

/**
 * Check which fiscal fields are missing from a raw values record.
 * Centralized fiscal validation — use this from UI and domain layers
 * to avoid drift.
 *
 * Returns the list of missing field names (empty array = all present).
 */
export function checkFiscalFields(
  fields: Record<string, string | null>
): string[] {
  const missing: string[] = []

  for (const field of FISCAL_REQUIRED_FIELDS) {
    const value = fields[field]
    if (!value || (typeof value === "string" && value.trim() === "")) {
      missing.push(field)
    }
  }

  return missing
}

/**
 * Validate that all required fiscal fields are non-null and non-empty.
 * Returns ok:true if valid, ok:false with missing field names otherwise.
 */
export function validateFiscalFields(
  snapshot: CheckoutTicketSnapshot
): FiscalValidationResult | null {
  const missing = checkFiscalFields(snapshot as unknown as Record<string, string | null>)

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Fiscal fields missing: ${missing.join(", ")}`,
      missingFields: missing,
    }
  }

  return null // valid
}

/**
 * Compute pricing totals for a set of item lines as internal-precision numbers.
 */
function calculateTicketAmounts(items: TicketItemLine[]): {
  subtotal: number
  discount: number
  finalTotal: number
} {
  const subtotal = items.reduce((sum, item) => {
    const value = Number.parseFloat(item.subtotal)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)

  const discount = items.reduce((sum, item) => {
    const value = Number.parseFloat(item.discountAmount)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)

  return {
    subtotal,
    discount,
    finalTotal: Math.max(0, subtotal - discount),
  }
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * Allocate sale-level payments proportionally across ticket totals.
 *
 * Each payment amount is split by the ratio `ticketTotal / grandTotal`.
 * The last ticket absorbs any rounding difference so the total is exact.
 *
 * Returns a new array of payment allocations for each ticket.
 */
function allocatePayments(
  ticketTotals: number[],
  salePayments: PaymentAllocation[],
): PaymentAllocation[][] {
  const grandTotal = ticketTotals.reduce((sum, t) => sum + t, 0)

  // If there's nothing to allocate (empty cart edge case), return empty arrays
  if (grandTotal === 0 || ticketTotals.length === 0) {
    return ticketTotals.map(() => [])
  }

  const allocations: PaymentAllocation[][] = ticketTotals.map(() => [])

  for (const payment of salePayments) {
    const paymentAmount = Number.parseFloat(payment.amount)
    if (!Number.isFinite(paymentAmount)) continue

    let allocated = 0

    for (let i = 0; i < ticketTotals.length; i++) {
      const isLast = i === ticketTotals.length - 1
      const ratio = ticketTotals[i] / grandTotal

      let share: number
      if (isLast) {
        // Last ticket absorbs rounding difference
        share = paymentAmount - allocated
      } else {
        share = Math.round(paymentAmount * ratio * 100) / 100
      }

      if (share > 0.001) {
        allocations[i].push({
          method: payment.method,
          amount: share.toFixed(2),
        })
        allocated += share
      }
    }
  }

  return allocations
}

/**
 * Build printable tickets from the checkout snapshot.
 *
 * Rules:
 * - If invoiceStatus === "issued" and ANY fiscal field is missing, returns a
 *   FiscalValidationResult error — no tickets are built.
 * - If invoiceStatus !== "issued", produces nonFiscal format.
 * - If snapshot has splitGroups, generates one ticket per group (items grouped
 *   by productId within each group's draft, matched against snapshot items).
 * - If no splitGroups, generates exactly one ticket with all items.
 * - Payments are allocated proportionally across tickets by subtotal ratio.
 * - Snapshot.total is authoritative for non-split tickets; split tickets
 *   allocate the authoritative total proportionally by item-derived totals.
 */
export function buildPrintableTickets(
  snapshot: CheckoutTicketSnapshot
): PrintableTicket[] | FiscalValidationResult {
  // Fiscal validation — must pass for "issued" status
  if (snapshot.invoiceStatus === "issued") {
    const fiscalError = validateFiscalFields(snapshot)
    if (fiscalError) return fiscalError

    const vatError = validateFiscalItemVat(snapshot.items)
    if (vatError) return vatError
  }

  const format: "fiscal" | "nonFiscal" =
    snapshot.invoiceStatus === "issued" ? "fiscal" : "nonFiscal"

  const fiscal: FiscalInfo | null =
    format === "fiscal"
      ? {
          cae: snapshot.cae!,
          caeVto: snapshot.caeVto!,
          cbteNro: snapshot.cbteNro!,
          cbteTipo: snapshot.cbteTipo!,
          ptoVta: snapshot.ptoVta!,
        }
      : null

  // Group items by split group or single group
  const itemGroups: { label?: string; items: TicketItemLine[] }[] = []

  if (snapshot.splitGroups && snapshot.splitGroups.length > 0) {
    // Build a lookup: productId → snapshot item
    const itemByProductId = new Map<string, TicketItemLine>()
    for (const item of snapshot.items) {
      itemByProductId.set(item.productId, item)
    }

    for (const group of snapshot.splitGroups) {
      const groupItems: TicketItemLine[] = []

      for (const draftItem of group.items) {
        // When authoritative unitPrice/subtotal are present (historical reprint),
        // use them directly instead of deriving from the productId map.
        // This preserves repeated productIds across split groups.
        if (draftItem.unitPrice && draftItem.subtotal) {
          const snapshotItem = itemByProductId.get(draftItem.productId)
          groupItems.push({
            productId: draftItem.productId,
            name: snapshotItem?.name ?? "",
            description: snapshotItem?.description,
            quantity: draftItem.quantity,
            unitPrice: draftItem.unitPrice,
            subtotal: draftItem.subtotal,
            discountAmount: "0.00",
            appliedPromotions: snapshotItem?.appliedPromotions ?? [],
            appliedPromotionType: snapshotItem?.appliedPromotionType ?? null,
            iva: snapshotItem?.iva,
          })
          continue
        }

        const snapshotItem = itemByProductId.get(draftItem.productId)
        if (snapshotItem) {
          // Create a proportional line: adjust quantity and subtotal
          // if the draft quantity differs from the snapshot item quantity
          const ratio = snapshotItem.quantity > 0
            ? draftItem.quantity / snapshotItem.quantity
            : 0
          const adjustedSubtotal = (
            Number.parseFloat(snapshotItem.subtotal) * ratio
          ).toFixed(2)

          groupItems.push({
            ...snapshotItem,
            quantity: draftItem.quantity,
            subtotal: adjustedSubtotal,
            discountAmount: snapshotItem.discountAmount && Number.parseFloat(snapshotItem.discountAmount) > 0 ? (Number.parseFloat(snapshotItem.discountAmount) * ratio).toFixed(2) : "0.00",
            appliedPromotions: snapshotItem.appliedPromotions,
          })
        }
      }

      if (groupItems.length > 0) {
        itemGroups.push({ label: group.label, items: groupItems })
      }
    }

    // If every split group produced zero items (all productIds missing from
    // snapshot), the data is inconsistent — block instead of silently falling
    // back to a single ticket, so the UI doesn't claim N tickets and print 1.
    if (snapshot.splitGroups.length > 0 && itemGroups.length === 0) {
      return {
        ok: false,
        reason:
          "Split group data mismatch: no items in any group could be matched to the sale snapshot",
        missingFields: [],
      }
    }

    // If some groups are empty after matching, the builder already drops them
    // above, but we still produce tickets for the non-empty groups. This
    // should not happen in normal flow — the checkout validation should
    // prevent empty groups from reaching the builder.
    if (itemGroups.length === 0) {
      itemGroups.push({ items: snapshot.items })
    }
  } else {
    itemGroups.push({ items: snapshot.items })
  }

  // Compute per-ticket totals from items (used as fallback / allocation base)
  const ticketAmounts = itemGroups.map((group) => calculateTicketAmounts(group.items))
  const ticketTotals = ticketAmounts.map((amounts) => amounts.finalTotal)

  // Use authoritative sale total for non-split tickets.
  // For split tickets, allocate proportionally from the authoritative total.
  const authoritativeTotal = Number.parseFloat(snapshot.total)
  const hasAuthoritativeTotal = Number.isFinite(authoritativeTotal) && authoritativeTotal > 0

  let finalTotals: number[]
  if (hasAuthoritativeTotal && itemGroups.length === 1) {
    // Non-split: use authoritative total directly
    finalTotals = [authoritativeTotal]
  } else if (hasAuthoritativeTotal && itemGroups.length > 1) {
    // Split: allocate authoritative total proportionally by item-derived totals
    const derivedGrandTotal = ticketTotals.reduce((sum, t) => sum + t, 0)
    if (derivedGrandTotal > 0) {
      let allocated = 0
      finalTotals = ticketTotals.map((t, i) => {
        const isLast = i === ticketTotals.length - 1
        if (isLast) {
          return roundCurrency(authoritativeTotal - allocated)
        }
        const share = roundCurrency(authoritativeTotal * (t / derivedGrandTotal))
        allocated += share
        return share
      })
    } else {
      finalTotals = ticketTotals
    }
  } else {
    // No authoritative total — fall back to item-derived totals
    finalTotals = ticketTotals
  }

  // Allocate payments proportionally
  const paymentAllocations = allocatePayments(ticketTotals, snapshot.payments)

  // Build tickets
  return itemGroups.map((group, i) => ({
    format,
    groupLabel: group.label,
    saleId: snapshot.saleId,
    saleDate: snapshot.saleDate,
    items: group.items,
    total: finalTotals[i].toFixed(2),
    payments: paymentAllocations[i],
    fiscal,
    manualDiscount: snapshot.manualDiscount,
    manualDiscountCents: snapshot.manualDiscountCents,
    manualDiscountAmount: snapshot.manualDiscountAmount ?? null,
  }))
}
