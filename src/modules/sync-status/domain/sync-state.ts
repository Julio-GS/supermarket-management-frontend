// ---------------------------------------------------------------------------
// Sync status domain types
// ---------------------------------------------------------------------------

export interface OutboxEntry {
  id: string;
  idempotency_key: string;
  operation_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: string;
  status: string;
  base_server_version: string | null;
  actor_user_id: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  server_result: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface SyncState {
  pendingCount: number;
  failedCount: number;
  revalidationRequired: boolean;
  lastSyncAt: string | null;
  /** Whether the local store is bootstrapped and ready for offline operation. */
  ready: boolean;
  /** Network reachability assessment. */
  connectivity: "online" | "offline" | "unknown";
  /** Current sync engine status from the desktop. */
  sync: "idle" | "syncing" | "error";
  /** Whether the database is running in degraded mode. */
  degraded: boolean;
}

export interface SyncStartResult {
  synced: number;
  failed: number;
  blocked: number;
  skipped: number;
  revalidationBlocked: boolean;
}

export interface RetryResult {
  success: boolean;
  error?: string;
}
