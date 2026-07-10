export type PromotionScope = "product" | "store"

export interface Promotion {
  id: string
  name: string
  description: string | null
  scope: PromotionScope
  productId: string | null
  type: "percentage" | "two_x_one"
  discountPercent: number | null
  startDate: string | null
  endDate: string | null
  weekdays: number[] | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

function areArraysEqual<T>(left: readonly T[] | null | undefined, right: readonly T[] | null | undefined): boolean {
  if (left === right) return true
  if (!left || !right) return false
  if (left.length !== right.length) return false

  return left.every((value, index) => Object.is(value, right[index]))
}

/**
 * Checks whether a candidate promotion conflicts with existing active promotions.
 *
 * Rules (per backend stacking model):
 * - Product-scoped promotions for the SAME product conflict — only the best wins at checkout.
 *   The frontend warns the admin but allows creation; the backend resolves best at sale time.
 * - Store-scoped promotions may stack freely — no conflict check.
 * - Disabled promotions never conflict.
 */
export function hasActivePromotionConflict(
  promotions: Promotion[],
  candidate: Pick<Promotion, "enabled" | "scope" | "productId">,
  idToExclude?: string
): boolean {
  if (!candidate.enabled) return false
  if (candidate.scope !== "product" || !candidate.productId) return false

  return promotions.some(
    (promotion) =>
      promotion.enabled &&
      promotion.scope === "product" &&
      promotion.productId === candidate.productId &&
      promotion.id !== idToExclude
  )
}

/**
 * Builds a partial update payload by comparing previous vs next domain shape.
 * Only changed fields are included in the patch.
 */
export function buildPromotionUpdatePayload(
  previous: Promotion,
  next: Omit<Promotion, "id" | "createdAt" | "updatedAt">
): Partial<Promotion> {
  const patch: Partial<Promotion> = {}

  if (previous.name !== next.name) patch.name = next.name
  if (previous.description !== next.description) patch.description = next.description
  if (previous.scope !== next.scope) patch.scope = next.scope
  if (previous.productId !== next.productId) patch.productId = next.productId
  if (previous.type !== next.type) patch.type = next.type
  if (previous.discountPercent !== next.discountPercent) patch.discountPercent = next.discountPercent
  if (previous.startDate !== next.startDate) patch.startDate = next.startDate
  if (previous.endDate !== next.endDate) patch.endDate = next.endDate
  if (!areArraysEqual(previous.weekdays, next.weekdays)) patch.weekdays = next.weekdays
  if (previous.enabled !== next.enabled) patch.enabled = next.enabled

  return patch
}
