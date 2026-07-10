import { useState } from "react"
import { Promotion } from "../domain/promotion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit2, ToggleLeft, ToggleRight } from "lucide-react"

interface PromotionsTableProps {
  promotions: Promotion[]
  onEdit: (promo: Promotion) => void
  onDelete: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
}

function ScopeBadge({ scope }: { scope: Promotion["scope"] }) {
  if (scope === "store") {
    return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs">Tienda</Badge>
  }
  return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">Producto</Badge>
}

function ScheduleSummary({ promo }: { promo: Promotion }) {
  if (promo.weekdays?.length) {
    const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    return <span className="text-xs text-muted-foreground">{promo.weekdays.map(d => dayLabels[d]).join(", ")}</span>
  }
  if (promo.startDate && promo.endDate) {
    const start = new Date(promo.startDate).toLocaleDateString("es-AR")
    const end = new Date(promo.endDate).toLocaleDateString("es-AR")
    return <span className="text-xs text-muted-foreground">{start} – {end}</span>
  }
  return <span className="text-xs text-muted-foreground">—</span>
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
          <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

export function PromotionsTable({ promotions, onEdit, onDelete, onToggleEnabled }: PromotionsTableProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (promotions.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed">
        <p className="text-sm text-muted-foreground">No hay promociones registradas.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Alcance</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Descuento</TableHead>
            <TableHead>Horario</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promotions.map((promo) => (
            <TableRow key={promo.id} className={promo.enabled ? "" : "opacity-50"}>
              <TableCell className="font-medium">{promo.name}</TableCell>
              <TableCell><ScopeBadge scope={promo.scope} /></TableCell>
              <TableCell>{promo.type === 'two_x_one' ? '2x1' : 'Porcentaje'}</TableCell>
              <TableCell>{promo.type === 'two_x_one' ? '—' : `${promo.discountPercent}%`}</TableCell>
              <TableCell><ScheduleSummary promo={promo} /></TableCell>
              <TableCell>
                <Badge variant={promo.enabled ? "default" : "secondary"} className="text-xs">
                  {promo.enabled ? "Activa" : "Inactiva"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(promo)}
                >
                  <Edit2 className="h-4 w-4" />
                  <span className="sr-only">Editar</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleEnabled(promo.id, !promo.enabled)}
                >
                  {promo.enabled ? (
                    <ToggleRight className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">{promo.enabled ? "Desactivar" : "Reactivar"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500"
                  onClick={() => setConfirmId(promo.id)}
                >
                  <ToggleLeft className="h-4 w-4 rotate-180" />
                  <span className="sr-only">Desactivar</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={confirmId !== null}
        title="Desactivar promoción"
        message="Esto desactivará la promoción. Se puede reactivar más tarde. ¿Continuar?"
        confirmLabel="Desactivar"
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
