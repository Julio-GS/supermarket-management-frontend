/**
 * Money helpers for strict decimal → cents conversion and canonical formatting.
 *
 * All operations use integer cents internally. Floating-point arithmetic
 * MUST NOT be used for totals or allocation validation.
 */

/** Cents are always whole integers (e.g., $15.50 = 1550 cents). */
export type MoneyCents = number

/**
 * Convert a decimal string to integer cents.
 * Throws on invalid, zero, or negative values.
 */
export function toCents(value: string): MoneyCents {
  const trimmed = value.trim()
  if (!trimmed || isNaN(Number(trimmed))) {
    throw new Error("Invalid money value")
  }

  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Money value must be positive")
  }

  // Multiply by 100 and round to nearest integer to avoid floating-point drift
  return Math.round(parsed * 100)
}

/**
 * Convert integer cents to canonical two-decimal string (e.g., 1550 → "15.50").
 */
export function centsToDecimal(cents: MoneyCents): string {
  return (cents / 100).toFixed(2)
}

/**
 * Compute the remaining amount in cents given the sale total and existing
 * allocations. Returns 0 when fully covered (or over-covered).
 */
export function computeRemainingCents(
  saleTotalCents: MoneyCents,
  allocatedCents: number[]
): MoneyCents {
  const sum = allocatedCents.reduce((acc, c) => acc + c, 0)
  const remaining = saleTotalCents - sum
  return remaining > 0 ? remaining : 0
}

/**
 * Convert a decimal string to non-negative integer cents.
 * Unlike `toCents`, this accepts zero, empty, and negative values,
 * clamping them to 0 instead of throwing. Use for UI draft values
 * that represent optional or not-yet-entered amounts.
 */
export function toNonNegativeCents(value: string): MoneyCents {
  const trimmed = value.trim()
  if (!trimmed || isNaN(Number(trimmed))) return 0

  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0

  return Math.round(parsed * 100)
}

/**
 * Validate a user-facing money input string.
 * Returns null if valid, or a user-facing error message.
 */
export function validateMoneyInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || isNaN(Number(trimmed))) {
    return "Total must be a number"
  }

  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed === 0) {
    return "Total must be greater than zero"
  }

  if (parsed < 0) {
    return "Total must be positive"
  }

  return null
}
