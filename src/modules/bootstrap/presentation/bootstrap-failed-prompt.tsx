interface BootstrapFailedPromptProps {
  canRetry: boolean
  error: string | undefined
  onRetry: () => void
}

export function BootstrapFailedPrompt({ canRetry, error, onRetry }: BootstrapFailedPromptProps) {
  return (
    <div role="alert" aria-label="Bootstrap failed">
      <p>La descarga de datos fallo{error ? `: ${error}` : ""}.</p>
      <button disabled={!canRetry} onClick={canRetry ? onRetry : undefined}>
        Reintentar
      </button>
      <p>Verifica tu conexion e intenta de nuevo.</p>
    </div>
  )
}
