"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import { useProviderPurchases } from "../application/use-provider-purchases"
import { useProviderPurchaseReport } from "../application/use-provider-purchase-report"
import { useReportWindow } from "@/modules/reportes"
import {
  buildProviderPurchasePatch,
  type ProviderPurchase,
  type ProviderPurchaseInput,
} from "../domain/provider-purchase"
import { ProviderPurchasesTable } from "../presentation/provider-purchases-table"
import { ProviderPurchaseFormDialog } from "../presentation/provider-purchase-form-dialog"
import { ProviderPurchaseReportWidget } from "../presentation/provider-purchase-report-widget"

export function ProviderPurchasesShell() {
  const { purchases, isLoading, error, createPurchase, updatePurchase, deletePurchase } =
    useProviderPurchases()

  const { window, setWindow } = useReportWindow()
  const {
    report,
    isLoading: isReportLoading,
    error: reportError,
  } = useProviderPurchaseReport(window)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<ProviderPurchase | null>(null)

  const handleOpenDialog = (purchase?: ProviderPurchase) => {
    setEditingPurchase(purchase ?? null)
    setIsDialogOpen(true)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setEditingPurchase(null)
    }
  }

  const handleSave = async (data: ProviderPurchaseInput) => {
    if (editingPurchase) {
      const patch = buildProviderPurchasePatch(editingPurchase, data)
      if (Object.keys(patch).length > 0) {
        await updatePurchase(editingPurchase.id, patch)
      }
    } else {
      await createPurchase(data)
    }
    toast.success("Compra guardada exitosamente")
  }

  const handleDelete = async (id: string) => {
    try {
      await deletePurchase(id)
      toast.success("Compra eliminada")
    } catch {
      toast.error("Error al eliminar la compra")
    }
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-6">
        <p className="font-semibold text-destructive">
          Error al cargar las compras
        </p>
        <p className="text-sm text-muted-foreground">
          {error.message}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Report section — renders independently from the list loading state */}
      <ProviderPurchaseReportWidget
        window={window}
        onWindowChange={setWindow}
        report={report}
        isLoading={isReportLoading}
        error={reportError ? (reportError instanceof Error ? reportError.message : "Error al cargar el reporte") : null}
      />

      {/* List section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Historial de compras</h2>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" /> Nueva Compra
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ProviderPurchasesTable
            purchases={purchases}
            onEdit={handleOpenDialog}
            onDelete={handleDelete}
          />
        )}
      </div>

      <ProviderPurchaseFormDialog
        key={`${isDialogOpen ? "open" : "closed"}-${editingPurchase?.id ?? "new"}`}
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSave={handleSave}
        initialData={editingPurchase}
      />
    </div>
  )
}
