import Link from "next/link"
import { Clock } from "lucide-react"

import { PosTerminalShell } from "@/modules/ventas"

export default function VentasPage() {
  return (
    <>
      {/* Quick-access nav bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <span className="text-sm font-medium text-muted-foreground">Accesos rápidos:</span>
        <Link
          href="/ventas/historial"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Clock className="size-4" />
          Historial de ventas
        </Link>
      </div>
      <PosTerminalShell />
    </>
  )
}
