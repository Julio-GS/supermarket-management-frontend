import { PageHeader } from "@/components/page-header"
import { SettingsTabsShell } from "@/modules/configuracion"

export default function ConfiguracionPage() {
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Administra los datos de tu tienda, el equipo y las preferencias."
      />
      <div className="p-4 lg:p-6">
        <SettingsTabsShell />
      </div>
    </>
  )
}
