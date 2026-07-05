import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { ReportesShell } from "@/modules/reportes"
import { formatCurrency } from "@/shared/presentation/currency"
import { DollarSign, Receipt, TrendingUp, Percent } from "lucide-react"

export default function ReportesPage() {
  return (
    <>
      <PageHeader
        title="Reportes"
        description="Analiza el rendimiento de ventas e ingresos del supermercado."
      />
      <div className="flex flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <ReportesShell />
      </div>
    </>
  )
}
