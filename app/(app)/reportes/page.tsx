import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { CategoryChart } from "@/components/dashboard/category-chart"
import { TopProducts } from "@/components/reportes/top-products"
import { DollarSign, Receipt, TrendingUp, Percent } from "lucide-react"
import { formatoMoneda } from "@/lib/data"

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
            value={formatoMoneda(128640)}
            change={14.2}
            icon={DollarSign}
          />
          <StatCard
            title="Ticket promedio"
            value={formatoMoneda(23.8)}
            change={3.1}
            icon={Receipt}
          />
          <StatCard
            title="Margen bruto"
            value="38.4%"
            change={1.8}
            icon={Percent}
          />
          <StatCard
            title="Crecimiento anual"
            value="+22.6%"
            change={5.4}
            icon={TrendingUp}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-7 lg:gap-6">
          <div className="lg:col-span-4">
            <SalesChart />
          </div>
          <div className="lg:col-span-3">
            <CategoryChart />
          </div>
        </div>
        <TopProducts />
      </div>
    </>
  )
}
