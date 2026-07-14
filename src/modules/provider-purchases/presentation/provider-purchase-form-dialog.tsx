"use client"

import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import type {
  ProviderPurchase,
  ProviderPurchaseInput,
} from "../domain/provider-purchase"
import { validateProviderPurchaseInput, type ProviderPurchaseInputErrors } from "../domain/provider-purchase"

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "— Sin especificar —" },
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "qr", label: "QR" },
  { value: "cheque", label: "Cheque" },
  { value: "otro", label: "Otro" },
] as const

interface ProviderPurchaseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: ProviderPurchaseInput) => Promise<void>
  initialData?: ProviderPurchase | null
}

export function ProviderPurchaseFormDialog({
  open,
  onOpenChange,
  onSave,
  initialData,
}: ProviderPurchaseFormDialogProps) {
  const [providerName, setProviderName] = useState(
    initialData?.providerName ?? ""
  )
  const [amount, setAmount] = useState(initialData?.amount ?? "")
  const [paymentMethod, setPaymentMethod] = useState(
    initialData?.paymentMethod ?? ""
  )
  const [errors, setErrors] = useState<ProviderPurchaseInputErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isEditing = Boolean(initialData)
  const title = isEditing ? "Editar" : "Nueva"

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const input: ProviderPurchaseInput = {
      providerName: providerName.trim(),
      amount: amount.trim(),
      paymentMethod: paymentMethod || null,
    }

    const validationErrors = validateProviderPurchaseInput(input)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setIsSaving(true)
    setSubmitError(null)

    try {
      await onSave(input)
      onOpenChange(false)
    } catch (exception) {
      setSubmitError(
        exception instanceof Error
          ? exception.message
          : "No se pudo guardar la compra."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title} compra a proveedor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {submitError}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="providerName">Proveedor</Label>
            <Input
              id="providerName"
              value={providerName}
              onChange={(e) => {
                setProviderName(e.target.value)
                setErrors((prev) => ({ ...prev, providerName: undefined }))
              }}
              placeholder="Nombre del proveedor"
            />
            {errors.providerName && (
              <p className="text-sm text-destructive">
                {errors.providerName}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Monto</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setErrors((prev) => ({ ...prev, amount: undefined }))
              }}
              placeholder="0.00"
            />
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Método de pago</Label>
            <select
              id="paymentMethod"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
