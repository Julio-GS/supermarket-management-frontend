import { Promotion } from "../domain/promotion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Edit2, Trash2 } from "lucide-react"

interface PromotionsTableProps {
  promotions: Promotion[]
  onEdit: (promo: Promotion) => void
  onDelete: (id: string) => void
}

export function PromotionsTable({ promotions, onEdit, onDelete }: PromotionsTableProps) {
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
            <TableHead>Tipo</TableHead>
            <TableHead>Descuento</TableHead>
            <TableHead>Activa</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promotions.map((promo) => (
            <TableRow key={promo.id}>
              <TableCell className="font-medium">{promo.name}</TableCell>
              <TableCell>{promo.type === 'two_x_one' ? '2x1' : 'Porcentaje'}</TableCell>
              <TableCell>{promo.type === 'two_x_one' ? '-' : `${promo.discount_percent}%`}</TableCell>
              <TableCell>{promo.active ? 'Sí' : 'No'}</TableCell>
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
                  className="text-red-500"
                  onClick={() => {
                    if (confirm("¿Estás seguro de eliminar esta promoción?")) {
                      onDelete(promo.id)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Eliminar</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
