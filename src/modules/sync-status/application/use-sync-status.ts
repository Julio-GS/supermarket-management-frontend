import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  SyncState,
  OutboxEntry,
  SyncStartResult,
  RetryResult,
} from "../domain/sync-state";
import { getAccessToken } from "@/shared/infrastructure/auth-token-store";
import {
  POS_CATALOG_QUERY_KEY,
  PRODUCTS_QUERY_KEY,
  PROMOTIONS_QUERY_KEY,
  STOCK_QUERY_KEY,
} from "@/shared/infrastructure/query-keys";

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

export interface UseSyncStatusOptions {
  token?: string;
  apiBaseUrl?: string;
  autoSyncEnabled?: boolean;
}

export interface UseSyncStatusResult {
  state: SyncState;
  syncing: boolean;
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

async function invalidateDesktopSyncQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: PROMOTIONS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: [POS_CATALOG_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [STOCK_QUERY_KEY] }),
  ]);
}

/**
 * Hook that reads sync state from the desktop bridge when available, falling
 * back to a default online/ready state in the browser.
 *
 * Polls every 10 seconds while mounted.
 */
export function useSyncStatus(options: UseSyncStatusOptions = {}): UseSyncStatusResult {
  const queryClient = useQueryClient();
  const hasDesktop = typeof window !== "undefined" && !!window.marketDesktop;
  const [state, setState] = useState<SyncState>(() =>
    hasDesktop
      ? { ...FALLBACK_SYNC_STATE, ready: false, connectivity: "unknown" }
      : FALLBACK_SYNC_STATE,
  );
  const [hasHydratedState, setHasHydratedState] = useState(!hasDesktop);
  const [syncing, setSyncing] = useState(false);
  const inFlightSyncRef = useRef<Promise<SyncStartResult> | null>(null);
  const autoSyncStartedForKeyRef = useRef<string | null>(null);
  const resolvedToken = options.token ?? getAccessToken() ?? undefined;
  const resolvedApiBaseUrl = useMemo(() => {
    if (options.apiBaseUrl) {
      return options.apiBaseUrl;
    }

    if (!hasDesktop) {
      return undefined;
    }

    return window.marketDesktop?.getConfig().apiBaseUrl;
  }, [hasDesktop, options.apiBaseUrl]);

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
        return { ...FALLBACK_SYNC_STATE, ready: false, connectivity: "unknown" };
      }
    },
    [hasDesktop],
  );

  const refresh = useCallback(async () => {
    const s = await buildSyncState();
    setState(s);
    setHasHydratedState(true);
  }, [buildSyncState]);

  const startSync = useCallback(
    async (reason: "manual" | "auto-ready" | "auto-interval" = "manual"): Promise<SyncStartResult> => {
      const syncApi = hasDesktop ? window.marketDesktop?.sync : undefined;

      if (!syncApi?.start) {
        return { synced: 0, failed: 0, blocked: 0, skipped: 0, revalidationBlocked: false };
      }

      if (inFlightSyncRef.current) {
        console.info("Desktop sync skipped because another run is already in flight", { reason });
        return inFlightSyncRef.current;
      }

      const syncPromise = (async () => {
        const startedAt = Date.now();
        setSyncing(true);

        try {
          const result = await syncApi.start({
            apiBaseUrl: resolvedApiBaseUrl,
            token: resolvedToken,
          });

          console.info("Desktop sync completed", {
            reason,
            durationMs: Date.now() - startedAt,
            apiBaseUrl: resolvedApiBaseUrl,
            synced: result.synced,
            failed: result.failed,
            blocked: result.blocked,
            skipped: result.skipped,
            revalidationBlocked: result.revalidationBlocked,
          });

          await invalidateDesktopSyncQueries(queryClient);
          await refresh();

          return result;
        } catch (error) {
          console.error("Desktop sync failed", {
            reason,
            apiBaseUrl: resolvedApiBaseUrl,
            hasToken: resolvedToken != null,
            error,
          });
          await refresh();
          throw error;
        } finally {
          inFlightSyncRef.current = null;
          setSyncing(false);
        }
      })();

      inFlightSyncRef.current = syncPromise;
      return syncPromise;
    },
    [hasDesktop, queryClient, refresh, resolvedApiBaseUrl, resolvedToken],
  );

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

  useEffect(() => {
    if (
      !options.autoSyncEnabled ||
      !hasDesktop ||
      !resolvedApiBaseUrl ||
      !resolvedToken ||
      !hasHydratedState ||
      !state.ready ||
      state.connectivity === "offline"
    ) {
      return;
    }

    const autoSyncKey = `${resolvedToken}::${resolvedApiBaseUrl}`;
    const shouldRunInitialSync = autoSyncStartedForKeyRef.current !== autoSyncKey;
    const initialSyncTimeout = shouldRunInitialSync
      ? window.setTimeout(() => {
          autoSyncStartedForKeyRef.current = autoSyncKey;
          void startSync("auto-ready").catch(() => undefined);
        }, 0)
      : null;
    const interval = window.setInterval(() => {
      void startSync("auto-interval").catch(() => undefined);
    }, 60_000);

    return () => {
      if (initialSyncTimeout != null) {
        window.clearTimeout(initialSyncTimeout);
      }
      window.clearInterval(interval);
    };
  }, [
    hasDesktop,
    hasHydratedState,
    options.autoSyncEnabled,
    resolvedApiBaseUrl,
    resolvedToken,
    startSync,
    state.connectivity,
    state.ready,
  ]);

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
    syncing,
    startSync: () => startSync("manual"),
    listOutbox,
    retryOutbox,
    exportOutbox,
    refresh,
  };
}
