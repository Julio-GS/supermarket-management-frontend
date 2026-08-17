import {
  POS_CATALOG_QUERY_KEY,
  PRODUCTS_QUERY_KEY,
  PROMOTIONS_QUERY_KEY,
  PROVIDER_PURCHASES_LIST_KEY,
  PROVIDER_PURCHASES_REPORT_KEY,
  REPORTS_QUERY_KEY,
  STOCK_QUERY_KEY,
} from "./query-keys"

export interface QueryInvalidator {
  invalidateQueries(params: {
    queryKey: readonly unknown[]
    refetchType?: "active"
  }): Promise<unknown>
}

export async function invalidateDesktopCatalogQueries(
  queryClient: QueryInvalidator,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: PROMOTIONS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: [POS_CATALOG_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [STOCK_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY }),
  ])
}

export async function invalidatePostCheckoutQueries(
  queryClient: QueryInvalidator,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [POS_CATALOG_QUERY_KEY],
      refetchType: "active",
    }),
    queryClient.invalidateQueries({
      queryKey: [PRODUCTS_QUERY_KEY],
      refetchType: "active",
    }),
    queryClient.invalidateQueries({
      queryKey: [STOCK_QUERY_KEY],
      refetchType: "active",
    }),
    queryClient.invalidateQueries({
      queryKey: REPORTS_QUERY_KEY,
      refetchType: "active",
    }),
    queryClient.invalidateQueries({
      queryKey: PROMOTIONS_QUERY_KEY,
      refetchType: "active",
    }),
    queryClient.invalidateQueries({
      queryKey: PROVIDER_PURCHASES_LIST_KEY,
      refetchType: "active",
    }),
    queryClient.invalidateQueries({
      queryKey: ["sync-status"],
      refetchType: "active",
    }),
  ])
}

export async function invalidateStockAdjustmentQueries(
  queryClient: QueryInvalidator,
  productId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [POS_CATALOG_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [STOCK_QUERY_KEY, productId] }),
  ])
}

export async function invalidateProductCatalogQueries(
  queryClient: QueryInvalidator,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [POS_CATALOG_QUERY_KEY] }),
  ])
}

export async function invalidatePromotionAdminQueries(
  queryClient: QueryInvalidator,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] })
}

export async function invalidateProviderPurchaseQueries(
  queryClient: QueryInvalidator,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: PROVIDER_PURCHASES_REPORT_KEY }),
  ])
}
