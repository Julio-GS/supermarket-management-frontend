import type { OfflinePromotionInput, OfflinePromotionUpdateInput, OfflinePromotionResult } from "@/shared/infrastructure/market-desktop-config"

export function isDesktopPromotionsAvailable(): boolean {
  if (typeof window === "undefined") return false
  return window.marketDesktop?.promotions?.create !== undefined
}

export function createDesktopPromotionAdapter() {
  return {
    async create(input: OfflinePromotionInput): Promise<OfflinePromotionResult> {
      const bridge = window.marketDesktop?.promotions
      if (!bridge) throw new Error("Desktop promotions bridge is not available")
      return bridge.create(input)
    },

    async update(id: string, input: OfflinePromotionUpdateInput): Promise<OfflinePromotionResult> {
      const bridge = window.marketDesktop?.promotions
      if (!bridge) throw new Error("Desktop promotions bridge is not available")
      return bridge.update(id, input)
    },

    async delete(id: string): Promise<OfflinePromotionResult> {
      const bridge = window.marketDesktop?.promotions
      if (!bridge) throw new Error("Desktop promotions bridge is not available")
      return bridge.delete(id)
    },

    async list(): Promise<OfflinePromotionResult[]> {
      const bridge = window.marketDesktop?.promotions
      if (!bridge) throw new Error("Desktop promotions bridge is not available")
      return bridge.list()
    },
  }
}
