"use client"

import { Plus } from "lucide-react"

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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import type { UseProductsTableDialogResult } from "./use-products-table-dialog"

export interface ProductsTableCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  create: UseProductsTableDialogResult["create"]
  setCreateField: UseProductsTableDialogResult["setCreateField"]
  onSave: () => void
  isLoading: boolean
}

export function ProductsTableCreateDialog({
  open,
  onOpenChange,
  create,
  setCreateField,
  onSave,
  isLoading,
}: ProductsTableCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" />
        Nuevo producto
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar producto</DialogTitle>
          <DialogDescription>
            Registra un nuevo producto en el catálogo del supermercado.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="nombre">Nombre del producto</FieldLabel>
            <Input
              id="nombre"
              placeholder="Ej. Cereal Integral 500g"
              value={create.name}
              onChange={(e) => setCreateField("name", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sku">Código SKU</FieldLabel>
            <Input
              id="sku"
              placeholder="Ej. CER-INT-500"
              value={create.sku}
              onChange={(e) => setCreateField("sku", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="precio">Precio ($)</FieldLabel>
              <Input
                id="precio"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={create.price}
                onChange={(e) => setCreateField("price", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="maneja-stock">Controla stock</FieldLabel>
              <label className="flex h-8 items-center gap-2 text-sm" htmlFor="maneja-stock">
                <input
                  id="maneja-stock"
                  type="checkbox"
                  checked={create.manejaStock}
                  onChange={(e) => setCreateField("manejaStock", String(e.target.checked))}
                />
                Crear con stock inicial 0
              </label>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="costo-neto">Costo neto ($)</FieldLabel>
              <Input
                id="costo-neto"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={create.costoNeto}
                onChange={(e) => setCreateField("costoNeto", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="iva">IVA ($)</FieldLabel>
              <Input
                id="iva"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={create.iva}
                onChange={(e) => setCreateField("iva", e.target.value)}
              />
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button onClick={onSave} disabled={isLoading}>
            Guardar producto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
