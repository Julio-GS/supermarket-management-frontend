"use client"

import { useState } from "react"
import { Search, PackageX } from "lucide-react"

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
import { ProductTableBody } from "./products-table-rows"
import { ProductTablePagination, PRODUCTS_PAGE_SIZE } from "./products-table-pagination"
import { useProductsTableDialog } from "./use-products-table-dialog"
import { ProductsTableCreateDialog } from "./products-table-create-dialog"
import { ProductsTableEditDialog } from "./products-table-edit-dialog"

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
      const message = err instanceof Error ? err.message : "No se pudo guardar el producto."
      toast.error(message)
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el producto."
      toast.error(message)
    } finally {
      setEditSaving(false)
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
