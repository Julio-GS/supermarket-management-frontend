import type { OfflineProductInput, OfflineProductUpdateInput, OfflineProductResult } from "@/shared/infrastructure/market-desktop-config"

/**
 * Returns true when the desktop products bridge is available.
 */
export function isDesktopProductsAvailable(): boolean {
  if (typeof window === "undefined") return false
  return window.marketDesktop?.products?.create !== undefined
}

/**
 * Desktop offline product repository adapter.
 * Routes product CRUD and search/lookup through the local IPC handler.
 */
export function createDesktopProductAdapter() {
  return {
    async create(input: OfflineProductInput): Promise<OfflineProductResult> {
      const bridge = window.marketDesktop?.products
      if (!bridge) throw new Error("Desktop products bridge is not available")
      return bridge.create(input)
    },

    async update(id: string, input: OfflineProductUpdateInput): Promise<OfflineProductResult> {
      const bridge = window.marketDesktop?.products
      if (!bridge) throw new Error("Desktop products bridge is not available")
      return bridge.update(id, input)
    },

    async delete(id: string): Promise<OfflineProductResult> {
      const bridge = window.marketDesktop?.products
      if (!bridge) throw new Error("Desktop products bridge is not available")
      return bridge.delete(id)
    },

    async list(filters?: { search?: string }): Promise<OfflineProductResult[]> {
      const bridge = window.marketDesktop?.products
      if (!bridge) throw new Error("Desktop products bridge is not available")
      return bridge.list(filters)
    },

    async findByCode(code: string): Promise<OfflineProductResult> {
      const bridge = window.marketDesktop?.products
      if (!bridge) throw new Error("Desktop products bridge is not available")
      return bridge.findByCode(code)
    },

    async get(id: string): Promise<OfflineProductResult> {
      const bridge = window.marketDesktop?.products
      if (!bridge) throw new Error("Desktop products bridge is not available")
      return bridge.get(id)
    },
  }
}
