export interface MarketDesktopRuntimeConfig {
  apiBaseUrl: string
  frontendDevUrl?: string
  appVersion?: string
  updateEnabled?: boolean
}

export interface BootstrapResult {
  status: "pending" | "in_progress" | "complete" | "failed"
  ready: boolean
  syncCursor: string | null
  error?: string
}

export interface OfflineState {
  ready: boolean
  bootstrap: "pending" | "in_progress" | "complete" | "failed"
  connectivity: "online" | "offline" | "unknown" | "reconnecting"
  sync: "idle" | "syncing" | "error"
  pendingCount: number
  failureCount: number
  degraded: boolean
  lastSyncAt: string | null
}

export interface OfflineSession {
  user_id: string
  username: string
  last_validated_at: string
  created_at: string
  updated_at: string
  password_hash?: string | null
}

export interface OfflineLoginResult {
  success: boolean
  userId?: string
  username?: string
  /** JWT access token — only present on successful online login. */
  token?: string
  /** True when authenticated locally (no network). */
  offlineMode?: boolean
  error?: string
}

export interface OfflineSaleItemInput {
  productId: string
  name: string
  description?: string
  quantity: number
  unitPrice: string
  subtotal: string
  discountAmount: string
}

export interface OfflineSalePaymentInput {
  method: string
  amount: string
}

export interface OfflineSaleInput {
  items: OfflineSaleItemInput[]
  payments: OfflineSalePaymentInput[]
  invoiceRequested: boolean
  total: string
}

export interface OfflineSaleIpcResult {
  success: boolean
  sale?: SaleDesktopRecord
  warnings?: string[]
  error?: string
  errorCode?: string
}

// ---------------------------------------------------------------------------
// Product IPC types (Slice 5)
// ---------------------------------------------------------------------------

export interface OfflineProductInput {
  detalle: string
  costo_neto?: string | null
  costo_final?: string | null
  iva?: string | null
  cambio_costo?: string
  cambio_precio?: string
  etiqueta?: string
  facturable?: boolean
  maneja_stock?: boolean
  codigos?: string[]
}

export interface OfflineProductUpdateInput {
  detalle?: string
  costo_neto?: string | null
  costo_final?: string | null
  iva?: string | null
  cambio_costo?: string
  cambio_precio?: string
  etiqueta?: string
  facturable?: boolean
  maneja_stock?: boolean
  codigos?: string[]
}

export interface OfflineProductResult {
  success: boolean
  product?: {
    id: string
    detalle: string
    costoNeto: string | null
    costoFinal: string | null
    iva: string | null
    cambioCosto: string
    cambioPrecio: string
    etiqueta: string
    facturable: boolean
    manejaStock: boolean
    codigos: string[]
    pricingMode: string
    isProtected: boolean
    stock?: number | null
    createdAt: string
    updatedAt: string
  }
  error?: string
}

// ---------------------------------------------------------------------------
// Promotion IPC types (Slice 5)
// ---------------------------------------------------------------------------

export interface OfflinePromotionInput {
  name: string
  description?: string | null
  scope?: string
  product_id?: string | null
  type: string
  discount_percent?: number | null
  start_date?: string | null
  end_date?: string | null
  weekdays?: number[] | null
}

export interface OfflinePromotionUpdateInput {
  name?: string
  description?: string | null
  scope?: string
  product_id?: string | null
  type?: string
  discount_percent?: number | null
  start_date?: string | null
  end_date?: string | null
  weekdays?: number[] | null
  enabled?: boolean
}

export interface OfflinePromotionResult {
  success: boolean
  promotion?: {
    id: string
    name: string
    description: string | null
    scope: string
    productId: string | null
    type: string
    discountPercent: number | null
    startDate: string | null
    endDate: string | null
    weekdays: number[] | null
    enabled: boolean
    createdAt: string
    updatedAt: string
  }
  error?: string
}

// ---------------------------------------------------------------------------
// Provider purchase IPC types (Slice 5)
// ---------------------------------------------------------------------------

export interface OfflineProviderPurchaseInput {
  provider_name: string
  amount: string
  payment_method?: string
}

export interface OfflineProviderPurchaseUpdateInput {
  provider_name?: string
  amount?: string
  payment_method?: string | null
}

export interface OfflineProviderPurchaseResult {
  success: boolean
  purchase?: {
    id: string
    providerName: string
    amount: string
    paymentMethod: string | null
    createdAt: string
    updatedAt: string
  }
  error?: string
}

// ---------------------------------------------------------------------------
// Report IPC types (Slice 5)
// ---------------------------------------------------------------------------

export interface OfflineReportResult<T = unknown> {
  success: boolean
  data?: T
  staleness?: "live" | "stale" | "unavailable"
  stalenessReason?: string
  error?: string
}

export interface OfflineSalesSummary {
  totalSales: number
  totalRevenue: string
  periodStart: string
  periodEnd: string
}

export interface OfflineRecentSale {
  id: string
  total: string
  customer: string
  invoiceStatus: string
  createdAt: string
}

export interface SaleDesktopRecord {
  id: string
  total: string
  customer: string
  invoiceStatus: "none" | "issued" | "failed"
  createdAt: string
  updatedAt: string
  items: Array<{
    productId: string
    name: string
    description?: string
    quantity: number
    unitPrice: string
    subtotal: string
    discountAmount: string
    appliedPromotions: Array<{
      promotionId: string
      promotionScope: "product" | "store"
      promotionType: "percentage" | "two_x_one"
      discountAmount: string
    }>
    appliedPromotionId: string | null
    appliedPromotionType: string | null
  }>
  paymentMethods: Array<{
    method: string
    amount: string
  }>
  splitTicketGroups: null
  cae: string | null
  caeVto: string | null
  cbteNro: string | null
  cbteTipo: string | null
  ptoVta: string | null
  invoiceRequestedAt: string | null
  invoiceRequested?: boolean
  syncStatus?: string | null
}

export interface StockMovementDesktopRecord {
  id: string
  productId: string
  quantity: number
  type: "adjustment"
  referenceId: null
  previousStock: number
  newStock: number
  reason: string | null
  createdAt: string
}

declare global {
  interface Window {
    __MARKET_DESKTOP_CONFIG__?: MarketDesktopRuntimeConfig
    marketDesktop?: {
      getConfig(): MarketDesktopRuntimeConfig
      platform?: NodeJS.Platform
      offline?: {
        getState(): Promise<OfflineState>
        getSession(): Promise<OfflineSession | null>
        login(params: { username: string; password: string; apiBaseUrl: string }): Promise<OfflineLoginResult>
        checkConnectivity?(params: { apiBaseUrl: string }): Promise<{ connectivity: OfflineState["connectivity"] }>
      }
      bootstrap?: {
        status(): Promise<BootstrapResult>
        start(params: { token: string; apiBaseUrl: string }): Promise<BootstrapResult>
        resume(params: { token: string; apiBaseUrl: string }): Promise<BootstrapResult>
      }
      sales?: {
        complete(input: OfflineSaleInput): Promise<OfflineSaleIpcResult>
        get(saleId: string): Promise<OfflineSaleIpcResult>
        list(): Promise<SaleDesktopRecord[]>
      }
      stock?: {
        get(productId: string): Promise<number | null>
        adjust(input: { productId: string; quantity: number; reason?: string }): Promise<StockMovementDesktopRecord>
      }
      sync?: {
        getState(): Promise<{ pendingCount: number; failedCount: number; revalidationRequired: boolean; lastSyncAt: string | null }>
        start(params?: { apiBaseUrl?: string; token?: string }): Promise<{ synced: number; failed: number; blocked: number; skipped: number; revalidationBlocked: boolean }>
        pull(params?: { apiBaseUrl?: string; token?: string }): Promise<{ applied: number; skipped: number; cursor: string | null; hasMore: boolean }>
      }
      products?: {
        create(input: OfflineProductInput): Promise<OfflineProductResult>
        update(id: string, input: OfflineProductUpdateInput): Promise<OfflineProductResult>
        delete(id: string): Promise<OfflineProductResult>
        list(filters?: { search?: string }): Promise<OfflineProductResult[]>
        get(id: string): Promise<OfflineProductResult>
        findByCode(code: string): Promise<OfflineProductResult>
      }
      promotions?: {
        create(input: OfflinePromotionInput): Promise<OfflinePromotionResult>
        update(id: string, input: OfflinePromotionUpdateInput): Promise<OfflinePromotionResult>
        delete(id: string): Promise<OfflinePromotionResult>
        list(): Promise<OfflinePromotionResult[]>
      }
      providerPurchases?: {
        create(input: OfflineProviderPurchaseInput): Promise<OfflineProviderPurchaseResult>
        update(id: string, input: OfflineProviderPurchaseUpdateInput): Promise<OfflineProviderPurchaseResult>
        delete(id: string): Promise<OfflineProviderPurchaseResult>
        list(): Promise<OfflineProviderPurchaseResult[]>
      }
      reports?: {
        getSalesSummary(): Promise<OfflineReportResult<OfflineSalesSummary>>
        getRecentSales(limit?: number): Promise<OfflineReportResult<OfflineRecentSale[]>>
        getStaleness(): Promise<OfflineReportResult<{ lastSyncAt: string | null; pendingCount: number; isStale: boolean }>>
      }
          support?: {
            listOutbox(filter?: { status?: string }): Promise<Array<{
              id: string
              idempotency_key: string
              operation_type: string
              aggregate_type: string
              aggregate_id: string
              payload: string
              status: string
              base_server_version: string | null
              actor_user_id: string | null
              attempt_count: number
              next_retry_at: string | null
              last_error: string | null
              server_result: string | null
              created_at: string
              updated_at: string
              synced_at: string | null
            }>>
            retryOutbox(id: string): Promise<{ success: boolean; error?: string }>
            exportOutbox(): Promise<Array<{
              id: string
              idempotency_key: string
              operation_type: string
              aggregate_type: string
              aggregate_id: string
              payload: string
              status: string
              base_server_version: string | null
              actor_user_id: string | null
              attempt_count: number
              next_retry_at: string | null
              last_error: string | null
              server_result: string | null
              created_at: string
              updated_at: string
              synced_at: string | null
            }>>
          }

    }
  }
}

export {}
