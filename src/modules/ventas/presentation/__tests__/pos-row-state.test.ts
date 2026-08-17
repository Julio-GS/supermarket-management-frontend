import { describe, expect, it } from "vitest"

import {
  MIN_SCANNER_ROWS,
  addOrConvertFirstAvailableAdHocRow,
  applyResolvedCatalogProduct,
  buildCartFromScannerRows,
  clearRowsForProduct,
  clearScannerRow,
  commitAdHocRowWithTrailingEmpty,
  commitResolvedCatalogRow,
  createRandomRowId,
  decreaseCartQuantity,
  increaseCartQuantity,
  initializeScannerRows,
  isEmptyScannerRow,
  makeEmptyScannerRow,
  selectCandidate,
  toggleAdHocMode,
  trimTrailingEmptyRows,
  updateAdHocDraftField,
  updateManualLineTotal,
  updateRowQuantity,
  updateRowQuery,
  validateManualTotal,
  type ScannerRow,
} from "../pos-row-state"
import type { ScannerRow as HookScannerRow } from "../use-pos-terminal"
import type { CatalogProduct } from "../../application/catalog-query-port"
import { isAdHocItem, isCatalogItem } from "../../domain/cart"

const product = (overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: "P1",
  name: "Product 1",
  sku: "SKU1",
  price: 10,
  stock: 5,
  manejaStock: true,
  unit: "u",
  promotions: null,
  storePromotions: null,
  ...overrides,
})

const committedCatalogRow = (
  id: string,
  p: CatalogProduct,
  quantity = "1",
  extra: Partial<ScannerRow> = {}
): ScannerRow => ({
  ...makeEmptyScannerRow(id),
  committed: true,
  resolvedProduct: p,
  query: p.name,
  quantity,
  ...extra,
})

const adHocDraftRow = (id: string, overrides: Partial<ScannerRow> = {}): ScannerRow => ({
  ...makeEmptyScannerRow(id),
  kind: "ad-hoc",
  adHocName: "Servicio",
  adHocUnitPrice: "500.00",
  ...overrides,
})

const makeSeq = () => {
  let n = 0
  return () => `new-${++n}`
}

describe("pos-row-state pure seam", () => {
  it("S1 — initializes exactly 12 empty uncommitted catalog rows", () => {
    const rows = initializeScannerRows()
    expect(rows).toHaveLength(MIN_SCANNER_ROWS)
    rows.forEach((r) => {
      expect(r).toMatchObject({
        kind: "catalog",
        query: "",
        resolvedProduct: null,
        quantity: "1",
        committed: false,
        isSearching: false,
        showDropdown: false,
      })
      expect(r.candidates).toEqual([])
    })
  })

  it("uses injected id factory / generates non-empty random id", () => {
    expect(initializeScannerRows(2, makeSeq()).map((r) => r.id)).toEqual(["new-1", "new-2"])
    expect(createRandomRowId()).toBeTruthy()
  })

  it("S2 — row edits and clear preserve the row id", () => {
    const base = makeEmptyScannerRow("row-a")
    expect(updateRowQuery([base], "row-a", "abc")[0].id).toBe("row-a")
    expect(updateRowQuantity([base], "row-a", "5")[0].id).toBe("row-a")
    expect(
      updateManualLineTotal(
        [{ ...base, resolvedProduct: product({ price: 0 }), isProtected: true }],
        "row-a",
        "10.00"
      )[0].id
    ).toBe("row-a")

    const cleared = clearScannerRow(
      [{ ...base, committed: true, resolvedProduct: product() }],
      "row-a"
    )
    expect(cleared[0]).toMatchObject({ id: "row-a", committed: false, resolvedProduct: null, quantity: "1" })
  })

  it("S5/S6 — trims trailing empties to minimum 12 while preserving middle empties", () => {
    expect(trimTrailingEmptyRows(initializeScannerRows(14, makeSeq()))).toHaveLength(12)

    const rows = initializeScannerRows(13, makeSeq())
    for (let i = 0; i < 13; i++) {
      if (i !== 5 && i !== 12) rows[i] = committedCatalogRow(rows[i].id, product())
    }
    const trimmed = trimTrailingEmptyRows(rows)
    expect(trimmed).toHaveLength(12)
    expect(isEmptyScannerRow(trimmed[5])).toBe(true)
    expect(trimmed[5].id).toBe(rows[5].id)
  })

  it("S7/S8 — merges normal catalog rows and product-based plus increments first row", () => {
    const p = product({ id: "P1" })
    const rows = [committedCatalogRow("r1", p), committedCatalogRow("r2", p)]
    expect(buildCartFromScannerRows(rows).items).toEqual([
      expect.objectContaining({ kind: "catalog", quantity: 2 }),
    ])

    const next = increaseCartQuantity(rows, { productId: "P1" })
    expect(next.find((r) => r.id === "r1")?.quantity).toBe("2")
    expect(next.find((r) => r.id === "r2")?.quantity).toBe("1")
    expect(buildCartFromScannerRows(next).items[0].quantity).toBe(3)
  })

  it("S9/S10/S11/S12 — handles protected manual total validation, commit, and independence", () => {
    const p = product({ id: "P1", price: 0 })
    const rows = [
      committedCatalogRow("r1", p, "1", { isProtected: true, manualLineTotal: "15.00" }),
      committedCatalogRow("r2", p, "1", { isProtected: true, manualLineTotal: "25.00" }),
    ]
    const cart = buildCartFromScannerRows(rows)
    expect(cart.items).toHaveLength(2)
    const catalog = cart.items.filter(isCatalogItem)
    expect(catalog.map((i) => ({ lineId: i.lineId, total: i.manualLineTotal }))).toEqual([
      { lineId: "r1", total: "15.00" },
      { lineId: "r2", total: "25.00" },
    ])

    // S10: editing uncommits
    const edited = updateManualLineTotal([rows[0]], "r1", "20.00")
    expect(edited[0].committed).toBe(false)
    expect(buildCartFromScannerRows(edited).items).toHaveLength(0)

    // S11: invalid values
    for (const invalid of ["", "0", "0.00", "-5", "abc", "1.999"]) {
      expect(validateManualTotal(invalid)).toBeTruthy()
    }
    const uncommitted = commitResolvedCatalogRow(
      [{ ...makeEmptyScannerRow("r1"), resolvedProduct: p, isProtected: true, manualLineTotal: "" }],
      "r1"
    )
    expect(uncommitted[0].committed).toBe(false)
    expect(uncommitted[0].manualTotalError).toBeTruthy()

    // S12: valid commit
    const committed = commitResolvedCatalogRow(
      [{ ...makeEmptyScannerRow("r1"), resolvedProduct: p, isProtected: true, manualLineTotal: "20.00" }],
      "r1"
    )
    expect(committed[0].committed).toBe(true)
    expect(buildCartFromScannerRows(committed).items[0]).toMatchObject({
      kind: "catalog",
      lineId: "r1",
      manualLineTotal: "20.00",
    })
  })

  it("S13/S14/S15 — ad-hoc draft projection, non-merging, and validation", () => {
    const single = buildCartFromScannerRows([
      { ...adHocDraftRow("draft-1"), committed: true, quantity: "2" },
    ])
    expect(single.items).toEqual([
      expect.objectContaining({
        kind: "ad-hoc",
        draftId: "draft-1",
        name: "Servicio",
        unitPrice: 500,
        quantity: 2,
      }),
    ])

    const multiple = buildCartFromScannerRows([
      { ...adHocDraftRow("a"), committed: true },
      { ...adHocDraftRow("b"), committed: true },
    ])
    expect(multiple.items.filter(isAdHocItem).map((i) => i.draftId)).toEqual(["a", "b"])

    for (const quantity of ["0", "-1", "abc", "1.5"]) {
      const res = commitAdHocRowWithTrailingEmpty([adHocDraftRow("r1", { quantity })], "r1", makeSeq())
      expect(res.quantityError).toBeTruthy()
      expect(res.rows[0].committed).toBe(false)
      expect(buildCartFromScannerRows(res.rows).items).toHaveLength(0)
    }
  })

  it("S16/S17/S18 — ad-hoc trailing row reuse, middle insertion, and end append", () => {
    // S16: reuse directly trailing empty
    const s16 = commitAdHocRowWithTrailingEmpty(
      [makeEmptyScannerRow("r0"), adHocDraftRow("r1"), makeEmptyScannerRow("r2")],
      "r1",
      makeSeq()
    )
    expect(s16.rows[1].committed).toBe(true)
    expect(s16.rows[2].id).toBe("r2")

    // S17: insert directly below and never reuse distant empty
    const s17 = commitAdHocRowWithTrailingEmpty(
      [adHocDraftRow("r0"), committedCatalogRow("r1", product()), makeEmptyScannerRow("r2")],
      "r0",
      makeSeq()
    )
    expect(s17.rows.map((r) => r.id)).toEqual(["r0", "new-1", "r1", "r2"])
    expect(isEmptyScannerRow(s17.rows[1])).toBe(true)

    // S18: append trailing empty when at end
    const s18 = commitAdHocRowWithTrailingEmpty([adHocDraftRow("r0")], "r0", makeSeq())
    expect(s18.rows.map((r) => r.id)).toEqual(["r0", "new-1"])
  })

  it("S19/R10 — decreaseCartQuantity decrements or clears targeted row without altering unrelated rows", () => {
    const p2 = product({ id: "P2", name: "Product 2" })
    const rows = [
      committedCatalogRow("r1", product({ id: "P1" }), "2"),
      committedCatalogRow("r2", p2, "1"),
      { ...makeEmptyScannerRow("r3"), query: "Product 3", resolvedProduct: product({ id: "P3" }), quantity: "0" },
    ]

    // Row-specific decrease (quantity 2 -> 1) preserves unrelated zero-quantity row
    const dec1 = decreaseCartQuantity(rows, { productId: "P1", rowId: "r1" })
    expect(dec1.find((r) => r.id === "r1")?.quantity).toBe("1")
    expect(dec1.find((r) => r.id === "r3")).toMatchObject({ query: "Product 3", quantity: "0" })

    // Row-specific decrease (quantity 1 -> cleared) clears only r2
    const dec2 = decreaseCartQuantity(rows, { productId: "P2", rowId: "r2" })
    expect(dec2.find((r) => r.id === "r2")).toMatchObject({ committed: false, resolvedProduct: null })
    expect(dec2.find((r) => r.id === "r3")).toMatchObject({ query: "Product 3", quantity: "0" })

    // Product-based decrease preserves unrelated zero-quantity row
    const dec3 = decreaseCartQuantity(rows, { productId: "P1" })
    expect(dec3.find((r) => r.id === "r1")?.quantity).toBe("1")
    expect(dec3.find((r) => r.id === "r3")).toMatchObject({ query: "Product 3", quantity: "0" })
  })

  it("S20/S21 — product-based and row-specific removal transitions", () => {
    const p1 = product({ id: "P1" })
    const rows = [
      committedCatalogRow("r1", p1),
      committedCatalogRow("r2", p1),
      committedCatalogRow("r3", product({ id: "P2" })),
    ]

    const clearedProduct = clearRowsForProduct(rows, "P1")
    expect(clearedProduct.filter((r) => !r.committed).map((r) => r.id)).toEqual(["r1", "r2"])
    expect(clearedProduct.find((r) => r.id === "r3")?.committed).toBe(true)

    const clearedRow = clearScannerRow(rows, "r1")
    expect(clearedRow.find((r) => r.id === "r1")?.committed).toBe(false)
    expect(clearedRow.find((r) => r.id === "r2")?.committed).toBe(true)
    expect(buildCartFromScannerRows(clearedRow).items[0]).toMatchObject({ quantity: 1 })
  })

  it("S22 — invalid committed-row quantities are excluded from cart projection", () => {
    for (const quantity of ["0", "-2", "1.5", "abc"]) {
      expect(buildCartFromScannerRows([committedCatalogRow("r1", product(), quantity)]).items).toHaveLength(0)
    }
  })

  it("S23/S24 — cart projection preserves payload kind and split-relevant line identity", () => {
    const cart = buildCartFromScannerRows([
      committedCatalogRow("n1", product({ id: "P1", price: 10 })),
      committedCatalogRow("n2", product({ id: "P1", price: 10 })),
      committedCatalogRow("m1", product({ id: "P2", price: 0 }), "1", { isProtected: true, manualLineTotal: "12.00" }),
      { ...adHocDraftRow("a1"), committed: true },
    ])
    expect(cart.items.find((i) => i.kind === "catalog" && !i.lineId)?.quantity).toBe(2)
    expect(cart.items.find((i) => i.kind === "catalog" && i.lineId)).toMatchObject({
      lineId: "m1",
      manualLineTotal: "12.00",
    })
    expect(cart.items.find((i) => i.kind === "ad-hoc")).toMatchObject({ draftId: "a1" })
  })

  it("S25 & helpers — catalog resolution, ad-hoc editing, toggle, candidate selection, and ScannerRow compatibility", () => {
    // applyResolvedCatalogProduct
    expect(applyResolvedCatalogProduct([makeEmptyScannerRow("r1")], "r1", product({ price: 0 }))[0]).toMatchObject({
      isProtected: true,
      committed: false,
    })
    expect(applyResolvedCatalogProduct([makeEmptyScannerRow("r1")], "r1", product({ price: 10 }))[0]).toMatchObject({
      isProtected: false,
      committed: true,
    })

    // updateAdHocDraftField
    const adHoc = { ...adHocDraftRow("r1"), committed: true }
    expect(updateAdHocDraftField([adHoc], "r1", "name", "Nuevo")[0]).toMatchObject({
      adHocName: "Nuevo",
      committed: false,
    })
    expect(updateAdHocDraftField([adHoc], "r1", "unitPrice", "0")[0].adHocUnitPriceError).toBeTruthy()
    expect(updateAdHocDraftField([adHoc], "r1", "description", "nota")[0]).toMatchObject({
      adHocDescription: "nota",
      committed: false,
    })

    // toggleAdHocMode & addOrConvertFirstAvailableAdHocRow
    expect(toggleAdHocMode([makeEmptyScannerRow("r1")], "r1")[0]).toMatchObject({ id: "r1", kind: "ad-hoc" })
    expect(addOrConvertFirstAvailableAdHocRow([makeEmptyScannerRow("r1")], makeSeq())).toMatchObject({
      rowId: "r1",
      rows: [{ id: "r1", kind: "ad-hoc" }],
    })

    // selectCandidate
    expect(selectCandidate([makeEmptyScannerRow("r1")], "r1", product())[0]).toMatchObject({
      resolvedProduct: expect.objectContaining({ id: "P1" }),
      committed: false,
    })

    // HookScannerRow type compatibility
    const viaHook: HookScannerRow = makeEmptyScannerRow("compat")
    expect(viaHook.id).toBe("compat")
  })
})
