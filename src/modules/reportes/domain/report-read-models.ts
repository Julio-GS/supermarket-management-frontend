export interface SalesByDay {
  day: string
  sales: number
  transactions: number
}

export interface TopProduct {
  name: string
  units: number
  revenue: number
}

export interface SalesSummary {
  salesByDay: SalesByDay[]
}

export interface ReportStats {
  monthlyRevenue: number
  averageTicket: number
  grossMargin: number
  annualGrowth: number
}

export interface RecentSale {
  id: string
  date: string
  customer: string
  /** Backend-safe payment method codes (e.g. ["cash", "card"]) */
  paymentMethods: string[]
  /** Decimal string from backend (e.g. "7501.50") */
  total: string
}

export interface LowStockProduct {
  id: string
  name: string
  stock: number
  stockMinimum: number
  unit: string
}
