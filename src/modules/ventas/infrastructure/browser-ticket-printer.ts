import type { TicketPrinterPort, TicketPrintWarning } from "../application/ticket-printer-port"
import { merchantFiscalIdentity as MERCHANT } from "@/shared/config/merchant-fiscal-identity"
import type { PrintableTicket } from "../domain/ticket"
import { buildArcaQrPayload, generateArcaQrDataUrl } from "./arca-fiscal-qr"

/**
 * Browser-based ticket printer.
 *
 * Renders tickets into a dedicated hidden node mounted directly under
 * `document.body`, then uses the host window print dialog.
 *
 * This matches the product-label print strategy and avoids popup windows,
 * which are blocked by the Electron shell security policy.
 *
 * Future Hassar/thermal printer adapters can implement the same
 * `TicketPrinterPort` interface without changing ticket-generation code.
 */
export class BrowserTicketPrinter implements TicketPrinterPort {
  async print(
    tickets: PrintableTicket[]
  ): Promise<
    | { ok: true; warnings?: TicketPrintWarning[] }
    | { ok: false; reason: string; warnings?: TicketPrintWarning[] }
  > {
    if (tickets.length === 0) {
      return { ok: false, reason: "No tickets to print" }
    }

    try {
      // Try desktop IPC bridge first when available
      const bridge = (window as any).marketDesktop?.printing?.printTicket
      if (typeof bridge === "function") {
        const { markup, warnings: markupWarnings } = await buildPrintMarkup(tickets)
        const result = await bridge({ html: markup, ticketCount: tickets.length })
        if (result.success) {
          return { ok: true, warnings: markupWarnings.length > 0 ? markupWarnings : undefined }
        }
        if (!result.fallbackToBrowser) {
          return { ok: false, reason: result.error ?? "Desktop print failed", warnings: markupWarnings.length > 0 ? markupWarnings : undefined }
        }
        // fallbackToBrowser: true — continue to browser print below
      }

      const { cleanup, warnings } = await mountPrintArea(tickets)
      const handleAfterPrint = () => {
        window.removeEventListener("afterprint", handleAfterPrint)
        cleanup()
      }

      window.addEventListener("afterprint", handleAfterPrint)
      await waitForNextFrame()
      window.print()
      return { ok: true, warnings: warnings.length > 0 ? warnings : undefined }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown print error"
      console.error("[BrowserTicketPrinter] Print failed:", message, err)
      return { ok: false, reason: message }
    }
  }
}

// ---------------------------------------------------------------------------
// DOM mount
// ---------------------------------------------------------------------------

const PRINT_AREA_ID = "ticket-print-area"

async function mountPrintArea(
  tickets: PrintableTicket[]
): Promise<{ cleanup: () => void; warnings: TicketPrintWarning[] }> {
  document.getElementById(PRINT_AREA_ID)?.remove()

  const printArea = document.createElement("div")
  printArea.id = PRINT_AREA_ID
  printArea.setAttribute("aria-hidden", "true")
  printArea.style.position = "absolute"
  printArea.style.left = "-9999px"
  printArea.style.top = "0"
  printArea.style.width = "80mm"
  printArea.style.pointerEvents = "none"

  const { markup, warnings } = await buildPrintMarkup(tickets)
  printArea.innerHTML = markup

  document.body.appendChild(printArea)

  return {
    cleanup: () => {
      if (printArea.parentNode) {
        printArea.parentNode.removeChild(printArea)
      }
    },
    warnings,
  }
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

// ---------------------------------------------------------------------------
// HTML & CSS template
// ---------------------------------------------------------------------------

async function buildPrintMarkup(
  tickets: PrintableTicket[]
): Promise<{ markup: string; warnings: TicketPrintWarning[] }> {
  const allWarnings: TicketPrintWarning[] = []
  const ticketsHtmlArr: string[] = []

  for (let i = 0; i < tickets.length; i++) {
    const { html, warnings } = await buildTicketHtml(tickets[i], i, tickets.length)
    ticketsHtmlArr.push(html)
    allWarnings.push(...warnings)
  }

  return {
    markup: `<style>${PRINT_CSS}</style>${ticketsHtmlArr.join("\n")}`,
    warnings: allWarnings,
  }
}

async function buildTicketHtml(
  ticket: PrintableTicket,
  index: number,
  totalTickets: number
): Promise<{ html: string; warnings: TicketPrintWarning[] }> {
  const groupInfo = ticket.groupLabel
    ? ` — Grupo ${ticket.groupLabel}`
    : ""
  const multiTicketLabel =
    totalTickets > 1
      ? `<div class="ticket-subtitle">Ticket ${index + 1} de ${totalTickets}${groupInfo}</div>`
      : ""

  const itemsHtml = ticket.items
    .map((item) => {
      const discountLines = item.appliedPromotions && item.appliedPromotions.length > 0
        ? item.appliedPromotions
            .map((ap) => {
              const scopeLabel = ap.promotionScope === "store" ? "Tienda" : "Producto"
              const typeLabel = ap.promotionType === "percentage" ? "%" : "2x1"
              const promoLabel = `DTO ${scopeLabel} ${typeLabel}`
              return `
                  <div class="item-detail discount-line">
                    <span>${promoLabel}</span>
                    <span class="item-subtotal">-${formatPrice(ap.discountAmount)}</span>
                  </div>`
            })
            .join("")
        : (item.discountAmount && Number.parseFloat(item.discountAmount) > 0
            ? `<div class="item-detail discount-line">
                    <span>${item.appliedPromotionType === "percentage" ? "DTO 10%" : item.appliedPromotionType === "two_x_one" ? "DTO 2x1" : "DTO"}</span>
                    <span class="item-subtotal">-${formatPrice(item.discountAmount)}</span>
                  </div>`
            : "")

      const descriptionLine = item.description
        ? `<div class="item-description">${escapeHtml(item.description)}</div>`
        : ""

      return `
          <div class="item-line">
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${descriptionLine}
            <div class="item-detail">
              <span>${item.quantity} x ${formatPrice(item.unitPrice)}</span>
              <span class="item-subtotal">${formatPrice(item.subtotal)}</span>
            </div>
            ${discountLines}
          </div>`
    })
    .join("")

  const paymentsHtml = ticket.payments
    .map(
      (p) => `
          <div class="line">
            <span>${paymentLabel(p.method)}</span>
            <span>${formatPrice(p.amount)}</span>
          </div>`
    )
    .join("")

  if (ticket.format === "fiscal" && ticket.fiscal) {
    return buildFiscalTicketHtml(ticket, itemsHtml, paymentsHtml, multiTicketLabel, index, totalTickets)
  }

  const ticketTotals = calculateTicketTotals(ticket)
  const discountLine = ticketTotals.discount > 0
    ? `<div class="line"><span>Descuento</span><span>-${formatPriceFromNumber(ticketTotals.discount)}</span></div>`
    : ""
  const subtotalSection = ticketTotals.discount > 0
    ? `
        <div class="line"><span>Subtotal</span><span>${formatPriceFromNumber(ticketTotals.subtotal)}</span></div>
        ${discountLine}`
    : ""

  return {
    html: `
      <div class="ticket non-fiscal-ticket">
        <div class="ticket-header">
          <div class="store-name">${escapeHtml(MERCHANT.tradeName)}</div>
          <div class="store-alias">${escapeHtml(MERCHANT.displayName)}</div>
          <div class="ticket-label">TICKET NO FISCAL</div>
          ${multiTicketLabel}
        </div>

        <div class="section compact-section">
          <div class="line"><span>Venta:</span><span>${escapeHtml(ticket.saleId)}</span></div>
          <div class="line"><span>Fecha:</span><span>${escapeHtml(formatDate(ticket.saleDate))}</span></div>
        </div>

        <div class="separator">--------------------------------</div>

        <div class="items-section">
          ${itemsHtml}
        </div>

        <div class="separator">--------------------------------</div>

        <div class="section compact-section">
          ${subtotalSection}
          <div class="line total-line"><span>TOTAL</span><span>${formatPriceFromNumber(ticketTotals.finalTotal)}</span></div>
        </div>

        ${ticket.payments.length > 0 ? `
        <div class="section compact-section">
          <div class="section-label">Forma de pago</div>
          ${paymentsHtml}
        </div>` : ""}

        <div class="separator">--------------------------------</div>

        <div class="footer">
          <p>Gracias por su compra</p>
          <p class="small">${escapeHtml(MERCHANT.displayName)}</p>
        </div>
      </div>`,
    warnings: [],
  }
}

async function buildFiscalTicketHtml(
  ticket: PrintableTicket,
  itemsHtml: string,
  paymentsHtml: string,
  multiTicketLabel: string,
  ticketIndex: number,
  ticketCount: number,
): Promise<{ html: string; warnings: TicketPrintWarning[] }> {
  const warnings: TicketPrintWarning[] = []
  const fiscal = ticket.fiscal!
  const fiscalTotals = calculateFiscalTotals(ticket)
  const { netTaxed, vatAmount } = calculateFiscalBreakdown(fiscalTotals.finalTotal)
  const saleDate = formatDateParts(ticket.saleDate)
  const grossIncomeValue = MERCHANT.grossIncomeNumber ?? MERCHANT.grossIncomePlaceholder
  const pointOfSale = fiscal.ptoVta || MERCHANT.pointOfSale
  const discountLine = fiscalTotals.discount > 0
    ? `<div class="line"><span>Descuento</span><span>-${formatPriceFromNumber(fiscalTotals.discount)}</span></div>`
    : ""

  // ── QR preparation ─────────────────────────────────────────────┐
  const qrBlock = await prepareQrBlock(ticket, fiscalTotals.finalTotal, ticketIndex, ticketCount)
  if (qrBlock.warning) {
    warnings.push(qrBlock.warning)
  }

  return {
    html: `
      <div class="ticket fiscal-ticket">
        <div class="fiscal-topline">
          <span>COD. 006</span>
          <span>FACTURA B</span>
        </div>

        <div class="ticket-header fiscal-header">
          <div class="document-copy">ORIGINAL</div>
          <div class="legal-name">${escapeHtml(MERCHANT.legalName)}</div>
          <div class="store-name">${escapeHtml(MERCHANT.tradeName)}</div>
          <div class="merchant-activity">${escapeHtml(MERCHANT.activity)}</div>
          <div class="merchant-address">${escapeHtml(MERCHANT.taxOfficeAddress)}</div>
          <div class="merchant-meta">CUIT: ${escapeHtml(MERCHANT.cuit)}</div>
          <div class="merchant-meta">Ingresos Brutos: ${escapeHtml(grossIncomeValue)}</div>
          <div class="merchant-meta">Condición frente al IVA: ${escapeHtml(MERCHANT.ivaCondition)}</div>
          <div class="merchant-meta">Inicio de actividades: ${escapeHtml(MERCHANT.activityStartDate)}</div>
          ${multiTicketLabel}
        </div>

        <div class="section compact-section fiscal-identification">
          <div class="line"><span>P.V.: ${escapeHtml(pointOfSale)}</span><span>Comp. Nro: ${escapeHtml(fiscal.cbteNro)}</span></div>
          <div class="line"><span>Fecha: ${escapeHtml(saleDate.date)}</span><span>Hora: ${escapeHtml(saleDate.time)}</span></div>
          <div class="line"><span>Venta:</span><span>${escapeHtml(ticket.saleId)}</span></div>
          <div class="line"><span>Cliente:</span><span>${escapeHtml(MERCHANT.defaultClientName)}</span></div>
          <div class="line"><span>Condición IVA:</span><span>${escapeHtml(MERCHANT.defaultClientName)}</span></div>
          <div class="line"><span>Condición de venta:</span><span>${escapeHtml(MERCHANT.defaultSaleCondition)}</span></div>
        </div>

        <div class="separator">--------------------------------</div>

        <div class="items-header">
          <span>Descripción</span>
          <span>Importe</span>
        </div>
        <div class="items-section">
          ${itemsHtml}
        </div>

        <div class="separator">--------------------------------</div>

        <div class="section compact-section totals-section">
          <div class="line"><span>Neto gravado</span><span>${formatPriceFromNumber(netTaxed)}</span></div>
          <div class="line"><span>IVA 21%</span><span>${formatPriceFromNumber(vatAmount)}</span></div>
          <div class="line"><span>Otros Imp. Nacionales Indirectos</span><span>${formatPriceFromNumber(0)}</span></div>
          <div class="line"><span>Subtotal</span><span>${formatPriceFromNumber(fiscalTotals.subtotal)}</span></div>
          ${discountLine}
          <div class="line total-line"><span>TOTAL</span><span>${formatPriceFromNumber(fiscalTotals.finalTotal)}</span></div>
        </div>

        ${ticket.payments.length > 0 ? `
        <div class="section compact-section">
          <div class="section-label">Forma de pago</div>
          ${paymentsHtml}
        </div>` : ""}

        <div class="separator">--------------------------------</div>

        <div class="section compact-section transparency-section">
          <div class="section-label">Régimen de Transparencia Fiscal al Consumidor</div>
          <p>IVA contenido en el precio según Ley 27.743.</p>
        </div>

        <div class="section compact-section fiscal-authorization">
          <div class="merchant-meta">ARCA - COMPROBANTE AUTORIZADO</div>
          <div class="merchant-meta">CAE: ${escapeHtml(fiscal.cae)}</div>
          <div class="merchant-meta">Vencimiento CAE: ${escapeHtml(fiscal.caeVto)}</div>
        </div>

        ${qrBlock.html}

        <div class="footer fiscal-footer">
          <p>Comprobante autorizado por ARCA</p>
          <p class="small">Comprobante generado por ${escapeHtml(MERCHANT.tradeName)}</p>
        </div>
      </div>`,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// QR preparation
// ---------------------------------------------------------------------------

interface QrBlockResult {
  html: string
  warning: TicketPrintWarning | null
}

async function prepareQrBlock(
  ticket: PrintableTicket,
  finalTotal: number,
  ticketIndex: number,
  ticketCount: number,
): Promise<QrBlockResult> {
  // Only fiscal tickets with fiscal data enter QR flow.
  if (!ticket.fiscal) {
    return { html: "", warning: null }
  }

  const { saleId, saleDate, groupLabel } = ticket
  const cuit = MERCHANT.cuit
  const { ptoVta, cbteTipo, cbteNro, cae } = ticket.fiscal

  const payloadResult = buildArcaQrPayload({
    saleDate,
    cuit,
    ptoVta,
    cbteTipo,
    cbteNro,
    cae,
    importe: finalTotal,
  })

  if (!payloadResult.ok) {
    logQrFailure("payload", payloadResult.reason, saleId, ticketIndex, ticketCount, groupLabel)

    if (payloadResult.kind === "invalid") {
      return {
        html: "",
        warning: buildQrWarning(ticket, ticketIndex, ticketCount, payloadResult.reason, "arca-qr-invalid"),
      }
    }
    // kind === "missing" → log only, no operator warning
    return { html: "", warning: null }
  }

  const imageResult = await generateArcaQrDataUrl(payloadResult.url).catch(
    (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown QR render error"
      return { ok: false as const, kind: "render" as const, reason: `QR library error: ${message}` }
    },
  )

  if (!imageResult.ok) {
    logQrFailure("render", imageResult.reason, saleId, ticketIndex, ticketCount, groupLabel)
    return {
      html: "",
      warning: buildQrWarning(ticket, ticketIndex, ticketCount, imageResult.reason, "arca-qr-render-failed"),
    }
  }

  return {
    html: `<div class="arca-qr-block"><img class="arca-qr-image" src="${imageResult.dataUrl}" alt="QR ARCA" /></div>`,
    warning: null,
  }
}

// ---------------------------------------------------------------------------
// QR technical logging & warning helpers
// ---------------------------------------------------------------------------

function logQrFailure(
  stage: "payload" | "render",
  reason: string,
  saleId: string,
  ticketIndex: number,
  ticketCount: number,
  groupLabel?: string,
): void {
  const timestamp = new Date().toISOString()
  const group = groupLabel ? ` group=${groupLabel}` : ""
  console.warn(
    `[arca-fiscal-qr] ts=${timestamp} saleId=${saleId} ticket=${ticketIndex + 1}/${ticketCount}${group} stage=${stage} reason="${reason}"`,
  )
}

function buildQrWarning(
  ticket: PrintableTicket,
  ticketIndex: number,
  ticketCount: number,
  reason: string,
  code: TicketPrintWarning["code"],
): TicketPrintWarning {
  return {
    code,
    saleId: ticket.saleId,
    ticketIndex,
    ticketCount,
    groupLabel: ticket.groupLabel,
    reason,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string | number | null | undefined): string {
  // Guard: backend may return numeric fields (e.g. cbte_tipo, pto_vta) instead
  // of strings. Converting here prevents "text.replace is not a function" at runtime.
  const s = text == null ? "" : String(text)
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatPrice(amount: string): string {
  const n = Number.parseFloat(amount)
  return formatPriceFromNumber(n)
}

function formatPriceFromNumber(amount: number): string {
  if (!Number.isFinite(amount)) return "$0,00"
  return `$${amount.toFixed(2).replace(".", ",")}`
}

const BUENOS_AIRES_TZ = "America/Argentina/Buenos_Aires"

function formatDate(iso: string): string {
  const parts = formatDateParts(iso)
  return parts.full
}

function formatDateParts(iso: string): { date: string; time: string; full: string } {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) {
      return { date: iso, time: "", full: iso }
    }

    const date = new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: BUENOS_AIRES_TZ,
    }).format(d)

    const time = new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: BUENOS_AIRES_TZ,
    }).format(d)

    return {
      date,
      time,
      full: time ? `${date}, ${time}` : date,
    }
  } catch {
    return { date: iso, time: "", full: iso }
  }
}

function calculateTicketTotals(ticket: PrintableTicket): {
  subtotal: number
  discount: number
  finalTotal: number
} {
  const subtotal = roundCurrency(
    ticket.items.reduce((sum, item) => sum + parseAmount(item.subtotal), 0)
  )
  const itemLevelDiscount = roundCurrency(
    ticket.items.reduce((sum, item) => sum + parseAmount(item.discountAmount), 0)
  )
  const derivedFinalTotal = roundCurrency(Math.max(0, subtotal - itemLevelDiscount))
  const paymentsTotal = roundCurrency(
    ticket.payments.reduce((sum, payment) => sum + parseAmount(payment.amount), 0)
  )
  const fallbackTotal = roundCurrency(parseAmount(ticket.total))

  const finalTotal = paymentsTotal > 0
    ? paymentsTotal
    : derivedFinalTotal > 0 || subtotal === 0
      ? derivedFinalTotal
      : fallbackTotal
  const discount = roundCurrency(Math.max(itemLevelDiscount, subtotal - finalTotal, 0))

  return {
    subtotal,
    discount,
    finalTotal,
  }
}

function calculateFiscalTotals(ticket: PrintableTicket): {
  subtotal: number
  discount: number
  finalTotal: number
} {
  return calculateTicketTotals(ticket)
}

function calculateFiscalBreakdown(total: number): {
  netTaxed: number
  vatAmount: number
} {
  if (!Number.isFinite(total)) {
    return { netTaxed: 0, vatAmount: 0 }
  }

  const netTaxed = total / 1.21
  const vatAmount = total - netTaxed

  return {
    netTaxed: roundCurrency(netTaxed),
    vatAmount: roundCurrency(vatAmount),
  }
}

function parseAmount(amount: string | null | undefined): number {
  const parsed = Number.parseFloat(amount ?? "")
  return Number.isFinite(parsed) ? parsed : 0
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    qr: "QR",
  }
  return labels[method] ?? method
}

// ---------------------------------------------------------------------------
// Print CSS
// ---------------------------------------------------------------------------

const PRINT_CSS = `
      #${PRINT_AREA_ID},
      #${PRINT_AREA_ID} * {
        box-sizing: border-box;
      }

      #${PRINT_AREA_ID} {
        font-family: "Courier New", Courier, monospace;
        font-size: 12px;
        line-height: 1.3;
        color: #000;
        background: #fff;
        padding: 8px;
      }

      @page {
        size: 80mm auto;
        margin: 2mm;
      }

      @media print {
        body > * {
          display: none !important;
        }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
        }

        body > #${PRINT_AREA_ID} {
          display: block !important;
          position: static !important;
          left: auto !important;
          top: auto !important;
          width: 80mm !important;
          max-width: 80mm !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          pointer-events: none !important;
        }

        #${PRINT_AREA_ID},
        #${PRINT_AREA_ID} * {
          overflow: visible !important;
        }

        #${PRINT_AREA_ID} .ticket {
          break-after: page;
          page-break-after: always;
          break-inside: avoid;
          page-break-inside: avoid;
          border: none;
          margin: 0;
        }

        #${PRINT_AREA_ID} .ticket:last-child {
          break-after: auto;
          page-break-after: auto;
        }

        #${PRINT_AREA_ID} .ticket-header,
        #${PRINT_AREA_ID} .section,
        #${PRINT_AREA_ID} .items-section,
        #${PRINT_AREA_ID} .item-line,
        #${PRINT_AREA_ID} .footer,
        #${PRINT_AREA_ID} .arca-qr-block {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }

      #${PRINT_AREA_ID} .ticket {
        max-width: 76mm;
        margin: 0 auto 12px auto;
        padding: 3mm;
        border: 1px dashed #cfcfcf;
      }

      #${PRINT_AREA_ID} .ticket-header,
      #${PRINT_AREA_ID} .footer {
        text-align: center;
      }

      #${PRINT_AREA_ID} .fiscal-topline,
      #${PRINT_AREA_ID} .line,
      #${PRINT_AREA_ID} .item-detail,
      #${PRINT_AREA_ID} .items-header {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      #${PRINT_AREA_ID} .store-name,
      #${PRINT_AREA_ID} .legal-name,
      #${PRINT_AREA_ID} .document-copy,
      #${PRINT_AREA_ID} .ticket-label,
      #${PRINT_AREA_ID} .section-label,
      #${PRINT_AREA_ID} .total-line,
      #${PRINT_AREA_ID} .items-header {
        font-weight: 700;
      }

      #${PRINT_AREA_ID} .store-name,
      #${PRINT_AREA_ID} .legal-name,
      #${PRINT_AREA_ID} .ticket-label,
      #${PRINT_AREA_ID} .document-copy,
      #${PRINT_AREA_ID} .section-label {
        text-transform: uppercase;
      }

      #${PRINT_AREA_ID} .fiscal-topline {
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 4px;
      }

      #${PRINT_AREA_ID} .fiscal-header {
        border: 1px solid #000;
        padding: 4px;
        margin-bottom: 6px;
      }

      #${PRINT_AREA_ID} .legal-name,
      #${PRINT_AREA_ID} .store-name {
        font-size: 14px;
      }

      #${PRINT_AREA_ID} .store-alias,
      #${PRINT_AREA_ID} .merchant-activity,
      #${PRINT_AREA_ID} .merchant-address,
      #${PRINT_AREA_ID} .merchant-meta,
      #${PRINT_AREA_ID} .ticket-subtitle,
      #${PRINT_AREA_ID} .item-description,
      #${PRINT_AREA_ID} .footer .small,
      #${PRINT_AREA_ID} .transparency-section p {
        font-size: 11px;
      }

      #${PRINT_AREA_ID} .merchant-address,
      #${PRINT_AREA_ID} .merchant-activity,
      #${PRINT_AREA_ID} .merchant-meta,
      #${PRINT_AREA_ID} .item-name,
      #${PRINT_AREA_ID} .item-description,
      #${PRINT_AREA_ID} .transparency-section p {
        margin-top: 2px;
      }

      #${PRINT_AREA_ID} .ticket-label {
        margin-top: 3px;
      }

      #${PRINT_AREA_ID} .section,
      #${PRINT_AREA_ID} .footer {
        margin-top: 6px;
      }

      #${PRINT_AREA_ID} .compact-section {
        margin-top: 4px;
      }

      #${PRINT_AREA_ID} .line,
      #${PRINT_AREA_ID} .item-detail {
        align-items: flex-start;
        font-size: 12px;
        padding: 1px 0;
      }

      #${PRINT_AREA_ID} .line > span:first-child,
      #${PRINT_AREA_ID} .items-header > span:first-child,
      #${PRINT_AREA_ID} .item-name,
      #${PRINT_AREA_ID} .item-description {
        flex: 1;
        min-width: 0;
      }

      #${PRINT_AREA_ID} .line > span:last-child,
      #${PRINT_AREA_ID} .items-header > span:last-child,
      #${PRINT_AREA_ID} .item-subtotal {
        text-align: right;
        white-space: nowrap;
      }

      #${PRINT_AREA_ID} .items-header {
        border-bottom: 1px solid #000;
        padding-bottom: 2px;
        font-size: 11px;
      }

      #${PRINT_AREA_ID} .item-line {
        margin: 4px 0;
      }

      #${PRINT_AREA_ID} .item-detail {
        padding-left: 6px;
      }

      #${PRINT_AREA_ID} .discount-line {
        font-weight: 700;
      }

      #${PRINT_AREA_ID} .total-line {
        border-top: 1px solid #000;
        font-size: 14px;
        margin-top: 2px;
        padding-top: 3px;
      }

      #${PRINT_AREA_ID} .separator {
        overflow: hidden;
        color: #555;
        font-size: 10px;
        letter-spacing: 0.8px;
        text-align: center;
        margin-top: 6px;
      }

      #${PRINT_AREA_ID} .transparency-section {
        border: 1px solid #000;
        padding: 4px;
      }

      #${PRINT_AREA_ID} .transparency-section p {
        margin-bottom: 0;
      }

      #${PRINT_AREA_ID} .arca-qr-block {
        margin-top: 6px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      #${PRINT_AREA_ID} .arca-qr-image {
        width: 28mm;
        height: 28mm;
        object-fit: contain;
        image-rendering: pixelated;
      }

      #${PRINT_AREA_ID} .fiscal-footer,
      #${PRINT_AREA_ID} .footer {
        font-size: 11px;
      }

      #${PRINT_AREA_ID} p {
        margin: 2px 0;
      }
    `
