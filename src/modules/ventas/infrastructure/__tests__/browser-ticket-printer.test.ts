import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { BrowserTicketPrinter } from "../browser-ticket-printer"
import type { PrintableTicket } from "../../domain/ticket"

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

function makeFiscalTicket(): PrintableTicket {
  return makeTicket({
    format: "fiscal",
    fiscal: {
      cae: "12345678901234",
      caeVto: "2026-07-15",
      cbteNro: "0000042",
      cbteTipo: "1",
      ptoVta: "0001",
    },
  })
}

interface FakePrintWindow {
  document: {
    write: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
  }
  print: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  onload: (() => void) | null
  onafterprint: (() => void) | null
}

function createFakePrintWindow(): FakePrintWindow {
  const win: FakePrintWindow = {
    document: {
      write: vi.fn(),
      close: vi.fn(),
    },
    print: vi.fn(),
    close: vi.fn(),
    onload: null,
    onafterprint: null,
  }
  return win
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BrowserTicketPrinter", () => {
  let openSpy: ReturnType<typeof vi.spyOn>
  let originalOpen: typeof window.open

  beforeEach(() => {
    originalOpen = window.open
  })

  afterEach(() => {
    window.open = originalOpen
    vi.restoreAllMocks()
  })

  // --- popup blocked failure ---

  it("returns ok:false when popup is blocked", async () => {
    vi.spyOn(window, "open").mockReturnValue(null)
    const printer = new BrowserTicketPrinter()

    const result = await printer.print([makeTicket()])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain("Popup blocked")
    }
  })

  // --- calls print on success ---

  it("calls window.print() on the popup and returns ok:true", async () => {
    const fakeWin = createFakePrintWindow()
    vi.spyOn(window, "open").mockReturnValue(fakeWin as unknown as Window)

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([makeTicket()])

    expect(fakeWin.document.write).toHaveBeenCalled()
    expect(fakeWin.document.close).toHaveBeenCalled()
    expect(fakeWin.print).toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  // --- closes popup after print (afterprint handler) ---

  it("sets onafterprint to close the popup after print dialog", async () => {
    const fakeWin = createFakePrintWindow()
    vi.spyOn(window, "open").mockReturnValue(fakeWin as unknown as Window)

    const printer = new BrowserTicketPrinter()
    await printer.print([makeTicket()])

    // onafterprint should be set after print() is called
    expect(fakeWin.onafterprint).toBeDefined()
    expect(fakeWin.close).not.toHaveBeenCalled() // not called yet

    // Simulate afterprint firing
    fakeWin.onafterprint!()
    expect(fakeWin.close).toHaveBeenCalled()
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
    const fakeWin = createFakePrintWindow()
    // Simulate an unexpected error in document.write
    fakeWin.document.write.mockImplementation(() => {
      throw new Error("DOM error")
    })
    vi.spyOn(window, "open").mockReturnValue(fakeWin as unknown as Window)

    const printer = new BrowserTicketPrinter()
    const result = await printer.print([makeTicket()])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("DOM error")
    }
  })

  // --- printable HTML markers: non-fiscal label ---

  it("includes TICKET NO FISCAL marker in HTML for non-fiscal ticket", async () => {
    const fakeWin = createFakePrintWindow()
    vi.spyOn(window, "open").mockReturnValue(fakeWin as unknown as Window)

    const printer = new BrowserTicketPrinter()
    await printer.print([makeTicket({ format: "nonFiscal" })])

    const writtenHtml = fakeWin.document.write.mock.calls[0]?.[0] as string | undefined
    expect(writtenHtml).toBeDefined()
    expect(writtenHtml).toContain("TICKET NO FISCAL")
    expect(writtenHtml).not.toContain("TICKET FISCAL")
  })

  // --- printable HTML markers: fiscal label ---

  it("includes TICKET FISCAL marker and AFIP fields in HTML for fiscal ticket", async () => {
    const fakeWin = createFakePrintWindow()
    vi.spyOn(window, "open").mockReturnValue(fakeWin as unknown as Window)

    const printer = new BrowserTicketPrinter()
    await printer.print([makeFiscalTicket()])

    const writtenHtml = fakeWin.document.write.mock.calls[0]?.[0] as string | undefined
    expect(writtenHtml).toBeDefined()
    expect(writtenHtml).toContain("TICKET FISCAL")
    expect(writtenHtml).not.toContain("TICKET NO FISCAL")

    // AFIP fields should be present in the HTML
    expect(writtenHtml).toContain("CAE:")
    expect(writtenHtml).toContain("12345678901234")
    expect(writtenHtml).toContain("Vto CAE:")
    expect(writtenHtml).toContain("Comprobante:")
    expect(writtenHtml).toContain("Punto de venta:")
  })

  // --- printable HTML markers: split ticket labels ---

  it("includes group and index labels in HTML for split tickets", async () => {
    const fakeWin = createFakePrintWindow()
    vi.spyOn(window, "open").mockReturnValue(fakeWin as unknown as Window)

    const ticketA = makeTicket({ groupLabel: "A" })
    const ticketB = makeTicket({ groupLabel: "B" })

    const printer = new BrowserTicketPrinter()
    await printer.print([ticketA, ticketB])

    const writtenHtml = fakeWin.document.write.mock.calls[0]?.[0] as string | undefined
    expect(writtenHtml).toBeDefined()

    // Multi-ticket labels
    expect(writtenHtml).toContain("Ticket 1 de 2")
    expect(writtenHtml).toContain("Ticket 2 de 2")

    // Group labels
    expect(writtenHtml).toContain("Grupo A")
    expect(writtenHtml).toContain("Grupo B")
  })

  // --- printable HTML markers: single ticket has no multi-ticket label ---

  it("does NOT include multi-ticket labels for a single ticket", async () => {
    const fakeWin = createFakePrintWindow()
    vi.spyOn(window, "open").mockReturnValue(fakeWin as unknown as Window)

    const printer = new BrowserTicketPrinter()
    await printer.print([makeTicket()])

    const writtenHtml = fakeWin.document.write.mock.calls[0]?.[0] as string | undefined
    expect(writtenHtml).toBeDefined()
    expect(writtenHtml).not.toContain("Ticket 1 de")
    expect(writtenHtml).not.toContain("de 1")
  })

  // --- printable HTML: contains store name, sale ID, date, items, total, payments ---

  it("renders all ticket metadata in HTML", async () => {
    const fakeWin = createFakePrintWindow()
    vi.spyOn(window, "open").mockReturnValue(fakeWin as unknown as Window)

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
        { method: "cash", amount: "120.00" },
        { method: "card", amount: "120.00" },
      ],
    })

    const printer = new BrowserTicketPrinter()
    await printer.print([ticket])

    const writtenHtml = fakeWin.document.write.mock.calls[0]?.[0] as string | undefined
    expect(writtenHtml).toBeDefined()

    expect(writtenHtml).toContain("Los Chicos") // store name
    expect(writtenHtml).toContain("V-00099") // sale ID
    expect(writtenHtml).toContain("TOTAL") // total label
    expect(writtenHtml).toContain("$240,00") // formatted total
    expect(writtenHtml).toContain("Dto. 10%") // discount badge
    expect(writtenHtml).toContain("-$30,00") // discount amount
    expect(writtenHtml).toContain("Forma de pago") // payment section
    expect(writtenHtml).toContain("Efectivo")
    expect(writtenHtml).toContain("Tarjeta")
  })
})
