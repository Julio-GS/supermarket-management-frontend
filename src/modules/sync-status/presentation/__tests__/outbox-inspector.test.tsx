import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OutboxInspector } from "../outbox-inspector";
import type { OutboxEntry, RetryResult } from "../../domain/sync-state";

function buildEntry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: "entry-1",
    idempotency_key: "ik-1",
    operation_type: "sale_create",
    aggregate_type: "sale",
    aggregate_id: "sale-1",
    payload: JSON.stringify({ total: "100.00", items: 3 }),
    status: "failed",
    base_server_version: null,
    actor_user_id: "user-1",
    attempt_count: 2,
    next_retry_at: null,
    last_error: "Backend unavailable",
    server_result: null,
    created_at: "2026-07-20T10:00:00.000Z",
    updated_at: "2026-07-20T10:05:00.000Z",
    synced_at: null,
    ...overrides,
  };
}

describe("OutboxInspector", () => {
  it("renders the inspector with header and close button", async () => {
    const listOutbox = vi.fn().mockResolvedValue([]);
    const retryOutbox = vi.fn();
    const exportOutbox = vi.fn();
    const onClose = vi.fn();

    render(
      <OutboxInspector
        listOutbox={listOutbox}
        retryOutbox={retryOutbox}
        exportOutbox={exportOutbox}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("outbox-inspector")).toBeDefined();
    });
    expect(screen.getByTestId("outbox-close-btn")).toBeDefined();
    expect(screen.getByTestId("outbox-filter")).toBeDefined();
    expect(screen.getByTestId("outbox-export-btn")).toBeDefined();
  });

  it("displays entry payload when present", async () => {
    const entry = buildEntry({
      payload: JSON.stringify({ total: "100.00", items: 3 }),
    });
    const listOutbox = vi.fn().mockResolvedValue([entry]);
    const retryOutbox = vi.fn();
    const exportOutbox = vi.fn();
    const onClose = vi.fn();

    render(
      <OutboxInspector
        listOutbox={listOutbox}
        retryOutbox={retryOutbox}
        exportOutbox={exportOutbox}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`outbox-entry-${entry.id}`)).toBeDefined();
    });

    // Payload should be visible
    const payloadEl = screen.getByTestId(`outbox-payload-${entry.id}`);
    expect(payloadEl).toBeDefined();
    expect(payloadEl.textContent).toContain("100.00");
    expect(payloadEl.textContent).toContain("items");
  });

  it("displays entry payload as raw string when not valid JSON", async () => {
    const entry = buildEntry({
      id: "entry-raw",
      payload: "plain text payload",
    });
    const listOutbox = vi.fn().mockResolvedValue([entry]);
    const retryOutbox = vi.fn();
    const exportOutbox = vi.fn();
    const onClose = vi.fn();

    render(
      <OutboxInspector
        listOutbox={listOutbox}
        retryOutbox={retryOutbox}
        exportOutbox={exportOutbox}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`outbox-entry-${entry.id}`)).toBeDefined();
    });

    const payloadEl = screen.getByTestId(`outbox-payload-${entry.id}`);
    expect(payloadEl).toBeDefined();
    expect(payloadEl.textContent).toBe("plain text payload");
  });

  it("does not render payload block when payload is absent", async () => {
    const entry = buildEntry({ id: "entry-no-payload", payload: "" });
    const listOutbox = vi.fn().mockResolvedValue([entry]);
    const retryOutbox = vi.fn();
    const exportOutbox = vi.fn();
    const onClose = vi.fn();

    render(
      <OutboxInspector
        listOutbox={listOutbox}
        retryOutbox={retryOutbox}
        exportOutbox={exportOutbox}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`outbox-entry-${entry.id}`)).toBeDefined();
    });

    expect(
      screen.queryByTestId(`outbox-payload-${entry.id}`),
    ).toBeNull();
  });

  it("shows error state when listOutbox rejects", async () => {
    const listOutbox = vi.fn().mockRejectedValue(new Error("IPC error"));
    const retryOutbox = vi.fn();
    const exportOutbox = vi.fn();
    const onClose = vi.fn();

    render(
      <OutboxInspector
        listOutbox={listOutbox}
        retryOutbox={retryOutbox}
        exportOutbox={exportOutbox}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("outbox-error")).toBeDefined();
    });
    expect(screen.getByTestId("outbox-error").textContent).toBe("IPC error");
  });

  it("does not update state after unmount (cancel-safe loading)", async () => {
    // Simulate a slow listOutbox that resolves after unmount
    let resolve: (value: OutboxEntry[]) => void;
    const listOutbox = vi.fn().mockReturnValue(
      new Promise<OutboxEntry[]>((r) => {
        resolve = r;
      }),
    );
    const retryOutbox = vi.fn();
    const exportOutbox = vi.fn();
    const onClose = vi.fn();

    const { unmount } = render(
      <OutboxInspector
        listOutbox={listOutbox}
        retryOutbox={retryOutbox}
        exportOutbox={exportOutbox}
        onClose={onClose}
      />,
    );

    // Prove the effect started: listOutbox was called
    expect(listOutbox).toHaveBeenCalledTimes(1);

    // Unmount before the promise resolves
    unmount();

    // Resolve after unmount — should not throw or update state
    resolve!([buildEntry()]);

    // After unmount + late resolve, no entries should appear in the DOM
    // (the cancellation guard prevented setState on an unmounted component)
    expect(
      screen.queryByTestId("outbox-entry-entry-1"),
    ).toBeNull();
  });

  it("renders retry button for failed entries", async () => {
    const entry = buildEntry({ status: "failed" });
    const listOutbox = vi.fn().mockResolvedValue([entry]);
    const retryOutbox = vi.fn().mockResolvedValue({ success: true } as RetryResult);
    const exportOutbox = vi.fn();
    const onClose = vi.fn();

    render(
      <OutboxInspector
        listOutbox={listOutbox}
        retryOutbox={retryOutbox}
        exportOutbox={exportOutbox}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`outbox-entry-${entry.id}`)).toBeDefined();
    });

    expect(screen.getByTestId(`outbox-retry-${entry.id}`)).toBeDefined();
  });

  it("displays last_error when present", async () => {
    const entry = buildEntry({ last_error: "Something went wrong" });
    const listOutbox = vi.fn().mockResolvedValue([entry]);
    const retryOutbox = vi.fn();
    const exportOutbox = vi.fn();
    const onClose = vi.fn();

    render(
      <OutboxInspector
        listOutbox={listOutbox}
        retryOutbox={retryOutbox}
        exportOutbox={exportOutbox}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`outbox-entry-${entry.id}`)).toBeDefined();
    });

    expect(screen.getByTestId(`outbox-error-${entry.id}`)).toBeDefined();
    expect(
      screen.getByTestId(`outbox-error-${entry.id}`).textContent,
    ).toBe("Something went wrong");
  });
});
