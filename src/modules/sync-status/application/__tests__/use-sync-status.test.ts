import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSyncStatus } from "../use-sync-status";

// ---------------------------------------------------------------------------
// Helper: stub window.marketDesktop
// ---------------------------------------------------------------------------

function stubDesktopBridge(overrides: Record<string, unknown> = {}) {
  const defaults = {
    getConfig: () => ({ apiBaseUrl: "http://localhost:3000/api/v1" }),
    offline: {
      getState: async () => ({
        ready: true,
        bootstrap: "complete",
        connectivity: "online",
        sync: "idle",
        pendingCount: 2,
        failureCount: 1,
        degraded: false,
        lastSyncAt: "2026-07-20T10:00:00.000Z",
      }),
    },
    sync: {
      getState: async () => ({
        pendingCount: 2,
        failedCount: 1,
        revalidationRequired: false,
        lastSyncAt: "2026-07-20T10:00:00.000Z",
      }),
      start: vi.fn().mockResolvedValue({
        synced: 3,
        failed: 0,
        blocked: 0,
        skipped: 0,
        revalidationBlocked: false,
      }),
    },
    support: {
      listOutbox: vi.fn().mockResolvedValue([]),
      retryOutbox: vi.fn(),
      exportOutbox: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  };

  (window as unknown as Record<string, unknown>).marketDesktop = defaults;
}

// ---------------------------------------------------------------------------
// Helper: token store
// ---------------------------------------------------------------------------

function setToken(token: string) {
  window.localStorage.setItem("sg-access-token", token);
}

function clearToken() {
  window.localStorage.removeItem("sg-access-token");
}

describe("useSyncStatus — token forwarding", () => {
  beforeEach(() => {
    clearToken();
    delete (window as unknown as Record<string, unknown>).marketDesktop;
  });

  afterEach(() => {
    clearToken();
    delete (window as unknown as Record<string, unknown>).marketDesktop;
  });

  it("passes the stored token to sync.start when available", async () => {
    setToken("test-jwt-token");
    stubDesktopBridge();

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.state.connectivity).toBe("online");
    });

    let syncResult: unknown;
    await act(async () => {
      syncResult = await result.current.startSync();
    });

    const syncStart = (window as unknown as Record<string, unknown>).marketDesktop as {
      sync: { start: ReturnType<typeof vi.fn> };
    };

    expect(syncStart.sync.start).toHaveBeenCalledWith({
      apiBaseUrl: "http://localhost:3000/api/v1",
      token: "test-jwt-token",
    });

    expect(syncResult).toEqual({
      synced: 3,
      failed: 0,
      blocked: 0,
      skipped: 0,
      revalidationBlocked: false,
    });
  });

  it("passes undefined token when no token is stored", async () => {
    clearToken();
    stubDesktopBridge();

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.state.connectivity).toBe("online");
    });

    await act(async () => {
      await result.current.startSync();
    });

    const syncStart = (window as unknown as Record<string, unknown>).marketDesktop as {
      sync: { start: ReturnType<typeof vi.fn> };
    };

    expect(syncStart.sync.start).toHaveBeenCalledWith({
      apiBaseUrl: "http://localhost:3000/api/v1",
      token: undefined,
    });
  });

  it("returns safe stub result when desktop bridge is absent", async () => {
    clearToken();
    delete (window as unknown as Record<string, unknown>).marketDesktop;

    const { result } = renderHook(() => useSyncStatus());

    // Wait for the initial poll to settle
    await waitFor(() => {
      expect(result.current.state.connectivity).toBe("online");
    });

    let syncResult: unknown;
    await act(async () => {
      syncResult = await result.current.startSync();
    });

    expect(syncResult).toEqual({
      synced: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      revalidationBlocked: false,
    });
  });
});
