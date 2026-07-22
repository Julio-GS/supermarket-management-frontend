import { createApiCheckoutAdapter } from "./api-checkout-adapter"
import { createDesktopCheckoutAdapter, isDesktopSalesAvailable } from "./desktop-checkout-adapter"

export const checkoutAdapter = isDesktopSalesAvailable()
  ? createDesktopCheckoutAdapter()
  : createApiCheckoutAdapter()
