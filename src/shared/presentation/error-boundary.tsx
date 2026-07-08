"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional custom fallback to override the default error screen */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null, errorInfo: null }
    this.reset = this.reset.bind(this)
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, errorInfo: null }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Keep errorInfo for dev display; in production this stays silent
    this.setState({ errorInfo })
    // Log to console so developers can see the full trace
    console.error("[ErrorBoundary]", error, errorInfo)
  }

  reset() {
    this.setState({ error: null, errorInfo: null })
  }

  override render() {
    const { error } = this.state
    const { children, fallback } = this.props

    if (error) {
      if (fallback) {
        return fallback(error, this.reset)
      }
      return <DefaultErrorScreen error={error} onReset={this.reset} />
    }

    return children
  }
}

// ---------------------------------------------------------------------------
// Default error screen shown when an uncaught render error occurs
// ---------------------------------------------------------------------------

interface DefaultErrorScreenProps {
  error: Error
  onReset: () => void
}

function DefaultErrorScreen({ error, onReset }: DefaultErrorScreenProps) {
  function reloadPage() {
    window.location.reload()
  }

  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Algo salió mal</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Ocurrió un error inesperado en esta sección. Podés intentar recargar o volver a la
          pantalla anterior.
        </p>

        {/* Show technical message only in development */}
        {process.env.NODE_ENV === "development" && error.message && (
          <code className="mt-2 rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
            {error.message}
          </code>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onReset} id="btn-error-retry">
          <RefreshCw className="size-4" />
          Reintentar
        </Button>
        <Button onClick={reloadPage} id="btn-error-reload">
          <RotateCcw className="size-4" />
          Recargar página
        </Button>
      </div>
    </div>
  )
}
