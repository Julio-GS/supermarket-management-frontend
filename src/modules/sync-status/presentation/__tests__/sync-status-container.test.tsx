import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SyncStatusContainer } from "../sync-status-container";
import type { SyncState, OutboxEntry, SyncStartResult, RetryResult } from "../../domain/sync-state";

// ---------------------------------------------------------------------------
// Mock useSyncStatus so the container test focuses on composition wiring
// ---------------------------------------------------------------------------

const mockStartSync = vi.fn();
const mockListOutbox = vi.fn();
const mockRetryOutbox = vi.fn();
const mockExportOutbox = vi.fn();
const mockRefresh = vi.fn();

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

let mockState: SyncState = buildState();

vi.mock("../../application/use-sync-status", () => ({
  useSyncStatus: () => ({
    state: mockState,
    startSync: mockStartSync,
    listOutbox: mockListOutbox,
    retryOutbox: mockRetryOutbox,
    exportOutbox: mockExportOutbox,
    refresh: mockRefresh,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubDesktop(): void {
  (window as unknown as Record<string, unknown>).marketDesktop = {
    getConfig: vi.fn().mockReturnValue({ apiBaseUrl: "http://localhost:3000/api/v1" }),
    offline: { getState: vi.fn() },
    sync: { getState: vi.fn(), start: vi.fn(), pull: vi.fn() },
    support: { listOutbox: vi.fn(), retryOutbox: vi.fn(), exportOutbox: vi.fn() },
  };
}

function clearDesktop(): void {
  delete (window as unknown as Record<string, unknown>).marketDesktop;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SyncStatusContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDesktop();
    mockState = buildState();
  });

  describe("browser / non-desktop mode", () => {
    it("returns null when window.marketDesktop is absent", () => {
      const { container } = render(<SyncStatusContainer />);
      // Container should render nothing in browser mode
      expect(container.firstChild).toBeNull();
    });

    it("does not render the connectivity indicator in browser mode", () => {
      render(<SyncStatusContainer />);
      expect(screen.queryByTestId("connectivity-indicator")).toBeNull();
    });
  });

  describe("desktop runtime", () => {
    beforeEach(() => {
      stubDesktop();
    });

    it("renders the connectivity indicator when marketDesktop is present", () => {
      render(<SyncStatusContainer />);
      expect(screen.getByTestId("connectivity-indicator")).toBeDefined();
    });

    it("renders Online text when connectivity is online", () => {
      render(<SyncStatusContainer />);
      expect(screen.getByText("Online")).toBeDefined();
    });

    it("calls startSync when Sync Now button is clicked", async () => {
      mockStartSync.mockResolvedValue({
        synced: 3,
        failed: 0,
        blocked: 0,
        skipped: 0,
        revalidationBlocked: false,
      } as SyncStartResult);

      render(<SyncStatusContainer />);
      const syncBtn = screen.getByTestId("sync-now-btn");

      await act(async () => {
        fireEvent.click(syncBtn);
      });

      expect(mockStartSync).toHaveBeenCalledTimes(1);
    });

    it("shows failed count when failed entries exist", () => {
      mockState = buildState({ failedCount: 3, connectivity: "online" });

      render(<SyncStatusContainer />);

      expect(screen.getByTestId("failed-count")).toBeDefined();
      expect(screen.getByTestId("failed-count").textContent).toContain("3");
    });

    it("opens outbox inspector when Inspect Failures button is clicked", async () => {
      mockState = buildState({ failedCount: 2 });
      mockListOutbox.mockResolvedValue([]);

      render(<SyncStatusContainer />);

      const inspectBtn = screen.getByTestId("inspect-failures-btn");

      await act(async () => {
        fireEvent.click(inspectBtn);
      });

      // Inspector should be visible after clicking inspect
      expect(screen.getByTestId("outbox-inspector")).toBeDefined();
    });
  });
});
