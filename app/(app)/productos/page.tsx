import { PageHeader } from "@/components/page-header"
import { ProductsTable } from "@/components/productos/products-table"

export default function ProductosPage() {
  return (
    <>
      <PageHeader
        title="Productos e inventario"
        description="Gestiona el catálogo, precios y niveles de stock de tu supermercado."
      />
      <div className="p-4 lg:p-6">
        <ProductsTable />
      </div>
    </>
  )
}
