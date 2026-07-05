import type { Sale } from "../domain/sale"

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
}

export interface SalesPage {
  data: Sale[]
  meta?: PaginationMeta
}

export interface SalesHistoryQuery {
  page?: number
  limit?: number
  sort?: string
}

export interface SalesHistoryPort {
  getSales(query?: SalesHistoryQuery): Promise<SalesPage>
}
