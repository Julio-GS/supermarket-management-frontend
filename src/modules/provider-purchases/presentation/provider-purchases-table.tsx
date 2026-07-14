"use client"

import { useState } from "react"
import { Edit2, Trash2 } from "lucide-react"
import type { ProviderPurchase } from "../domain/provider-purchase"
import { formatCurrency } from "@/shared/presentation/currency"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  qr: "QR",
  cheque: "Cheque",
  otro: "Otro",
}

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method || method === "null") return "Sin registro de medio"
  return PAYMENT_METHOD_LABELS[method] ?? method
}

interface ProviderPurchasesTableProps {
  purchases: ProviderPurchase[]
  onEdit: (purchase: ProviderPurchase) => void
  onDelete: (id: string) => void
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ProviderPurchasesTable({
  purchases,
  onEdit,
  onDelete,
}: ProviderPurchasesTableProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (purchases.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed">
        <p className="text-sm text-muted-foreground">
          No hay compras registradas.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proveedor</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Método de pago</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell className="font-medium">
                {purchase.providerName}
              </TableCell>
              <TableCell>{formatCurrency(purchase.amount)}</TableCell>
              <TableCell>
                {paymentMethodLabel(purchase.paymentMethod)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(purchase)}
                >
                  <Edit2 className="h-4 w-4" />
                  <span className="sr-only">Editar</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500"
                  onClick={() => setConfirmId(purchase.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Eliminar</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={confirmId !== null}
        title="Eliminar compra"
        message="¿Estás seguro de que querés eliminar esta compra? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (confirmId) {
            onDelete(confirmId)
            setConfirmId(null)
          }
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
