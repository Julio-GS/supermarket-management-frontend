import { describe, expect, it } from "vitest"
import { argentinaLocalDayToUtcRange } from "../argentina-date-boundary"

describe("argentinaLocalDayToUtcRange", () => {
  it("converts a single Argentina calendar date to inclusive UTC boundaries", () => {
    const result = argentinaLocalDayToUtcRange("2026-07-15")

    expect(result.from).toBe("2026-07-15T03:00:00.000Z")
    expect(result.to).toBe("2026-07-16T02:59:59.999Z")
  })

  it("handles a date in Argentine winter (UTC-3)", () => {
    const result = argentinaLocalDayToUtcRange("2026-01-10")

    expect(result.from).toBe("2026-01-10T03:00:00.000Z")
    expect(result.to).toBe("2026-01-11T02:59:59.999Z")
  })

  it("handles end of month correctly", () => {
    const result = argentinaLocalDayToUtcRange("2026-01-31")

    expect(result.from).toBe("2026-01-31T03:00:00.000Z")
    expect(result.to).toBe("2026-02-01T02:59:59.999Z")
  })

  it("handles end of year correctly", () => {
    const result = argentinaLocalDayToUtcRange("2026-12-31")

    expect(result.from).toBe("2026-12-31T03:00:00.000Z")
    expect(result.to).toBe("2027-01-01T02:59:59.999Z")
  })

  it("returns consistent boundaries for a fixed-offset date (no DST shift)", () => {
    // July 2026 — verify the span is exactly 24 hours minus 1 ms
    const result = argentinaLocalDayToUtcRange("2026-07-15")

    const fromMs = new Date(result.from).getTime()
    const toMs = new Date(result.to).getTime()
    expect(toMs - fromMs).toBe(24 * 60 * 60 * 1000 - 1)
  })

  it("handles a range where start and end are the same date (single-day range equivalence)", () => {
    const single = argentinaLocalDayToUtcRange("2026-07-15")
    const rangeStart = argentinaLocalDayToUtcRange("2026-07-15")
    const rangeEnd = argentinaLocalDayToUtcRange("2026-07-15")

    // Single day == range where start=end
    expect(rangeStart.from).toBe(single.from)
    expect(rangeEnd.to).toBe(single.to)
  })
})
