import { useQuery } from "@tanstack/react-query"

import { PROVIDER_PURCHASES_REPORT_KEY } from "@/shared/infrastructure/query-keys"
import type {
  ProviderPurchaseReport,
  ReportWindow,
} from "../domain/provider-purchase"
import { providerPurchaseRepository } from "../infrastructure/provider-purchase-repository-instance"

export function useProviderPurchaseReport(
  window: ReportWindow | null
) {
  const {
    data: report = null,
    isLoading,
    error,
  } = useQuery({
    queryKey: [...PROVIDER_PURCHASES_REPORT_KEY, window],
    queryFn: () => providerPurchaseRepository.report(window!),
    enabled: window !== null,
    retry: false,
  })

  return {
    report: report as ProviderPurchaseReport | null,
    isLoading,
    error: error ?? null,
  }
}
