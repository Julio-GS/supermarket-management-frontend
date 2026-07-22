// Domain
export type {
  ProviderPurchase,
  ProviderPurchaseInput,
  ProviderPurchasePatch,
  ProviderPurchaseReport,
  ProviderPurchaseReportRange,
  PaymentMethodBreakdown,
  ReportWindow,
} from "./domain/provider-purchase"
export {
  toDomain,
  toDomainReport,
  toBackend,
  toBackendPatch,
  validateProviderPurchaseInput,
  buildProviderPurchasePatch,
} from "./domain/provider-purchase"

// Application
export type { ProviderPurchasePort } from "./application/provider-purchase-port"
export { useProviderPurchases } from "./application/use-provider-purchases"
export { useProviderPurchaseReport } from "./application/use-provider-purchase-report"

// Infrastructure
export {
  ApiProviderPurchaseRepository,
} from "./infrastructure/api-provider-purchase-repository"
export {
  providerPurchaseRepository,
} from "./infrastructure/provider-purchase-repository-instance"

// Composition
export { ProviderPurchasesShell } from "./composition/provider-purchases-shell"

// Presentation
export { ProviderPurchasesTable } from "./presentation/provider-purchases-table"
export { ProviderPurchaseFormDialog } from "./presentation/provider-purchase-form-dialog"
export { ProviderPurchaseReportWidget } from "./presentation/provider-purchase-report-widget"
