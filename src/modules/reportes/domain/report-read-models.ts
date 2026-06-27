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
  paymentMethod: string
  total: number
}

export interface LowStockProduct {
  id: string
  name: string
  stock: number
  stockMinimum: number
  unit: string
}
