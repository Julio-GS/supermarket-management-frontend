"use client"

import { useMemo, useState } from "react"
import { Search, Plus, PackageX } from "lucide-react"
import { productos as initialProductos, categorias, formatoMoneda, type Producto } from "@/lib/data"
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

function StockBadge({ producto }: { producto: Producto }) {
  if (producto.stock === 0) {
    return <Badge variant="destructive">Agotado</Badge>
  }
  if (producto.stock <= producto.stockMinimo) {
    return <Badge variant="destructive">Stock bajo</Badge>
  }
  return <Badge variant="secondary">En stock</Badge>
}

export function ProductsTable() {
  const [productos, setProductos] = useState<Producto[]>(initialProductos)
  const [busqueda, setBusqueda] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas")
  const [dialogAbierto, setDialogAbierto] = useState(false)

  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevaCategoria, setNuevaCategoria] = useState<string>(categorias[0])
  const [nuevoPrecio, setNuevoPrecio] = useState("")
  const [nuevoStock, setNuevoStock] = useState("")

  const filtrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideBusqueda =
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.sku.toLowerCase().includes(busqueda.toLowerCase())
      const coincideCategoria = filtroCategoria === "todas" || p.categoria === filtroCategoria
      return coincideBusqueda && coincideCategoria
    })
  }, [productos, busqueda, filtroCategoria])

  function agregarProducto() {
    if (!nuevoNombre || !nuevoPrecio || !nuevoStock) {
      toast.error("Completa todos los campos del producto.")
      return
    }
    const nuevo: Producto = {
      id: `P${String(productos.length + 1).padStart(3, "0")}`,
      nombre: nuevoNombre,
      categoria: nuevaCategoria as Producto["categoria"],
      sku: `NEW-${String(productos.length + 1).padStart(4, "0")}`,
      precio: Number(nuevoPrecio),
      costo: Number(nuevoPrecio) * 0.6,
      stock: Number(nuevoStock),
      stockMinimo: 20,
      unidad: "u",
      proveedor: "Sin asignar",
    }
    setProductos((prev) => [nuevo, ...prev])
    setNuevoNombre("")
    setNuevoPrecio("")
    setNuevoStock("")
    setDialogAbierto(false)
    toast.success(`"${nuevo.nombre}" se agregó al catálogo.`)
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Catálogo de productos</CardTitle>
          <CardDescription>{filtrados.length} productos encontrados</CardDescription>
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
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 sm:w-64"
            />
          </div>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((c) => (
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
                  <Select value={nuevaCategoria} onValueChange={setNuevaCategoria}>
                    <SelectTrigger id="categoria">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {categorias.map((c) => (
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
                <Button onClick={agregarProducto}>Guardar producto</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {filtrados.length === 0 ? (
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
                {filtrados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku}</TableCell>
                    <TableCell>{p.categoria}</TableCell>
                    <TableCell className="text-right">{formatoMoneda(p.precio)}</TableCell>
                    <TableCell className="text-right">
                      {p.stock} {p.unidad}
                    </TableCell>
                    <TableCell>
                      <StockBadge producto={p} />
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
