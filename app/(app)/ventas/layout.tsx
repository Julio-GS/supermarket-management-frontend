"use client"

import type { ReactNode } from "react"

/**
 * Layout for the /ventas route segment.
 *
 * Applies overflow-hidden + min-h-0 at the route level so the POS
 * terminal is self-contained and never causes external (body-level)
 * scrolling. The SidebarInset above us is flex-1 flex-col; combining
 * overflow-hidden here prevents its children from expanding beyond
 * the visible area.
 *
 * Other routes (dashboard, productos, reportes) don't inherit this
 * layout, so their normal scroll behaviour is unaffected.
 */
export default function VentasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  )
}
