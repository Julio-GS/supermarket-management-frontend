import { providerPurchaseRepository as apiRepo } from "./api-provider-purchase-repository"
import {
  createDesktopProviderPurchaseAdapter,
  isDesktopProviderPurchasesAvailable,
} from "./desktop-provider-purchase-adapter"
import type { ProviderPurchase, ProviderPurchaseInput, ProviderPurchasePatch, ProviderPurchaseReport, ReportWindow } from "../domain/provider-purchase"

const desktopAdapter = isDesktopProviderPurchasesAvailable()
  ? createDesktopProviderPurchaseAdapter()
  : null

function unwrapPurchase(result: {
  success: boolean
  purchase?: {
    id: string
    providerName: string
    amount: string
    paymentMethod: string | null
    createdAt: string
    updatedAt: string
  }
  error?: string
}): ProviderPurchase {
  if (!result.success || !result.purchase) throw new Error(result.error ?? "Desktop provider purchase operation failed")
  return result.purchase
}

function unwrapPurchaseList(
  results: {
    success: boolean
    purchase?: ProviderPurchase
    error?: string
  }[],
): ProviderPurchase[] {
  return results.map((r) => unwrapPurchase(r))
}

/**
 * Desktop-first provider purchase repository.
 * When the desktop bridge is available, routes through IPC to the main-process
 * SQLite store. Falls back to the API repository for browser and non-desktop
 * environments. The `report` method always uses the API backend because it
 * depends on server-side aggregation.
 */
export const providerPurchaseRepository = desktopAdapter
  ? {
      list: async (): Promise<ProviderPurchase[]> => {
        const results = await desktopAdapter.list()
        return unwrapPurchaseList(results)
      },

      create: async (input: ProviderPurchaseInput): Promise<ProviderPurchase> => {
        const result = await desktopAdapter.create({
          provider_name: input.providerName,
          amount: input.amount,
          payment_method: input.paymentMethod ?? undefined,
        })
        return unwrapPurchase(result)
      },

      update: async (id: string, patch: ProviderPurchasePatch): Promise<ProviderPurchase> => {
        const result = await desktopAdapter.update(id, {
          provider_name: patch.providerName,
          amount: patch.amount,
          payment_method: patch.paymentMethod,
        })
        return unwrapPurchase(result)
      },

      delete: async (id: string): Promise<void> => {
        const result = await desktopAdapter.delete(id)
        if (!result.success) throw new Error(result.error ?? "Failed to delete provider purchase")
      },

      // Report always uses server-side aggregation — delegate to API repository
      report: async (window: ReportWindow): Promise<ProviderPurchaseReport> => {
        return apiRepo.report(window)
      },
    }
  : apiRepo
