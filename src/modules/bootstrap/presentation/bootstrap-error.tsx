export function BootstrapError({ error }: { error: string }) {
  return (
    <div role="alert">
      <p>Error al verificar el estado: {error}</p>
    </div>
  )
}
