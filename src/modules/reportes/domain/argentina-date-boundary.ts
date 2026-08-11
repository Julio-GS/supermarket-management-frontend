/**
 * Pure helper that converts an Argentina local calendar date (YYYY-MM-DD)
 * into inclusive UTC ISO-8601 boundaries covering that full calendar day
 * in the America/Argentina/Buenos_Aires timezone (fixed UTC-3 offset).
 *
 * Example: "2026-07-15" → from 2026-07-15T03:00:00.000Z, to 2026-07-16T02:59:59.999Z
 */
export function argentinaLocalDayToUtcRange(dateString: string): {
  from: string
  to: string
} {
  // Argentina observes a fixed UTC-3 offset (no DST as of current IANA data).
  // Construct local midnight and end-of-day in Argentina, then serialize as UTC.
  const from = new Date(`${dateString}T00:00:00-03:00`)
  const to = new Date(`${dateString}T23:59:59.999-03:00`)

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}
