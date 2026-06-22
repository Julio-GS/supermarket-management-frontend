import type { Sale } from "../domain/sale"

export interface CheckoutPort {
  save(draft: Omit<Sale, "id" | "date">): Promise<Sale>
}
