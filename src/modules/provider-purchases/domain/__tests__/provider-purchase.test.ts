import { describe, expect, it } from "vitest"
import {
  toDomain,
  validateProviderPurchaseInput,
  buildProviderPurchasePatch,
  type BackendProviderPurchaseDto,
  type ProviderPurchase,
  type ProviderPurchaseInput,
} from "../provider-purchase"

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDto(
  overrides: Partial<BackendProviderPurchaseDto> = {}
): BackendProviderPurchaseDto {
  return {
    id: "pp-1",
    provider_name: "Distribuidora ABC",
    amount: "15000.00",
    payment_method: "transferencia",
    created_at: "2026-07-10T12:00:00.000Z",
    updated_at: "2026-07-10T12:00:00.000Z",
    ...overrides,
  }
}

function makePurchase(
  overrides: Partial<ProviderPurchase> = {}
): ProviderPurchase {
  return {
    id: "pp-1",
    providerName: "Distribuidora ABC",
    amount: "15000.00",
    paymentMethod: "transferencia",
    createdAt: "2026-07-10T12:00:00.000Z",
    updatedAt: "2026-07-10T12:00:00.000Z",
    ...overrides,
  }
}

// ── DTO Normalization ──────────────────────────────────────────────────────

describe("toDomain", () => {
  it("converts snake_case DTO fields to camelCase domain", () => {
    const dto = makeDto()

    const result = toDomain(dto)

    expect(result).toEqual({
      id: "pp-1",
      providerName: "Distribuidora ABC",
      amount: "15000.00",
      paymentMethod: "transferencia",
      createdAt: "2026-07-10T12:00:00.000Z",
      updatedAt: "2026-07-10T12:00:00.000Z",
    })
  })

  it("maps null payment_method to null paymentMethod", () => {
    const dto = makeDto({ payment_method: null })

    const result = toDomain(dto)

    expect(result.paymentMethod).toBeNull()
  })

  it("preserves all string fields as-is from DTO", () => {
    const dto = makeDto({
      provider_name: "  Distribuidora XYZ  ",
      amount: "99.99",
    })

    const result = toDomain(dto)

    expect(result.providerName).toBe("  Distribuidora XYZ  ")
    expect(result.amount).toBe("99.99")
  })
})

// ── Validation ─────────────────────────────────────────────────────────────

describe("validateProviderPurchaseInput", () => {
  it("returns no errors for valid input", () => {
    const input: ProviderPurchaseInput = {
      providerName: "Distribuidora X",
      amount: "15000",
    }

    expect(validateProviderPurchaseInput(input)).toEqual({})
  })

  it("returns an error for empty provider name", () => {
    const errors = validateProviderPurchaseInput({
      providerName: "",
      amount: "100",
    })

    expect(errors.providerName).toBeDefined()
  })

  it("returns an error for whitespace-only provider name", () => {
    const errors = validateProviderPurchaseInput({
      providerName: "   ",
      amount: "100",
    })

    expect(errors.providerName).toBeDefined()
  })

  it("returns an error for zero amount", () => {
    const errors = validateProviderPurchaseInput({
      providerName: "X",
      amount: "0",
    })

    expect(errors.amount).toBeDefined()
  })

  it("returns an error for negative amount", () => {
    const errors = validateProviderPurchaseInput({
      providerName: "X",
      amount: "-500",
    })

    expect(errors.amount).toBeDefined()
  })

  it("returns an error for non-numeric amount", () => {
    const errors = validateProviderPurchaseInput({
      providerName: "X",
      amount: "abc",
    })

    expect(errors.amount).toBeDefined()
  })

  it("allows empty string amount to fall through as error", () => {
    const errors = validateProviderPurchaseInput({
      providerName: "X",
      amount: "",
    })

    expect(errors.amount).toBeDefined()
  })

  it("accepts optional payment method", () => {
    const errors = validateProviderPurchaseInput({
      providerName: "X",
      amount: "100",
      paymentMethod: "transferencia",
    })

    expect(errors).toEqual({})
  })

  it("accepts null payment method (clearing)", () => {
    const errors = validateProviderPurchaseInput({
      providerName: "X",
      amount: "100",
      paymentMethod: null,
    })

    expect(errors).toEqual({})
  })
})

// ── Patch Builder ──────────────────────────────────────────────────────────

describe("buildProviderPurchasePatch", () => {
  it("returns empty object when nothing changed", () => {
    const prev = makePurchase()

    const patch = buildProviderPurchasePatch(prev, {
      providerName: prev.providerName,
      amount: prev.amount,
      paymentMethod: prev.paymentMethod,
    })

    expect(patch).toEqual({})
  })

  it("includes only changed fields", () => {
    const prev = makePurchase()

    const patch = buildProviderPurchasePatch(prev, {
      providerName: "Nuevo nombre",
      amount: prev.amount,
      paymentMethod: prev.paymentMethod,
    })

    expect(patch).toEqual({ providerName: "Nuevo nombre" })
  })

  it("detects amount change as string", () => {
    const prev = makePurchase()

    const patch = buildProviderPurchasePatch(prev, {
      providerName: prev.providerName,
      amount: "9999.99",
      paymentMethod: prev.paymentMethod,
    })

    expect(patch).toEqual({ amount: "9999.99" })
  })

  it("sends null when payment method is cleared", () => {
    const prev = makePurchase({ paymentMethod: "transferencia" })

    const patch = buildProviderPurchasePatch(prev, {
      providerName: prev.providerName,
      amount: prev.amount,
      paymentMethod: null,
    })

    expect(patch).toEqual({ paymentMethod: null })
  })

  it("sends empty string when payment method is set to empty", () => {
    const prev = makePurchase({ paymentMethod: "transferencia" })

    const patch = buildProviderPurchasePatch(prev, {
      providerName: prev.providerName,
      amount: prev.amount,
      paymentMethod: "",
    })

    // Empty string should NOT be sent (design says clearing sends null, never empty string)
    // But if user explicitly sets "" the patch should reflect that as null
    expect(patch.paymentMethod).toBeNull()
  })

  it("detects payment method change from null to a value", () => {
    const prev = makePurchase({ paymentMethod: null })

    const patch = buildProviderPurchasePatch(prev, {
      providerName: prev.providerName,
      amount: prev.amount,
      paymentMethod: "efectivo",
    })

    expect(patch).toEqual({ paymentMethod: "efectivo" })
  })

  it("handles all three fields changing at once", () => {
    const prev = makePurchase()

    const patch = buildProviderPurchasePatch(prev, {
      providerName: "Otro Proveedor",
      amount: "50000",
      paymentMethod: "qr",
    })

    expect(patch).toEqual({
      providerName: "Otro Proveedor",
      amount: "50000",
      paymentMethod: "qr",
    })
  })
})
