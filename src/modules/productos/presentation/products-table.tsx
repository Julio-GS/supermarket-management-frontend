"use client"

import { useEffect, useRef, useState } from "react"
import { Search, PackageX, Printer } from "lucide-react"

import { validateProductPrice } from "../domain/product"
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
import { Input } from "@/components/ui/input"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { toast } from "sonner"
import { ProductTableBody, ProductsTableSkeleton } from "./products-table-rows"
import { ProductTablePagination, PRODUCTS_PAGE_SIZE } from "./products-table-pagination"
import { useProductsTableDialog } from "./use-products-table-dialog"
import { ProductsTableCreateDialog } from "./products-table-create-dialog"
import { ProductsTableEditDialog } from "./products-table-edit-dialog"
import { useLabelQueue } from "./use-label-queue"
import { ProductLabelsPrintDialog } from "./product-labels-print-dialog"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/shared/infrastructure/get-error-message"

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
  // timedOut becomes true after LOADING_TIMEOUT_MS if still loading with no data
  const LOADING_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes
  const [timedOut, setTimedOut] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isLoading && products.length === 0) {
      // Start the timeout clock when a fetch begins with no data yet
      timeoutRef.current = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS)
    } else {
      // Reset as soon as data arrives or loading stops
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setTimedOut(false)
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, products.length])

  const {
    create,
    edit,
    openCreate,
    closeCreate,
    resetCreate,
    setCreateField,
    openEdit,
    closeEdit,
    setEditField,
    setEditSaving,
  } = useProductsTableDialog()

  const {
    queue: labelQueue,
    isOpen: isPrintDialogOpen,
    enqueue: enqueueLabel,
    clearQueue: clearLabelQueue,
    openDialog: openPrintDialog,
    closeDialog: closePrintDialog,
  } = useLabelQueue()

  const totalPages = busqueda
    ? Math.max(1, Math.ceil(products.length / PRODUCTS_PAGE_SIZE))
    : pageMeta.totalPages
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
    if (!create.name || !create.price || !create.stock) {
      toast.error("Completa todos los campos del producto.")
      return
    }

    const price = Number(create.price)
    const priceError = validateProductPrice(price)
    if (priceError) {
      toast.error(priceError.message)
      return
    }

    const input: CreateProductInput = {
      name: create.name,
      sku: create.sku,
      price,
      stock: Number(create.stock),
    }
    if (create.costoNeto) input.costo_neto = Number(create.costoNeto)
    if (create.iva) input.iva = Number(create.iva)

    try {
      await createProduct(input)

      resetCreate()
      closeCreate()
      toast.success(`"${create.name}" se agregó al catálogo.`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function guardarEdicion() {
    if (!edit.product) return
    if (!edit.name || !edit.price) {
      toast.error("Completa el nombre y el precio del producto.")
      return
    }

    const price = Number(edit.price)
    const priceError = validateProductPrice(price)
    if (priceError) {
      toast.error(priceError.message)
      return
    }

    const priceChanged = price !== edit.product.price

    const input: UpdateProductInput = {
      id: edit.product.id,
      name: edit.name,
      sku: edit.sku,
      price,
    }

    setEditSaving(true)
    try {
      await updateProduct(input)
      closeEdit()
      toast.success(`"${input.name}" se actualizó correctamente.`)
      if (priceChanged) {
        // Enqueue updated product (with new price and name) for label printing
        enqueueLabel(
          { ...edit.product, name: edit.name, sku: edit.sku, price },
          new Date()
        )
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Catálogo de productos</CardTitle>
          <CardDescription>
            {isLoading && products.length === 0
              ? "Cargando productos..."
              : `${busqueda ? products.length : pageMeta.total} productos encontrados`}
          </CardDescription>
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
          {labelQueue.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={openPrintDialog}
              className="gap-2"
              id="btn-print-labels"
            >
              <Printer className="size-4" />
              {labelQueue.length} {labelQueue.length === 1 ? "etiqueta" : "etiquetas"} pendiente{labelQueue.length === 1 ? "" : "s"}
            </Button>
          )}
          <ProductsTableCreateDialog
            open={create.open}
            onOpenChange={(open) => (open ? openCreate() : closeCreate())}
            create={create}
            setCreateField={setCreateField}
            onSave={agregarProducto}
            isLoading={isLoading}
          />
        </div>
      </CardHeader>
      <ProductsTableEditDialog
        edit={edit}
        onClose={closeEdit}
        setEditField={setEditField}
        onSave={guardarEdicion}
      />
      <ProductLabelsPrintDialog
        open={isPrintDialogOpen}
        onClose={closePrintDialog}
        queue={labelQueue}
        onClearQueue={clearLabelQueue}
      />
      <CardContent>
        {error && (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {/* Show skeleton while loading and we have no data yet and haven't timed out */}
        {isLoading && products.length === 0 && !timedOut ? (
          <ProductsTableSkeleton />
        ) : products.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageX />
              </EmptyMedia>
              <EmptyTitle>Sin resultados</EmptyTitle>
              <EmptyDescription>
                {timedOut
                  ? "El servidor tardó demasiado en responder. Intentá de nuevo más tarde."
                  : "No se encontraron productos con los filtros seleccionados."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ProductTableBody products={paginatedProducts} onEdit={openEdit} />
        )}
        <ProductTablePagination
          page={currentPage}
          totalPages={totalPages}
          onPageChange={changePage}
        />
      </CardContent>
    </Card>
  )
}
