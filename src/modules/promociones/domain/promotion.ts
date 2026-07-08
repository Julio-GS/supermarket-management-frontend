export interface Promotion {
  id: string
  name: string
  description?: string
  type: "percentage" | "two_x_one"
  discount_percent: number | null
  startDate: string | null
  endDate: string | null
  weekdays: number[] | null
  active: boolean
  productIds: string[]
}

function areArraysEqual<T>(left: readonly T[] | null | undefined, right: readonly T[] | null | undefined): boolean {
  if (left === right) return true
  if (!left || !right) return false
  if (left.length !== right.length) return false

  return left.every((value, index) => Object.is(value, right[index]))
}

export function hasActivePromotionConflict(
  promotions: Promotion[],
  candidate: Pick<Promotion, "active" | "productIds">,
  idToExclude?: string
): boolean {
  if (!candidate.active) return false

  const productId = candidate.productIds[0]
  if (!productId) return false

  return promotions.some(
    (promotion) =>
      promotion.active &&
      promotion.productIds.includes(productId) &&
      promotion.id !== idToExclude
  )
}

export function buildPromotionUpdatePayload(
  previous: Promotion,
  next: Omit<Promotion, "id">
): Partial<Promotion> {
  const patch: Partial<Promotion> = {}

  if (previous.name !== next.name) patch.name = next.name
  if (previous.description !== next.description) patch.description = next.description
  if (previous.type !== next.type) patch.type = next.type
  if (previous.discount_percent !== next.discount_percent) patch.discount_percent = next.discount_percent
  if (previous.startDate !== next.startDate) patch.startDate = next.startDate
  if (previous.endDate !== next.endDate) patch.endDate = next.endDate
  if (!areArraysEqual(previous.weekdays, next.weekdays)) patch.weekdays = next.weekdays
  if (previous.active !== next.active) patch.active = next.active
  if (!areArraysEqual(previous.productIds, next.productIds)) patch.productIds = next.productIds

  return patch
}
