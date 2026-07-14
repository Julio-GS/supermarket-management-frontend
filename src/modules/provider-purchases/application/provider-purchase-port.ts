import type {
  ProviderPurchase,
  ProviderPurchaseInput,
  ProviderPurchasePatch,
  ProviderPurchaseReport,
  ReportWindow,
} from "../domain/provider-purchase"

export interface ProviderPurchasePort {
  list(): Promise<ProviderPurchase[]>
  create(input: ProviderPurchaseInput): Promise<ProviderPurchase>
  update(id: string, patch: ProviderPurchasePatch): Promise<ProviderPurchase>
  delete(id: string): Promise<void>
  report(window: ReportWindow): Promise<ProviderPurchaseReport>
}
