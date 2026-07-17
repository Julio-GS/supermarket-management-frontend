"use client"

import { useState, type FormEvent } from "react"
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
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)

  function reset() {
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

    const numericQuantity = Number(quantity)

    // Client-side validation
    const validationError = validateAdjustmentQuantity(numericQuantity)
    if (validationError) {
      setLocalError(validationError)
      return
    }

    setLocalError(null)
    setBackendError(null)
    setSubmitting(true)

    try {
      await onAdjusted({
        productId,
        quantity: numericQuantity,
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

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {currentStock !== null && (
            <p className="text-sm text-muted-foreground">
              Stock actual: <span className="font-medium text-foreground">{currentStock}</span>
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="adjust-quantity">Cantidad</Label>
            <Input
              id="adjust-quantity"
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value)
                setLocalError(null)
              }}
              placeholder="Ej: 10 o -3"
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "Ajustando..." : "Ajustar stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
