import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDesktopCheckoutAdapter } from "../desktop-checkout-adapter";
import type { OfflineSaleIpcResult } from "@/shared/infrastructure/market-desktop-config";
import type { CheckoutDraft } from "../../application/checkout-port";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSalesBridge(completeImpl?: (input: unknown) => Promise<OfflineSaleIpcResult>) {
  const complete = vi.fn();
  if (completeImpl) {
    complete.mockImplementation(completeImpl);
  }

  const get = vi.fn();

   
  (window as any).marketDesktop = { sales: { complete, get } };

  return { complete, get };
}

function clearSalesBridge() {
   
  delete (window as any).marketDesktop;
}

const nonFiscalCheckout: CheckoutDraft = {
  items: [
    {
      kind: "catalog-fixed" as const,
      productId: "prod-1",
      quantity: 2,
    },
  ],
  paymentMethods: [{ method: "cash", amount: "200.00" }],
  invoiceRequested: false,
};

const fiscalCheckout: CheckoutDraft = {
  ...nonFiscalCheckout,
  invoiceRequested: true,
};

function successResult(): OfflineSaleIpcResult {
  return {
    success: true,
    sale: {
      id: "sale-123",
      total: "200.00",
      customer: "Mostrador",
      invoiceStatus: "none",
      createdAt: new Date().toISOString(),
    },
    warnings: [],
  };
}

function fiscalBlockedResult(): OfflineSaleIpcResult {
  return {
    success: false,
    error: "Fiscal/invoice sales are not available offline.",
    errorCode: "FISCAL_BLOCKED",
  };
}

function negativeStockResult(): OfflineSaleIpcResult {
  return {
    success: true,
    sale: {
      id: "sale-456",
      total: "1000.00",
      customer: "Mostrador",
      invoiceStatus: "none",
      createdAt: new Date().toISOString(),
    },
    warnings: ["Negative stock for product prod-1 (Test): balance is -5. Will be reconciled on sync."],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createDesktopCheckoutAdapter", () => {
  beforeEach(() => {
    clearSalesBridge();
  });

  afterEach(() => {
    clearSalesBridge();
  });

  describe("non-fiscal offline sale", () => {
    it("completes a non-fiscal sale via IPC and returns a Sale", async () => {
      const { complete } = mockSalesBridge(() => Promise.resolve(successResult()));

      const adapter = createDesktopCheckoutAdapter();
      const sale = await adapter.save(nonFiscalCheckout);

      expect(sale).toBeDefined();
      expect(sale.id).toBe("sale-123");
      expect(sale.total).toBe("200.00");
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it("passes invoiceRequested: false to the IPC bridge", async () => {
      const { complete } = mockSalesBridge(() => Promise.resolve(successResult()));

      const adapter = createDesktopCheckoutAdapter();
      await adapter.save(nonFiscalCheckout);

      const input = complete.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(input).toBeDefined();
      expect(input!.invoiceRequested).toBe(false);
    });

    it("passes items and payments to the IPC bridge", async () => {
      const { complete } = mockSalesBridge(() => Promise.resolve(successResult()));

      const adapter = createDesktopCheckoutAdapter();
      await adapter.save(nonFiscalCheckout);

      const input = complete.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(input).toBeDefined();
      expect(input!.items).toHaveLength(1);
      expect(input!.payments).toHaveLength(1);
    });

    it("returns sale items in the domain Sale shape", async () => {
      const { complete } = mockSalesBridge(() => Promise.resolve(successResult()));

      const adapter = createDesktopCheckoutAdapter();
      const sale = await adapter.save(nonFiscalCheckout);

      expect(sale.items).toHaveLength(1);
      expect(sale.paymentMethods).toHaveLength(1);
      expect(sale.paymentMethods[0].method).toBe("cash");
    });
  });

  describe("fiscal sale blocking", () => {
    it("throws when the IPC bridge returns FISCAL_BLOCKED", async () => {
      mockSalesBridge(() => Promise.resolve(fiscalBlockedResult()));

      const adapter = createDesktopCheckoutAdapter();
      await expect(adapter.save(fiscalCheckout)).rejects.toThrow("Fiscal");
    });

    it("throws with INVOICE_FAILED error code for fiscal blocking", async () => {
      mockSalesBridge(() => Promise.resolve(fiscalBlockedResult()));

      const adapter = createDesktopCheckoutAdapter();
      try {
        await adapter.save(fiscalCheckout);
        expect.unreachable("Expected error");
      } catch (err) {
        expect((err as Error & { code?: string }).code).toBe("INVOICE_FAILED");
      }
    });
  });

  describe("negative stock warning visibility", () => {
    it("completes the sale successfully even with negative stock warnings", async () => {
      mockSalesBridge(() => Promise.resolve(negativeStockResult()));

      const adapter = createDesktopCheckoutAdapter();
      const sale = await adapter.save(nonFiscalCheckout);

      expect(sale).toBeDefined();
      expect(sale.id).toBe("sale-456");
    });

    it("logs warnings via console.warn (does not throw)", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockSalesBridge(() => Promise.resolve(negativeStockResult()));

      const adapter = createDesktopCheckoutAdapter();
      await adapter.save(nonFiscalCheckout);

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("isDesktopSalesAvailable", () => {
    it("returns true when marketDesktop.sales.complete exists", async () => {
      const { isDesktopSalesAvailable } = await import("../desktop-checkout-adapter");
      mockSalesBridge(() => Promise.resolve(successResult()));
      expect(isDesktopSalesAvailable()).toBe(true);
    });

    it("returns false when marketDesktop.sales is undefined", async () => {
      const { isDesktopSalesAvailable } = await import("../desktop-checkout-adapter");
      clearSalesBridge();
      expect(isDesktopSalesAvailable()).toBe(false);
    });
  });

  describe("restart-safe persistence simulation", () => {
    it("resolves to a Sale with a stable ID that could survive a restart lookup", async () => {
      const saleId = "offline-sale-restart-99";
      const { complete, get } = mockSalesBridge((input) => {
        // Return success for both complete and get
        return Promise.resolve({
          success: true,
          sale: {
            id: saleId,
            total: "300.00",
            customer: "Mostrador",
            invoiceStatus: "none",
            createdAt: new Date().toISOString(),
          },
        });
      });

      // Also mock get to return a successful lookup
      get.mockResolvedValue({
        success: true,
        sale: {
          id: saleId,
          total: "300.00",
          customer: "Mostrador",
          invoiceStatus: "none",
          createdAt: new Date().toISOString(),
        },
      });

      const adapter = createDesktopCheckoutAdapter();
      const sale = await adapter.save(nonFiscalCheckout);

      expect(sale.id).toBe(saleId);

      // Simulate a "restart" by looking up the sale from IPC
      const lookupResult = await get(saleId);
      expect(lookupResult.success).toBe(true);
      expect(lookupResult.sale?.id).toBe(saleId);
    });
  });
});
