export interface PrintableLabelProduct {
  id: string
  name: string
  sku: string
  price: number
}

/**
 * Neutral display type for a single printable label. Produced by the remote
 * label-print flow (job-backed) and consumed by the print dialog / label
 * renderer. It must not depend on any local label queue.
 */
export interface LabelItem {
  product: PrintableLabelProduct
  changedAt: Date
  /** Stable key for React list rendering. Set to job.id for remote items. */
  queueKey?: string
}
