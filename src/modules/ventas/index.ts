// Domain
export type { PaymentMethodCode } from "./domain/payment-method"
export { PAYMENT_METHOD_LABELS, ALL_PAYMENT_METHODS } from "./domain/payment-method"
export type { Sale, SaleItem, SplitTicketGroup, SplitTicketGroupItem } from "./domain/sale"
export type { Cart, CartItem, CartProduct } from "./domain/cart"
export { emptyCart, addItem, changeQuantity, removeItem } from "./domain/cart"
export { calculateTotals, VAT_RATE } from "./domain/totals"
export type { CheckoutError, CheckoutErrorCode } from "./domain/checkout-error"
export { validateSplitGroups } from "./domain/split-validator"
export { deriveDefaultSplitPreview, deriveRowBasedSplitPreview } from "./domain/default-split"
export type { SplitItemGroup, SplitPreviewResult, RowSplitEntry } from "./domain/default-split"

// Application
export type { CatalogProduct, CatalogFilters, CatalogQueryPort } from "./application/catalog-query-port"
export type { CheckoutPort, CheckoutDraft, SplitTicketGroupDraft } from "./application/checkout-port"
export type { SalesHistoryPort, SalesHistoryQuery, SalesPage, PaginationMeta } from "./application/sales-history-port"
export type { SaleDetailPort } from "./application/sale-detail-port"
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

// Composition
export { PosTerminalShell } from "./composition/pos-terminal-shell"

// Presentation
export { PosTerminal } from "./presentation/pos-terminal"
export type { PosTerminalProps } from "./presentation/pos-terminal"
export { PosCheckoutSuccessDialog } from "./presentation/pos-checkout-success-dialog"
export type { PosCheckoutSuccessDialogProps } from "./presentation/pos-checkout-success-dialog"
export type { PosCheckoutSuccess } from "./presentation/use-pos-terminal"
