import type {
  CategoryTotal,
  LowStockProduct,
  RecentSale,
  ReportStats,
  SalesByDay,
  TopProduct,
} from "../domain/report-read-models"

export const seedSalesByDay: SalesByDay[] = [
  { day: "Lun", sales: 3240, transactions: 182 },
  { day: "Mar", sales: 2980, transactions: 165 },
  { day: "Mié", sales: 3620, transactions: 201 },
  { day: "Jue", sales: 4120, transactions: 228 },
  { day: "Vie", sales: 5380, transactions: 297 },
  { day: "Sáb", sales: 6890, transactions: 372 },
  { day: "Dom", sales: 4510, transactions: 246 },
]

export const seedCategoryTotals: CategoryTotal[] = [
  { category: "Frutas y Verduras", total: 8420 },
  { category: "Lácteos", total: 6310 },
  { category: "Carnes", total: 7890 },
  { category: "Bebidas", total: 5240 },
  { category: "Despensa", total: 4680 },
  { category: "Limpieza", total: 3120 },
]

export const seedTopProducts: TopProduct[] = [
  { name: "Leche Entera 1L", units: 1240, revenue: 1364 },
  { name: "Pan de Molde", units: 980, revenue: 2058 },
  { name: "Agua Mineral 1.5L", units: 1860, revenue: 1581 },
  { name: "Pechuga de Pollo", units: 420, revenue: 2604 },
  { name: "Arroz 1kg", units: 760, revenue: 1292 },
]

export const seedRecentSales: RecentSale[] = [
  {
    id: "V-10428",
    date: "2026-06-21 14:32",
    customer: "Mostrador",
    paymentMethod: "Tarjeta",
    total: 42.6,
  },
  {
    id: "V-10427",
    date: "2026-06-21 14:18",
    customer: "Mostrador",
    paymentMethod: "Efectivo",
    total: 12.85,
  },
  {
    id: "V-10426",
    date: "2026-06-21 13:55",
    customer: "Restaurante La Plaza",
    paymentMethod: "Transferencia",
    total: 156.3,
  },
  {
    id: "V-10425",
    date: "2026-06-21 13:40",
    customer: "Mostrador",
    paymentMethod: "Tarjeta",
    total: 28.4,
  },
  {
    id: "V-10424",
    date: "2026-06-21 13:12",
    customer: "Mostrador",
    paymentMethod: "Efectivo",
    total: 9.6,
  },
  {
    id: "V-10423",
    date: "2026-06-21 12:48",
    customer: "Mostrador",
    paymentMethod: "Tarjeta",
    total: 64.2,
  },
  {
    id: "V-10422",
    date: "2026-06-21 12:30",
    customer: "Cafetería Sol",
    paymentMethod: "Transferencia",
    total: 98.75,
  },
  {
    id: "V-10421",
    date: "2026-06-21 12:05",
    customer: "Mostrador",
    paymentMethod: "Efectivo",
    total: 18.3,
  },
]

export const seedLowStockProducts: LowStockProduct[] = [
  { id: "P002", name: "Plátano", category: "Frutas y Verduras", stock: 18, stockMinimum: 40, unit: "kg" },
  { id: "P005", name: "Yogur Natural 500g", category: "Lácteos", stock: 12, stockMinimum: 25, unit: "u" },
  { id: "P008", name: "Carne Molida Res", category: "Carnes", stock: 6, stockMinimum: 20, unit: "kg" },
  { id: "P013", name: "Jugo de Naranja 1L", category: "Bebidas", stock: 9, stockMinimum: 30, unit: "u" },
  { id: "P018", name: "Pasta Espagueti 500g", category: "Despensa", stock: 4, stockMinimum: 50, unit: "u" },
]

export const seedReportStats: ReportStats = {
  monthlyRevenue: 128640,
  averageTicket: 23.8,
  grossMargin: 38.4,
  annualGrowth: 22.6,
}
