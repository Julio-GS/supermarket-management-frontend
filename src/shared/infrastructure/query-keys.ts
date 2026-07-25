/**
 * Centralized React Query keys for cross-feature usage.
 *
 * Every module owns its own keys here, but in a single shared file so cross-module
 * invalidation does not create coupling between feature folders.
 */

/** Products module — cached under ["products", queryParams] */
export const PRODUCTS_QUERY_KEY = "products"

/** Promotions module — flat list of admin-managed promotions */
export const PROMOTIONS_QUERY_KEY = ["promotions"] as const

/** Provider purchases module — list of provider expense records */
export const PROVIDER_PURCHASES_LIST_KEY = ["provider-purchases"] as const

/** Provider purchases module — windowed spending report */
export const PROVIDER_PURCHASES_REPORT_KEY = ["provider-purchases", "report"] as const

/** POS catalog — cached under ["pos-catalog"] */
export const POS_CATALOG_QUERY_KEY = "pos-catalog"

/** Stock module — root key for targeted stock lookups, used as [STOCK_QUERY_KEY, productId] */
export const STOCK_QUERY_KEY = "stock"

/** Reports module — shared roots for report/dashboard invalidation */
export const REPORTS_QUERY_KEY = ["reports"] as const
export const REPORTS_SALES_SUMMARY_QUERY_KEY = [...REPORTS_QUERY_KEY, "sales-summary"] as const
export const REPORTS_RECENT_SALES_QUERY_KEY = [...REPORTS_QUERY_KEY, "recent-sales"] as const
export const REPORTS_BUSINESS_REPORT_QUERY_KEY = [...REPORTS_QUERY_KEY, "business-report"] as const
