import type { Sale } from "../domain/sale"

export interface SaleInvoiceRetryPort {
  retryFiscalInvoice(saleId: string): Promise<Sale>
}
