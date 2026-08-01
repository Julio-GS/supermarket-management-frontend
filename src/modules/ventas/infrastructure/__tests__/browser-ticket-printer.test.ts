import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { BrowserTicketPrinter } from "../browser-ticket-printer"
import * as QrModule from "../arca-fiscal-qr"
import type { PrintableTicket } from "../../domain/ticket"

const PRINT_AREA_SELECTOR = "#ticket-print-area"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTicket(overrides: Partial<PrintableTicket> = {}): PrintableTicket {
  return {
    format: "nonFiscal",
    saleId: "V-00042",
    saleDate: "2026-07-01T15:30:00Z",
    items: [
      {
        productId: "P001",
        name: "Leche entera 1L",
        quantity: 2,
        unitPrice: "120.00",
        subtotal: "240.00",
        discountAmount: "0.00",
        appliedPromotions: [],
        appliedPromotionType: null
      },
    ],
    total: "240.00",
    payments: [{ method: "cash", amount: "240.00" }],
    fiscal: null,
    ...overrides,
  }
}

function makeFiscalTicket(overrides: Partial<PrintableTicket> = {}): PrintableTicket {
  return makeTicket({
    format: "fiscal",
    fiscal: {
      cae: "12345678901234",
      caeVto: "2026-07-15",
      cbteNro: "0000042",
      cbteTipo: "1",
      ptoVta: "0001",
    },
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BrowserTicketPrinter", () => {
  beforeEach(() => {
    document.querySelector(PRINT_AREA_SELECTOR)?.remove()
  })

  afterEach(() => {
    document.querySelector(PRINT_AREA_SELECTOR)?.remove()
    vi.restoreAllMocks()
  })

  it("prints through the main window without opening a popup", async () => {
    const openSpy = vi.spyOn(window, "open")
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined)
    const printer = new BrowserTicketPrinter()

    const result = await printer.print([makeTicket()])

    expect(result).toEqual({ ok: true })
    expect(openSpy).not.toHaveBeenCalled()
    expect(printSpy).toHaveBeenCalledTimes(1)
    expect(document.querySelector(PRINT_AREA_SELECTOR)).toBeInTheDocument()
  })

  it("works even when popup opening would be blocked by Electron", async () => {
    vi.spyOn(window, "open").mockImplementation(() => {
      throw new Error("window.open should not be used")
    })
    vi.spyOn(window, "print").mockImplementation(() => undefined)
    const printer = new BrowserTicketPrinter()

    const result = await printer.print([makeTicket()])

    expect(result).toEqual({ ok: true })
    expect(document.querySelector(PRINT_AREA_SELECTOR)?.textContent).toContain("V-00042")
  })

  it("cleans up the print area after the print dialog completes", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)
    const printer = new BrowserTicketPrinter()

    await printer.print([makeTicket()])
    expect(document.querySelector(PRINT_AREA_SELECTOR)).toBeInTheDocument()

    window.dispatchEvent(new Event("afterprint"))

    expect(document.querySelector(PRINT_AREA_SELECTOR)).not.toBeInTheDocument()
  })

  // --- empty tickets edge case ---

  it("returns ok:false for empty ticket array", async () => {
    const printer = new BrowserTicketPrinter()
    const result = await printer.print([])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("No tickets to print")
    }
  })

  // --- surfaces thrown errors ---

  it("surfaces thrown errors as { ok:false, reason }", async () => {
    vi.spyOn(document.body, "appendChild").mockImplementation(() => {
      throw new Error("DOM error")
    })

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([makeTicket()])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("DOM error")
    }
  })

  // --- printable HTML markers: non-fiscal label ---

  it("includes TICKET NO FISCAL marker in HTML for non-fiscal ticket", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    await printer.print([makeTicket({ format: "nonFiscal" })])

    const printAreaHtml = document.querySelector(PRINT_AREA_SELECTOR)?.innerHTML
    expect(printAreaHtml).toBeDefined()
    expect(printAreaHtml).toContain("TICKET NO FISCAL")
    expect(printAreaHtml).not.toContain("TICKET FISCAL")
  })

  // --- printable HTML markers: fiscal label ---

  it("renders the redesigned ARCA fiscal ticket structure with QR image", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    await printer.print([makeFiscalTicket()])

    const printAreaHtml = document.querySelector(PRINT_AREA_SELECTOR)?.innerHTML
    expect(printAreaHtml).toBeDefined()
    expect(printAreaHtml).toContain("FACTURA B")
    expect(printAreaHtml).toContain("ORIGINAL")
    expect(printAreaHtml).not.toContain("TICKET NO FISCAL")
    expect(printAreaHtml).toContain("CAMACHO ROMERO LILA GLADYS")
    expect(printAreaHtml).toContain("AUTOSERVICIO LOS CHICOS")
    expect(printAreaHtml).toContain("CUIT: 27-93973280-8")
    expect(printAreaHtml).toContain("Ingresos Brutos: 1553547-9")
    expect(printAreaHtml).toContain("IVA RESPONSABLE INSCRIPTO")
    expect(printAreaHtml).toContain("Inicio de actividades: 23/07/2026")
    expect(printAreaHtml).toContain("P.V.: 0001")
    expect(printAreaHtml).toContain("Comp. Nro: 0000042")
    expect(printAreaHtml).toContain("<span>Cliente:</span>")
    expect(printAreaHtml).toContain("<span>Condición IVA:</span>")
    expect(printAreaHtml).toContain("<span>Condición de venta:</span>")
    expect(printAreaHtml).toContain(">CONSUMIDOR FINAL<")
    expect(printAreaHtml).toContain("Neto gravado")
    expect(printAreaHtml).toContain("IVA 21%")
    expect(printAreaHtml).toContain("Otros Imp. Nacionales Indirectos")
    expect(printAreaHtml).toContain("Subtotal")
    expect(printAreaHtml).not.toContain("Descuento")
    expect(printAreaHtml).toContain("$0,00")
    expect(printAreaHtml).toContain("TOTAL")
    expect(printAreaHtml).toContain("$240,00")
    expect(printAreaHtml).toContain("Comprobante autorizado por ARCA")
    expect(printAreaHtml).toContain("CAE: 12345678901234")
    expect(printAreaHtml).toContain("Vencimiento CAE: 2026-07-15")
    // QR is rendered as an img element in the DOM
    const qrImages = document.querySelectorAll(`${PRINT_AREA_SELECTOR} .arca-qr-image`)
    expect(qrImages.length).toBe(1)
    const qrSrc = (qrImages[0] as HTMLImageElement).src
    expect(qrSrc).toMatch(/^data:image\/png;base64,/)
    expect(printAreaHtml).not.toContain("https://www.afip.gob.ar/fe/qr/?p=")
  })

  // --- printable HTML markers: split ticket labels ---

  it("includes group and index labels in HTML for split tickets", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const ticketA = makeTicket({ groupLabel: "A" })
    const ticketB = makeTicket({ groupLabel: "B" })

    const printer = new BrowserTicketPrinter()
    await printer.print([ticketA, ticketB])

    const printAreaHtml = document.querySelector(PRINT_AREA_SELECTOR)?.innerHTML
    expect(printAreaHtml).toBeDefined()

    expect(printAreaHtml).toContain("Ticket 1 de 2")
    expect(printAreaHtml).toContain("Ticket 2 de 2")
    expect(printAreaHtml).toContain("Grupo A")
    expect(printAreaHtml).toContain("Grupo B")
  })

  it("uses normal print flow protections for multi-ticket printing", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    await printer.print([makeFiscalTicket({ groupLabel: "A" }), makeFiscalTicket({ groupLabel: "B" })])

    const printAreaHtml = document.querySelector(PRINT_AREA_SELECTOR)?.innerHTML
    expect(printAreaHtml).toBeDefined()
    expect(printAreaHtml).not.toContain("position: fixed !important;")
    expect(printAreaHtml).toContain("position: static !important;")
    expect(printAreaHtml).toContain("overflow: visible !important;")
    expect(printAreaHtml).toContain("page-break-after: always;")
    expect(printAreaHtml).toContain("break-after: page;")
    expect(printAreaHtml).toContain("page-break-inside: avoid;")
    expect(printAreaHtml).toContain("break-inside: avoid;")
  })

  // --- printable HTML markers: single ticket has no multi-ticket label ---

  it("does NOT include multi-ticket labels for a single ticket", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    await printer.print([makeTicket()])

    const printAreaHtml = document.querySelector(PRINT_AREA_SELECTOR)?.innerHTML
    expect(printAreaHtml).toBeDefined()
    expect(printAreaHtml).not.toContain("Ticket 1 de")
    expect(printAreaHtml).not.toContain("de 1")
  })

  // --- printable HTML: contains store name, sale ID, date, items, total, payments ---

  it("renders all ticket metadata in HTML", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const ticket = makeTicket({
      saleId: "V-00099",
      total: "240.00",
      items: [
        {
          productId: "P001",
          name: "Leche entera 1L",
          quantity: 2,
          unitPrice: "120.00",
          subtotal: "240.00",
          discountAmount: "30.00",
          appliedPromotions: [],
          appliedPromotionType: "percentage",
        },
      ],
      payments: [
        { method: "cash", amount: "130.25" },
        { method: "card", amount: "109.75" },
      ],
    })

    const printer = new BrowserTicketPrinter()
    await printer.print([ticket])

    const printAreaHtml = document.querySelector(PRINT_AREA_SELECTOR)?.innerHTML
    expect(printAreaHtml).toBeDefined()

    expect(printAreaHtml).toContain("Los Chicos")
    expect(printAreaHtml).toContain("V-00099")
    expect(printAreaHtml).toContain("TOTAL")
    expect(printAreaHtml).toContain("$240,00")
    expect(printAreaHtml).toContain("DTO 10%")
    expect(printAreaHtml).toContain("-$30,00")
    expect(printAreaHtml).not.toContain("Forma de pago")
    expect(printAreaHtml).not.toContain("Efectivo")
    expect(printAreaHtml).not.toContain("Tarjeta")
    expect(printAreaHtml).not.toContain("$130,25")
    expect(printAreaHtml).not.toContain("$109,75")
  })

  it("shows fiscal subtotal, discount, and final total when discounts apply", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    await printer.print([
      makeFiscalTicket({
        items: [
          {
            productId: "P001",
            name: "Leche entera 1L",
            quantity: 2,
            unitPrice: "120.00",
            subtotal: "240.00",
            discountAmount: "30.00",
            appliedPromotions: [],
            appliedPromotionType: "percentage",
          },
        ],
        total: "210.00",
        payments: [{ method: "cash", amount: "210.00" }],
      }),
    ])

    const printAreaHtml = document.querySelector(PRINT_AREA_SELECTOR)?.innerHTML
    expect(printAreaHtml).toBeDefined()
    expect(printAreaHtml).toContain("Subtotal")
    expect(printAreaHtml).toContain("Descuento")
    expect(printAreaHtml).toContain("$240,00")
    expect(printAreaHtml).toContain("-$30,00")
    expect(printAreaHtml).toContain("TOTAL</span><span>$210,00")
    expect(printAreaHtml).not.toContain("Forma de pago")
    expect(printAreaHtml).not.toContain("Efectivo")
  })

  it("shows non-fiscal subtotal, discount, and final total when discounts apply", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    await printer.print([
      makeTicket({
        items: [
          {
            productId: "P001",
            name: "Leche entera 1L",
            quantity: 2,
            unitPrice: "120.00",
            subtotal: "240.00",
            discountAmount: "30.00",
            appliedPromotions: [],
            appliedPromotionType: "percentage",
          },
        ],
        total: "210.00",
        payments: [{ method: "cash", amount: "210.00" }],
      }),
    ])

    const printAreaHtml = document.querySelector(PRINT_AREA_SELECTOR)?.innerHTML
    expect(printAreaHtml).toBeDefined()
    expect(printAreaHtml).toContain("Subtotal")
    expect(printAreaHtml).toContain("Descuento")
    expect(printAreaHtml).toContain("$240,00")
    expect(printAreaHtml).toContain("-$30,00")
    expect(printAreaHtml).toContain("TOTAL</span><span>$210,00")
  })

  it("shows non-fiscal subtotal, discount, and final total for manual checkout discounts", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    await printer.print([
      makeTicket({
        items: [
          {
            productId: "P001",
            name: "Leche entera 1L",
            quantity: 2,
            unitPrice: "120.00",
            subtotal: "240.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
          },
        ],
        total: "216.00",
        payments: [{ method: "cash", amount: "216.00" }],
      }),
    ])

    const printAreaHtml = document.querySelector(PRINT_AREA_SELECTOR)?.innerHTML
    expect(printAreaHtml).toBeDefined()
    expect(printAreaHtml).toContain("Subtotal")
    expect(printAreaHtml).toContain("Descuento")
    expect(printAreaHtml).toContain("$240,00")
    expect(printAreaHtml).toContain("-$24,00")
    expect(printAreaHtml).toContain("TOTAL</span><span>$216,00")
  })

  it("keeps the printed TOTAL tied to the sale total when cash paid is higher", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    await printer.print([
      makeTicket({
        items: [
          {
            productId: "P001",
            name: "Producto A",
            quantity: 1,
            unitPrice: "3900.00",
            subtotal: "3900.00",
            discountAmount: "0.00",
            appliedPromotions: [],
            appliedPromotionType: null,
          },
        ],
        total: "3900.00",
        payments: [{ method: "cash", amount: "4000.00" }],
      }),
    ])

    const printAreaHtml = document.querySelector(PRINT_AREA_SELECTOR)?.innerHTML
    expect(printAreaHtml).toBeDefined()
    expect(printAreaHtml).toContain("TOTAL</span><span>$3900,00")
    expect(printAreaHtml).not.toContain("Forma de pago")
    expect(printAreaHtml).not.toContain("Efectivo")
    expect(printAreaHtml).not.toContain("$4000,00")
  })

  it("applies bold font weight to the whole printed ticket container", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    await printer.print([makeTicket()])

    const styleContent = document.querySelector(`${PRINT_AREA_SELECTOR} style`)?.textContent
    expect(styleContent).toBeDefined()
    expect(styleContent).toMatch(/#ticket-print-area\s*\{[^}]*font-weight:\s*700;/s)
  })

  // ── QR fallback: missing fiscal data ──────────────────────────

  it("prints fiscal ticket without QR when fiscal data is missing", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const ticket = makeFiscalTicket({
      fiscal: {
        cae: "",
        caeVto: "2026-07-15",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
      },
    })

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([ticket])

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok")

    // No QR image in DOM
    const qrImages = document.querySelectorAll(`${PRINT_AREA_SELECTOR} .arca-qr-image`)
    expect(qrImages.length).toBe(0)

    // Technical log was emitted
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[arca-fiscal-qr]"),
    )

    // No operator warning for missing data
    expect(result.warnings).toBeUndefined()
  })

  // ── QR fallback: invalid fiscal data ──────────────────────────

  it("prints fiscal ticket without QR and returns warning for invalid data", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const ticket = makeFiscalTicket({
      fiscal: {
        cae: "12345678901234",
        caeVto: "2026-07-15",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "ABC",
      },
    })

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([ticket])

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok")

    // No QR image in DOM
    const qrImages = document.querySelectorAll(`${PRINT_AREA_SELECTOR} .arca-qr-image`)
    expect(qrImages.length).toBe(0)

    // Warning is present
    expect(result.warnings).toBeDefined()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings![0].code).toBe("arca-qr-invalid")
    expect(result.warnings![0].reason).toContain("ptoVta")
  })

  // ── QR render failure ─────────────────────────────────────────

  it("prints ticket without QR and returns warning when QR generation throws", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)

    // Force QR render to fail
    vi.spyOn(QrModule, "generateArcaQrDataUrl").mockRejectedValue(new Error("Canvas error"))

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([makeFiscalTicket()])

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok")

    // No QR image in DOM
    const qrImages = document.querySelectorAll(`${PRINT_AREA_SELECTOR} .arca-qr-image`)
    expect(qrImages.length).toBe(0)

    // Warning is present
    expect(result.warnings).toBeDefined()
    expect(result.warnings![0].code).toBe("arca-qr-render-failed")
  })

  // ── Split tickets: independent QR rendering ───────────────────

  it("renders two QR images for two valid fiscal split tickets", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const ticketA = makeFiscalTicket({ groupLabel: "A", total: "10000.00" })
    const ticketB = makeFiscalTicket({ groupLabel: "B", total: "5250.50" })

    const printer = new BrowserTicketPrinter()
    await printer.print([ticketA, ticketB])

    const qrImages = document.querySelectorAll(`${PRINT_AREA_SELECTOR} .arca-qr-image`)
    expect(qrImages.length).toBe(2)
  })

  it("renders QR for valid split ticket but not for sibling with missing data", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const ticketA = makeFiscalTicket({ groupLabel: "A" })
    const ticketB = makeFiscalTicket({
      groupLabel: "B",
      fiscal: {
        cae: "",
        caeVto: "2026-07-15",
        cbteNro: "0000042",
        cbteTipo: "1",
        ptoVta: "0001",
      },
    })

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([ticketA, ticketB])

    expect(result.ok).toBe(true)

    const qrImages = document.querySelectorAll(`${PRINT_AREA_SELECTOR} .arca-qr-image`)
    expect(qrImages.length).toBe(1)

    expect(result.warnings).toBeUndefined()
  })

  // ── Non-fiscal ticket exclusion ───────────────────────────────

  it("does NOT render any QR for non-fiscal tickets", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    await printer.print([makeTicket({ format: "nonFiscal" })])

    const qrImages = document.querySelectorAll(`${PRINT_AREA_SELECTOR} .arca-qr-image`)
    expect(qrImages.length).toBe(0)
    const qrBlocks = document.querySelectorAll(`${PRINT_AREA_SELECTOR} .arca-qr-block`)
    expect(qrBlocks.length).toBe(0)
  })
})

// ── Desktop IPC bridge routing ──────────────────────────────────

describe("BrowserTicketPrinter — desktop bridge", () => {
  const PRINT_AREA_SELECTOR = "#ticket-print-area"

  it("calls desktop bridge when window.marketDesktop.printing.printTicket is available", async () => {
    // stub window.print so it would fail if called accidentally
    const windowPrintStub = vi.spyOn(window, "print").mockImplementation(() => undefined)

    const bridgeStub = vi.fn().mockResolvedValue({ success: true })
    ;(window as any).marketDesktop = {
      printing: { printTicket: bridgeStub },
    }

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([makeTicket({ format: "nonFiscal" })])

    expect(result.ok).toBe(true)
    expect(bridgeStub).toHaveBeenCalledTimes(1)
    expect(bridgeStub).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.any(String), ticketCount: 1 })
    )
    // window.print must NOT be called when bridge succeeds
    expect(windowPrintStub).not.toHaveBeenCalled()

    // cleanup
    delete (window as any).marketDesktop
    windowPrintStub.mockRestore()
  })

  it("falls back to browser print when bridge is absent (marketDesktop missing)", async () => {
    const windowPrintStub = vi.spyOn(window, "print").mockImplementation(() => undefined)

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([makeTicket({ format: "nonFiscal" })])

    expect(result.ok).toBe(true)
    expect(windowPrintStub).toHaveBeenCalled()

    windowPrintStub.mockRestore()
  })

  it("falls back to browser print when marketDesktop exists but printing.printTicket is missing", async () => {
    const windowPrintStub = vi.spyOn(window, "print").mockImplementation(() => undefined)
    ;(window as any).marketDesktop = { printing: {} } // no printTicket

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([makeTicket({ format: "nonFiscal" })])

    expect(result.ok).toBe(true)
    expect(windowPrintStub).toHaveBeenCalled()

    delete (window as any).marketDesktop
    windowPrintStub.mockRestore()
  })

  it("falls back to browser print when bridge returns success:false with fallbackToBrowser:true", async () => {
    const windowPrintStub = vi.spyOn(window, "print").mockImplementation(() => undefined)
    const bridgeStub = vi.fn().mockResolvedValue({ success: false, fallbackToBrowser: true })
    ;(window as any).marketDesktop = {
      printing: { printTicket: bridgeStub },
    }

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([makeTicket({ format: "nonFiscal" })])

    expect(result.ok).toBe(true)
    expect(bridgeStub).toHaveBeenCalledTimes(1)
    expect(windowPrintStub).toHaveBeenCalled() // fallback triggered

    delete (window as any).marketDesktop
    windowPrintStub.mockRestore()
  })

  it("returns error when bridge fails without fallbackToBrowser", async () => {
    const windowPrintStub = vi.spyOn(window, "print").mockImplementation(() => undefined)
    const bridgeStub = vi.fn().mockResolvedValue({ success: false, error: "Printer offline" })
    ;(window as any).marketDesktop = {
      printing: { printTicket: bridgeStub },
    }

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([makeTicket({ format: "nonFiscal" })])

    expect(result.ok).toBe(false)
    expect(result.reason).toContain("Printer offline")
    expect(bridgeStub).toHaveBeenCalledTimes(1)
    expect(windowPrintStub).not.toHaveBeenCalled()

    delete (window as any).marketDesktop
    windowPrintStub.mockRestore()
  })
})
