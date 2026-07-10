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
