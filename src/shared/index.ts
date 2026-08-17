// Shared module public API — re-exports for UI/presentation consumers that
// cannot import infrastructure directly.
export { getAccessToken } from "./infrastructure/auth-token-store";
export { resolveDesktopApiBaseUrlByNullish } from "./infrastructure/runtime-api-config";
export {
  PRODUCTS_QUERY_KEY,
  PROMOTIONS_QUERY_KEY,
  PROVIDER_PURCHASES_LIST_KEY,
  PROVIDER_PURCHASES_REPORT_KEY,
  POS_CATALOG_QUERY_KEY,
  STOCK_QUERY_KEY,
  REPORTS_QUERY_KEY,
  REPORTS_SALES_SUMMARY_QUERY_KEY,
  REPORTS_RECENT_SALES_QUERY_KEY,
  REPORTS_BUSINESS_REPORT_QUERY_KEY,
} from "./infrastructure/query-keys";
