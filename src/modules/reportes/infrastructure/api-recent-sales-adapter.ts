import { createApiSalesRepository } from "@/modules/ventas"
import type { RecentSalesPort, RecentSalesResult } from "../application/recent-sales-port"

/**
 * Creates a RecentSalesPort backed by the real API.
 * Uses the ventas module's api-sales-repository to fetch sales
 * and maps them into the reportes domain read models.
 * API data is always considered "live".
 */
export function createApiRecentSalesAdapter(): RecentSalesPort {
  const salesRepo = createApiSalesRepository()

  return {
    async getRecentSales(limit = 6): Promise<RecentSalesResult> {
      const page = await salesRepo.getSales({ limit, sort: "desc" })
      return {
        sales: page.data.map((sale) => ({
          id: sale.id,
          date: sale.createdAt,
          customer: sale.customer,
          paymentMethods: sale.paymentMethods,
          total: sale.total,
        })),
        staleness: "live",
      }
    },
  }
}
