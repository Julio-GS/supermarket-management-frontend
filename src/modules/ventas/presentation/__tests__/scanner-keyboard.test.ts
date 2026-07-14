import { describe, expect, it } from "vitest"
import {
  parseScannerEntry,
  nextRowIndex,
  prevRowIndex,
  resolveArrowTarget,
  resolveTabTarget,
  resolveShiftTabTarget,
  nextRowIndexNoWrap,
  resolveScannerExit,
} from "../scanner-keyboard"

// ---------------------------------------------------------------------------
// Prefix parsing
// ---------------------------------------------------------------------------

describe("parseScannerEntry", () => {
  it("extracts quantity and barcode from valid prefixed input", () => {
    const result = parseScannerEntry("*37781234")
    expect(result).toEqual({ kind: "prefixed", query: "7781234", quantity: 3 })
  })

  it("parses prefixed input where barcode starts with digits too", () => {
    // Quantity is always ONE digit following *; rest is barcode
    const result = parseScannerEntry("*157781234")
    expect(result).toEqual({ kind: "prefixed", query: "57781234", quantity: 1 })
  })

  it("parses single-digit quantity prefix in front of a numeric barcode", () => {
    const result = parseScannerEntry("*17781234")
    expect(result).toEqual({ kind: "prefixed", query: "7781234", quantity: 1 })
  })

  it("trims whitespace from barcode", () => {
    const result = parseScannerEntry("  *3  7781234  ")
    expect(result).toEqual({ kind: "prefixed", query: "7781234", quantity: 3 })
  })

  it("returns plain for input starting with * but no digits followed by barcode", () => {
    const result = parseScannerEntry("*abc")
    expect(result).toEqual({ kind: "plain", query: "*abc" })
  })

  it("returns plain for input starting with * but qty is zero", () => {
    const result = parseScannerEntry("*0foo")
    expect(result).toEqual({ kind: "plain", query: "*0foo" })
  })

  it("returns plain for input starting with * but no barcode after digits", () => {
    const result = parseScannerEntry("*5")
    expect(result).toEqual({ kind: "plain", query: "*5" })
  })

  it("returns plain for normal barcode without prefix", () => {
    const result = parseScannerEntry("7781234")
    expect(result).toEqual({ kind: "plain", query: "7781234" })
  })

  it("returns plain for empty input", () => {
    const result = parseScannerEntry("")
    expect(result).toEqual({ kind: "plain", query: "" })
  })

  it("returns plain for whitespace-only input", () => {
    const result = parseScannerEntry("   ")
    expect(result).toEqual({ kind: "plain", query: "" })
  })

  it("handles prefix with spaces between * and digits gracefully", () => {
    // The regex /^\*(\d+)(.+)$/ won't match "* 3foo" because space is not a digit
    const result = parseScannerEntry("* 3foo")
    expect(result).toEqual({ kind: "plain", query: "* 3foo" })
  })
})

// ---------------------------------------------------------------------------
// Row-index wraparound
// ---------------------------------------------------------------------------

describe("nextRowIndex", () => {
  it("advances to the next row", () => {
    expect(nextRowIndex(0, 12)).toBe(1)
    expect(nextRowIndex(5, 12)).toBe(6)
  })

  it("wraps from last row to first", () => {
    expect(nextRowIndex(11, 12)).toBe(0)
  })

  it("handles single row (wraps to itself)", () => {
    expect(nextRowIndex(0, 1)).toBe(0)
  })

  it("returns 0 for zero total rows", () => {
    expect(nextRowIndex(0, 0)).toBe(0)
  })
})

describe("prevRowIndex", () => {
  it("goes to previous row", () => {
    expect(prevRowIndex(5, 12)).toBe(4)
    expect(prevRowIndex(1, 12)).toBe(0)
  })

  it("wraps from first row to last", () => {
    expect(prevRowIndex(0, 12)).toBe(11)
  })

  it("handles single row (wraps to itself)", () => {
    expect(prevRowIndex(0, 1)).toBe(0)
  })

  it("returns 0 for zero total rows", () => {
    expect(prevRowIndex(0, 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Arrow navigation
// ---------------------------------------------------------------------------

describe("resolveArrowTarget", () => {
  const rows = [
    { id: "r0" },
    { id: "r1" },
    { id: "r2" },
    { id: "r3" },
  ]

  it("moves down preserving product field", () => {
    const target = resolveArrowTarget("product", 1, rows, "down")
    expect(target).toEqual({ rowId: "r2", field: "product" })
  })

  it("moves down preserving quantity field", () => {
    const target = resolveArrowTarget("quantity", 1, rows, "down")
    expect(target).toEqual({ rowId: "r2", field: "quantity" })
  })

  it("moves up preserving product field", () => {
    const target = resolveArrowTarget("product", 2, rows, "up")
    expect(target).toEqual({ rowId: "r1", field: "product" })
  })

  it("moves up preserving quantity field", () => {
    const target = resolveArrowTarget("quantity", 2, rows, "up")
    expect(target).toEqual({ rowId: "r1", field: "quantity" })
  })

  it("wraps down at last row", () => {
    const target = resolveArrowTarget("product", 3, rows, "down")
    expect(target).toEqual({ rowId: "r0", field: "product" })
  })

  it("wraps up at first row", () => {
    const target = resolveArrowTarget("quantity", 0, rows, "up")
    expect(target).toEqual({ rowId: "r3", field: "quantity" })
  })

  it("returns null for empty rows", () => {
    expect(resolveArrowTarget("product", 0, [], "down")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tab / Shift+Tab traversal
// ---------------------------------------------------------------------------

describe("resolveTabTarget", () => {
  const rows = [
    { id: "r0" },
    { id: "r1" },
    { id: "r2" },
  ]

  it("moves from product to quantity in same row", () => {
    const target = resolveTabTarget("product", 1, rows)
    expect(target).toEqual({ rowId: "r1", field: "quantity" })
  })

  it("moves from quantity to manualTotal in same row", () => {
    const target = resolveTabTarget("quantity", 1, rows)
    expect(target).toEqual({ rowId: "r1", field: "manualTotal" })
  })

  it("moves from manualTotal to next row product", () => {
    const target = resolveTabTarget("manualTotal", 1, rows)
    expect(target).toEqual({ rowId: "r2", field: "product" })
  })

  it("wraps from manualTotal at last row to first row product", () => {
    const target = resolveTabTarget("manualTotal", 2, rows)
    expect(target).toEqual({ rowId: "r0", field: "product" })
  })

  it("returns null for empty rows", () => {
    expect(resolveTabTarget("product", 0, [])).toBeNull()
  })
})

describe("resolveShiftTabTarget", () => {
  const rows = [
    { id: "r0" },
    { id: "r1" },
    { id: "r2" },
  ]

  it("moves from manualTotal to quantity in same row", () => {
    const target = resolveShiftTabTarget("manualTotal", 1, rows)
    expect(target).toEqual({ rowId: "r1", field: "quantity" })
  })

  it("moves from quantity to product in same row", () => {
    const target = resolveShiftTabTarget("quantity", 1, rows)
    expect(target).toEqual({ rowId: "r1", field: "product" })
  })

  it("moves from product to previous row manualTotal", () => {
    const target = resolveShiftTabTarget("product", 2, rows)
    expect(target).toEqual({ rowId: "r1", field: "manualTotal" })
  })

  it("wraps from product at first row to last row manualTotal", () => {
    const target = resolveShiftTabTarget("product", 0, rows)
    expect(target).toEqual({ rowId: "r2", field: "manualTotal" })
  })

  it("returns null for empty rows", () => {
    expect(resolveShiftTabTarget("quantity", 0, [])).toBeNull()
  })
})

// ── Non-wrapping navigation (scanner exit) ────────────────────

describe("nextRowIndexNoWrap", () => {
  it("advances to the next row without wrapping", () => {
    expect(nextRowIndexNoWrap(0, 12)).toBe(1)
    expect(nextRowIndexNoWrap(5, 12)).toBe(6)
  })

  it("returns null at last row instead of wrapping", () => {
    expect(nextRowIndexNoWrap(11, 12)).toBeNull()
  })

  it("returns null for single row", () => {
    expect(nextRowIndexNoWrap(0, 1)).toBeNull()
  })

  it("returns null for zero total rows", () => {
    expect(nextRowIndexNoWrap(0, 0)).toBeNull()
  })
})

describe("resolveScannerExit", () => {
  const rows = [
    { id: "r0" },
    { id: "r1" },
    { id: "r2" },
  ]

  it("returns null for ArrowDown when not last row", () => {
    const target = resolveScannerExit("product", 1, rows, "arrowDown")
    expect(target).toEqual({ rowId: "r2", field: "product" })
  })

  it("returns payment exit for ArrowDown on last row", () => {
    const target = resolveScannerExit("product", 2, rows, "arrowDown")
    expect(target).toBe("payment")
  })

  it("returns payment exit for Enter on last row with valid product", () => {
    const target = resolveScannerExit("product", 2, rows, "enter")
    expect(target).toBe("payment")
  })

  it("returns next row for Enter when not last row", () => {
    const target = resolveScannerExit("product", 1, rows, "enter")
    expect(target).toEqual({ rowId: "r2", field: "product" })
  })

  it("returns null for empty rows", () => {
    expect(resolveScannerExit("product", 0, [], "arrowDown")).toBeNull()
  })

  it("preserves the current field when moving to next row with ArrowDown", () => {
    const target = resolveScannerExit("quantity", 0, rows, "arrowDown")
    expect(target).toEqual({ rowId: "r1", field: "quantity" })
  })
})
