import type { CheckoutPort } from "../application/checkout-port"
import { createApiCheckoutAdapter } from "./api-checkout-adapter"
import { createDesktopCheckoutAdapter, isDesktopSalesAvailable } from "./desktop-checkout-adapter"

const apiAdapter = createApiCheckoutAdapter()
let desktopAdapter: ReturnType<typeof createDesktopCheckoutAdapter> | null = null

function getCheckoutAdapter() {
  if (!isDesktopSalesAvailable()) {
    return apiAdapter
  }

  if (!desktopAdapter) {
    desktopAdapter = createDesktopCheckoutAdapter()
  }

  return desktopAdapter
}

export const checkoutAdapter: CheckoutPort = {
  save(draft) {
    return getCheckoutAdapter().save(draft)
  },
}
