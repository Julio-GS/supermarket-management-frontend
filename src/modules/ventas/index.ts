// Domain
export type { PaymentMethodCode } from "./domain/payment-method"
export { PAYMENT_METHOD_LABELS, ALL_PAYMENT_METHODS } from "./domain/payment-method"
export type { Sale, SaleItem, AppliedPromotion, SplitTicketGroup, SplitTicketGroupItem, PaymentAllocation, InvoiceStatus } from "./domain/sale"
export { INVOICE_STATUSES, isInvoiceStatus, parseInvoiceStatus, canRetryFiscalInvoice, requiresFiscalReconciliation } from "./domain/sale"
export type { Cart, CartItem, CartProduct, CatalogCartItem, AdHocCartItem } from "./domain/cart"
export { emptyCart, addItem, addAdHocItem, changeQuantity, removeItem, removeAdHocItem, isCatalogItem, isAdHocItem } from "./domain/cart"
export type { AdHocItemDraft, AdHocValidationErrors } from "./domain/ad-hoc-item"
export { validateAdHocName, validateAdHocPrice, validateAdHocQuantity, validateAdHocDraft, validateAdHocDrafts, computeAdHocSubtotal } from "./domain/ad-hoc-item"
export { calculateTotals, VAT_RATE } from "./domain/totals"
export type { CheckoutError, CheckoutErrorCode } from "./domain/checkout-error"
export { validateSplitGroups } from "./domain/split-validator"
export { deriveDefaultSplitPreview, deriveRowBasedSplitPreview } from "./domain/default-split"
export type { SplitItemGroup, SplitPreviewResult, RowSplitEntry } from "./domain/default-split"
export type { CheckoutTicketSnapshot, PrintableTicket } from "./domain/ticket"
export { buildPrintableTickets } from "./domain/ticket-builder"
export { saleToCheckoutTicketSnapshot } from "./domain/sale-to-ticket-snapshot"
export type { CaeExpirationDisplay } from "./domain/cae-expiration-formatter"
export { formatCaeExpirationDateOnly } from "./domain/cae-expiration-formatter"

// Application
export type { CatalogProduct, CatalogFilters, CatalogQueryPort } from "./application/catalog-query-port"
export type { CheckoutPort, CheckoutDraft, CheckoutItemDraft, SplitTicketGroupDraft, ItemSplitTicketDraft, CatalogFixedCheckoutItem, CatalogManualCheckoutItem, AdHocCheckoutItem } from "./application/checkout-port"
export type { SalesHistoryPort, SalesHistoryQuery, SalesPage, PaginationMeta } from "./application/sales-history-port"
export type { SaleDetailPort } from "./application/sale-detail-port"
export type { SaleInvoiceRetryPort } from "./application/sale-invoice-retry-port"
export { usePosCheckout } from "./application/use-pos-checkout"
export type {
  UsePosCheckoutOptions,
  UsePosCheckoutResult,
  CheckoutInput,
} from "./application/use-pos-checkout"

// Infrastructure
export { catalogQueryAdapter } from "./infrastructure/catalog-query-adapter"
export { createMockCheckoutAdapter } from "./infrastructure/mock-checkout-adapter"
export { createApiCheckoutAdapter } from "./infrastructure/api-checkout-adapter"
export { checkoutAdapter } from "./infrastructure/checkout-adapter-instance"
export { createApiSalesRepository } from "./infrastructure/api-sales-repository"
export type { ApiSalesRepository } from "./infrastructure/api-sales-repository"
export { BrowserTicketPrinter } from "./infrastructure/browser-ticket-printer"

// Composition
export { PosTerminalShell } from "./composition/pos-terminal-shell"

// Presentation
export { PosTerminal } from "./presentation/pos-terminal"
export type { PosTerminalProps } from "./presentation/pos-terminal"
export { PosCheckoutSuccessDialog } from "./presentation/pos-checkout-success-dialog"
export type { PosCheckoutSuccessDialogProps } from "./presentation/pos-checkout-success-dialog"
export {
  FiscalInvoiceDetailPanel,
  FiscalInvoiceHistoryIndicator,
  FiscalInvoiceStatusBadge,
} from "./presentation/fiscal-invoice-status"
export type { PosCheckoutSuccess } from "./presentation/use-pos-terminal"
