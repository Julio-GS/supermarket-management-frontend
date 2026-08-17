import {
  invalidateDesktopCatalogQueries,
  type QueryInvalidator,
} from "@/shared/infrastructure/query-cache-policy"
import { classifyOutboxStatus } from "./bootstrap-predicates"
import type { BootstrapPort } from "./bootstrap-port"
import type { BootstrapStatusState } from "../domain/bootstrap-state"

export const DESKTOP_CATALOG_REFRESH_MAX_PAGES = 200
const desktopBootstrapRefreshMemoryGuard = new Set<string>()

export function getDesktopBootstrapRefreshKey(apiBaseUrl: string): string {
  return `sg-desktop-bootstrap-refresh:${apiBaseUrl}`
}

export function hasDesktopBootstrapRefreshGuard(apiBaseUrl: string): boolean {
  const key = getDesktopBootstrapRefreshKey(apiBaseUrl)
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem(key) === "complete"
  } catch {
    return desktopBootstrapRefreshMemoryGuard.has(key)
  }
}

export function setDesktopBootstrapRefreshGuard(apiBaseUrl: string): void {
  const key = getDesktopBootstrapRefreshKey(apiBaseUrl)
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, "complete")
      return
    }
  } catch {
    // Fallback to memory
  }
  desktopBootstrapRefreshMemoryGuard.add(key)
}

export function hasUnresolvedOutboxWork(state: unknown): boolean {
  if (!state || typeof state !== "object") {
    return false
  }

  const counts = state as {
    pendingCount?: number
    failedCount?: number
    inFlightCount?: number
    blockingCount?: number
  }

  return (
    classifyOutboxStatus(counts.pendingCount) === "blocked" ||
    classifyOutboxStatus(counts.failedCount) === "blocked" ||
    classifyOutboxStatus(counts.inFlightCount) === "blocked" ||
    classifyOutboxStatus(counts.blockingCount) === "blocked"
  )
}

export type { QueryInvalidator }

export interface DesktopSyncApi {
  getState?: () => Promise<unknown> | unknown
  pull?: (params: { token: string; apiBaseUrl: string }) => Promise<{
    applied: number
    skipped: number
    cursor: string | null
    hasMore: boolean
  }>
}

export interface DesktopCatalogRefresherDependencies {
  bootstrapPort: Pick<BootstrapPort, "startBootstrap">
  syncApi?: DesktopSyncApi
  queryInvalidator: QueryInvalidator
  maxPages?: number
}

export interface RefreshDesktopCatalogInput {
  token: string
  apiBaseUrl: string
  isCancelled?: () => boolean
}

export interface DesktopCatalogPullSummary {
  totalApplied: number
  totalSkipped: number
  pages: number
  lastCursor: string | null
  hasMore: boolean
}

export type DesktopCatalogRefreshResult =
  | { status: "success"; summary: DesktopCatalogPullSummary; snapshot?: BootstrapStatusState }
  | { status: "outbox-blocked"; summary: DesktopCatalogPullSummary }
  | { status: "pull-unavailable"; snapshot?: BootstrapStatusState }
  | { status: "fatal-error"; error: unknown; snapshot?: BootstrapStatusState }

export async function refreshDesktopCatalog(
  deps: DesktopCatalogRefresherDependencies,
  input: RefreshDesktopCatalogInput,
): Promise<DesktopCatalogRefreshResult> {
  const {
    bootstrapPort,
    syncApi,
    queryInvalidator,
    maxPages = DESKTOP_CATALOG_REFRESH_MAX_PAGES,
  } = deps
  const { token, apiBaseUrl, isCancelled = () => false } = input

  let snapshotResult: BootstrapStatusState | undefined
  let isOutboxBlocked = false

  if (!hasDesktopBootstrapRefreshGuard(apiBaseUrl)) {
    try {
      const syncState = await syncApi?.getState?.()

      if (hasUnresolvedOutboxWork(syncState)) {
        isOutboxBlocked = true
        console.warn(
          "Desktop bootstrap refresh skipped: unresolved outbox work detected",
          syncState,
        )
      } else {
        snapshotResult = await bootstrapPort.startBootstrap({
          token,
          apiBaseUrl,
        })

        if (snapshotResult?.status === "complete") {
          setDesktopBootstrapRefreshGuard(apiBaseUrl)
        } else {
          console.error(
            "Desktop bootstrap refresh failed; continuing with paginated pull",
            new Error(`Bootstrap refresh returned status ${snapshotResult?.status ?? "unknown"}`),
          )
        }
      }
    } catch (err) {
      console.error("Desktop bootstrap refresh failed; continuing with paginated pull", err)
    }
  }

  const pullCatalogPage = syncApi?.pull
  if (!pullCatalogPage) {
    return { status: "pull-unavailable", snapshot: snapshotResult }
  }

  let totalApplied = 0
  let totalSkipped = 0
  let pages = 0
  let lastCursor: string | null = null
  let hasMore = false

  try {
    do {
      if (isCancelled()) {
        break
      }

      const result = await pullCatalogPage({
        token,
        apiBaseUrl,
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

      if (hasMore && pages < maxPages && !isCancelled()) {
        await Promise.resolve()
      }
    } while (hasMore && pages < maxPages && !isCancelled())

    const summary: DesktopCatalogPullSummary = {
      totalApplied,
      totalSkipped,
      pages,
      lastCursor,
      hasMore,
    }

    if (hasMore && pages >= maxPages) {
      console.warn("Desktop catalog refresh reached max pages", {
        maxPages,
        ...summary,
      })
    }

    console.info("Desktop catalog refresh completed", summary)

    if (!isCancelled()) {
      await invalidateDesktopCatalogQueries(queryInvalidator)
    }

    return isOutboxBlocked
      ? { status: "outbox-blocked", summary }
      : { status: "success", summary, snapshot: snapshotResult }
  } catch (error) {
    return { status: "fatal-error", error, snapshot: snapshotResult }
  }
}
