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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ingresos del mes"
            value={formatCurrency(128640)}
            change="+14.2%"
            icon={DollarSign}
          />
          <StatCard
            title="Ticket promedio"
            value={formatCurrency(23.8)}
            change="+3.1%"
            icon={Receipt}
          />
          <StatCard
            title="Margen bruto"
            value="38.4%"
            change="+1.8%"
            icon={Percent}
          />
          <StatCard
            title="Crecimiento anual"
            value="+22.6%"
            change="+5.4%"
            icon={TrendingUp}
          />
        </div>
        <ReportesShell />
      </div>
    </>
  )
}
