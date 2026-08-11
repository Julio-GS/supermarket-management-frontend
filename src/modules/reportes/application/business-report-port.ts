import type { BusinessReport, ReportQuery } from "../domain/report-read-models"

export interface BusinessReportPort {
  getReport(query: ReportQuery): Promise<BusinessReport>
}
