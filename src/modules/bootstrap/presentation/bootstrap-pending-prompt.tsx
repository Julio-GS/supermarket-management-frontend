interface BootstrapPendingPromptProps {
  canStart: boolean
  onStart: () => void
}

export function BootstrapPendingPrompt({ canStart, onStart }: BootstrapPendingPromptProps) {
  return (
    <div role="status" aria-label="Bootstrap required">
      <p>Se requiere la descarga inicial de datos para continuar.</p>
      <button disabled={!canStart} onClick={canStart ? onStart : undefined}>
        Iniciar descarga
      </button>
      <p>
        Asegurate de tener conexion a internet y presiona{" "}
        <strong>Iniciar descarga</strong> para comenzar.
      </p>
    </div>
  )
}
