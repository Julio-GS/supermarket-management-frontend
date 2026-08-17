/** Immutable snapshot of a remote label print job as received from the backend. */
export type RemoteLabelJobStatus =
  | "pending"
  | "claimed"
  | "completed"
  | "failed"
  | "blocked_for_review"

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
  status: RemoteLabelJobStatus
  /** Audit fields populated when the job is terminal `blocked_for_review`. */
  blocked_reason: string | null
  blocked_by: string | null
  blocked_at: string | null
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

/** Lease duration sent to the legacy claim/claim-batch endpoint (5 minutes, milliseconds). */
export const CLAIM_LEASE_MS = 300_000

/** Lease duration sent to claim-batch/continue as `lease_seconds` (5 minutes). */
export const CLAIM_LEASE_SECONDS = 300
