"use client"

import { useEffect, useState, type ReactNode } from "react"
import type { BootstrapPort } from "../application/bootstrap-port"
import type { BootstrapStatusState } from "../domain/bootstrap-state"

export interface BootstrapGateProps {
  port: BootstrapPort
  children: ReactNode
  token?: string
  apiBaseUrl?: string
}

/**
 * Readiness gate that prevents the app from showing operational content
 * before the initial data bootstrap completes.
 *
 * - In desktop mode: queries bootstrap status via IPC. If offline and not
 *   bootstrapped, renders children anyway with a warning banner.
 * - In web mode: always renders children immediately.
 */
export function BootstrapGate({ port, children, token, apiBaseUrl }: BootstrapGateProps) {
  const [state, setState] = useState<BootstrapStatusState | null>(() =>
    port.isDesktop ? null : { status: "complete", ready: true, syncCursor: null },
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!port.isDesktop) return

    let cancelled = false

    async function check() {
      try {
        const status = await port.getStatus()
        if (!cancelled) setState(status)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to check bootstrap status")
        }
      }
    }

    void check()
    return () => { cancelled = true }
  }, [port])

  // Loading
  if (state === null && port.isDesktop) {
    return (
      <div role="status" aria-label="Checking bootstrap status">
        <p>Verificando estado offline...</p>
      </div>
    )
  }

  // Error fetching status
  if (error) {
    return (
      <div role="alert">
        <p>Error al verificar el estado: {error}</p>
      </div>
    )
  }

  // Web mode or already ready
  if (state?.ready) {
    return <>{children}</>
  }

  // Offline mode: render children even if not bootstrapped
  if (state?.isOfflineMode && (state.status === "pending" || state.status === "failed")) {
    return (
      <>
        <div
          role="status"
          aria-label="Modo offline activo"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "#f59e0b",
            color: "#000",
            textAlign: "center",
            padding: "4px 12px",
            fontSize: "0.75rem",
            fontWeight: 500,
          }}
        >
          Sin conexion - trabajando con datos locales. Los cambios se sincronizaran al reconectarte.
        </div>
        {children}
      </>
    )
  }

  // Pending - not started yet (online mode)
  if (state?.status === "pending") {
    const canStart = port.isDesktop && token != null && apiBaseUrl != null

    return (
      <div role="status" aria-label="Bootstrap required">
        <p>Se requiere la descarga inicial de datos para continuar.</p>
        {port.isDesktop && (
          <button
            disabled={!canStart}
            onClick={() => {
              if (!canStart) return
              setState((prev) =>
                prev ? { ...prev, status: "in_progress", ready: false } : prev,
              )
              port
                .startBootstrap({ token, apiBaseUrl })
                .then((result) => setState(result))
                .catch((err) =>
                  setState((prev) =>
                    prev
                      ? {
                          ...prev,
                          status: "failed",
                          ready: false,
                          error: err instanceof Error ? err.message : "Bootstrap fallido",
                        }
                      : prev,
                  ),
                )
            }}
          >
            Iniciar descarga
          </button>
        )}
        <p>
          Asegurate de tener conexion a internet y presiona{" "}
          <strong>Iniciar descarga</strong> para comenzar.
        </p>
      </div>
    )
  }

  // In progress
  if (state?.status === "in_progress") {
    return (
      <div role="status" aria-label="Bootstrap in progress">
        <p>Descargando datos operativos...</p>
        <p>Aguarda un momento mientras la app se prepara.</p>
      </div>
    )
  }

  // Failed (online mode)
  if (state?.status === "failed") {
    const canRetry = port.isDesktop && token != null && apiBaseUrl != null

    return (
      <div role="alert" aria-label="Bootstrap failed">
        <p>La descarga de datos fallo{state.error ? `: ${state.error}` : ""}.</p>
        {port.isDesktop && (
          <button
            disabled={!canRetry}
            onClick={() => {
              if (!canRetry) return
              setState((prev) =>
                prev ? { ...prev, status: "in_progress", ready: false } : prev,
              )
              port
                .resumeBootstrap({ token, apiBaseUrl })
                .then((result) => setState(result))
                .catch((err) =>
                  setState((prev) =>
                    prev
                      ? {
                          ...prev,
                          status: "failed",
                          ready: false,
                          error: err instanceof Error ? err.message : "Bootstrap fallido",
                        }
                      : prev,
                  ),
                )
            }}
          >
            Reintentar
          </button>
        )}
        <p>Verifica tu conexion e intenta de nuevo.</p>
      </div>
    )
  }

  return null
}
