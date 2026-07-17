// ── Domain types ──────────────────────────────────────────────────────────────

export interface ProviderPurchaseInput {
  providerName: string
  amount: string
  paymentMethod?: string | null
}

export type ProviderPurchasePatch = Partial<ProviderPurchaseInput>

export interface ProviderPurchase {
  id: string
  providerName: string
  amount: string
  paymentMethod: string | null
  createdAt: string
  updatedAt: string
}

export type ReportWindow = "day" | "week" | "month"

export interface ProviderPurchaseReportRange {
  startsAt: string
  endsAt: string
}

export interface PaymentMethodBreakdown {
  method: string
  amount: string
}

export interface ProviderPurchaseReport {
  window: ReportWindow
  range: ProviderPurchaseReportRange
  totalAmount: string
  purchaseCount: number
  paymentMethodBreakdown: PaymentMethodBreakdown[]
}

// ── Backend DTO (snake_case) ────────────────────────────────────────────────

export interface BackendProviderPurchaseDto {
  id: string
  provider_name: string
  amount: string
  payment_method: string | null
  created_at: string
  updated_at: string
}

export interface BackendProviderPurchaseReportDto {
  window: string
  range:
    | { startsAt: string; endsAt: string }
    | { starts_at: string; ends_at: string }
  totalAmount?: string
  total_amount?: string
  purchaseCount?: number
  purchase_count?: number
  paymentMethodBreakdown?: { method: string; amount: string }[]
  payment_method_breakdown?: { method: string; amount: string }[]
}

// ── DTO Normalization ───────────────────────────────────────────────────────

export function toDomain(dto: BackendProviderPurchaseDto): ProviderPurchase {
  return {
    id: dto.id,
    providerName: dto.provider_name,
    amount: dto.amount,
    paymentMethod: dto.payment_method,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  }
}

export function toDomainReport(
  dto: BackendProviderPurchaseReportDto
): ProviderPurchaseReport {
  const range = "startsAt" in dto.range
    ? dto.range
    : {
        startsAt: dto.range.starts_at,
        endsAt: dto.range.ends_at,
      }

  return {
    window: dto.window as ReportWindow,
    range: {
      startsAt: range.startsAt,
      endsAt: range.endsAt,
    },
    totalAmount: dto.totalAmount ?? dto.total_amount ?? "0",
    purchaseCount: dto.purchaseCount ?? dto.purchase_count ?? 0,
    paymentMethodBreakdown: (
      dto.paymentMethodBreakdown ?? dto.payment_method_breakdown ?? []
    ).map((pm) => ({
      method: pm.method,
      amount: pm.amount,
    })),
  }
}

// ── Backend serialization ───────────────────────────────────────────────────

export function toBackend(
  input: ProviderPurchaseInput
): Omit<BackendProviderPurchaseDto, "id" | "created_at" | "updated_at"> {
  return {
    provider_name: input.providerName,
    amount: input.amount,
    payment_method:
      input.paymentMethod === "" ? null : (input.paymentMethod ?? null),
  }
}

export function toBackendPatch(
  patch: ProviderPurchasePatch
): Partial<
  Omit<BackendProviderPurchaseDto, "id" | "created_at" | "updated_at">
> {
  const backendPatch: Partial<
    Omit<BackendProviderPurchaseDto, "id" | "created_at" | "updated_at">
  > = {}

  if (patch.providerName !== undefined) {
    backendPatch.provider_name = patch.providerName
  }
  if (patch.amount !== undefined) {
    backendPatch.amount = patch.amount
  }
  if (patch.paymentMethod !== undefined) {
    backendPatch.payment_method =
      patch.paymentMethod === "" ? null : patch.paymentMethod
  }

  return backendPatch
}

// ── Validation ──────────────────────────────────────────────────────────────

export interface ProviderPurchaseInputErrors {
  providerName?: string
  amount?: string
}

export function validateProviderPurchaseInput(
  input: ProviderPurchaseInput
): ProviderPurchaseInputErrors {
  const errors: ProviderPurchaseInputErrors = {}

  if (input.providerName.trim() === "") {
    errors.providerName = "El nombre del proveedor es obligatorio."
  }

  const amountNum = Number.parseFloat(input.amount)
  if (Number.isNaN(amountNum) || amountNum <= 0) {
    errors.amount = "El monto debe ser un número positivo."
  }

  return errors
}

// ── Patch Builder ───────────────────────────────────────────────────────────

export function buildProviderPurchasePatch(
  previous: ProviderPurchase,
  next: ProviderPurchaseInput
): ProviderPurchasePatch {
  const patch: ProviderPurchasePatch = {}

  if (next.providerName !== previous.providerName) {
    patch.providerName = next.providerName
  }

  if (next.amount !== previous.amount) {
    patch.amount = next.amount
  }

  const nextPM =
    next.paymentMethod === "" ? null : (next.paymentMethod ?? null)
  if (nextPM !== previous.paymentMethod) {
    patch.paymentMethod = nextPM
  }

  return patch
}
