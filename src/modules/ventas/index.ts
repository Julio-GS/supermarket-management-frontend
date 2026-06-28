// Domain
export type { PaymentMethod } from "./domain/payment-method"
export { paymentMethods } from "./domain/payment-method"
export type { Sale, SaleItem } from "./domain/sale"
export type { Cart, CartItem, CartProduct } from "./domain/cart"
export { emptyCart, addItem, changeQuantity, removeItem } from "./domain/cart"
export { calculateTotals, VAT_RATE } from "./domain/totals"
export type { CheckoutError, CheckoutErrorCode } from "./domain/checkout-error"

// Application
export type { CatalogProduct, CatalogFilters, CatalogQueryPort } from "./application/catalog-query-port"
export type { CheckoutPort } from "./application/checkout-port"
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

// Composition
export { PosTerminalShell } from "./composition/pos-terminal-shell"

// Presentation
export { PosTerminal } from "./presentation/pos-terminal"
export type { PosTerminalProps } from "./presentation/pos-terminal"
