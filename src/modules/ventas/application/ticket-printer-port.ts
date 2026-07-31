import type { PrintableTicket } from "../domain/ticket"

/**
 * Non-blocking warning produced during a successful print.
 *
 * Warnings MUST NOT cause printing to fail. They signal degraded
 * quality (e.g. missing QR) so the presentation layer can notify
 * the operator without blocking checkout.
 */
export interface TicketPrintWarning {
  code: "arca-qr-invalid" | "arca-qr-render-failed"
  saleId: string
  ticketIndex: number
  ticketCount: number
  groupLabel?: string
  reason: string
}

export interface TicketPrinterPort {
  /**
   * Print one or more tickets.
   *
   * Returns ok:true on success (optionally with non-blocking warnings),
   * or ok:false with a reason string on failure.
   */
  print(tickets: PrintableTicket[]): Promise<
    | { ok: true; warnings?: TicketPrintWarning[] }
    | { ok: false; reason: string; warnings?: TicketPrintWarning[] }
  >
}
