"use client"

import { useEffect, useRef, useState } from "react"
import { Search, PackageX, Printer } from "lucide-react"

import { validateProductPrice } from "../domain/product"
import { isExactSkuMatch } from "../domain/product-search"
import { useProductCatalog } from "../application/use-product-catalog"
import { useStockAdjustment } from "../application/use-stock-adjustment"
import type { ProductRepository } from "../application/product-repository"
import type { StockRepository } from "../application/stock-repository"
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
import { ProductLabelsPrintDialog } from "./product-labels-print-dialog"
import { ProductStockAdjustDialog } from "./product-stock-adjust-dialog"
import { Button } from "@/components/ui/button"
import type { LabelPrintJobsPort } from "@/modules/label-print-jobs"
import { useRemoteLabelPrintFlow, RemoteLabelPrintConfirmDialog } from "@/modules/label-print-jobs"

const LOADING_TIMEOUT_MS = 2 * 60 * 1000

export interface ProductsTableProps {
  repository: ProductRepository
  stockRepository?: StockRepository
  initialProducts?: Product[]
  labelPrintJobsPort?: LabelPrintJobsPort
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message
  }

  if (typeof err === "string" && err.trim()) {
    return err
  }

  return "No se pudo completar la operación."
}

export function ProductsTable({ repository, stockRepository, initialProducts, labelPrintJobsPort }: ProductsTableProps) {
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
    toggleStockControl,
    isCreating,
  } = useProductCatalog(repository, { initialProducts })

  const [busqueda, setBusqueda] = useState(filters.search ?? "")
  // timedOut becomes true after LOADING_TIMEOUT_MS if still loading with no data
  const [timedOut, setTimedOut] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isLoading || products.length > 0) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      }
    }

    // Start the timeout clock when a fetch begins with no data yet
    timeoutRef.current = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
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

  // Remote label print jobs — only active when port is provided
  const remoteFlow = useRemoteLabelPrintFlow(
    labelPrintJobsPort ?? {
      getPendingJobs: async () => [],
      claim: async () => null,
      claimBatch: async () => [],
      claimAllForPrint: async () => {
        throw new Error("Label print jobs port not available")
      },
      completeJob: async () => {},
      failJob: async () => {},
      blockJob: async () => {
        throw new Error("Label print jobs port not available")
      },
      createJob: async () => {
        throw new Error("Label print jobs port not available")
      },
    }
  )

  // Manual stock adjustment
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)

  const {
    adjustStock,
    isPending: isAdjustPending,
    error: adjustError,
    resetError: resetAdjustError,
  } = useStockAdjustment(
    stockRepository ?? {
      getStock: async () => null,
      adjust: async () => {
        throw new Error("Stock repository not available")
      },
    }
  )

  function openAdjustStock(product: Product) {
    setAdjustingProduct(product)
  }

  function closeAdjustStock() {
    setAdjustingProduct(null)
    resetAdjustError()
  }

  const totalPages = busqueda
    ? Math.max(1, Math.ceil(products.length / PRODUCTS_PAGE_SIZE))
    : pageMeta.totalPages
  const currentPage = busqueda ? 1 : pageMeta.page
  const paginatedProducts = busqueda ? products.slice(0, PRODUCTS_PAGE_SIZE) : products

  function applySearch(value: string) {
    setTimedOut(false)
    setBusqueda(value)
    applyFilters({ ...filters, search: value || undefined })
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    const value = e.currentTarget.value.trim()
    if (!value) return
    if (isExactSkuMatch(products, value)) {
      setBusqueda("")
    }
  }

  function changePage(value: number) {
    setTimedOut(false)
    setPage(value)
  }

  async function agregarProducto() {
    if (isCreating) {
      return
    }

    if (!create.name || !create.price) {
      toast.error("Completa el nombre y el precio del producto.")
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
      manejaStock: create.manejaStock,
    }
    if (create.costoNeto) input.costo_neto = Number(create.costoNeto)
    if (create.iva) input.iva = Number(create.iva)

    try {
      await createProduct(input)

      resetCreate()
      closeCreate()
      toast.success(`"${create.name}" se agregó al catálogo.`)

      // Refresh pending label jobs — best-effort, non-fatal
      if (labelPrintJobsPort) {
        remoteFlow.refreshPendingJobs().catch(() => {
          toast.warning(
            "El producto se creó correctamente, pero no se pudo actualizar la cola de etiquetas pendientes. Podés reintentar el refresco más tarde."
          )
        })
      }
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

    if (edit.product.iva == null || !Number.isFinite(edit.product.iva)) {
      toast.error("El producto no tiene una alícuota de IVA configurada.")
      return
    }

    const input: UpdateProductInput = {
      id: edit.product.id,
      name: edit.name,
      sku: edit.sku,
      price,
      manejaStock: edit.manejaStock,
      iva: edit.product.iva,
    }

    // Only auto-enqueue a label when the final sale price changes;
    // name-only or SKU-only edits do not require a new printed label.
    const priceChanged = edit.product.price !== price

    setEditSaving(true)
    try {
      await updateProduct(input)
      closeEdit()
      toast.success(`"${input.name}" se actualizó correctamente.`)
      if (priceChanged && labelPrintJobsPort) {
        remoteFlow.refreshPendingJobs().catch(() => {
          toast.warning(
            "El precio se actualizó, pero no se pudo refrescar la cola de etiquetas pendientes. Reintentá el refresco más tarde."
          )
        })
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setEditSaving(false)
    }
  }

      async function handlePrintLooseLabel(product: Product) {
    if (!labelPrintJobsPort) {
      toast.error("La impresión de etiquetas no está disponible.")
      return
    }

    try {
      await labelPrintJobsPort.createJob({
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        sale_price: product.price.toFixed(2),
      })
      toast.success(`Etiqueta de "${product.name}" enviada a la cola de impresión.`)
      remoteFlow.refreshPendingJobs().catch(() => {
        toast.warning(
          "La etiqueta se envió, pero no se pudo refrescar la cola de pendientes."
        )
      })
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }
  async function handleToggleStockControl(product: Product) {
    try {
      await toggleStockControl({ id: product.id, manejaStock: !product.manejaStock })
      toast.success(product.manejaStock ? "Control de stock desactivado" : "Control de stock activado")
    } catch (err) {
      toast.error(getErrorMessage(err))
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
              onKeyDown={handleSearchKeyDown}
              className="pl-9 sm:w-64"
            />
          </div>

          {/* Remote pending-label print button */}
          {labelPrintJobsPort && remoteFlow.pendingCount > 0 && (
            <Button
              variant={remoteFlow.pendingCount > 0 ? "default" : "outline"}
              size="sm"
              onClick={remoteFlow.handlePrintPending}
              disabled={remoteFlow.isClaiming}
              className="gap-2"
              id="btn-remote-print-labels"
            >
              <Printer className="size-4" />
              {remoteFlow.isClaiming
                ? "Reclamando..."
                : `Imprimir pendientes (${remoteFlow.pendingCount})`}
            </Button>
          )}

          <ProductsTableCreateDialog
            open={create.open}
            onOpenChange={(open) => (open ? openCreate() : closeCreate())}
            create={create}
            setCreateField={setCreateField}
            onSave={agregarProducto}
            isLoading={isCreating}
          />
        </div>
      </CardHeader>
      <ProductsTableEditDialog
        edit={edit}
        onClose={closeEdit}
        setEditField={setEditField}
        onSave={guardarEdicion}
      />

      {/* Remote label print dialog */}
      <ProductLabelsPrintDialog
        open={remoteFlow.isPrintDialogOpen}
        onClose={remoteFlow.openOutcome}
        queue={remoteFlow.remoteQueue}
        onClearQueue={() => {}}
        isRemote
      />

      {/* Remote print confirmation dialog */}
      <RemoteLabelPrintConfirmDialog
        open={remoteFlow.isConfirmOpen}
        jobCount={remoteFlow.remoteQueue.length}
        onComplete={remoteFlow.confirmSuccess}
        onRequeue={() => remoteFlow.confirmRequeue()}
        onBlock={() => remoteFlow.confirmBlock()}
        isProcessing={remoteFlow.isFinalizing}
        pendingMessage={remoteFlow.settlementMessage}
        onRetry={remoteFlow.retryFinalization}
      />

      <ProductStockAdjustDialog
        open={adjustingProduct !== null}
        onClose={closeAdjustStock}
        productId={adjustingProduct?.id ?? ""}
        productName={adjustingProduct?.name ?? ""}
        currentStock={adjustingProduct?.stock ?? null}
        onAdjusted={async (input) => {
          await adjustStock(input)
        }}
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
          <ProductTableBody products={paginatedProducts} onEdit={openEdit} onAdjustStock={openAdjustStock} onToggleStockControl={handleToggleStockControl} onPrintLabel={handlePrintLooseLabel} />
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
