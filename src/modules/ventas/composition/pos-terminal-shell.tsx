"use client"

import type { CatalogProduct } from "../application/catalog-query-port"
import { catalogQueryAdapter } from "../infrastructure/catalog-query-adapter"
import { checkoutAdapter } from "../infrastructure/checkout-adapter-instance"
import { PosTerminal } from "../presentation/pos-terminal"

export interface PosTerminalShellProps {
  initialProducts?: CatalogProduct[]
}

export function PosTerminalShell({ initialProducts }: PosTerminalShellProps) {
  return (
    <PosTerminal
      initialProducts={initialProducts}
      catalogQueryPort={catalogQueryAdapter}
      checkoutPort={checkoutAdapter}
    />
  )
}
