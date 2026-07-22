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
export function SyncStatusContainer(): React.ReactElement | null {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const {
    state,
    startSync,
    listOutbox,
    retryOutbox,
    exportOutbox,
  } = useSyncStatus();

  // Only render the indicator in desktop runtime; in browser mode it's
  // harmless but unnecessary noise.
  const hasDesktop =
    typeof window !== "undefined" && !!window.marketDesktop;

  if (!hasDesktop) return null;

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await startSync();
    } finally {
      setSyncing(false);
    }
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
