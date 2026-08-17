import type { Product } from "../domain/product"

/**
 * Neutral display type for a single printable label. Produced by the remote
 * label-print flow (job-backed) and consumed by the print dialog / label
 * renderer. It must not depend on any local label queue.
 */
export interface LabelItem {
  product: Product
  changedAt: Date
  /** Stable key for React list rendering. Set to job.id for remote items. */
  queueKey?: string
}
