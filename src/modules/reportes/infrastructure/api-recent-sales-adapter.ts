import { createApiSalesRepository } from "@/modules/ventas"
import type { RecentSale } from "../domain/report-read-models"
import type { RecentSalesPort } from "../application/recent-sales-port"

/**
 * Creates a RecentSalesPort backed by the real API.
 * Uses the ventas module's api-sales-repository to fetch sales
 * and maps them into the reportes domain read models.
 */
export function createApiRecentSalesAdapter(): RecentSalesPort {
  const salesRepo = createApiSalesRepository()

  return {
    async getRecentSales(limit = 6): Promise<RecentSale[]> {
      const page = await salesRepo.getSales({ limit, sort: "desc" })
      return page.data.map((sale) => ({
        id: sale.id,
        date: sale.createdAt,
        customer: sale.customer,
        paymentMethods: sale.paymentMethods,
        total: sale.total,
      }))
    },
  }
}
