/**
 * Ad-hoc sale item domain types and validation helpers.
 *
 * Ad-hoc items are non-catalog checkout lines entered by the cashier
 * during the scanner flow. They carry a frontend-only `draftId` and are
 * never merged with catalog rows. Validation runs before cart construction
 * and is re-checked at checkout submission.
 */

/** Draft shape for a single ad-hoc line before checkout submission. */
export interface AdHocItemDraft {
  draftId: string
  name: string
  description?: string
  unitPrice: string
  quantity: number
}

// ---- Item-level validation ----

/**
 * Validate the name field for an ad-hoc item.
 * Returns null when valid or a user-facing error string.
 */
export function validateAdHocName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return "El nombre del producto es obligatorio"
  }
  return null
}

/**
 * Validate the unit price field for an ad-hoc item.
 * Returns null when valid or a user-facing error string.
 */
export function validateAdHocPrice(unitPrice: string): string | null {
  const trimmed = unitPrice.trim()
  if (!trimmed) {
    return "El precio unitario es obligatorio"
  }
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "El precio debe ser mayor a cero"
  }
  return null
}

/**
 * Validate the quantity field for an ad-hoc item.
 * Returns null when valid or a user-facing error string.
 */
export function validateAdHocQuantity(quantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return "La cantidad debe ser un entero positivo"
  }
  return null
}

// ---- Bulk validation (runs at checkout time) ----

export interface AdHocValidationErrors {
  draftId: string
  name?: string
  unitPrice?: string
  quantity?: string
}

/**
 * Run all ad-hoc validations on a single draft and return a map of
 * field-level error messages. Returns an empty object when valid.
 */
export function validateAdHocDraft(draft: AdHocItemDraft): AdHocValidationErrors {
  const errors: AdHocValidationErrors = { draftId: draft.draftId }
  const nameErr = validateAdHocName(draft.name)
  if (nameErr) errors.name = nameErr
  const priceErr = validateAdHocPrice(draft.unitPrice)
  if (priceErr) errors.unitPrice = priceErr
  const qtyErr = validateAdHocQuantity(draft.quantity)
  if (qtyErr) errors.quantity = qtyErr
  return errors
}

/**
 * Validate a collection of ad-hoc drafts and return only those with
 * validation errors. Returns an empty array when all drafts are valid.
 */
export function validateAdHocDrafts(
  drafts: AdHocItemDraft[]
): AdHocValidationErrors[] {
  return drafts
    .map((d) => validateAdHocDraft(d))
    .filter((e) => e.name || e.unitPrice || e.quantity)
}

/**
 * Compute the line subtotal for an ad-hoc item as a number
 * (unitPrice * quantity). Returns 0 for invalid inputs.
 */
export function computeAdHocSubtotal(draft: AdHocItemDraft): number {
  const price = Number.parseFloat(draft.unitPrice)
  if (!Number.isFinite(price) || price <= 0) return 0
  const qty = draft.quantity
  if (!Number.isInteger(qty) || qty < 1) return 0
  return price * qty
}
