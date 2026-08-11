/**
 * Pure CAE expiration date formatter.
 *
 * Parses and displays CAE expiration values from the backend transport
 * without ever producing "Invalid Date" or shifting the calendar day
 * due to browser timezone interpretation.
 *
 * Backend contract (observation 81):
 * - Transport field: `cae_vto: string | null`
 * - Format: `YYYYMMDD` (compact)
 * - No backend `caeVto` alias
 *
 * This formatter also accepts ISO date-only (`YYYY-MM-DD`) and full ISO
 * timestamps for legacy / desktop fixture compatibility, but always
 * renders the intended calendar date.
 */

export type CaeExpirationDisplay =
  | { kind: "empty" }
  | { kind: "formatted"; label: string }
  | { kind: "unavailable"; label: string }

const UNAVAILABLE_LABEL = "Fecha no disponible"

/**
 * Validates whether the given year, month, day form a real calendar date.
 * Month is 1-indexed (1–12).
 */
function isValidCalendarDate(y: number, m: number, d: number): boolean {
  if (!Number.isFinite(y) || y < 1 || y > 9999) return false
  if (!Number.isFinite(m) || m < 1 || m > 12) return false
  if (!Number.isFinite(d) || d < 1) return false

  const daysInMonth = new Date(y, m, 0).getDate() // last day of the month
  return d <= daysInMonth
}

/**
 * Parse compact `YYYYMMDD` (8 digits) or ISO `YYYY-MM-DD` (10 chars)
 * without going through the `Date` constructor for parsing.
 *
 * Returns `null` when the string doesn't match any recognised pattern
 * or when the extracted date components don't form a valid calendar date.
 */
function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  // Compact YYYYMMDD — 8 digits
  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4))
    const month = Number(value.slice(4, 6))
    const day = Number(value.slice(6, 8))
    if (isValidCalendarDate(year, month, day)) {
      return { year, month, day }
    }
    return null
  }

  // ISO YYYY-MM-DD — 10 chars
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const year = Number(value.slice(0, 4))
    const month = Number(value.slice(5, 7))
    const day = Number(value.slice(8, 10))
    if (isValidCalendarDate(year, month, day)) {
      return { year, month, day }
    }
    return null
  }

  // Full ISO timestamp — extract date portion before 'T'
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const datePart = value.slice(0, 10)
    const year = Number(datePart.slice(0, 4))
    const month = Number(datePart.slice(5, 7))
    const day = Number(datePart.slice(8, 10))
    if (isValidCalendarDate(year, month, day)) {
      return { year, month, day }
    }
    return null
  }

  return null
}

/**
 * Format a valid {year, month, day} as `dd/mm/yyyy` for es-AR locale.
 */
function formatEsAr(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`
}

/**
 * Render a CAE expiration value for display.
 *
 * - `null`, `undefined`, empty, and whitespace-only → `{ kind: "empty" }`
 * - Valid compact `YYYYMMDD` → `{ kind: "formatted", label: "dd/mm/yyyy" }`
 * - Valid ISO `YYYY-MM-DD` or full ISO timestamp → `{ kind: "formatted", label: "dd/mm/yyyy" }`
 * - Malformed non-empty value → `{ kind: "unavailable", label: "Fecha no disponible" }`
 *
 * Never returns "Invalid Date" or exposes the raw malformed value.
 */
export function formatCaeExpirationDateOnly(
  value: string | null | undefined,
  _locale?: string,
): CaeExpirationDisplay {
  // null / undefined → empty
  if (value == null) return { kind: "empty" }

  // whitespace-only / empty → empty
  if (value.trim() === "") return { kind: "empty" }

  const parsed = parseDateOnly(value.trim())
  if (parsed) {
    return {
      kind: "formatted",
      label: formatEsAr(parsed.year, parsed.month, parsed.day),
    }
  }

  return { kind: "unavailable", label: UNAVAILABLE_LABEL }
}
