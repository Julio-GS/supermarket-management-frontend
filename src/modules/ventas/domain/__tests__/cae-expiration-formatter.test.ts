import { describe, expect, it } from "vitest"
import { formatCaeExpirationDateOnly } from "../cae-expiration-formatter"

// ---------------------------------------------------------------------------
// formatCaeExpirationDateOnly — RED/GREEN test battery
// ---------------------------------------------------------------------------

describe("formatCaeExpirationDateOnly", () => {
  // ── null / undefined / empty / whitespace → empty ───────────────

  it("returns empty kind for null", () => {
    const result = formatCaeExpirationDateOnly(null)
    expect(result).toEqual({ kind: "empty" })
  })

  it("returns empty kind for undefined", () => {
    const result = formatCaeExpirationDateOnly(undefined)
    expect(result).toEqual({ kind: "empty" })
  })

  it("returns empty kind for empty string", () => {
    const result = formatCaeExpirationDateOnly("")
    expect(result).toEqual({ kind: "empty" })
  })

  it("returns empty kind for whitespace-only string", () => {
    const result = formatCaeExpirationDateOnly("   ")
    expect(result).toEqual({ kind: "empty" })
  })

  // ── Compact backend YYYYMMDD ────────────────────────────────────

  it("formats compact YYYYMMDD as local calendar date", () => {
    const result = formatCaeExpirationDateOnly("20260715")
    expect(result).toEqual({ kind: "formatted", label: "15/07/2026" })
  })

  it("formats compact YYYYMMDD for a different date", () => {
    const result = formatCaeExpirationDateOnly("20261201")
    expect(result).toEqual({ kind: "formatted", label: "01/12/2026" })
  })

  it("formats compact YYYYMMDD for January (single-digit month)", () => {
    const result = formatCaeExpirationDateOnly("20260105")
    expect(result).toEqual({ kind: "formatted", label: "05/01/2026" })
  })

  // ── ISO date-only YYYY-MM-DD (legacy / desktop fixtures) ───────

  it("formats ISO date-only string YYYY-MM-DD", () => {
    const result = formatCaeExpirationDateOnly("2026-07-15")
    expect(result).toEqual({ kind: "formatted", label: "15/07/2026" })
  })

  it("formats ISO date-only string without timezone shift", () => {
    const result = formatCaeExpirationDateOnly("2026-01-01")
    expect(result).toEqual({ kind: "formatted", label: "01/01/2026" })
  })

  // ── Full ISO timestamp (legacy / desktop fixtures) ──────────────

  it("formats full ISO timestamp preserving the calendar date", () => {
    const result = formatCaeExpirationDateOnly("2026-07-15T00:00:00.000Z")
    // The date portion must be 15 July 2026 regardless of local timezone
    expect(result.kind).toBe("formatted")
    if (result.kind === "formatted") {
      expect(result.label).toMatch(/15\/07\/2026/)
    }
  })

  // ── Malformed non-empty values → safe fallback ──────────────────

  it("returns unavailable for non-date string", () => {
    const result = formatCaeExpirationDateOnly("abc")
    expect(result).toEqual({ kind: "unavailable", label: "Fecha no disponible" })
  })

  it("returns unavailable for invalid date string", () => {
    const result = formatCaeExpirationDateOnly("2026-13-45")
    expect(result).toEqual({ kind: "unavailable", label: "Fecha no disponible" })
  })

  it("returns unavailable for invalid compact date (bad month)", () => {
    const result = formatCaeExpirationDateOnly("20261301")
    expect(result).toEqual({ kind: "unavailable", label: "Fecha no disponible" })
  })

  it("returns unavailable for invalid compact date (bad day)", () => {
    const result = formatCaeExpirationDateOnly("20260230")
    expect(result).toEqual({ kind: "unavailable", label: "Fecha no disponible" })
  })

  // ── Never "Invalid Date" ────────────────────────────────────────

  it("never contains 'Invalid Date' in any output", () => {
    const inputs = [
      null,
      undefined,
      "",
      "   ",
      "20260715",
      "2026-07-15",
      "abc",
      "2026-13-45",
      "not-a-date",
      "20260230",
    ]

    for (const input of inputs) {
      const result = formatCaeExpirationDateOnly(input)
      if (result.kind === "formatted" || result.kind === "unavailable") {
        expect(result.label).not.toContain("Invalid")
        expect(result.label).not.toContain("Date")
      }
    }
  })

  // ── Timezone safety (date-only values must not shift) ───────────

  it("preserves the calendar day for ISO date-only regardless of runtime TZ", () => {
    // "2026-07-15" must always render as 15/07/2026
    // We test that the label contains the correct day numbers,
    // regardless of what timezone the test runs in.
    const result = formatCaeExpirationDateOnly("2026-07-15")
    expect(result).toEqual({ kind: "formatted", label: "15/07/2026" })
  })

  it("preserves the calendar day for compact YYYYMMDD regardless of runtime TZ", () => {
    const result = formatCaeExpirationDateOnly("20260715")
    expect(result).toEqual({ kind: "formatted", label: "15/07/2026" })
  })
})
