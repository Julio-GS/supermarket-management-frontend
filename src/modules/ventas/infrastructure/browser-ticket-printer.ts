import type { TicketPrinterPort } from "../application/ticket-printer-port"
import type { PrintableTicket } from "../domain/ticket"

/**
 * Browser-based ticket printer.
 *
 * Renders tickets as HTML in a popup window, applies CSS `@media print`
 * styling, and triggers the browser print dialog.
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
      const html = buildPrintHtml(tickets)
      const printWindow = window.open("", "_blank", "width=400,height=600")

      if (!printWindow) {
        console.error("[BrowserTicketPrinter] Popup blocked — cannot print tickets")
        return { ok: false, reason: "Popup blocked — allow popups for printing" }
      }

      printWindow.document.write(html)
      printWindow.document.close()

      // Wait for content to render before printing
      await new Promise<void>((resolve) => {
        printWindow!.onload = () => resolve()
        // Fallback if onload already fired
        setTimeout(resolve, 300)
      })

      // Close the popup window once the print dialog completes (or is cancelled).
      // This prevents the browser from keeping printed ticket data visible in an
      // open window.
      printWindow.onafterprint = () => {
        printWindow.close()
      }

      printWindow.print()
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown print error"
      console.error("[BrowserTicketPrinter] Print failed:", message, err)
      return { ok: false, reason: message }
    }
  }
}

// ---------------------------------------------------------------------------
// HTML & CSS template
// ---------------------------------------------------------------------------

function buildPrintHtml(tickets: PrintableTicket[]): string {
  const ticketsHtml = tickets
    .map((ticket, idx) => buildTicketHtml(ticket, idx, tickets.length))
    .join("\n")

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket${tickets.length > 1 ? "s" : ""} — ${tickets[0]?.saleId ?? ""}</title>
  <style>
    ${PRINT_CSS}
  </style>
</head>
<body>
  ${ticketsHtml}
</body>
</html>`
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
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
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
    body {
      padding: 0;
    }

    .ticket {
      page-break-after: always;
    }

    .ticket:last-child {
      page-break-after: auto;
    }
  }

  .ticket {
    max-width: 76mm;
    margin: 0 auto 20px auto;
    padding: 4mm;
    border: 1px dashed #ccc;
  }

  @media print {
    .ticket {
      border: none;
      margin-bottom: 0;
    }
  }

  .ticket-header {
    text-align: center;
    margin-bottom: 8px;
  }

  .store-name {
    font-size: 16px;
    font-weight: bold;
    text-transform: uppercase;
  }

  .ticket-label {
    font-size: 13px;
    font-weight: bold;
    margin-top: 2px;
  }

  .ticket-subtitle {
    font-size: 12px;
    color: #333;
  }

  .section {
    margin: 6px 0;
  }

  .section-label {
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 2px;
  }

  .line {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    padding: 1px 0;
  }

  .total-line {
    font-size: 15px;
    font-weight: bold;
    border-top: 1.5px solid #000;
    padding-top: 3px;
    margin-top: 2px;
  }

  .item-line {
    margin: 3px 0;
  }

  .item-name {
    font-size: 13px;
  }

  .item-description {
    font-size: 11px;
    color: #444;
    padding-left: 4px;
  }

  .item-detail {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    padding-left: 8px;
  }

  .discount-line {
    font-style: italic;
    color: #333;
  }

  .item-subtotal {
    font-weight: bold;
  }

  .fiscal-section {
    font-size: 12px;
  }

  .fiscal-section .line span:first-child {
    color: #333;
  }

  .separator {
    text-align: center;
    font-size: 10px;
    color: #888;
    letter-spacing: 1px;
    margin: 4px 0;
  }

  .footer {
    text-align: center;
    font-size: 12px;
    margin-top: 8px;
  }

  .footer .small {
    font-size: 11px;
    color: #666;
  }
`
