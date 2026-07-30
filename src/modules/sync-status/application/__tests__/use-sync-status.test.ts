import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@/test/render";
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
    vi.useRealTimers();
    clearToken();
    delete (window as unknown as Record<string, unknown>).marketDesktop;
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("refreshes sync state even when sync.start rejects", async () => {
    setToken("test-jwt-token");

    const syncStart = vi.fn().mockRejectedValue(new Error("Sync failed"));
    const syncGetState = vi
      .fn()
      .mockResolvedValueOnce({
        pendingCount: 2,
        failedCount: 1,
        revalidationRequired: false,
        lastSyncAt: "2026-07-20T10:00:00.000Z",
      })
      .mockResolvedValueOnce({
        pendingCount: 0,
        failedCount: 2,
        revalidationRequired: true,
        lastSyncAt: "2026-07-20T10:05:00.000Z",
      });

    stubDesktopBridge({
      sync: {
        getState: syncGetState,
        start: syncStart,
      },
    });

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.state.failedCount).toBe(1);
    });

    await act(async () => {
      await expect(result.current.startSync()).rejects.toThrow("Sync failed");
    });

    await waitFor(() => {
      expect(result.current.state.failedCount).toBe(2);
      expect(result.current.state.lastSyncAt).toBe("2026-07-20T10:05:00.000Z");
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

  it("invalidates desktop catalog queries after a successful sync", async () => {
    setToken("test-jwt-token");
    stubDesktopBridge();
    const invalidateQueries = vi
      .spyOn(QueryClient.prototype, "invalidateQueries")
      .mockResolvedValue();

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.state.connectivity).toBe("online");
    });

    await act(async () => {
      await result.current.startSync();
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(4);

    invalidateQueries.mockRestore();
  });

  it("runs an initial auto-sync and repeats it every minute once ready", async () => {
    vi.useFakeTimers();
    setToken("test-jwt-token");
    const syncStart = vi.fn().mockResolvedValue({
      synced: 3,
      failed: 0,
      blocked: 0,
      skipped: 0,
      revalidationBlocked: false,
    });
    stubDesktopBridge({
      sync: {
        getState: vi.fn().mockResolvedValue({
          pendingCount: 0,
          failedCount: 0,
          revalidationRequired: false,
          lastSyncAt: "2026-07-20T10:00:00.000Z",
        }),
        start: syncStart,
      },
    });

    const { result } = renderHook(() =>
      useSyncStatus({
        token: "test-jwt-token",
        apiBaseUrl: "http://localhost:3000/api/v1",
        autoSyncEnabled: true,
      }),
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state.connectivity).toBe("online");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(syncStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(syncStart).toHaveBeenCalledTimes(2);
  });

  it("does not auto-sync while the desktop reports offline connectivity", async () => {
    vi.useFakeTimers();
    setToken("test-jwt-token");
    const syncStart = vi.fn().mockResolvedValue({
      synced: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      revalidationBlocked: false,
    });

    stubDesktopBridge({
      offline: {
        getState: vi.fn().mockResolvedValue({
          ready: true,
          bootstrap: "complete",
          connectivity: "offline",
          sync: "idle",
          pendingCount: 2,
          failureCount: 0,
          degraded: false,
          lastSyncAt: null,
        }),
      },
      sync: {
        getState: vi.fn().mockResolvedValue({
          pendingCount: 2,
          failedCount: 0,
          revalidationRequired: false,
          lastSyncAt: null,
        }),
        start: syncStart,
      },
    });

    renderHook(() =>
      useSyncStatus({
        token: "test-jwt-token",
        apiBaseUrl: "http://localhost:3000/api/v1",
        autoSyncEnabled: true,
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(syncStart).not.toHaveBeenCalled();
  });

  it("does not auto-sync while connectivity is unknown", async () => {
    vi.useFakeTimers();
    setToken("test-jwt-token");
    const syncStart = vi.fn().mockResolvedValue({
      synced: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      revalidationBlocked: false,
    });

    stubDesktopBridge({
      offline: {
        getState: vi.fn().mockResolvedValue({
          ready: true,
          bootstrap: "complete",
          connectivity: "unknown",
          sync: "idle",
          pendingCount: 0,
          failureCount: 0,
          degraded: false,
          lastSyncAt: null,
        }),
      },
      sync: {
        getState: vi.fn().mockResolvedValue({
          pendingCount: 0,
          failedCount: 0,
          revalidationRequired: false,
          lastSyncAt: null,
        }),
        start: syncStart,
      },
    });

    renderHook(() =>
      useSyncStatus({
        token: "test-jwt-token",
        apiBaseUrl: "http://localhost:3000/api/v1",
        autoSyncEnabled: true,
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(syncStart).not.toHaveBeenCalled();
  });

  it("does not auto-sync while connectivity is reconnecting", async () => {
    vi.useFakeTimers();
    setToken("test-jwt-token");
    const syncStart = vi.fn().mockResolvedValue({
      synced: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      revalidationBlocked: false,
    });

    stubDesktopBridge({
      offline: {
        getState: vi.fn().mockResolvedValue({
          ready: true,
          bootstrap: "complete",
          connectivity: "reconnecting",
          sync: "idle",
          pendingCount: 0,
          failureCount: 0,
          degraded: false,
          lastSyncAt: null,
        }),
      },
      sync: {
        getState: vi.fn().mockResolvedValue({
          pendingCount: 0,
          failedCount: 0,
          revalidationRequired: false,
          lastSyncAt: null,
        }),
        start: syncStart,
      },
    });

    renderHook(() =>
      useSyncStatus({
        token: "test-jwt-token",
        apiBaseUrl: "http://localhost:3000/api/v1",
        autoSyncEnabled: true,
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(syncStart).not.toHaveBeenCalled();
  });

  it("does not start another sync while an auto-sync is still in flight", async () => {
    vi.useFakeTimers();
    setToken("test-jwt-token");

    let resolveSync: ((value: unknown) => void) | null = null;
    const syncStart = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        }),
    );

    stubDesktopBridge({
      sync: {
        getState: vi.fn().mockResolvedValue({
          pendingCount: 0,
          failedCount: 0,
          revalidationRequired: false,
          lastSyncAt: "2026-07-20T10:00:00.000Z",
        }),
        start: syncStart,
      },
    });

    const { result } = renderHook(() =>
      useSyncStatus({
        token: "test-jwt-token",
        apiBaseUrl: "http://localhost:3000/api/v1",
        autoSyncEnabled: true,
      }),
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state.connectivity).toBe("online");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(syncStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(syncStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSync?.({
        synced: 1,
        failed: 0,
        blocked: 0,
        skipped: 0,
        revalidationBlocked: false,
      });
      await Promise.resolve();
    });
  });
});
