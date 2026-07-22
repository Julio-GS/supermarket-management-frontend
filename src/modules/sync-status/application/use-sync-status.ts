import { useState, useEffect, useCallback } from "react";
import type {
  SyncState,
  OutboxEntry,
  SyncStartResult,
  RetryResult,
} from "../domain/sync-state";
import { getAccessToken } from "@/shared/infrastructure/auth-token-store";

// ---------------------------------------------------------------------------
// Fallback values when the desktop bridge is not available
// ---------------------------------------------------------------------------

const FALLBACK_SYNC_STATE: SyncState = {
  pendingCount: 0,
  failedCount: 0,
  revalidationRequired: false,
  lastSyncAt: null,
  ready: true,
  connectivity: "online",
  sync: "idle",
  degraded: false,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseSyncStatusResult {
  state: SyncState;
  /** Trigger a manual sync (desktop bridge only). */
  startSync: () => Promise<SyncStartResult>;
  /** List outbox entries, optionally filtered by status. */
  listOutbox: (filter?: { status?: string }) => Promise<OutboxEntry[]>;
  /** Retry a single failed outbox entry. */
  retryOutbox: (id: string) => Promise<RetryResult>;
  /** Export all outbox entries (desktop bridge only). */
  exportOutbox: () => Promise<OutboxEntry[]>;
  /** Refresh the sync state from the bridge. */
  refresh: () => Promise<void>;
}

/**
 * Hook that reads sync state from the desktop bridge when available, falling
 * back to a default online/ready state in the browser.
 *
 * Polls every 10 seconds while mounted.
 */
export function useSyncStatus(): UseSyncStatusResult {
  const [state, setState] = useState<SyncState>(FALLBACK_SYNC_STATE);

  const hasDesktop = typeof window !== "undefined" && !!window.marketDesktop;

  const buildSyncState = useCallback(
    async (): Promise<SyncState> => {
      if (!hasDesktop || !window.marketDesktop?.offline || !window.marketDesktop?.sync) {
        return FALLBACK_SYNC_STATE;
      }

      try {
        const [offlineState, syncState] = await Promise.all([
          window.marketDesktop.offline.getState(),
          window.marketDesktop.sync.getState(),
        ]);

        return {
          pendingCount: syncState.pendingCount ?? offlineState.pendingCount,
          failedCount: syncState.failedCount ?? offlineState.failureCount,
          revalidationRequired: syncState.revalidationRequired,
          lastSyncAt: syncState.lastSyncAt ?? offlineState.lastSyncAt,
          ready: offlineState.ready,
          connectivity: offlineState.connectivity ?? "unknown",
          sync: offlineState.sync ?? "idle",
          degraded: offlineState.degraded ?? false,
        };
      } catch {
        return FALLBACK_SYNC_STATE;
      }
    },
    [hasDesktop],
  );

  const refresh = useCallback(async () => {
    const s = await buildSyncState();
    setState(s);
  }, [buildSyncState]);

  const startSync = useCallback(async (): Promise<SyncStartResult> => {
    if (!hasDesktop || !window.marketDesktop?.sync?.start) {
      return { synced: 0, failed: 0, blocked: 0, skipped: 0, revalidationBlocked: false };
    }
    const config = window.marketDesktop.getConfig();
    const token = getAccessToken();
    const result = await window.marketDesktop.sync.start({
      apiBaseUrl: config.apiBaseUrl,
      token: token ?? undefined,
    });
    await refresh();
    return result;
  }, [hasDesktop, refresh]);

  const listOutbox = useCallback(
    async (filter?: { status?: string }): Promise<OutboxEntry[]> => {
      if (!hasDesktop || !window.marketDesktop?.support?.listOutbox) {
        return [];
      }
      return window.marketDesktop.support.listOutbox(filter);
    },
    [hasDesktop],
  );

  const retryOutbox = useCallback(
    async (id: string): Promise<RetryResult> => {
      if (!hasDesktop || !window.marketDesktop?.support?.retryOutbox) {
        return { success: false, error: "Desktop bridge not available" };
      }
      const result = await window.marketDesktop.support.retryOutbox(id);
      if (result.success) {
        await refresh();
      }
      return result;
    },
    [hasDesktop, refresh],
  );

  const exportOutbox = useCallback(async (): Promise<OutboxEntry[]> => {
    if (!hasDesktop || !window.marketDesktop?.support?.exportOutbox) {
      return [];
    }
    return window.marketDesktop.support.exportOutbox();
  }, [hasDesktop]);

  // Poll every 10 seconds with cancellation guard
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const s = await buildSyncState();
      if (!cancelled) setState(s);
    };

    poll();

    const interval = setInterval(() => {
      poll();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [buildSyncState]);

  return {
    state,
    startSync,
    listOutbox,
    retryOutbox,
    exportOutbox,
    refresh,
  };
}
