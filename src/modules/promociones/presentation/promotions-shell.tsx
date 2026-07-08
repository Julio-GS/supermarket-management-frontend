"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { usePromotionsAdmin } from "../application/use-promotions-admin"
import {
  buildPromotionUpdatePayload,
  type Promotion,
} from "../domain/promotion"
import { PromotionFormDialog } from "./PromotionFormDialog"
import { PromotionsTable } from "./PromotionsTable"

export function PromotionsShell() {
  const { promotions, isLoading, error, createPromotion, updatePromotion, deletePromotion } =
    usePromotionsAdmin()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)

  const handleOpenDialog = (promotion?: Promotion) => {
    setEditingPromotion(promotion ?? null)
    setIsDialogOpen(true)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setEditingPromotion(null)
    }
  }

  const handleSave = async (promotionData: Omit<Promotion, "id">) => {
    if (editingPromotion) {
      const patch = buildPromotionUpdatePayload(editingPromotion, promotionData)
      if (Object.keys(patch).length > 0) {
        await updatePromotion(editingPromotion.id, patch)
      }
    } else {
      await createPromotion(promotionData)
    }

    toast.success("Promoción guardada exitosamente")
  }

  const handleDelete = async (id: string) => {
    try {
      await deletePromotion(id)
      toast.success("Promoción desactivada")
    } catch {
      toast.error("Error al desactivar la promoción")
    }
  }

  if (isLoading) return <div>Cargando promociones...</div>
  if (error) return <div className="text-red-500">Error al cargar: {error.message}</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Promoción
        </Button>
      </div>

      <PromotionsTable promotions={promotions} onEdit={handleOpenDialog} onDelete={handleDelete} />

      <PromotionFormDialog
        key={`${isDialogOpen ? "open" : "closed"}-${editingPromotion?.id ?? "new"}`}
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSave={handleSave}
        initialData={editingPromotion}
      />
    </div>
  )
}
