"use client";

import React, { useState } from "react";
import { useSyncStatus } from "../application/use-sync-status";
import { SyncStatusIndicator } from "../presentation/sync-status-indicator";
import { OutboxInspector } from "../presentation/outbox-inspector";

/**
 * Production container that wires useSyncStatus, SyncStatusIndicator, and
 * OutboxInspector for the authenticated/desktop app shell.
 *
 * In desktop runtime, it reads sync state from the Electron bridge and provides
 * the persistent indicator, inspect path, retry, and export affordances.
 * In browser/API fallback mode, the indicator shows a safe online/ready default.
 */
export interface SyncStatusContainerProps {
  token?: string;
  apiBaseUrl?: string;
}

export function SyncStatusContainer({ token, apiBaseUrl }: SyncStatusContainerProps): React.ReactElement | null {
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const {
    state,
    syncing,
    startSync,
    listOutbox,
    retryOutbox,
    exportOutbox,
  } = useSyncStatus({ token, apiBaseUrl, autoSyncEnabled: true });

  // Only render the indicator in desktop runtime; in browser mode it's
  // harmless but unnecessary noise.
  const hasDesktop =
    typeof window !== "undefined" && !!window.marketDesktop;

  if (!hasDesktop) return null;

  const handleSyncNow = async () => {
    await startSync();
  };

  const handleInspectFailures = () => {
    setInspectorOpen(true);
  };

  return (
    <>
      <SyncStatusIndicator
        state={state}
        onSyncNow={handleSyncNow}
        onInspectFailures={handleInspectFailures}
        syncing={syncing}
      />
      {inspectorOpen && (
        <OutboxInspector
          listOutbox={listOutbox}
          retryOutbox={retryOutbox}
          exportOutbox={exportOutbox}
          onClose={() => setInspectorOpen(false)}
        />
      )}
    </>
  );
}
