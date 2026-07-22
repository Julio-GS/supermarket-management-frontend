"use client";

import React, { useEffect, useState } from "react";
import type { OutboxEntry, RetryResult } from "../domain/sync-state";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OutboxInspectorProps {
  /** Function to list outbox entries (optionally filtered). */
  listOutbox: (filter?: { status?: string }) => Promise<OutboxEntry[]>;
  /** Function to retry a single entry. */
  retryOutbox: (id: string) => Promise<RetryResult>;
  /** Function to export all entries. */
  exportOutbox: () => Promise<OutboxEntry[]>;
  /** Called when the user dismisses the inspector. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "in_flight":
      return "In flight";
    case "retry_wait":
      return "Waiting retry";
    case "synced":
      return "Synced";
    case "failed":
      return "Failed";
    case "blocked_auth":
      return "Blocked (auth)";
    case "blocked_conflict":
      return "Blocked (conflict)";
    default:
      return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "synced":
      return "#22c55e";
    case "failed":
    case "blocked_auth":
    case "blocked_conflict":
      return "#dc2626";
    case "in_flight":
      return "#3b82f6";
    default:
      return "#f97316";
  }
}

function isRetryable(status: string): boolean {
  return ["failed", "blocked_auth", "blocked_conflict"].includes(status);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Support/operator view for inspecting outbox entries.
 *
 * Shows all entries with their status, payload, allows retrying failed
 * entries, and provides an export action.
 */
export function OutboxInspector({
  listOutbox,
  retryOutbox,
  exportOutbox,
  onClose,
}: OutboxInspectorProps): React.ReactElement {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("failed");

  // Fetch entries when filter changes, with cancellation guard
  useEffect(() => {
    let cancelled = false;

    const fetchEntries = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await listOutbox(filter ? { status: filter } : undefined);
        if (!cancelled) setEntries(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load outbox");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEntries();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listOutbox(filter ? { status: filter } : undefined);
      setEntries(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load outbox");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    setRetrying((prev) => new Set(prev).add(id));
    try {
      await retryOutbox(id);
      await handleRefresh();
    } catch {
      // error stays shown via reload
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportOutbox();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `outbox-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  };

  return (
    <div
      data-testid="outbox-inspector"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "480px",
        maxWidth: "100vw",
        height: "100vh",
        backgroundColor: "white",
        boxShadow: "-4px 0 12px rgba(0,0,0,0.1)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
          Sync Outbox
        </h2>
        <button
          data-testid="outbox-close-btn"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "1.25rem",
            cursor: "pointer",
            padding: "0.25rem",
          }}
        >
          ✕
        </button>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          borderBottom: "1px solid #e5e7eb",
          alignItems: "center",
        }}
      >
        <select
          data-testid="outbox-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="synced">Synced</option>
          <option value="retry_wait">Waiting retry</option>
        </select>
        <button
          data-testid="outbox-refresh-btn"
          onClick={handleRefresh}
          style={{
            fontSize: "0.75rem",
            padding: "0.25rem 0.5rem",
            border: "1px solid #d1d5db",
            borderRadius: "0.25rem",
            background: "white",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
        <button
          data-testid="outbox-export-btn"
          onClick={handleExport}
          style={{
            fontSize: "0.75rem",
            padding: "0.25rem 0.5rem",
            border: "1px solid #d1d5db",
            borderRadius: "0.25rem",
            background: "white",
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          Export JSON
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "0.5rem 1rem" }}>
        {loading && (
          <p data-testid="outbox-loading" style={{ color: "#6b7280" }}>
            Loading...
          </p>
        )}
        {error && (
          <p data-testid="outbox-error" style={{ color: "#dc2626" }}>
            {error}
          </p>
        )}
        {!loading && !error && entries.length === 0 && (
          <p data-testid="outbox-empty" style={{ color: "#6b7280" }}>
            No outbox entries match the selected filter.
          </p>
        )}
        {!loading &&
          entries.map((entry) => (
            <div
              key={entry.id}
              data-testid={`outbox-entry-${entry.id}`}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "0.375rem",
                padding: "0.5rem 0.75rem",
                marginBottom: "0.5rem",
                fontSize: "0.8125rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.25rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {entry.operation_type}
                </span>
                <span
                  data-testid={`outbox-status-${entry.id}`}
                  style={{
                    color: statusColor(entry.status),
                    fontWeight: 500,
                  }}
                >
                  {statusLabel(entry.status)}
                </span>
              </div>
              <div style={{ color: "#6b7280", marginBottom: "0.25rem" }}>
                <span>{entry.aggregate_type}</span>
                {" · "}
                <span>{entry.aggregate_id}</span>
                {" · "}
                <span>{new Date(entry.created_at).toLocaleString()}</span>
              </div>
              {entry.last_error && (
                <div
                  data-testid={`outbox-error-${entry.id}`}
                  style={{
                    color: "#dc2626",
                    marginBottom: "0.25rem",
                    fontSize: "0.75rem",
                  }}
                >
                  {entry.last_error}
                </div>
              )}
              {entry.payload && (
                <div
                  data-testid={`outbox-payload-${entry.id}`}
                  style={{
                    backgroundColor: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.25rem",
                    padding: "0.375rem 0.5rem",
                    marginBottom: "0.25rem",
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    maxHeight: "8rem",
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {typeof entry.payload === "string"
                    ? entry.payload
                    : JSON.stringify(entry.payload, null, 2)}
                </div>
              )}
              {isRetryable(entry.status) && (
                <button
                  data-testid={`outbox-retry-${entry.id}`}
                  onClick={() => handleRetry(entry.id)}
                  disabled={retrying.has(entry.id)}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.125rem 0.5rem",
                    backgroundColor: retrying.has(entry.id)
                      ? "#d1d5db"
                      : "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: retrying.has(entry.id) ? "default" : "pointer",
                  }}
                >
                  {retrying.has(entry.id) ? "Retrying..." : "Retry"}
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
