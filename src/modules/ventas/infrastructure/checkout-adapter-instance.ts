import type { CheckoutDraft, CheckoutPort } from "../application/checkout-port"
import { createApiCheckoutAdapter } from "./api-checkout-adapter"
import { createDesktopCheckoutAdapter, isDesktopSalesAvailable } from "./desktop-checkout-adapter"

const apiAdapter = createApiCheckoutAdapter()
let desktopAdapter: ReturnType<typeof createDesktopCheckoutAdapter> | null = null

function getDesktopAdapter() {
  if (!desktopAdapter) {
    desktopAdapter = createDesktopCheckoutAdapter()
  }

  return desktopAdapter
}

async function getCheckoutAdapter(draft: CheckoutDraft) {
  if (!isDesktopSalesAvailable()) {
    return apiAdapter
  }

  if (!draft.invoiceRequested) {
    return getDesktopAdapter()
  }

  try {
    const state = await window.marketDesktop?.offline?.getState?.()

    if (state?.connectivity === "online") {
      return apiAdapter
    }
  } catch {
    // Route fiscal sales to the desktop adapter so the offline flow can surface its existing blocked message.
  }

  return getDesktopAdapter()
}

export const checkoutAdapter: CheckoutPort = {
  async save(draft) {
    return (await getCheckoutAdapter(draft)).save(draft)
  },
}
