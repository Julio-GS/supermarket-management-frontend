/**
 * Browser/API idempotent product creation domain types and helpers.
 *
 * Desktop product creation routes through window.marketDesktop.products.create
 * and does NOT participate in the HTTP idempotency contract. These types are
 * only relevant for the browser/API adapter path.
 */

/** Backend label_status values from POST /api/v1/products response. */
export type ProductCreationLabelStatus = "pending" | "not_required" | "unknown"

/** Lightweight label job info from creation response. */
export interface ProductCreationLabelJob {
  id: string
  product_id: string
  product_name?: string
  sku?: string
  sale_price?: string | null
}

/** Result of an idempotent product creation attempt. */
export interface ProductCreationResult {
  product: import("./product").Product
  labelStatus: ProductCreationLabelStatus
  labelJob: ProductCreationLabelJob | null
}

/** Locally persisted pending creation operation. */
export interface PendingProductCreationOperationV1 {
  version: 1
  id: string
  idempotencyKey: string
  serializedPayload: string
  createdAt: string
  updatedAt: string
  attempts: number
}

/** Stable wire for the persisted operations store. */
export interface PendingCreationStore {
  version: 1
  operations: PendingProductCreationOperationV1[]
}

/**
 * Typed error surfaced when a new product submission conflicts with a locally
 * persisted pending creation (the same idempotency key would be reused for a
 * different logical product). The pending operation is intentionally preserved
 * so the operator can explicitly recover it instead of silently overwriting it.
 */
export class PendingCreationConflictError extends Error {
  readonly code = "PENDING_CREATION_CONFLICT" as const
  readonly pendingKey: string

  constructor(pendingKey: string, message: string) {
    super(message)
    this.name = "PendingCreationConflictError"
    this.pendingKey = pendingKey
  }
}

const STORE_KEY = "supermarket-management:productos:pending-product-creation:v1"

/** Generate a stable UUID v4 for the Idempotency-Key. */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: crypto.getRandomValues-based UUID v4
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-")
}

/** Read persisted pending operations from localStorage. */
export function readPendingCreations(): PendingCreationStore {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return { version: 1, operations: [] }
    const parsed = JSON.parse(raw)
    if (parsed?.version === 1 && Array.isArray(parsed.operations)) {
      return parsed as PendingCreationStore
    }
    return { version: 1, operations: [] }
  } catch {
    return { version: 1, operations: [] }
  }
}

/** Write pending operations to localStorage. */
export function writePendingCreations(store: PendingCreationStore): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    // localStorage full or unavailable — non-fatal
  }
}

/** Remove a specific operation from the persisted store by idempotencyKey. */
export function removePendingCreation(idempotencyKey: string): void {
  const store = readPendingCreations()
  store.operations = store.operations.filter(
    (op) => op.idempotencyKey !== idempotencyKey
  )
  writePendingCreations(store)
}
