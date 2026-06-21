import { LoginForm } from "@/components/login-form"
import { Store, ShieldCheck, TrendingUp, Boxes } from "lucide-react"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <section className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="size-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold">SuperGestión</span>
              <span className="text-xs text-muted-foreground">
                Gestión de supermercado
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              Bienvenido de nuevo
            </h1>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Inicia sesión para administrar ventas, inventario y reportes de tu
              tienda.
            </p>
          </div>

          <LoginForm />
        </div>
      </section>

      <section className="hidden flex-1 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-sm font-medium opacity-90">
          <ShieldCheck className="size-4" />
          Plataforma segura para tu negocio
        </div>

        <div className="flex flex-col gap-6">
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-balance">
            Todo tu supermercado, bajo control en un solo panel.
          </h2>
          <div className="flex flex-col gap-5">
            <Feature
              icon={<TrendingUp className="size-5" />}
              title="Ventas en tiempo real"
              description="Registra ventas y sigue tus ingresos al instante."
            />
            <Feature
              icon={<Boxes className="size-5" />}
              title="Inventario inteligente"
              description="Alertas de stock bajo y control de proveedores."
            />
            <Feature
              icon={<ShieldCheck className="size-5" />}
              title="Reportes claros"
              description="Visualiza el rendimiento de tu tienda con gráficos."
            />
          </div>
        </div>

        <p className="text-sm opacity-75">
          {"\u00A9 2026 SuperGestión. Todos los derechos reservados."}
        </p>
      </section>
    </main>
  )
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-sm opacity-80">{description}</span>
      </div>
    </div>
  )
}
