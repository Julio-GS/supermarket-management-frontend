import type { OfflineProviderPurchaseInput, OfflineProviderPurchaseUpdateInput, OfflineProviderPurchaseResult } from "@/shared/infrastructure/market-desktop-config"

export function isDesktopProviderPurchasesAvailable(): boolean {
  if (typeof window === "undefined") return false
  return window.marketDesktop?.providerPurchases?.create !== undefined
}

export function createDesktopProviderPurchaseAdapter() {
  return {
    async create(input: OfflineProviderPurchaseInput): Promise<OfflineProviderPurchaseResult> {
      const bridge = window.marketDesktop?.providerPurchases
      if (!bridge) throw new Error("Desktop provider purchases bridge is not available")
      return bridge.create(input)
    },

    async update(id: string, input: OfflineProviderPurchaseUpdateInput): Promise<OfflineProviderPurchaseResult> {
      const bridge = window.marketDesktop?.providerPurchases
      if (!bridge) throw new Error("Desktop provider purchases bridge is not available")
      return bridge.update(id, input)
    },

    async list(): Promise<OfflineProviderPurchaseResult[]> {
      const bridge = window.marketDesktop?.providerPurchases
      if (!bridge) throw new Error("Desktop provider purchases bridge is not available")
      return bridge.list()
    },

    async delete(id: string): Promise<OfflineProviderPurchaseResult> {
      const bridge = window.marketDesktop?.providerPurchases
      if (!bridge) throw new Error("Desktop provider purchases bridge is not available")
      return bridge.delete(id)
    },
  }
}
