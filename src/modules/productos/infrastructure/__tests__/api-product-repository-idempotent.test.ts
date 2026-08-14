import { describe, expect, it, vi, beforeEach } from "vitest"
import { createApiProductRepository } from "../api-product-repository"
import { PendingCreationConflictError } from "../../domain/product-creation-operation"

vi.mock("@/shared/infrastructure/auth-token-store", () => ({
  getAccessToken: vi.fn(() => "token123"),
  clearAccessToken: vi.fn(),
}))

const STORE_KEY = "supermarket-management:productos:pending-product-creation:v1"
const FAKE_UUID = "550e8400-e29b-41d4-a716-446655440000"

/**
 * Seed a pending operation whose payload matches the given product input's
 * stable identity (cambio_costo/cambio_precio are stripped by stablePayloadIdentity).
 * Used to exercise terminal-error cleanup without tripping the different-payload guard.
 */
function seedMatchingOperation(
  input: { name: string; sku: string; price: number; manejaStock: boolean },
  key = FAKE_UUID
) {
  const payload = {
    detalle: input.name,
    codigos: [input.sku],
    costo_final: input.price.toFixed(2),
    costo_neto: "0.00",
    iva: "0.00",
    cambio_costo: "seeded",
    cambio_precio: "seeded",
    facturable: true,
    maneja_stock: input.manejaStock,
    etiqueta: "true",
  }
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({
      version: 1,
      operations: [
        {
          version: 1,
          id: key,
          idempotencyKey: key,
          serializedPayload: JSON.stringify(payload),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attempts: 1,
        },
      ],
    })
  )
}

describe("createApiProductRepository — createIdempotent", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => FAKE_UUID) })
    localStorage.clear()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    )
  })

  function getFetchMock() {
    return vi.mocked(fetch)
  }

  function stub201(productDto?: Record<string, unknown>) {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify(
          productDto ?? {
            id: "P001",
            detalle: "Leche Entera 1L",
            codigos: ["LAC-0001"],
            costo_final: "1.10",
            maneja_stock: true,
          }
        ),
        { status: 201 }
      )
    )
  }

  it("sends Idempotency-Key header with a stable UUID on create", async () => {
    stub201()
    const repository = createApiProductRepository()

    await repository.createIdempotent({
      name: "Nuevo",
      sku: "NUE-0001",
      price: 100,
      manejaStock: true,
    })

    const [url, options] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/products")
    expect(options?.method).toBe("POST")
    expect((options?.headers as Headers).get("Idempotency-Key")).toBe(FAKE_UUID)
  })

  it("persists pending operation to localStorage before the request", async () => {
    let capturedStore: string | null = null
    getFetchMock().mockImplementation(async () => {
      capturedStore = localStorage.getItem(STORE_KEY)
      return new Response(
        JSON.stringify({
          id: "P001",
          detalle: "Leche Entera 1L",
          codigos: ["LAC-0001"],
          costo_final: "1.10",
          maneja_stock: true,
        }),
        { status: 201 }
      )
    })
    const repository = createApiProductRepository()

    await repository.createIdempotent({
      name: "Nuevo",
      sku: "NUE-0001",
      price: 100,
      manejaStock: true,
    })

    expect(capturedStore).not.toBeNull()
    const parsed = JSON.parse(capturedStore!)
    expect(parsed.version).toBe(1)
    expect(parsed.operations).toHaveLength(1)
    expect(parsed.operations[0].idempotencyKey).toBe(FAKE_UUID)
    const payload = JSON.parse(parsed.operations[0].serializedPayload)
    expect(payload.detalle).toBe("Nuevo")
    expect(payload.codigos).toEqual(["NUE-0001"])
    expect(payload.costo_final).toBe("100.00")
    expect(typeof payload.cambio_costo).toBe("string")
    expect(typeof payload.cambio_precio).toBe("string")
  })

  it("removes persisted operation after 201 success", async () => {
    stub201()
    const repository = createApiProductRepository()

    await repository.createIdempotent({
      name: "Nuevo",
      sku: "NUE-0001",
      price: 100,
      manejaStock: true,
    })

    const store = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
    expect(store.operations ?? []).toHaveLength(0)
  })

  it("returns product with label_status and label_job from 201 response", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "P001",
          detalle: "Nuevo",
          codigos: ["NUE-0001"],
          costo_final: "100.00",
          maneja_stock: true,
          label_status: "pending",
          label_job: { id: "lj-1", product_id: "P001", product_name: "Nuevo", sku: "NUE-0001", sale_price: "100.00" },
        }),
        { status: 201 }
      )
    )
    const repository = createApiProductRepository()

    const result = await repository.createIdempotent({
      name: "Nuevo",
      sku: "NUE-0001",
      price: 100,
      manejaStock: true,
    })

    expect(result.labelStatus).toBe("pending")
    expect(result.labelJob).toEqual({
      id: "lj-1",
      product_id: "P001",
      product_name: "Nuevo",
      sku: "NUE-0001",
      sale_price: "100.00",
    })
    expect(result.product.name).toBe("Nuevo")
  })

  it("maps label_status: not_required from 201 response", async () => {
    getFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "P001",
          detalle: "Nuevo",
          codigos: ["NUE-0001"],
          costo_final: "100.00",
          maneja_stock: true,
          label_status: "not_required",
          label_job: null,
        }),
        { status: 201 }
      )
    )
    const repository = createApiProductRepository()

    const result = await repository.createIdempotent({
      name: "Nuevo",
      sku: "NUE-0001",
      price: 100,
      manejaStock: true,
    })

    expect(result.labelStatus).toBe("not_required")
    expect(result.labelJob).toBeNull()
  })

  it("maps missing label_status as 'unknown'", async () => {
    stub201()
    const repository = createApiProductRepository()

    const result = await repository.createIdempotent({
      name: "Nuevo",
      sku: "NUE-0001",
      price: 100,
      manejaStock: true,
    })

    // RED: currently defaults to "not_required", should be "unknown"
    expect(result.labelStatus).toBe("unknown")
    expect(result.labelJob).toBeNull()
  })

  it("removes persisted operation after 400 terminal error", async () => {
    seedMatchingOperation({ name: "Bad", sku: "BAD-0001", price: 100, manejaStock: true })

    getFetchMock().mockRejectedValue(Object.assign(new Error("Bad request"), { status: 400 }))
    const repository = createApiProductRepository()

    await expect(
      repository.createIdempotent({
        name: "Bad",
        sku: "BAD-0001",
        price: 100,
        manejaStock: true,
      })
    ).rejects.toThrow()

    const store = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
    expect(store.operations ?? []).toHaveLength(0)
  })

  it("removes persisted operation after 409 conflict", async () => {
    seedMatchingOperation({ name: "Conflict", sku: "CON-0001", price: 100, manejaStock: true })

    getFetchMock().mockRejectedValue(Object.assign(new Error("Conflict"), { status: 409 }))
    const repository = createApiProductRepository()

    await expect(
      repository.createIdempotent({
        name: "Conflict",
        sku: "CON-0001",
        price: 100,
        manejaStock: true,
      })
    ).rejects.toThrow()

    const store = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
    expect(store.operations ?? []).toHaveLength(0)
  })

  it("throws a typed PendingCreationConflictError when submitting a different product while an operation is pending", async () => {
    seedMatchingOperation({ name: "Other", sku: "OTH-0001", price: 50, manejaStock: true })
    const repository = createApiProductRepository()

    const conflict = await repository
      .createIdempotent({
        name: "Nuevo",
        sku: "NUE-0001",
        price: 100,
        manejaStock: true,
      })
      .catch((err: unknown) => err)

    // Clear typed conflict/recovery error (not a generic Error)
    expect(conflict).toBeInstanceOf(PendingCreationConflictError)
    expect((conflict as PendingCreationConflictError).code).toBe("PENDING_CREATION_CONFLICT")
    expect((conflict as PendingCreationConflictError).pendingKey).toBe(FAKE_UUID)
    expect((conflict as Error).message).toMatch(/pendiente/)

    // Must NOT silently resend the old pending payload
    expect(getFetchMock()).not.toHaveBeenCalled()

    // The pending operation is retained for operator recovery
    const store = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
    expect(store.operations ?? []).toHaveLength(1)
    expect(store.operations[0].idempotencyKey).toBe(FAKE_UUID)
  })

  it("retains persisted operation after 500 indeterminate error", async () => {
    getFetchMock().mockRejectedValue(Object.assign(new Error("Server error"), { status: 500 }))
    const repository = createApiProductRepository()

    await expect(
      repository.createIdempotent({
        name: "Retry",
        sku: "RET-0001",
        price: 100,
        manejaStock: true,
      })
    ).rejects.toThrow()

    const store = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
    expect(store.operations).toHaveLength(1)
    expect(store.operations[0].idempotencyKey).toBe(FAKE_UUID)
  })

  it("reuses persisted key and frozen payload on retry after indeterminate error", async () => {
    getFetchMock()
      .mockRejectedValueOnce(Object.assign(new Error("Server error"), { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "P001",
            detalle: "Leche Entera 1L",
            codigos: ["LAC-0001"],
            costo_final: "1.10",
            maneja_stock: true,
          }),
          { status: 201 }
        )
      )

    const repository = createApiProductRepository()

    // First attempt — fails
    await expect(
      repository.createIdempotent({
        name: "Nuevo",
        sku: "NUE-0001",
        price: 100,
        manejaStock: true,
      })
    ).rejects.toThrow()

    const store1 = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
    expect(store1.operations).toHaveLength(1)
    const persistedKey = store1.operations[0].idempotencyKey
    const persistedPayload = store1.operations[0].serializedPayload
    expect(persistedKey).toBe(FAKE_UUID)

    // Second attempt (retry) — should reuse key and payload
    await repository.createIdempotent({
      name: "Nuevo",
      sku: "NUE-0001",
      price: 100,
      manejaStock: true,
    })

    const [url, options] = getFetchMock().mock.calls[1]
    expect((options?.headers as Headers).get("Idempotency-Key")).toBe(FAKE_UUID)
    // RED: retry should use the exact frozen payload, not a new one
    expect(options?.body).toBe(persistedPayload)

    const store2 = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
    expect(store2.operations ?? []).toHaveLength(0)
  })

  it("does not mutate timestamps on retry — payload is byte-identical", async () => {
    getFetchMock()
      .mockRejectedValueOnce(Object.assign(new Error("Timeout"), { status: undefined }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "P001",
            detalle: "Nuevo",
            codigos: ["NUE-0001"],
            costo_final: "100.00",
            maneja_stock: true,
          }),
          { status: 201 }
        )
      )

    const repository = createApiProductRepository()

    await expect(
      repository.createIdempotent({
        name: "Nuevo",
        sku: "NUE-0001",
        price: 100,
        manejaStock: true,
      })
    ).rejects.toThrow()

    const storeAfterFail = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
    const frozenPayload = JSON.parse(storeAfterFail.operations[0].serializedPayload)
    const frozenCambioCosto = frozenPayload.cambio_costo
    const frozenCambioPrecio = frozenPayload.cambio_precio

    await repository.createIdempotent({
      name: "Nuevo",
      sku: "NUE-0001",
      price: 100,
      manejaStock: true,
    })

    const [, retryOptions] = getFetchMock().mock.calls[1]
    const retryPayload = JSON.parse(retryOptions?.body as string)

    // RED: timestamps must not be regenerated on retry
    expect(retryPayload.cambio_costo).toBe(frozenCambioCosto)
    expect(retryPayload.cambio_precio).toBe(frozenCambioPrecio)
  })
})
