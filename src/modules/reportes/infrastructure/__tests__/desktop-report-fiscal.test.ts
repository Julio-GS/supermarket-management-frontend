import { describe, expect, it } from "vitest"
import { buildFiscalGrouping } from "../desktop-report-adapter"

type FiscalSale = { invoiceStatus: string; total: string }

describe("buildFiscalGrouping", () => {
  it("produces empty buckets at zero", () => {
    const result = buildFiscalGrouping([])
    expect(result.issued).toEqual({ amount: "0.00", sale_count: 0 })
    expect(result.none).toEqual({ amount: "0.00", sale_count: 0 })
    expect(result.incident).toEqual({ amount: "0.00", sale_count: 0 })
  })

  it("classifies every status into exactly one bucket without misclassification", () => {
    const sales: FiscalSale[] = [
      { invoiceStatus: "issued", total: "1000.00" },
      { invoiceStatus: "none", total: "500.00" },
      { invoiceStatus: "issuing", total: "200.00" },
      { invoiceStatus: "failed", total: "100.00" },
      { invoiceStatus: "ambiguous", total: "50.00" },
    ]
    const result = buildFiscalGrouping(sales, true)
    expect(result.issued).toEqual({ amount: "1000.00", sale_count: 1 })
    expect(result.none).toEqual({ amount: "500.00", sale_count: 1 })
    expect(result.incident).toEqual({ amount: "350.00", sale_count: 3 })
    expect(result.incidentAvailability).toBe("complete")
    expect(
      result.issued.sale_count + result.none.sale_count + result.incident.sale_count
    ).toBe(sales.length)
  })

  it("fails closed on unknown status without counting it", () => {
    const sales: FiscalSale[] = [
      { invoiceStatus: "issued", total: "1000.00" },
      { invoiceStatus: "none", total: "500.00" },
      { invoiceStatus: "unknown", total: "25.00" },
    ]
    const result = buildFiscalGrouping(sales, true)
    expect(result.issued).toEqual({ amount: "1000.00", sale_count: 1 })
    expect(result.none).toEqual({ amount: "500.00", sale_count: 1 })
    expect(result.incident).toEqual({ amount: "0.00", sale_count: 0 })
    expect(result.incidentAvailability).toBe("unavailable")
    expect(
      result.issued.sale_count + result.none.sale_count + result.incident.sale_count
    ).toBe(2)
  })

  it("marks incident degraded when issuing/ambiguous cannot be supplied", () => {
    const sales: FiscalSale[] = [
      { invoiceStatus: "issued", total: "1000.00" },
      { invoiceStatus: "none", total: "500.00" },
      { invoiceStatus: "failed", total: "100.00" },
    ]
    const result = buildFiscalGrouping(sales)
    expect(result.incident).toEqual({ amount: "100.00", sale_count: 1 })
    expect(result.incidentAvailability).toBe("degraded")
  })
})
