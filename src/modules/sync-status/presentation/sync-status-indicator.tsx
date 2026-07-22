"use client";

import React from "react";
import type { SyncState } from "../domain/sync-state";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SyncStatusIndicatorProps {
  state: SyncState;
  /** Called when the user clicks "Sync now" */
  onSyncNow?: () => void;
  /** Called when the user clicks to inspect failed entries */
  onInspectFailures?: () => void;
  /** Whether a sync is currently in progress (for optimistic UI) */
  syncing?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Persistent sync status indicator for the app shell.
 *
 * Displays connectivity state, pending/failed counts, and provides action
 * affordances (sync now, inspect failures).
 */
export function SyncStatusIndicator({
  state,
  onSyncNow,
  onInspectFailures,
  syncing = false,
}: SyncStatusIndicatorProps): React.ReactElement {
  const connectivityLabel =
    state.connectivity === "online"
      ? "Online"
      : state.connectivity === "offline"
        ? "Offline"
        : "Checking...";

  const connectivityColor =
    state.connectivity === "online"
      ? "#22c55e"
      : state.connectivity === "offline"
        ? "#f97316"
        : "#94a3b8";

  const degraded = state.degraded;
  const pending = state.pendingCount;
  const failed = state.failedCount;
  const hasFailures = failed > 0;
  const hasPending = pending > 0;
  const offline = state.connectivity === "offline";

  return (
    <div
      data-testid="sync-status-indicator"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.25rem 0.75rem",
        fontSize: "0.8125rem",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: degraded ? "#fef2f2" : "transparent",
        borderRadius: "0.375rem",
      }}
    >
      {/* Connectivity dot + label */}
      <span
        data-testid="connectivity-indicator"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
        }}
        title={`Connectivity: ${connectivityLabel}`}
      >
        <span
          style={{
            width: "0.5rem",
            height: "0.5rem",
            borderRadius: "9999px",
            backgroundColor: connectivityColor,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span>{connectivityLabel}</span>
      </span>

      {/* Degraded warning */}
      {degraded && (
        <span
          data-testid="degraded-warning"
          style={{ color: "#dc2626", fontWeight: 500 }}
        >
          Degraded
        </span>
      )}

      {/* Pending count */}
      {hasPending && (
        <span
          data-testid="pending-count"
          style={{
            color: offline ? "#f97316" : "#3b82f6",
            fontWeight: 500,
          }}
        >
          {pending} pending
        </span>
      )}

      {/* Failed count + inspect action */}
      {hasFailures && (
        <span
          data-testid="failed-count"
          style={{ color: "#dc2626", fontWeight: 600 }}
        >
          {failed} failed
          {onInspectFailures && (
            <button
              data-testid="inspect-failures-btn"
              onClick={onInspectFailures}
              style={{
                marginLeft: "0.375rem",
                fontSize: "0.75rem",
                textDecoration: "underline",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#dc2626",
                padding: 0,
              }}
            >
              Inspect
            </button>
          )}
        </span>
      )}

      {/* Sync progress indicator */}
      {syncing && (
        <span
          data-testid="syncing-indicator"
          style={{ color: "#3b82f6", fontWeight: 500 }}
        >
          Syncing...
        </span>
      )}

      {/* Manual sync trigger */}
      {onSyncNow && state.connectivity === "online" && !syncing && (
        <button
          data-testid="sync-now-btn"
          onClick={onSyncNow}
          style={{
            fontSize: "0.75rem",
            padding: "0.125rem 0.5rem",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
          }}
        >
          Sync now
        </button>
      )}
    </div>
  );
}
