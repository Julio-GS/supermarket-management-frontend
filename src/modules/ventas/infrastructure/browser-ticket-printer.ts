import type { TicketPrinterPort } from "../application/ticket-printer-port"
import type { PrintableTicket } from "../domain/ticket"

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
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (tickets.length === 0) {
      return { ok: false, reason: "No tickets to print" }
    }

    try {
      const cleanup = mountPrintArea(tickets)
      const handleAfterPrint = () => {
        window.removeEventListener("afterprint", handleAfterPrint)
        cleanup()
      }

      window.addEventListener("afterprint", handleAfterPrint)
      await waitForNextFrame()
      window.print()
      return { ok: true }
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

function mountPrintArea(tickets: PrintableTicket[]): () => void {
  document.getElementById(PRINT_AREA_ID)?.remove()

  const printArea = document.createElement("div")
  printArea.id = PRINT_AREA_ID
  printArea.setAttribute("aria-hidden", "true")
  printArea.style.position = "absolute"
  printArea.style.left = "-9999px"
  printArea.style.top = "0"
  printArea.style.width = "80mm"
  printArea.style.pointerEvents = "none"
  printArea.innerHTML = buildPrintMarkup(tickets)

  document.body.appendChild(printArea)

  return () => {
    if (printArea.parentNode) {
      printArea.parentNode.removeChild(printArea)
    }
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

function buildPrintMarkup(tickets: PrintableTicket[]): string {
  const ticketsHtml = tickets
    .map((ticket, idx) => buildTicketHtml(ticket, idx, tickets.length))
    .join("\n")

  return `<style>${PRINT_CSS}</style>${ticketsHtml}`
}

function buildTicketHtml(
  ticket: PrintableTicket,
  index: number,
  totalTickets: number
): string {
  const headerLabel =
    ticket.format === "fiscal" ? "TICKET FISCAL" : "TICKET NO FISCAL"
  const groupInfo = ticket.groupLabel
    ? ` — Grupo ${ticket.groupLabel}`
    : ""
  const multiTicketLabel =
    totalTickets > 1
      ? `<div class="ticket-subtitle">Ticket ${index + 1} de ${totalTickets}${groupInfo}</div>`
      : ""

  const fiscalSection =
    ticket.format === "fiscal" && ticket.fiscal
      ? `
      <div class="section fiscal-section">
        <div class="line"><span>CAE:</span><span>${escapeHtml(ticket.fiscal.cae)}</span></div>
        <div class="line"><span>Vto CAE:</span><span>${escapeHtml(ticket.fiscal.caeVto)}</span></div>
        <div class="line"><span>Comprobante:</span><span>${escapeHtml(ticket.fiscal.cbteTipo)} - ${escapeHtml(ticket.fiscal.cbteNro)}</span></div>
        <div class="line"><span>Punto de venta:</span><span>${escapeHtml(ticket.fiscal.ptoVta)}</span></div>
      </div>`
      : ""

  const itemsHtml = ticket.items
    .map((item) => {
      const discountLines = item.appliedPromotions && item.appliedPromotions.length > 0
        ? item.appliedPromotions
            .map((ap) => {
              const scopeLabel = ap.promotionScope === "store" ? "Tienda" : "Producto"
              const typeLabel = ap.promotionType === "percentage" ? "%" : "2x1"
              const promoLabel = `Dto. ${scopeLabel} ${typeLabel}`
              return `
              <div class="item-detail discount-line">
                <span>${promoLabel}</span>
                <span class="item-subtotal">-${formatPrice(ap.discountAmount)}</span>
              </div>`
            })
            .join("")
        : (item.discountAmount && Number.parseFloat(item.discountAmount) > 0
            ? `<div class="item-detail discount-line">
                <span>${item.appliedPromotionType === "percentage" ? "Dto. 10%" : item.appliedPromotionType === "two_x_one" ? "Dto. 2x1" : "Dto."}</span>
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
          <span>${item.quantity} × ${formatPrice(item.unitPrice)}</span>
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

  return `
  <div class="ticket">
    <div class="ticket-header">
      <div class="store-name">${escapeHtml(STORE_NAME)}</div>
      <div class="ticket-label">${headerLabel}</div>
      ${multiTicketLabel}
    </div>

    <div class="section">
      <div class="line"><span>Venta:</span><span>${escapeHtml(ticket.saleId)}</span></div>
      <div class="line"><span>Fecha:</span><span>${escapeHtml(formatDate(ticket.saleDate))}</span></div>
    </div>

    <div class="separator">--------------------------------</div>

    <div class="items-section">
      ${itemsHtml}
    </div>

    <div class="separator">--------------------------------</div>

    <div class="section">
      <div class="line total-line"><span>TOTAL</span><span>${formatPrice(ticket.total)}</span></div>
    </div>

    ${ticket.payments.length > 0 ? `
    <div class="section">
      <div class="section-label">Forma de pago</div>
      ${paymentsHtml}
    </div>` : ""}

    ${fiscalSection}

    <div class="separator">--------------------------------</div>

    <div class="footer">
      <p>Gracias por su compra</p>
      <p class="small">${escapeHtml(STORE_NAME)}</p>
    </div>
  </div>`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORE_NAME = "Los Chicos"

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
  if (!Number.isFinite(n)) return "$0,00"
  return `$${n.toFixed(2).replace(".", ",")}`
}

const BUENOS_AIRES_TZ = "America/Argentina/Buenos_Aires"

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: BUENOS_AIRES_TZ,
    })
  } catch {
    return iso
  }
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
    font-size: 14px;
    font-weight: bold;
    line-height: 1.4;
    color: #000;
    background: #fff;
    padding: 10px;
  }

  @page {
    size: 80mm auto;
    margin: 2mm;
  }

  @media print {
    body > * {
      display: none !important;
    }

    body > #${PRINT_AREA_ID} {
      display: block !important;
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 80mm !important;
      padding: 0 !important;
      pointer-events: none !important;
    }

    #${PRINT_AREA_ID} .ticket {
      page-break-after: always;
      border: none;
      margin-bottom: 0;
    }

    #${PRINT_AREA_ID} .ticket:last-child {
      page-break-after: auto;
    }
  }

  #${PRINT_AREA_ID} .ticket {
    max-width: 76mm;
    margin: 0 auto 20px auto;
    padding: 4mm;
    border: 1px dashed #ccc;
  }

  #${PRINT_AREA_ID} .ticket-header {
    text-align: center;
    margin-bottom: 8px;
  }

  #${PRINT_AREA_ID} .store-name {
    font-size: 16px;
    font-weight: bold;
    text-transform: uppercase;
  }

  #${PRINT_AREA_ID} .ticket-label {
    font-size: 13px;
    font-weight: bold;
    margin-top: 2px;
  }

  #${PRINT_AREA_ID} .ticket-subtitle {
    font-size: 12px;
    color: #333;
  }

  #${PRINT_AREA_ID} .section {
    margin: 6px 0;
  }

  #${PRINT_AREA_ID} .section-label {
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 2px;
  }

  #${PRINT_AREA_ID} .line {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    padding: 1px 0;
  }

  #${PRINT_AREA_ID} .total-line {
    font-size: 15px;
    font-weight: bold;
    border-top: 1.5px solid #000;
    padding-top: 3px;
    margin-top: 2px;
  }

  #${PRINT_AREA_ID} .item-line {
    margin: 3px 0;
  }

  #${PRINT_AREA_ID} .item-name {
    font-size: 13px;
  }

  #${PRINT_AREA_ID} .item-description {
    font-size: 11px;
    color: #444;
    padding-left: 4px;
  }

  #${PRINT_AREA_ID} .item-detail {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    padding-left: 8px;
  }

  #${PRINT_AREA_ID} .discount-line {
    font-style: italic;
    color: #333;
  }

  #${PRINT_AREA_ID} .item-subtotal {
    font-weight: bold;
  }

  #${PRINT_AREA_ID} .fiscal-section {
    font-size: 12px;
  }

  #${PRINT_AREA_ID} .fiscal-section .line span:first-child {
    color: #333;
  }

  #${PRINT_AREA_ID} .separator {
    text-align: center;
    font-size: 10px;
    color: #888;
    letter-spacing: 1px;
    margin: 4px 0;
  }

  #${PRINT_AREA_ID} .footer {
    text-align: center;
    font-size: 12px;
    margin-top: 8px;
  }

  #${PRINT_AREA_ID} .footer .small {
    font-size: 11px;
    color: #666;
  }
`
