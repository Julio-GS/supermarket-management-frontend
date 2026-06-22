import { PageHeader } from "@/components/page-header"
import { ProductsTableShell, productRepository } from "@/modules/productos"

export default async function ProductosPage() {
  const initialProducts = await productRepository.list()

  return (
    <>
      <PageHeader
        title="Productos e inventario"
        description="Gestiona el catálogo, precios y niveles de stock de tu supermercado."
      />
      <div className="p-4 lg:p-6">
        <ProductsTableShell initialProducts={initialProducts} />
      </div>
    </>
  )
}
