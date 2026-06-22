import { PosTerminalShell, catalogQueryAdapter } from "@/modules/ventas"

export default async function VentasPage() {
  const initialProducts = await catalogQueryAdapter.search({})

  return <PosTerminalShell initialProducts={initialProducts} />
}
