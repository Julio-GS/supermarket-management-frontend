/** Immutable snapshot of a remote label print job as received from the backend. */
export interface RemoteLabelJob {
  id: string
  product_id: string
  sku: string
  product_name: string
  /** Decimal string from the backend — parse with Number() or parseFloat before arithmetic. */
  sale_price: string
  /** Installation that currently holds the lease (null when pending). */
  claimed_by: string | null
  lease_expires_at: string | null
  status: "pending" | "claimed" | "completed" | "failed"
}

/**
 * Validate a remote sale_price string from the backend.
 * Accepts only finite, non-negative decimal values (e.g. "150.00", "0.00").
 * Rejects NaN, Infinity, -Infinity, negative numbers, and non-numeric strings.
 */
export function isValidSalePrice(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const num = Number.parseFloat(trimmed)
  if (!Number.isFinite(num)) return false
  if (num < 0) return false
  // Reject inputs that parse to NaN via Number or look like Infinity/-Infinity
  if (isNaN(Number(trimmed))) return false
  return true
}

/** Maximum number of jobs to claim per batch via one-at-a-time loop. */
export const MAX_CLAIM_BATCH = 45

/** Lease duration sent to the claim endpoint (5 minutes). */
export const CLAIM_LEASE_MS = 300_000
