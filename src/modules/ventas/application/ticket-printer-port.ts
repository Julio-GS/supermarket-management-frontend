import type { PrintableTicket } from "../domain/ticket"

export interface TicketPrinterPort {
  /**
   * Print one or more tickets.
   * Returns ok:true on success, or ok:false with a reason string on failure.
   */
  print(tickets: PrintableTicket[]): Promise<
    { ok: true } | { ok: false; reason: string }
  >
}
