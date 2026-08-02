import type { CheckoutPort, CheckoutDraft, CheckoutItemDraft } from "../../ventas/application/checkout-port";
import type { Sale, SaleItem, PaymentAllocation, AppliedPromotion } from "../../ventas/domain/sale";
import { parseInvoiceStatus } from "../../ventas/domain/sale";
import type { PaymentMethodCode } from "../../ventas/domain/payment-method";
import type { CheckoutErrorCode } from "../../ventas/domain/checkout-error";
import type { OfflineSaleInput, OfflineSaleItemInput, OfflineSalePaymentInput, OfflineSaleIpcResult } from "@/shared/infrastructure/market-desktop-config";

// ---------------------------------------------------------------------------
// Serialization helpers — convert CheckoutDraft -> OfflineSaleInput
// ---------------------------------------------------------------------------

function serializeCheckoutItem(item: CheckoutItemDraft): OfflineSaleItemInput {
  switch (item.kind) {
    case "catalog-fixed":
      return {
        productId: item.productId,
        name: item.productId, // Will be resolved from local catalog; IPC only requires productId
        quantity: item.quantity,
        unitPrice: "0", // Will be resolved locally; IPC/desktop handles pricing
        subtotal: "0",
        discountAmount: "0",
      };
    case "catalog-manual":
      return {
        productId: item.productId,
        name: item.productId,
        quantity: 1,
        unitPrice: item.lineTotal,
        subtotal: item.lineTotal,
        discountAmount: "0",
      };
    case "ad-hoc":
      return {
        productId: item.draftId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
        discountAmount: "0",
      };
  }
}

function serializePaymentMethod(method: string): string {
  return method;
}

// ---------------------------------------------------------------------------
// Deserialization — convert OfflineSaleIpcResult -> Sale
// ---------------------------------------------------------------------------

function normalizePaymentMethod(method: string): PaymentMethodCode {
  const valid: PaymentMethodCode[] = ["cash", "transfer", "card", "qr"];
  if (valid.includes(method as PaymentMethodCode)) return method as PaymentMethodCode;
  return "cash";
}

function normalizeInvoiceStatus(value: string | undefined): Sale["invoiceStatus"] {
  if (value === "issued" || value === "failed") return value;
  return "none";
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Returns true when the desktop offline sales bridge is available
 * and offline mode is ready.
 */
export function isDesktopSalesAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return window.marketDesktop?.sales?.complete !== undefined;
}

/**
 * Desktop offline checkout adapter.
 *
 * Routes non-fiscal sales through the local IPC sales handler.
 * Fiscal/invoice sales return a FISCAL_BLOCKED error.
 */
export function createDesktopCheckoutAdapter(): CheckoutPort {
  return {
    async save(draft: CheckoutDraft): Promise<Sale> {
      const bridge = window.marketDesktop?.sales;
      if (!bridge) {
        const err = new Error("Desktop sales bridge is not available") as Error & { code: CheckoutErrorCode };
        err.code = "SERVER_ERROR";
        throw err;
      }

      const input: OfflineSaleInput = {
        items: draft.items.map(serializeCheckoutItem),
        payments: draft.paymentMethods.map((pm): OfflineSalePaymentInput => ({
          method: serializePaymentMethod(pm.method),
          amount: pm.amount,
        })),
        invoiceRequested: draft.invoiceRequested,
        total: draft.saleTotal,
      };

      const result: OfflineSaleIpcResult = await bridge.complete(input);

      if (!result.success) {
        if (result.errorCode === "FISCAL_BLOCKED") {
          const err = new Error(result.error ?? "Las ventas con factura requieren conexión. Usá Ticket no fiscal.") as Error & { code: CheckoutErrorCode };
          err.code = "INVOICE_FAILED";
          throw err;
        }
        if (result.errorCode === "OFFLINE_AUTH_REQUIRED") {
          const err = new Error(
            "Sesión offline no disponible. Iniciá sesión con conexión al menos una vez para habilitar el modo sin conexión."
          ) as Error & { code: CheckoutErrorCode };
          err.code = "SERVER_ERROR";
          throw err;
        }
        const err = new Error(result.error ?? "No se pudo completar la venta") as Error & { code: CheckoutErrorCode };
        err.code = "SERVER_ERROR";
        throw err;
      }

      // Map IPC result to domain Sale shape
      const s = result.sale!;
      const sale: Sale = {
        id: s.id,
        createdAt: s.createdAt,
        updatedAt: s.createdAt,
        customer: s.customer,
        items: draft.items.map((item): SaleItem => {
          const base: SaleItem = {
            productId: item.kind === "ad-hoc" ? item.draftId : item.productId,
            name: item.kind === "ad-hoc" ? item.name : item.productId,
            description: item.kind === "ad-hoc" ? item.description : undefined,
            quantity: item.quantity,
            unitPrice: item.kind === "ad-hoc" ? item.unitPrice : "0",
            subtotal: item.kind === "ad-hoc"
              ? (parseFloat(item.unitPrice) * item.quantity).toFixed(2)
              : "0",
            discountAmount: "0.00",
            appliedPromotions: [] as AppliedPromotion[],
            appliedPromotionId: null,
            appliedPromotionType: null,
          };
          return base;
        }),
        total: s.total,
        paymentMethods: draft.paymentMethods.map((pm): PaymentAllocation => ({
          method: normalizePaymentMethod(pm.method),
          amount: pm.amount,
        })),
        invoiceStatus: normalizeInvoiceStatus(s.invoiceStatus),
        cae: null,
        caeVto: null,
        cbteNro: null,
        cbteTipo: null,
        ptoVta: null,
        invoiceRequestedAt: null,
        splitTicketGroups: null,
      };

      // Emit warnings if any
      if (result.warnings && result.warnings.length > 0) {
        for (const w of result.warnings) {
          console.warn("[desktop-checkout]", w);
        }
      }

      return sale;
    },
  };
}
