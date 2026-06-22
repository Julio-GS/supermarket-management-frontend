"use client"

import { useState } from "react"
import { Search, Plus, PackageX } from "lucide-react"
import { formatCurrency } from "@/shared/presentation/currency"
import { categories } from "../domain/category"
import { getStockStatus } from "../domain/product"
import { useProductCatalog } from "../application/use-product-catalog"
import type { ProductRepository } from "../application/product-repository"
import type { Category } from "../domain/category"
import type { Product } from "../domain/product"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { toast } from "sonner"

function StockBadge({ product }: { product: { stock: number; stockMinimum: number } }) {
  const status = getStockStatus(product)
  if (status === "OUT_OF_STOCK") {
    return <Badge variant="destructive">Agotado</Badge>
  }
  if (status === "LOW_STOCK") {
    return <Badge variant="destructive">Stock bajo</Badge>
  }
  return <Badge variant="secondary">En stock</Badge>
}

export interface ProductsTableProps {
  repository: ProductRepository
  initialProducts?: Product[]
}

export function ProductsTable({ repository, initialProducts }: ProductsTableProps) {
  const { products, filters, applyFilters, isLoading, createProduct } = useProductCatalog(
    repository,
    { initialProducts }
  )

  const [busqueda, setBusqueda] = useState(filters.search ?? "")
  const [filtroCategoria, setFiltroCategoria] = useState<string>(filters.category ?? "all")
  const [dialogAbierto, setDialogAbierto] = useState(false)

  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevaCategoria, setNuevaCategoria] = useState<Category>(categories[0])
  const [nuevoPrecio, setNuevoPrecio] = useState("")
  const [nuevoStock, setNuevoStock] = useState("")

  function applySearch(value: string) {
    setBusqueda(value)
    applyFilters({ ...filters, search: value || undefined })
  }

  function applyCategory(value: string | null) {
    const category = value ?? "all"
    setFiltroCategoria(category)
    applyFilters({ ...filters, category: category as Category | "all" })
  }

  async function agregarProducto() {
    if (!nuevoNombre || !nuevoPrecio || !nuevoStock) {
      toast.error("Completa todos los campos del producto.")
      return
    }

    await createProduct({
      name: nuevoNombre,
      category: nuevaCategoria,
      price: Number(nuevoPrecio),
      stock: Number(nuevoStock),
    })

    setNuevoNombre("")
    setNuevoPrecio("")
    setNuevoStock("")
    setDialogAbierto(false)
    toast.success(`"${nuevoNombre}" se agregó al catálogo.`)
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Catálogo de productos</CardTitle>
          <CardDescription>{products.length} productos encontrados</CardDescription>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Buscar por nombre o SKU"
              value={busqueda}
              onChange={(e) => applySearch(e.target.value)}
              className="pl-9 sm:w-64"
            />
          </div>
          <Select value={filtroCategoria} onValueChange={applyCategory}>
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
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
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="categoria">Categoría</FieldLabel>
                  <Select value={nuevaCategoria} onValueChange={(value) => setNuevaCategoria((value ?? categories[0]) as Category)}>
                    <SelectTrigger id="categoria">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="precio">Precio (€)</FieldLabel>
                    <Input
                      id="precio"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={nuevoPrecio}
                      onChange={(e) => setNuevoPrecio(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="stock">Stock inicial</FieldLabel>
                    <Input
                      id="stock"
                      type="number"
                      placeholder="0"
                      value={nuevoStock}
                      onChange={(e) => setNuevoStock(e.target.value)}
                    />
                  </Field>
                </div>
              </FieldGroup>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
                <Button onClick={agregarProducto} disabled={isLoading}>
                  Guardar producto
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageX />
              </EmptyMedia>
              <EmptyTitle>Sin resultados</EmptyTitle>
              <EmptyDescription>
                No se encontraron productos con los filtros seleccionados.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.price)}</TableCell>
                    <TableCell className="text-right">
                      {p.stock} {p.unit}
                    </TableCell>
                    <TableCell>
                      <StockBadge product={p} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
