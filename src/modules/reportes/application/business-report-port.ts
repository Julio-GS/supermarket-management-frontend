import type { BusinessReport, ReportWindow } from "../domain/report-read-models"

export interface BusinessReportPort {
  getReport(window: ReportWindow): Promise<BusinessReport>
}
