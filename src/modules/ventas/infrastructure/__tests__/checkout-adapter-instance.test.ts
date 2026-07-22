import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setDesktopBridge(available: boolean) {
  if (available) {
    const complete = vi.fn().mockResolvedValue({
      success: true,
      sale: {
        id: "sale-99",
        total: "100.00",
        customer: "Mostrador",
        invoiceStatus: "none",
        createdAt: new Date().toISOString(),
      },
      warnings: [],
    });
    (window as any).marketDesktop = {
      sales: { complete, get: vi.fn() },
    };
    return { complete };
  } else {
    delete (window as any).marketDesktop;
    return { complete: vi.fn() };
  }
}

const nonFiscalCheckout = {
  items: [
    {
      kind: "catalog-fixed" as const,
      productId: "prod-1",
      quantity: 2,
    },
  ],
  paymentMethods: [{ method: "cash", amount: "100.00" }],
  invoiceRequested: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkout adapter instance selection", () => {
  afterEach(() => {
    delete (window as any).marketDesktop;
    vi.resetModules();
  });

  describe("when desktop bridge IS available", () => {
    it("selects the desktop checkout adapter that routes through IPC", async () => {
      // Set up the bridge BEFORE importing the module
      const { complete } = setDesktopBridge(true);

      // Now import — the module should detect the bridge and pick the desktop adapter
      const { checkoutAdapter } = await import("../checkout-adapter-instance");

      // If the desktop adapter was selected, calling save() should invoke
      // window.marketDesktop.sales.complete (IPC path).
      // If the API adapter was selected instead (current bug), complete() won't be called.
      await checkoutAdapter.save(nonFiscalCheckout as any);

      // THIS is the assertion that should FAIL before the fix:
      // the desktop bridge's complete() was NOT called because the API adapter
      // is still being selected unconditionally.
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  describe("when desktop bridge is NOT available (browser)", () => {
    it("selects the API checkout adapter (no bridge calls)", async () => {
      setDesktopBridge(false);

      const { checkoutAdapter } = await import("../checkout-adapter-instance");

      // In browser mode, the adapter should NOT attempt IPC.
      // The API adapter will try fetch() which will fail in jsdom,
      // but we just need to verify it doesn't crash trying to access
      // window.marketDesktop.sales.
      expect(checkoutAdapter).toBeDefined();
      expect(typeof checkoutAdapter.save).toBe("function");

      // The adapter should NOT throw when the bridge is absent
      // (the API adapter uses fetch, not the bridge)
    });
  });
});
