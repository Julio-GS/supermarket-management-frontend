import { apiRequest } from "@/shared/infrastructure/api-client"
import type { ProviderPurchasePort } from "../application/provider-purchase-port"
import {
  toBackend,
  toBackendPatch,
  toDomain,
  toDomainReport,
  type BackendProviderPurchaseDto,
  type BackendProviderPurchaseReportDto,
  type ProviderPurchase,
  type ProviderPurchaseInput,
  type ProviderPurchasePatch,
  type ProviderPurchaseReport,
  type ReportWindow,
} from "../domain/provider-purchase"

export class ApiProviderPurchaseRepository implements ProviderPurchasePort {
  async list(): Promise<ProviderPurchase[]> {
    const response = await apiRequest<BackendProviderPurchaseDto[]>(
      "/reports/provider-purchases"
    )
    return (response ?? []).map(toDomain)
  }

  async create(input: ProviderPurchaseInput): Promise<ProviderPurchase> {
    const response = await apiRequest<BackendProviderPurchaseDto>(
      "/reports/provider-purchases",
      {
        method: "POST",
        body: JSON.stringify(toBackend(input)),
      }
    )
    return toDomain(response)
  }

  async update(
    id: string,
    patch: ProviderPurchasePatch
  ): Promise<ProviderPurchase> {
    const response = await apiRequest<BackendProviderPurchaseDto>(
      `/reports/provider-purchases/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(toBackendPatch(patch)),
      }
    )
    return toDomain(response)
  }

  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/reports/provider-purchases/${id}`, {
      method: "DELETE",
    })
  }

  async report(window: ReportWindow): Promise<ProviderPurchaseReport> {
    const response = await apiRequest<BackendProviderPurchaseReportDto>(
      `/reports/provider-purchases/report?window=${window}`
    )
    return toDomainReport(response)
  }
}

export const providerPurchaseRepository = new ApiProviderPurchaseRepository()
