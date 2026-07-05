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
  /** Backend allocation objects (e.g. [{ method: "cash", amount: "4000.00" }]) */
  paymentMethods: { method: string; amount: string }[]
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

// ---- Reports module types (real /reports endpoint) ----

export type ReportWindow = "day" | "week" | "month"

export interface ReportRange {
  startsAt: string // ISO 8601 with Argentina offset
  endsAt: string   // ISO 8601 with Argentina offset
}

export interface BusinessReportBreakdownItem {
  method: string
  amount: string
}

export interface BusinessReportTopProduct {
  productId: string
  detalle: string
  units_sold: number
}

export interface BusinessReport {
  window: ReportWindow
  range: ReportRange
  totalCollectedAmount: string
  paymentMethodBreakdown: BusinessReportBreakdownItem[]
  topProducts: BusinessReportTopProduct[]
}
