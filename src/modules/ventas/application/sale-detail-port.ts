import type { Sale } from "../domain/sale"

export interface SaleDetailPort {
  getById(id: string): Promise<Sale>
}
