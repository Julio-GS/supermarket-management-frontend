"use client"

import { BrowserTicketPrinter } from "../infrastructure/browser-ticket-printer"
import type { CatalogProduct } from "../application/catalog-query-port"
import { catalogQueryAdapter } from "../infrastructure/catalog-query-adapter"
import { checkoutAdapter } from "../infrastructure/checkout-adapter-instance"
import { PosTerminal } from "../presentation/pos-terminal"

/** Singleton browser printer instance — created once, reused across renders. */
const browserPrinter = new BrowserTicketPrinter()

export interface PosTerminalShellProps {
  initialProducts?: CatalogProduct[]
}

export function PosTerminalShell({ initialProducts }: PosTerminalShellProps) {
  return (
    <PosTerminal
      initialProducts={initialProducts}
      catalogQueryPort={catalogQueryAdapter}
      checkoutPort={checkoutAdapter}
      ticketPrinterPort={browserPrinter}
    />
  )
}
