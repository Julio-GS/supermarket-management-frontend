import { addAdHocItem, addItem, emptyCart, type Cart, type CartProduct } from "../domain/cart"
import { validateAdHocName, validateAdHocPrice, validateAdHocQuantity } from "../domain/ad-hoc-item"
import type { CatalogProduct } from "../application/catalog-query-port"

export const MIN_SCANNER_ROWS = 12

/** Regex for validating a positive decimal string with up to 2 decimal places. */
const MANUAL_TOTAL_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/

export type RowIdFactory = () => string

export const createRandomRowId: RowIdFactory = () => Math.random().toString(36).slice(2)

export interface ScannerRow {
  id: string
  kind: "catalog" | "ad-hoc"
  query: string
  resolvedProduct: CatalogProduct | null
  quantity: string
  isSearching: boolean
  candidates: CatalogProduct[]
  showDropdown: boolean
  committed: boolean
  pricingMode?: "standard" | "manual"
  isProtected?: boolean
  manualLineTotal?: string
  manualTotalError?: string | null
  adHocName?: string
  adHocDescription?: string
  adHocUnitPrice?: string
  adHocUnitPriceError?: string | null
  adHocNameError?: string | null
}

export function validateManualTotal(value: string): string | null {
  if (!MANUAL_TOTAL_RE.test(value)) return "Enter a positive amount (e.g. 15.50)"
  const parsed = Number.parseFloat(value)
  return !Number.isFinite(parsed) || parsed <= 0 ? "Enter a positive amount" : null
}

function catalogToCartProduct(p: CatalogProduct): CartProduct {
  return { id: p.id, name: p.name, price: p.price, unit: p.unit, promotions: p.promotions, storePromotions: p.storePromotions }
}

export function makeEmptyScannerRow(id: string = createRandomRowId()): ScannerRow {
  return {
    id,
    kind: "catalog",
    query: "",
    resolvedProduct: null,
    quantity: "1",
    isSearching: false,
    candidates: [],
    showDropdown: false,
    committed: false,
  }
}

export function initializeScannerRows(
  count: number = MIN_SCANNER_ROWS,
  createId: RowIdFactory = createRandomRowId
): ScannerRow[] {
  return Array.from({ length: count }, () => makeEmptyScannerRow(createId()))
}

export function isEmptyScannerRow(row: ScannerRow): boolean {
  return !row.query && !row.resolvedProduct && !row.committed
}

export function trimTrailingEmptyRows(
  rows: ScannerRow[],
  minRows: number = MIN_SCANNER_ROWS
): ScannerRow[] {
  if (rows.length <= minRows) return rows
  let cutAt = rows.length
  while (cutAt > minRows && isEmptyScannerRow(rows[cutAt - 1])) {
    cutAt--
  }
  return cutAt < rows.length ? rows.slice(0, cutAt) : rows
}

export function buildCartFromScannerRows(rows: ScannerRow[]): Cart {
  return rows.reduce((cart, row) => {
    if (!row.committed) return cart
    const parsed = Number(row.quantity)
    if (!Number.isInteger(parsed) || parsed < 1) return cart
    const quantity = parsed

    if (row.kind === "ad-hoc") {
      const name = row.adHocName?.trim()
      const unitPriceStr = row.adHocUnitPrice?.trim()
      if (!name || !unitPriceStr) return cart
      const unitPrice = Number.parseFloat(unitPriceStr)
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return cart
      return addAdHocItem(cart, row.id, name, unitPrice, quantity, row.adHocDescription?.trim() || undefined)
    }

    if (!row.resolvedProduct) return cart

    if (row.isProtected && row.manualLineTotal) {
      return addItem(cart, catalogToCartProduct(row.resolvedProduct), quantity, {
        lineId: row.id,
        manualLineTotal: row.manualLineTotal,
      })
    }

    if (row.resolvedProduct.price === 0 && !row.manualLineTotal) return cart

    return addItem(cart, catalogToCartProduct(row.resolvedProduct), quantity)
  }, emptyCart)
}

export function commitResolvedCatalogRow(rows: ScannerRow[], rowId: string): ScannerRow[] {
  return rows.map((r) => {
    if (r.id !== rowId) return r
    if (r.isProtected) {
      const error = validateManualTotal(r.manualLineTotal ?? "")
      return error ? { ...r, manualTotalError: error } : { ...r, committed: true, manualTotalError: undefined }
    }
    return { ...r, committed: true }
  })
}

export function updateManualLineTotal(rows: ScannerRow[], rowId: string, value: string): ScannerRow[] {
  const error = validateManualTotal(value)
  return rows.map((r) =>
    r.id === rowId ? { ...r, manualLineTotal: value, manualTotalError: error, committed: false } : r
  )
}

export interface ApplyResolvedProductOptions {
  quantity?: string
  autoCommit?: boolean
}

export function applyResolvedCatalogProduct(
  rows: ScannerRow[],
  rowId: string,
  product: CatalogProduct,
  options: ApplyResolvedProductOptions = {}
): ScannerRow[] {
  const quantity = options.quantity ?? "1"
  const isProtected = (product.pricingMode === "manual" && product.isProtected === true) || product.price === 0
  const committed = options.autoCommit ?? !isProtected

  return rows.map((r) =>
    r.id === rowId
      ? {
          ...r,
          resolvedProduct: product,
          query: product.name,
          quantity,
          isSearching: false,
          showDropdown: false,
          candidates: [],
          pricingMode: product.pricingMode,
          isProtected: isProtected ? true : (product.isProtected ?? false),
          committed,
        }
      : r
  )
}

export function updateRowQuery(rows: ScannerRow[], rowId: string, value: string): ScannerRow[] {
  return rows.map((r) =>
    r.id === rowId ? { ...r, query: value, resolvedProduct: null, showDropdown: false, committed: false } : r
  )
}

export function updateRowQuantity(rows: ScannerRow[], rowId: string, value: string): ScannerRow[] {
  return rows.map((r) => (r.id === rowId ? { ...r, quantity: value } : r))
}

export function selectCandidate(rows: ScannerRow[], rowId: string, product: CatalogProduct): ScannerRow[] {
  return rows.map((r) =>
    r.id === rowId ? { ...r, resolvedProduct: product, query: product.name, showDropdown: false, candidates: [] } : r
  )
}

export interface CommitAdHocRowResult {
  rows: ScannerRow[]
  focusRowId: string
  nameError: string | null
  priceError: string | null
  quantityError: string | null
}

export function commitAdHocRowWithTrailingEmpty(
  rows: ScannerRow[],
  rowId: string,
  createId: RowIdFactory = createRandomRowId
): CommitAdHocRowResult {
  const idx = rows.findIndex((r) => r.id === rowId)
  if (idx === -1 || rows[idx].kind !== "ad-hoc") {
    return { rows, focusRowId: rowId, nameError: null, priceError: null, quantityError: null }
  }

  const row = rows[idx]
  const name = row.adHocName?.trim()
  const unitPrice = row.adHocUnitPrice?.trim()
  const parsedQty = Number(row.quantity)
  const qty = Number.isInteger(parsedQty) ? parsedQty : 0

  const nameErr = validateAdHocName(name ?? "")
  const priceErr = validateAdHocPrice(unitPrice ?? "")
  const qtyErr = validateAdHocQuantity(qty)

  if (nameErr || priceErr || qtyErr) {
    return {
      rows: rows.map((r) => (r.id === rowId ? { ...r, adHocNameError: nameErr, adHocUnitPriceError: priceErr } : r)),
      focusRowId: rowId,
      nameError: nameErr,
      priceError: priceErr,
      quantityError: qtyErr,
    }
  }

  const committed: ScannerRow = { ...row, committed: true, adHocNameError: null, adHocUnitPriceError: null }
  const nextRow = rows[idx + 1]
  const canReuseNext =
    nextRow && !nextRow.committed && !nextRow.resolvedProduct && nextRow.query === "" && nextRow.kind === "catalog"

  if (canReuseNext) {
    const nextRows = [...rows]
    nextRows[idx] = committed
    return { rows: nextRows, focusRowId: nextRow.id, nameError: null, priceError: null, quantityError: null }
  }

  const newEmpty = makeEmptyScannerRow(createId())
  const nextRows = [...rows]
  nextRows[idx] = committed
  nextRows.splice(idx + 1, 0, newEmpty)
  return { rows: nextRows, focusRowId: newEmpty.id, nameError: null, priceError: null, quantityError: null }
}

export function toggleAdHocMode(rows: ScannerRow[], rowId: string): ScannerRow[] {
  return rows.map((r): ScannerRow =>
    r.id === rowId
      ? {
          ...r,
          kind: r.kind === "catalog" ? "ad-hoc" : "catalog",
          committed: false,
          adHocName: undefined,
          adHocDescription: undefined,
          adHocUnitPrice: undefined,
          adHocUnitPriceError: null,
          adHocNameError: null,
        }
      : r
  )
}

export function addOrConvertFirstAvailableAdHocRow(
  rows: ScannerRow[],
  createId: RowIdFactory = createRandomRowId
): { rows: ScannerRow[]; rowId: string } {
  const targetIdx = rows.findIndex((r) => !r.committed && !r.resolvedProduct && !r.query && r.kind === "catalog")
  if (targetIdx === -1) {
    const id = createId()
    return { rows: [...rows, { ...makeEmptyScannerRow(id), kind: "ad-hoc" }], rowId: id }
  }
  const targetId = rows[targetIdx].id
  return {
    rows: rows.map((r, i): ScannerRow =>
      i === targetIdx
        ? {
            ...r,
            kind: "ad-hoc",
            committed: false,
            adHocName: undefined,
            adHocDescription: undefined,
            adHocUnitPrice: undefined,
            adHocUnitPriceError: null,
            adHocNameError: null,
          }
        : r
    ),
    rowId: targetId,
  }
}

export function updateAdHocDraftField(
  rows: ScannerRow[],
  rowId: string,
  field: "name" | "description" | "unitPrice",
  value: string
): ScannerRow[] {
  return rows.map((r) => {
    if (r.id !== rowId || r.kind !== "ad-hoc") return r
    if (field === "name") {
      return { ...r, adHocName: value, adHocNameError: value.trim() ? null : validateAdHocName(value), committed: false }
    }
    if (field === "unitPrice") {
      return { ...r, adHocUnitPrice: value, adHocUnitPriceError: validateAdHocPrice(value), committed: false }
    }
    return { ...r, adHocDescription: value, committed: false }
  })
}

export interface RowQuantityTarget {
  productId: string
  rowId?: string
}

export function clearScannerRow(rows: ScannerRow[], rowId: string): ScannerRow[] {
  return rows.map((r) => (r.id === rowId ? makeEmptyScannerRow(rowId) : r))
}

export function clearRowsForProduct(rows: ScannerRow[], productId: string): ScannerRow[] {
  return trimTrailingEmptyRows(
    rows.map((row) => (row.resolvedProduct?.id === productId ? makeEmptyScannerRow(row.id) : row))
  )
}

export function increaseCartQuantity(rows: ScannerRow[], target: RowQuantityTarget): ScannerRow[] {
  const { productId, rowId } = target
  let found = false
  return rows.map((r) => {
    if (found || !r.committed) return r
    const isTarget = rowId ? r.id === rowId : r.kind === "catalog" && r.resolvedProduct?.id === productId
    if (!isTarget) return r
    found = true
    const parsed = Number.parseInt(r.quantity, 10)
    const next = Number.isFinite(parsed) && parsed >= 1 ? String(parsed + 1) : "1"
    return { ...r, quantity: next }
  })
}

export function decreaseCartQuantity(rows: ScannerRow[], target: RowQuantityTarget): ScannerRow[] {
  const { productId, rowId } = target
  let found = false
  const nextRows = rows.map((r) => {
    if (found || !r.committed) return r
    const isTarget = rowId ? r.id === rowId : r.kind === "catalog" && r.resolvedProduct?.id === productId
    if (!isTarget) return r
    found = true
    const parsed = Number.parseInt(r.quantity, 10)
    if (!Number.isFinite(parsed) || parsed <= 1) {
      return makeEmptyScannerRow(r.id)
    }
    return { ...r, quantity: String(parsed - 1) }
  })
  return trimTrailingEmptyRows(nextRows)
}
