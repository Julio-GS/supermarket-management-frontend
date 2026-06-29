"use client"

import { memo, useCallback, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  Search,
  Plus,
  PackageX,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { formatCurrency } from "@/shared/presentation/currency"
import { getStockStatus, validateProductPrice } from "../domain/product"
import { useProductCatalog } from "../application/use-product-catalog"
import type { ProductRepository } from "../application/product-repository"
import type { CreateProductInput, Product, UpdateProductInput } from "../domain/product"
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

const VIRTUALIZATION_THRESHOLD = 100
const ROW_HEIGHT = 53
export const PRODUCTS_PAGE_SIZE = 100

function StockBadge({ product }: { product: { stock: number | null; stockMinimum: number } }) {
  const status = getStockStatus(product)
  if (status === "UNKNOWN_STOCK") {
    return <Badge variant="outline">No disponible</Badge>
  }
  if (status === "OUT_OF_STOCK") {
    return <Badge variant="destructive">Agotado</Badge>
  }
  if (status === "LOW_STOCK") {
    return <Badge variant="destructive">Stock bajo</Badge>
  }
  return <Badge variant="secondary">En stock</Badge>
}

interface ProductRowProps {
  product: Product
  onEdit: (product: Product) => void
}

const ProductRow = memo(function ProductRow({ product, onEdit }: ProductRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{product.name}</TableCell>
      <TableCell className="text-muted-foreground">{product.sku}</TableCell>
      <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
      <TableCell className="text-right">
        {product.stock === null ? "N/D" : `${product.stock} ${product.unit}`}
      </TableCell>
      <TableCell>
        <StockBadge product={product} />
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(product)}
          aria-label={`Editar ${product.name}`}
        >
          <Pencil />
        </Button>
      </TableCell>
    </TableRow>
  )
})

interface VirtualizedProductRowsProps {
  products: Product[]
  onEdit: (product: Product) => void
}

function VirtualizedProductRows({ products, onEdit }: VirtualizedProductRowsProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()

  return (
    <div ref={parentRef} className="max-h-[600px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <tr>
            <td colSpan={6} style={{ height: totalHeight, position: "relative" }}>
              {virtualRows.map((virtualRow) => {
                const product = products[virtualRow.index]
                return (
                  <div
                    key={product.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <Table className="border-0">
                      <TableBody className="border-0">
                        <ProductRow product={product} onEdit={onEdit} />
                      </TableBody>
                    </Table>
                  </div>
                )
              })}
            </td>
          </tr>
        </TableBody>
      </Table>
    </div>
  )
}

interface ProductTableBodyProps {
  products: Product[]
  onEdit: (product: Product) => void
}

function ProductTableBody({ products, onEdit }: ProductTableBodyProps) {
  if (products.length >= VIRTUALIZATION_THRESHOLD) {
    return <VirtualizedProductRows products={products} onEdit={onEdit} />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <ProductRow key={p.id} product={p} onEdit={onEdit} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 pt-4"
    >
      <span data-testid="pagination-info" className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="Primera página"
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Última página"
        >
          <ChevronsRight />
        </Button>
      </div>
    </nav>
  )
}

export interface ProductsTableProps {
  repository: ProductRepository
  initialProducts?: Product[]
}

export function ProductsTable({ repository, initialProducts }: ProductsTableProps) {
  const {
    products,
    filters,
    applyFilters,
    pageMeta,
    setPage,
    isLoading,
    error,
    createProduct,
    updateProduct,
  } = useProductCatalog(repository, { initialProducts })

  const [busqueda, setBusqueda] = useState(filters.search ?? "")
  const [dialogAbierto, setDialogAbierto] = useState(false)

  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevoSku, setNuevoSku] = useState("")
  const [nuevoPrecio, setNuevoPrecio] = useState("")
  const [nuevoStock, setNuevoStock] = useState("")
  const [nuevoCostoNeto, setNuevoCostoNeto] = useState("")
  const [nuevoIva, setNuevoIva] = useState("")

  const [productoEnEdicion, setProductoEnEdicion] = useState<Product | null>(null)
  const [editNombre, setEditNombre] = useState("")
  const [editSku, setEditSku] = useState("")
  const [editPrecio, setEditPrecio] = useState("")
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const totalPages = busqueda ? Math.max(1, Math.ceil(products.length / PRODUCTS_PAGE_SIZE)) : pageMeta.totalPages
  const currentPage = busqueda ? 1 : pageMeta.page
  const paginatedProducts = busqueda ? products.slice(0, PRODUCTS_PAGE_SIZE) : products

  function applySearch(value: string) {
    setBusqueda(value)
    applyFilters({ ...filters, search: value || undefined })
  }

  function changePage(value: number) {
    setPage(value)
  }

  async function agregarProducto() {
    if (!nuevoNombre || !nuevoPrecio || !nuevoStock) {
      toast.error("Completa todos los campos del producto.")
      return
    }

    const price = Number(nuevoPrecio)
    const priceError = validateProductPrice(price)
    if (priceError) {
      toast.error(priceError.message)
      return
    }

    const input: CreateProductInput = {
      name: nuevoNombre,
      sku: nuevoSku,
      price,
      stock: Number(nuevoStock),
    }
    if (nuevoCostoNeto) input.costo_neto = Number(nuevoCostoNeto)
    if (nuevoIva) input.iva = Number(nuevoIva)

    try {
      await createProduct(input)

      setNuevoNombre("")
      setNuevoSku("")
      setNuevoPrecio("")
      setNuevoStock("")
      setNuevoCostoNeto("")
      setNuevoIva("")
      setDialogAbierto(false)
      toast.success(`"${nuevoNombre}" se agregó al catálogo.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el producto."
      toast.error(message)
    }
  }

  const abrirEdicion = useCallback((product: Product) => {
    setProductoEnEdicion(product)
    setEditNombre(product.name)
    setEditSku(product.sku)
    setEditPrecio(String(product.price))
  }, [])

  function cerrarEdicion() {
    setProductoEnEdicion(null)
    setEditNombre("")
    setEditSku("")
    setEditPrecio("")
  }

  async function guardarEdicion() {
    if (!productoEnEdicion) return
    if (!editNombre || !editPrecio) {
      toast.error("Completa el nombre y el precio del producto.")
      return
    }

    const price = Number(editPrecio)
    const priceError = validateProductPrice(price)
    if (priceError) {
      toast.error(priceError.message)
      return
    }

    const input: UpdateProductInput = {
      id: productoEnEdicion.id,
      name: editNombre,
      sku: editSku,
      price,
    }

    setGuardandoEdicion(true)
    try {
      await updateProduct(input)
      cerrarEdicion()
      toast.success(`"${input.name}" se actualizó correctamente.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el producto."
      toast.error(message)
    } finally {
      setGuardandoEdicion(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Catálogo de productos</CardTitle>
          <CardDescription>{busqueda ? products.length : pageMeta.total} productos encontrados</CardDescription>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="Buscar por nombre o SKU"
              placeholder="Buscar por nombre o SKU"
              value={busqueda}
              onChange={(e) => applySearch(e.target.value)}
              className="pl-9 sm:w-64"
            />
          </div>
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
                  <FieldLabel htmlFor="sku">Código SKU</FieldLabel>
                  <Input
                    id="sku"
                    placeholder="Ej. CER-INT-500"
                    value={nuevoSku}
                    onChange={(e) => setNuevoSku(e.target.value)}
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
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="costo-neto">Costo neto ($)</FieldLabel>
                    <Input
                      id="costo-neto"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={nuevoCostoNeto}
                      onChange={(e) => setNuevoCostoNeto(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="iva">IVA ($)</FieldLabel>
                    <Input
                      id="iva"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={nuevoIva}
                      onChange={(e) => setNuevoIva(e.target.value)}
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
      <Dialog open={productoEnEdicion !== null} onOpenChange={(open) => !open && cerrarEdicion()}>
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
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-sku">Código SKU</FieldLabel>
              <Input
                id="edit-sku"
                placeholder="Ej. CER-INT-500"
                value={editSku}
                onChange={(e) => setEditSku(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-precio">Precio ($)</FieldLabel>
              <Input
                id="edit-precio"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={editPrecio}
                onChange={(e) => setEditPrecio(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button onClick={guardarEdicion} disabled={guardandoEdicion}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CardContent>
        {error && (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
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
          <ProductTableBody products={paginatedProducts} onEdit={abrirEdicion} />
        )}
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onPageChange={changePage}
        />
      </CardContent>
    </Card>
  )
}
