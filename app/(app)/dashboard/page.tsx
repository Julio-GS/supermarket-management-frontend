import { DollarSign, ShoppingCart, Package, Users, Download } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { CategoryChart } from "@/components/dashboard/category-chart"
import { RecentSales } from "@/components/dashboard/recent-sales"
import { LowStock } from "@/components/dashboard/low-stock"

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Panel de control"
        description="Resumen general de tu supermercado"
        actions={
          <Button variant="outline" size="sm">
            <Download data-icon="inline-start" />
            Exportar
          </Button>
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ventas de hoy"
            value="6.890 €"
            change="+12,5%"
            trend="up"
            icon={DollarSign}
            hint="vs ayer"
          />
          <StatCard
            title="Transacciones"
            value="372"
            change="+8,2%"
            trend="up"
            icon={ShoppingCart}
            hint="vs ayer"
          />
          <StatCard
            title="Productos activos"
            value="1.284"
            change="+24"
            trend="up"
            icon={Package}
            hint="este mes"
          />
          <StatCard
            title="Clientes atendidos"
            value="298"
            change="-3,1%"
            trend="down"
            icon={Users}
            hint="vs ayer"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SalesChart />
          <CategoryChart />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentSales />
          </div>
          <LowStock />
        </div>
      </div>
    </>
  )
}
