import { PromotionsShell } from "@/modules/promociones"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Promociones | Los Chicos",
  description: "Administración de promociones de la sucursal",
}

export default function PromotionsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Promociones</h2>
      </div>
      <PromotionsShell />
    </div>
  )
}
