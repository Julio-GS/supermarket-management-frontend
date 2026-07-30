import { describe, expect, it } from "vitest"
import {
  INVOICE_STATUSES,
  isInvoiceStatus,
  parseInvoiceStatus,
  canRetryFiscalInvoice,
  requiresFiscalReconciliation,
} from "../sale"
import type { InvoiceStatus } from "../sale"

// ---------------------------------------------------------------------------
// Five-status ARCA contract tests
// ---------------------------------------------------------------------------

describe("InvoiceStatus domain model", () => {
  describe("INVOICE_STATUSES constant", () => {
    it("declares exactly five statuses", () => {
      expect(INVOICE_STATUSES).toHaveLength(5)
      expect(INVOICE_STATUSES).toEqual([
        "none",
        "issuing",
        "issued",
        "failed",
        "ambiguous",
      ])
    })
  })

  describe("isInvoiceStatus guard", () => {
    it.each(["none", "issuing", "issued", "failed", "ambiguous"] as const)(
      "returns true for known status: %s",
      (status) => {
        expect(isInvoiceStatus(status)).toBe(true)
      },
    )

    it("returns false for unknown string", () => {
      expect(isInvoiceStatus("some_future_value")).toBe(false)
    })

    it("returns false for null", () => {
      expect(isInvoiceStatus(null)).toBe(false)
    })

    it("returns false for undefined", () => {
      expect(isInvoiceStatus(undefined)).toBe(false)
    })

    it("returns false for number", () => {
      expect(isInvoiceStatus(1)).toBe(false)
    })

    it("returns false for empty string", () => {
      expect(isInvoiceStatus("")).toBe(false)
    })
  })

  describe("parseInvoiceStatus", () => {
    it.each(["none", "issuing", "issued", "failed", "ambiguous"] as const)(
      "returns the known status unchanged: %s",
      (status) => {
        expect(parseInvoiceStatus(status)).toBe(status)
      },
    )

    it("throws on unknown string value", () => {
      expect(() => parseInvoiceStatus("some_future_value")).toThrow(
        /unknown.*invoice.*status/i,
      )
    })

    it("throws on null", () => {
      expect(() => parseInvoiceStatus(null)).toThrow(/unknown.*invoice.*status/i)
    })

    it("throws on undefined", () => {
      expect(() => parseInvoiceStatus(undefined)).toThrow(
        /unknown.*invoice.*status/i,
      )
    })

    it("throws on empty string", () => {
      expect(() => parseInvoiceStatus("")).toThrow(/unknown.*invoice.*status/i)
    })

    it("throws on number", () => {
      expect(() => parseInvoiceStatus(42)).toThrow(/unknown.*invoice.*status/i)
    })

    it("never defaults unknown values to 'none'", () => {
      // explicit contract: unknown MUST NOT silently become "none"
      let threw = false
      try {
        parseInvoiceStatus("unexpected_value")
      } catch {
        threw = true
      }
      expect(threw).toBe(true)
    })
  })

  describe("canRetryFiscalInvoice", () => {
    it("returns true only for 'failed'", () => {
      expect(canRetryFiscalInvoice("failed" as InvoiceStatus)).toBe(true)
    })

    it("returns false for 'none'", () => {
      expect(canRetryFiscalInvoice("none" as InvoiceStatus)).toBe(false)
    })

    it("returns false for 'issuing'", () => {
      expect(canRetryFiscalInvoice("issuing" as InvoiceStatus)).toBe(false)
    })

    it("returns false for 'issued'", () => {
      expect(canRetryFiscalInvoice("issued" as InvoiceStatus)).toBe(false)
    })

    it("returns false for 'ambiguous'", () => {
      expect(canRetryFiscalInvoice("ambiguous" as InvoiceStatus)).toBe(false)
    })
  })

  describe("requiresFiscalReconciliation", () => {
    it("returns true for 'issuing'", () => {
      expect(requiresFiscalReconciliation("issuing" as InvoiceStatus)).toBe(true)
    })

    it("returns true for 'ambiguous'", () => {
      expect(requiresFiscalReconciliation("ambiguous" as InvoiceStatus)).toBe(
        true,
      )
    })

    it("returns false for 'none'", () => {
      expect(requiresFiscalReconciliation("none" as InvoiceStatus)).toBe(false)
    })

    it("returns false for 'issued'", () => {
      expect(requiresFiscalReconciliation("issued" as InvoiceStatus)).toBe(false)
    })

    it("returns false for 'failed'", () => {
      expect(requiresFiscalReconciliation("failed" as InvoiceStatus)).toBe(false)
    })
  })
})
