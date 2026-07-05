import { apiRequest } from "@/shared/infrastructure/api-client"
import type { BusinessReportPort } from "../application/business-report-port"
import type { BusinessReport, ReportWindow } from "../domain/report-read-models"

export function createApiBusinessReportAdapter(): BusinessReportPort {
  return {
    async getReport(window: ReportWindow): Promise<BusinessReport> {
      const data = await apiRequest<BusinessReport>(`/reports?window=${window}`)
      return data
    },
  }
}
