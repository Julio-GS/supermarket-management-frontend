import type { BootstrapStatusState } from "../domain/bootstrap-state"

export type OutboxStatus = "clean" | "blocked"

export interface CanAutoStartBootstrapInput {
  isDesktop: boolean
  state: BootstrapStatusState | null | undefined
  autoStartConsumed: boolean
}

export interface CanAutoSyncCatalogInput {
  isDesktop: boolean
  state: BootstrapStatusState | null | undefined
  syncKey: string | null | undefined
  consumedSyncKey: string | null | undefined
}

/**
 * Pure decision predicate for automatic bootstrap initiation in desktop mode.
 */
export function canAutoStartBootstrap({
  isDesktop,
  state,
  autoStartConsumed,
}: CanAutoStartBootstrapInput): boolean {
  if (!isDesktop || autoStartConsumed || !state) {
    return false
  }

  if (state.isOfflineMode || state.connectivity !== "online") {
    return false
  }

  if (state.status !== "pending" || state.ready) {
    return false
  }

  return true
}

/**
 * Pure decision predicate for automatic desktop catalog sync/refresh.
 */
export function canAutoSyncCatalog({
  isDesktop,
  state,
  syncKey,
  consumedSyncKey,
}: CanAutoSyncCatalogInput): boolean {
  if (!isDesktop || !state || syncKey == null || syncKey === "") {
    return false
  }

  if (consumedSyncKey === syncKey) {
    return false
  }

  if (state.isOfflineMode || state.connectivity !== "online") {
    return false
  }

  if (state.status !== "complete" || !state.ready) {
    return false
  }

  return true
}

/**
 * Pure helper to classify outbox safety for snapshot refresh.
 */
export function classifyOutboxStatus(count: number | undefined): OutboxStatus {
  return count !== undefined && count > 0 ? "blocked" : "clean"
}
