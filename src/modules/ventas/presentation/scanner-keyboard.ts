/**
 * Pure helpers for keyboard-first navigation in the POS scanner panel.
 *
 * All functions are side-effect-free and deterministic. They operate on
 * structured data so the navigation rules are testable without DOM timing.
 */

/** Identifies which input field inside a scanner row has focus. */
export type ScannerField = "product" | "quantity"

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
 * Resolve the target row+field for ArrowUp/ArrowDown navigation.
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
 *   product → quantity (same row)
 *   quantity → product (next row, wraparound)
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

  // quantity → next row product
  const nextIdx = nextRowIndex(currentRowIndex, rows.length)
  return { rowId: rows[nextIdx].id, field: "product" }
}

/**
 * Resolve the previous field for Shift+Tab traversal:
 *   quantity → product (same row)
 *   product → quantity (previous row, wraparound)
 */
export function resolveShiftTabTarget(
  currentField: ScannerField,
  currentRowIndex: number,
  rows: { id: string }[],
): ScannerFieldTarget | null {
  if (rows.length === 0) return null

  if (currentField === "quantity") {
    return { rowId: rows[currentRowIndex].id, field: "product" }
  }

  // product → previous row quantity
  const prevIdx = prevRowIndex(currentRowIndex, rows.length)
  return { rowId: rows[prevIdx].id, field: "quantity" }
}

/**
 * Resolve the target field for ArrowLeft / ArrowRight lateral navigation
 * within the same row (no cross-row movement):
 *   product + ArrowRight → quantity
 *   quantity + ArrowLeft  → product
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

  if (direction === "right" && currentField === "product") {
    return { rowId, field: "quantity" }
  }
  if (direction === "left" && currentField === "quantity") {
    return { rowId, field: "product" }
  }
  return null
}
