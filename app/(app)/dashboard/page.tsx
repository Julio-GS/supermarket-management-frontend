"use client"

import { DollarSign, ShoppingCart, Package, Users, Download } from "lucide-react"
import dynamic from "next/dynamic"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/shared/presentation/currency"
import { useReportWindow } from "@/modules/reportes/application/use-report-window"
import { useBusinessReport } from "@/modules/reportes/application/use-business-report"
import { businessReportPort } from "@/modules/reportes/infrastructure/report-repository-instance"

const SalesChartShell = dynamic(
  () => import("@/modules/reportes").then((mod) => ({ default: mod.SalesChartShell })),
  {
    loading: () => <ChartSkeleton />,
  }
)

const RecentSalesShell = dynamic(
  () => import("@/modules/reportes").then((mod) => ({ default: mod.RecentSalesShell })),
  {
    loading: () => <RecentSalesSkeleton />,
  }
)

const LowStockShell = dynamic(
  () => import("@/modules/reportes").then((mod) => ({ default: mod.LowStockShell })),
  {
    loading: () => <LowStockSkeleton />,
  }
)

function ChartSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-6">
      <div className="mb-2 space-y-1.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  )
}

function RecentSalesSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 space-y-1.5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}

function LowStockSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 space-y-1.5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { window } = useReportWindow()
  const { report } = useBusinessReport(businessReportPort, window)

  const totalCollected = report?.totalCollectedAmount
  const transactionCount = report?.paymentMethodBreakdown?.length ?? 0
  const topProductCount = report?.topProducts?.length ?? 0

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
            title="Ventas del período"
            value={totalCollected ? formatCurrency(totalCollected) : "—"}
            change={window === "day" ? "Hoy" : window === "week" ? "Semana" : "Mes"}
            trend="up"
            icon={DollarSign}
            hint={window === "day" ? "vs ayer" : "período actual"}
          />
          <StatCard
            title="Métodos usados"
            value={String(transactionCount)}
            change={report ? "Real" : "—"}
            trend="up"
            icon={ShoppingCart}
            hint="métodos distintos"
          />
          <StatCard
            title="Productos vendidos"
            value={String(topProductCount)}
            change={report ? "Real" : "—"}
            trend="up"
            icon={Package}
            hint="con ventas"
          />
          <StatCard
            title="Clientes atendidos"
            value="—"
            change="—"
            trend="down"
            icon={Users}
            hint="próximamente"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <SalesChartShell />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentSalesShell />
          </div>
          {/* Low stock mock card kept visible during business-reports cutover */}
          <LowStockShell />
        </div>
      </div>
    </>
  )
}
