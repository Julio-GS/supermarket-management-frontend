"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { BootstrapPort } from "../application/bootstrap-port"
import type { BootstrapStatusState } from "../domain/bootstrap-state"
import {
  canAutoStartBootstrap,
  canAutoSyncCatalog,
} from "../application/bootstrap-predicates"
import { refreshDesktopCatalog } from "../application/desktop-catalog-refresher"
import { BootstrapLoading } from "./bootstrap-loading"
import { ConnectivityChecking } from "./connectivity-checking"
import { BootstrapError } from "./bootstrap-error"
import { OfflineBanner } from "./offline-banner"
import { BootstrapPendingPrompt } from "./bootstrap-pending-prompt"
import { BootstrapProgress } from "./bootstrap-progress"
import { BootstrapFailedPrompt } from "./bootstrap-failed-prompt"

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
    if (token == null || apiBaseUrl == null) return

    if (
      !canAutoStartBootstrap({
        isDesktop: port.isDesktop,
        state,
        autoStartConsumed: autoStartTriggeredRef.current,
      })
    ) {
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

    if (
      !canAutoSyncCatalog({
        isDesktop: port.isDesktop,
        state,
        syncKey,
        consumedSyncKey: autoSyncKeyRef.current,
      })
    ) {
      return
    }

    if (token == null || apiBaseUrl == null || typeof window === "undefined") {
      return
    }

    autoSyncKeyRef.current = syncKey

    let cancelled = false

    void refreshDesktopCatalog(
      {
        bootstrapPort: port,
        syncApi: window.marketDesktop?.sync,
        queryInvalidator: queryClient,
      },
      {
        token,
        apiBaseUrl,
        isCancelled: () => cancelled,
      },
    )
      .then((result) => {
        if (result.status === "pull-unavailable") {
          console.warn("Desktop catalog refresh skipped: sync.pull API unavailable")
        } else if (result.status === "fatal-error") {
          console.error("Desktop auto-sync failed", result.error)
        }
      })
      .catch((err) => {
        console.error("Desktop auto-sync failed", err)
      })

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, port, queryClient, state, token])

  // Loading
  if (state === null && port.isDesktop) {
    return <BootstrapLoading />
  }

  // Connectivity unresolved — show checking feedback and block bootstrap
  if (
    port.isDesktop &&
    (state?.connectivity === "unknown" || state?.connectivity === "reconnecting")
  ) {
    return <ConnectivityChecking />
  }

  // Error fetching status
  if (error) {
    return <BootstrapError error={error} />
  }

  // Web mode or already ready
  if (state?.ready) {
    return <>{children}</>
  }

  // Offline mode: render children even if not bootstrapped
  if (state?.isOfflineMode && (state.status === "pending" || state.status === "failed")) {
    return (
      <>
        <OfflineBanner
          onRetryConnectivity={async () => {
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
        />
        {children}
      </>
    )
  }

  // Pending - not started yet (online mode)
  if (state?.status === "pending") {
    const canStart = port.isDesktop && token != null && apiBaseUrl != null

    return (
      <BootstrapPendingPrompt
        canStart={canStart}
        onStart={() => {
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
      />
    )
  }

  // In progress
  if (state?.status === "in_progress") {
    return <BootstrapProgress />
  }

  // Failed (online mode)
  if (state?.status === "failed") {
    const canRetry = port.isDesktop && token != null && apiBaseUrl != null

    return (
      <BootstrapFailedPrompt
        canRetry={canRetry}
        error={state.error}
        onRetry={() => {
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
      />
    )
  }

  return null
}
