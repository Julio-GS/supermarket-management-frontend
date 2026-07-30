"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { POS_CATALOG_QUERY_KEY, PRODUCTS_QUERY_KEY, PROMOTIONS_QUERY_KEY, STOCK_QUERY_KEY } from "@/shared/infrastructure/query-keys"
import type { BootstrapPort } from "../application/bootstrap-port"
import type { BootstrapStatusState } from "../domain/bootstrap-state"

const DESKTOP_CATALOG_REFRESH_MAX_PAGES = 200
const desktopBootstrapRefreshMemoryGuard = new Set<string>()

function getDesktopBootstrapRefreshKey(apiBaseUrl: string) {
  return `sg-desktop-bootstrap-refresh:${apiBaseUrl}`
}

function hasDesktopBootstrapRefreshGuard(apiBaseUrl: string) {
  const key = getDesktopBootstrapRefreshKey(apiBaseUrl)

  try {
    return window.localStorage.getItem(key) === "complete"
  } catch {
    return desktopBootstrapRefreshMemoryGuard.has(key)
  }
}

function setDesktopBootstrapRefreshGuard(apiBaseUrl: string) {
  const key = getDesktopBootstrapRefreshKey(apiBaseUrl)

  try {
    window.localStorage.setItem(key, "complete")
    return
  } catch {
    desktopBootstrapRefreshMemoryGuard.add(key)
  }
}

function hasUnresolvedOutboxWork(state: unknown) {
  if (!state || typeof state !== "object") {
    return false
  }

  const counts = state as {
    pendingCount?: number
    failedCount?: number
    inFlightCount?: number
    blockingCount?: number
  }

  return [
    counts.pendingCount ?? 0,
    counts.failedCount ?? 0,
    counts.inFlightCount ?? 0,
    counts.blockingCount ?? 0,
  ].some((count) => count > 0)
}

async function invalidateDesktopCatalogCaches(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: PROMOTIONS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: [POS_CATALOG_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [STOCK_QUERY_KEY] }),
  ])
}

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
  const queryClient = useQueryClient()
  const [state, setState] = useState<BootstrapStatusState | null>(() =>
    port.isDesktop ? null : { status: "complete", ready: true, syncCursor: null },
  )
  const [error, setError] = useState<string | null>(null)
  const autoStartTriggeredRef = useRef(false)
  const autoSyncKeyRef = useRef<string | null>(null)

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
    return () => {
      cancelled = true
    }
  }, [port])

  // Poll status every 2s while connectivity is unresolved so automatic
  // retries in the main process are reflected without a renderer event bus.
  useEffect(() => {
    if (!port.isDesktop) return
    if (
      state?.connectivity !== "unknown" &&
      state?.connectivity !== "reconnecting"
    ) {
      return
    }

    let cancelled = false
    const interval = setInterval(async () => {
      try {
        const status = await port.getStatus()
        if (!cancelled) setState(status)
      } catch {
        // Silently ignore polling errors
      }
    }, 2_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [port, state?.connectivity])

  useEffect(() => {
    const connectivity = state?.connectivity
    const canAutoStart =
      port.isDesktop &&
      token != null &&
      apiBaseUrl != null &&
      connectivity === "online" &&
      !state?.isOfflineMode

    if (!canAutoStart || state?.status !== "pending" || autoStartTriggeredRef.current) {
      return
    }

    autoStartTriggeredRef.current = true
    setState((prev) =>
      prev ? { ...prev, status: "in_progress", ready: false, error: undefined } : prev,
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
  }, [apiBaseUrl, port, state, token])

  useEffect(() => {
    const syncKey = token != null && apiBaseUrl != null ? `${token}::${apiBaseUrl}` : null
    const canAutoSync =
      port.isDesktop &&
      syncKey != null &&
      state?.status === "complete" &&
      state.ready &&
      state.connectivity === "online" &&
      !state.isOfflineMode &&
      typeof window !== "undefined"

    if (!canAutoSync || autoSyncKeyRef.current === syncKey) {
      return
    }

    if (token == null || apiBaseUrl == null) {
      return
    }

    const syncApi = window.marketDesktop?.sync
    autoSyncKeyRef.current = syncKey

    if (!syncApi?.pull) {
      console.warn("Desktop catalog refresh skipped: sync.pull API unavailable")
      return
    }

    const activeSyncApi = syncApi
    const pullCatalogPage = activeSyncApi.pull
    const resolvedToken: string = token
    const resolvedApiBaseUrl: string = apiBaseUrl
    let cancelled = false

    async function refreshDesktopCatalog() {
      if (!hasDesktopBootstrapRefreshGuard(resolvedApiBaseUrl)) {
        try {
          const syncState = await activeSyncApi.getState?.()

          if (hasUnresolvedOutboxWork(syncState)) {
            console.warn(
              "Desktop bootstrap refresh skipped: unresolved outbox work detected",
              syncState,
            )
          } else {
            const refreshResult = await port.startBootstrap({
              token: resolvedToken,
              apiBaseUrl: resolvedApiBaseUrl,
            })

            if (refreshResult?.status === "complete") {
              setDesktopBootstrapRefreshGuard(resolvedApiBaseUrl)
            } else {
              console.error(
                "Desktop bootstrap refresh failed; continuing with paginated pull",
                new Error(`Bootstrap refresh returned status ${refreshResult?.status ?? "unknown"}`),
              )
            }
          }
        } catch (err) {
          console.error("Desktop bootstrap refresh failed; continuing with paginated pull", err)
        }
      }

      let totalApplied = 0
      let totalSkipped = 0
      let pages = 0
      let lastCursor: string | null = null
      let hasMore = false

      do {
        const result = await pullCatalogPage({
          token: resolvedToken,
          apiBaseUrl: resolvedApiBaseUrl,
        })
        pages += 1
        totalApplied += result.applied
        totalSkipped += result.skipped
        lastCursor = result.cursor
        hasMore = result.hasMore

        console.info("Desktop catalog refresh page completed", {
          applied: result.applied,
          skipped: result.skipped,
          cursor: result.cursor,
          hasMore: result.hasMore,
          page: pages,
          totalApplied,
          totalSkipped,
        })

        if (hasMore && pages < DESKTOP_CATALOG_REFRESH_MAX_PAGES && !cancelled) {
          await Promise.resolve()
        }
      } while (hasMore && pages < DESKTOP_CATALOG_REFRESH_MAX_PAGES && !cancelled)

      const summary = {
        totalApplied,
        totalSkipped,
        pages,
        lastCursor,
        hasMore,
      }

      if (hasMore && pages >= DESKTOP_CATALOG_REFRESH_MAX_PAGES) {
        console.warn("Desktop catalog refresh reached max pages", {
          maxPages: DESKTOP_CATALOG_REFRESH_MAX_PAGES,
          ...summary,
        })
      }

      console.info("Desktop catalog refresh completed", summary)
      await invalidateDesktopCatalogCaches(queryClient)
    }

    void refreshDesktopCatalog().catch((err) => {
      console.error("Desktop auto-sync failed", err)
    })

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, port.isDesktop, queryClient, state, token])

  // Loading
  if (state === null && port.isDesktop) {
    return (
      <div role="status" aria-label="Checking bootstrap status">
        <p>Verificando estado offline...</p>
      </div>
    )
  }

  // Connectivity unresolved — show checking feedback and block bootstrap
  if (
    port.isDesktop &&
    (state?.connectivity === "unknown" || state?.connectivity === "reconnecting")
  ) {
    return (
      <div role="status" aria-label="Checking connection">
        <p>Verificando conexión...</p>
        <p>Estableciendo conexión con el servidor.</p>
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
          <div style={{ marginTop: "4px" }}>
            <button
              onClick={async () => {
                if (!apiBaseUrl) return
                setState((prev) =>
                  prev ? { ...prev, connectivity: "reconnecting" } : prev,
                )
                try {
                  const refreshed = await port.retryConnectivity({ apiBaseUrl })
                  setState(refreshed)
                } catch {
                  const status = await port.getStatus()
                  setState(status)
                }
              }}
              style={{
                background: "#fff",
                color: "#000",
                border: "1px solid #d97706",
                borderRadius: "4px",
                padding: "2px 12px",
                fontSize: "0.7rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reintentar conexión
            </button>
          </div>
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
