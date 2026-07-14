import { PageHeader } from "@/components/page-header"
import { ProviderPurchasesShell } from "@/modules/provider-purchases"

export default function ProviderPurchasesPage() {
  return (
    <>
      <PageHeader
        title="Compras a Proveedores"
        description="Registra y consulta las compras realizadas a proveedores."
      />
      <div className="flex flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <ProviderPurchasesShell />
      </div>
    </>
  )
}
