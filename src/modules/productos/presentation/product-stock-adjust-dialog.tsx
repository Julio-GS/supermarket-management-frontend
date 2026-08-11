"use client"

import { useState, type FormEvent } from "react"
import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { validateAdjustmentQuantity } from "../domain/stock-adjustment"

export type StockAdjustMode = "add" | "remove"

export interface ProductStockAdjustDialogProps {
  open: boolean
  onClose: () => void
  productId: string
  productName: string
  currentStock: number | null
  onAdjusted: (input: { productId: string; quantity: number; reason: string }) => Promise<unknown>
}

export function ProductStockAdjustDialog({
  open,
  onClose,
  productId,
  productName,
  currentStock,
  onAdjusted,
}: ProductStockAdjustDialogProps) {
  const [mode, setMode] = useState<StockAdjustMode>("add")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)

  function reset() {
    setMode("add")
    setQuantity("")
    setReason("")
    setLocalError(null)
    setBackendError(null)
    setSubmitting(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const enteredQuantity = Number(quantity)

    // Client-side validation: positive non-zero integer
    const validationError = validateAdjustmentQuantity(enteredQuantity)
    if (validationError) {
      setLocalError(validationError)
      return
    }

    // Map intent to signed quantity: Add -> positive, Remove -> negative
    const signedQuantity = mode === "add" ? enteredQuantity : -enteredQuantity

    setLocalError(null)
    setBackendError(null)
    setSubmitting(true)

    try {
      await onAdjusted({
        productId,
        quantity: signedQuantity,
        reason: reason.trim(),
      })
      reset()
      onClose()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo completar el ajuste."
      setBackendError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const isAdd = mode === "add"

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isAdd ? "Agregar stock" : "Quitar stock"}</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {currentStock !== null && (
            <p className="text-sm text-muted-foreground">
              Stock actual: <span className="font-medium text-foreground">{currentStock}</span>
            </p>
          )}

          {/* Add / Remove mode toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={isAdd ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => { setMode("add"); setLocalError(null) }}
              aria-label="Agregar stock"
            >
              <Plus className="mr-1 size-4" />
              Agregar
            </Button>
            <Button
              type="button"
              variant={!isAdd ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => { setMode("remove"); setLocalError(null) }}
              aria-label="Quitar stock"
            >
              <Minus className="mr-1 size-4" />
              Quitar
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="adjust-quantity">Cantidad</Label>
            <Input
              id="adjust-quantity"
              type="number"
              step={1}
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value)
                setLocalError(null)
              }}
              placeholder="Ej: 5"
              aria-label="Cantidad"
            />
            {localError && (
              <p className="text-sm text-destructive" role="alert">
                {localError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="adjust-reason">Motivo (opcional)</Label>
            <Input
              id="adjust-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Corrección de inventario"
              aria-label="Motivo"
            />
          </div>

          {backendError && (
            <p className="text-sm text-destructive" role="alert">
              {backendError}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} aria-label={isAdd ? "Confirmar agregar stock" : "Confirmar quitar stock"}>
              {submitting ? "Ajustando..." : isAdd ? "Agregar stock" : "Quitar stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
