"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import type { UseProductsTableDialogResult } from "./use-products-table-dialog"

export interface ProductsTableEditDialogProps {
  edit: UseProductsTableDialogResult["edit"]
  onClose: () => void
  setEditField: UseProductsTableDialogResult["setEditField"]
  onSave: () => void
}

export function ProductsTableEditDialog({
  edit,
  onClose,
  setEditField,
  onSave,
}: ProductsTableEditDialogProps) {
  return (
    <Dialog open={edit.product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar producto</DialogTitle>
          <DialogDescription>
            Modifica los datos del producto seleccionado.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="edit-nombre">Nombre del producto</FieldLabel>
            <Input
              id="edit-nombre"
              placeholder="Ej. Cereal Integral 500g"
              value={edit.name}
              onChange={(e) => setEditField("name", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-sku">Código SKU</FieldLabel>
            <Input
              id="edit-sku"
              placeholder="Ej. CER-INT-500"
              value={edit.sku}
              onChange={(e) => setEditField("sku", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-precio">Precio ($)</FieldLabel>
            <Input
              id="edit-precio"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={edit.price}
              onChange={(e) => setEditField("price", e.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={onSave} disabled={edit.saving}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
