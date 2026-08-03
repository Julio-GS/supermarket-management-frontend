/**
 * Pure helpers for keyboard-first navigation in the POS scanner panel.
 *
 * All functions are side-effect-free and deterministic. They operate on
 * structured data so the navigation rules are testable without DOM timing.
 */

/** Identifies which input field inside a scanner row has focus. */
export type ScannerField = "product" | "quantity" | "manualTotal"

/**
 * Parsed result of a scanner input that may contain a quantity prefix.
 *
 * `*{qty}{barcode}` (e.g. `*37781234`) extracts the quantity and barcode.
 */
export type ParsedScannerEntry =
  | { kind: "plain"; query: string }
  | { kind: "prefixed"; query: string; quantity: number }

/**
 * A resolved focus target: which row and which field to focus next.
 */
export interface ScannerFieldTarget {
  rowId: string
  field: ScannerField
}

// ---------------------------------------------------------------------------
// Prefix parsing
// ---------------------------------------------------------------------------

/**
 * Parse a scanner input string looking for the `*{qty}{barcode}` prefix pattern.
 *
 * - `*37781234` → `{ kind: "prefixed", query: "7781234", quantity: 3 }`
 * - `*0foo` → `{ kind: "plain", query: "*0foo" }` (qty ≤ 0, fallback)
 * - `*abc` → `{ kind: "plain", query: "*abc" }` (no digits after *)
 * - `plain-text` → `{ kind: "plain", query: "plain-text" }`
 */
export function parseScannerEntry(input: string): ParsedScannerEntry {
  const trimmed = input.trim()
  if (!trimmed) return { kind: "plain", query: "" }

  const prefixMatch = /^\*(\d)(.+)$/.exec(trimmed)
  if (prefixMatch) {
    const quantity = Number.parseInt(prefixMatch[1], 10)
    const query = prefixMatch[2].trim()
    if (Number.isFinite(quantity) && quantity > 0 && query.length > 0) {
      return { kind: "prefixed", query, quantity }
    }
  }
  return { kind: "plain", query: trimmed }
}

// ---------------------------------------------------------------------------
// Row-index arithmetic (flat-list, wraparound)
// ---------------------------------------------------------------------------

/**
 * Clamp an index into `[0, total)` with wraparound.
 * Handles negative inputs and out-of-bounds gracefully.
 */
function clampToVisible(index: number, total: number): number {
  if (total <= 0) return 0
  return ((index % total) + total) % total
}

/**
 * Return the next row index with wraparound (ArrowDown).
 */
export function nextRowIndex(currentIndex: number, totalRows: number): number {
  return clampToVisible(currentIndex + 1, totalRows)
}

/**
 * Return the previous row index with wraparound (ArrowUp).
 */
export function prevRowIndex(currentIndex: number, totalRows: number): number {
  return clampToVisible(currentIndex - 1, totalRows)
}

// ---------------------------------------------------------------------------
// Field-target resolution
// ---------------------------------------------------------------------------

/**
 * Return the next row index WITHOUT wraparound.
 * Returns null when at the last row (used for scanner exit).
 */
export function nextRowIndexNoWrap(currentIndex: number, totalRows: number): number | null {
  if (totalRows <= 0) return null
  const next = currentIndex + 1
  return next < totalRows ? next : null
}

/**
 * Resolve the target for ArrowUp/ArrowDown navigation.
 *
 * Preserves the current column: product→product, quantity→quantity.
 */
export function resolveArrowTarget(
  field: ScannerField,
  currentRowIndex: number,
  rows: { id: string }[],
  direction: "up" | "down",
): ScannerFieldTarget | null {
  if (rows.length === 0) return null

  const newIndex =
    direction === "down"
      ? nextRowIndex(currentRowIndex, rows.length)
      : prevRowIndex(currentRowIndex, rows.length)

  return { rowId: rows[newIndex].id, field }
}

/**
 * Resolve the next field for Tab traversal:
 *   product → quantity → manualTotal → product (next row, wraparound)
 */
export function resolveTabTarget(
  currentField: ScannerField,
  currentRowIndex: number,
  rows: { id: string }[],
): ScannerFieldTarget | null {
  if (rows.length === 0) return null

  if (currentField === "product") {
    return { rowId: rows[currentRowIndex].id, field: "quantity" }
  }

  if (currentField === "quantity") {
    return { rowId: rows[currentRowIndex].id, field: "manualTotal" }
  }

  // manualTotal → next row product
  const nextIdx = nextRowIndex(currentRowIndex, rows.length)
  return { rowId: rows[nextIdx].id, field: "product" }
}

/**
 * Resolve the previous field for Shift+Tab traversal:
 *   manualTotal → quantity (same row)
 *   quantity → product (same row)
 *   product → manualTotal (previous row, wraparound)
 */
export function resolveShiftTabTarget(
  currentField: ScannerField,
  currentRowIndex: number,
  rows: { id: string }[],
): ScannerFieldTarget | null {
  if (rows.length === 0) return null

  if (currentField === "manualTotal") {
    return { rowId: rows[currentRowIndex].id, field: "quantity" }
  }

  if (currentField === "quantity") {
    return { rowId: rows[currentRowIndex].id, field: "product" }
  }

  // product → previous row manualTotal
  const prevIdx = prevRowIndex(currentRowIndex, rows.length)
  return { rowId: rows[prevIdx].id, field: "manualTotal" }
}

/**
 * Resolve the target field for ArrowLeft / ArrowRight lateral navigation
 * within the same row (no cross-row movement):
 *   product + ArrowRight → quantity
 *   quantity + ArrowRight → manualTotal
 *   quantity + ArrowLeft  → product
 *   manualTotal + ArrowLeft → quantity
 *   (opposite direction → no-op, returns null)
 */
export function resolveArrowSideTarget(
  currentField: ScannerField,
  currentRowIndex: number,
  rows: { id: string }[],
  direction: "left" | "right",
): ScannerFieldTarget | null {
  if (rows.length === 0) return null
  const rowId = rows[currentRowIndex].id

  if (direction === "right") {
    if (currentField === "product") return { rowId, field: "quantity" }
    if (currentField === "quantity") return { rowId, field: "manualTotal" }
    return null
  }

  // direction === "left"
  if (currentField === "manualTotal") return { rowId, field: "quantity" }
  if (currentField === "quantity") return { rowId, field: "product" }
  return null
}

/**
 * Scanner exit target type:
 * - "payment"  → move focus to the payment method panel
 * - "new-row"  → append a new empty scanner row (ArrowDown on a filled last row)
 */
export type ScannerExitTarget = "payment" | "new-row"

/**
 * Resolve whether keyboard input should exit the scanner grid vertically
 * (ArrowDown from the last row, or Enter on the last row).
 *
 * - ArrowDown on the last row **with** a product → "new-row"  (expand grid)
 * - ArrowDown on the last row **without** a product → "payment" (empty → done)
 * - Enter on the last row **with** a product → "new-row"  (expand grid)
 * - Enter on the last row **without** a product → "payment" (empty, move to checkout)
 * - Otherwise → navigate to the next row
 */
export function resolveScannerExit(
  field: ScannerField,
  currentRowIndex: number,
  rows: { id: string }[],
  action: "arrowDown" | "enter",
  rowHasProduct?: boolean,
): ScannerFieldTarget | ScannerExitTarget | null {
  if (rows.length === 0) return null

  if (currentRowIndex >= rows.length - 1) {
    // Last row
    if (action === "arrowDown") {
      // Arrow down: expand grid when row has a product, exit to payment when empty
      return rowHasProduct ? "new-row" : "payment"
    }
    // Enter on last row: grow grid when row has a product, exit to payment when empty
    if (action === "enter") {
      return rowHasProduct ? "new-row" : "payment"
    }
    return "payment"
  }

  // Not last row — navigate normally
  return { rowId: rows[currentRowIndex + 1].id, field }
}

export function resolveScannerExitLateral(field: ScannerField): ScannerExitTarget | null {
  if (field === "quantity" || field === "manualTotal") {
    return "payment"
  }
  return null
}
