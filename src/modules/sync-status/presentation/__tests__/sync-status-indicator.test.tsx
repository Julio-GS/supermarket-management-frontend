import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SyncStatusIndicator } from "../sync-status-indicator";
import type { SyncState } from "../../domain/sync-state";

function buildState(overrides: Partial<SyncState> = {}): SyncState {
  return {
    pendingCount: 0,
    failedCount: 0,
    revalidationRequired: false,
    lastSyncAt: null,
    ready: true,
    connectivity: "online",
    sync: "idle",
    degraded: false,
    ...overrides,
  };
}

describe("SyncStatusIndicator", () => {
  it("renders the connectivity indicator", () => {
    render(<SyncStatusIndicator state={buildState({ connectivity: "online" })} />);
    expect(screen.getByTestId("connectivity-indicator")).toBeDefined();
    expect(screen.getByText("Online")).toBeDefined();
  });

  it("shows 'Offline' when connectivity is offline", () => {
    render(<SyncStatusIndicator state={buildState({ connectivity: "offline" })} />);
    expect(screen.getByText("Offline")).toBeDefined();
  });

  it("shows 'Checking...' when connectivity is unknown", () => {
    render(<SyncStatusIndicator state={buildState({ connectivity: "unknown" })} />);
    expect(screen.getByText("Checking...")).toBeDefined();
  });

  it("displays pending count when there are pending items", () => {
    render(
      <SyncStatusIndicator
        state={buildState({ pendingCount: 5, connectivity: "offline" })}
      />,
    );
    expect(screen.getByTestId("pending-count")).toBeDefined();
    expect(screen.getByText("5 pending")).toBeDefined();
  });

  it("does not display pending count when zero", () => {
    render(
      <SyncStatusIndicator state={buildState({ pendingCount: 0 })} />,
    );
    expect(screen.queryByTestId("pending-count")).toBeNull();
  });

  it("displays failed count and inspect button when there are failures", () => {
    const onInspect = vi.fn();
    render(
      <SyncStatusIndicator
        state={buildState({ failedCount: 3 })}
        onInspectFailures={onInspect}
      />,
    );
    expect(screen.getByTestId("failed-count")).toBeDefined();
    expect(screen.getByText("3 failed")).toBeDefined();
    expect(screen.getByTestId("inspect-failures-btn")).toBeDefined();
  });

  it("calls onInspectFailures when inspect button is clicked", () => {
    const onInspect = vi.fn();
    render(
      <SyncStatusIndicator
        state={buildState({ failedCount: 1 })}
        onInspectFailures={onInspect}
      />,
    );
    fireEvent.click(screen.getByTestId("inspect-failures-btn"));
    expect(onInspect).toHaveBeenCalledTimes(1);
  });

  it("does not show inspect button when onInspectFailures is not provided", () => {
    render(
      <SyncStatusIndicator state={buildState({ failedCount: 1 })} />,
    );
    expect(screen.getByTestId("failed-count")).toBeDefined();
    expect(screen.queryByTestId("inspect-failures-btn")).toBeNull();
  });

  it("shows 'Sync now' button when online and onSyncNow is provided", () => {
    const onSync = vi.fn();
    render(
      <SyncStatusIndicator
        state={buildState({ connectivity: "online" })}
        onSyncNow={onSync}
      />,
    );
    expect(screen.getByTestId("sync-now-btn")).toBeDefined();
  });

  it("hides 'Sync now' button when offline", () => {
    const onSync = vi.fn();
    render(
      <SyncStatusIndicator
        state={buildState({ connectivity: "offline" })}
        onSyncNow={onSync}
      />,
    );
    expect(screen.queryByTestId("sync-now-btn")).toBeNull();
  });

  it("shows 'Syncing...' when syncing prop is true", () => {
    render(
      <SyncStatusIndicator state={buildState()} syncing={true} />,
    );
    expect(screen.getByTestId("syncing-indicator")).toBeDefined();
    expect(screen.getByText("Syncing...")).toBeDefined();
  });

  it("shows degraded warning when database is degraded", () => {
    render(
      <SyncStatusIndicator state={buildState({ degraded: true })} />,
    );
    expect(screen.getByTestId("degraded-warning")).toBeDefined();
    expect(screen.getByText("Degraded")).toBeDefined();
  });

  it("calls onSyncNow when 'Sync now' is clicked", () => {
    const onSync = vi.fn();
    render(
      <SyncStatusIndicator
        state={buildState({ connectivity: "online" })}
        onSyncNow={onSync}
      />,
    );
    fireEvent.click(screen.getByTestId("sync-now-btn"));
    expect(onSync).toHaveBeenCalledTimes(1);
  });
});
