import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

// ---------------------------------------------------------------------------
// Desktop product repository routing tests
//
// These tests verify that productRepository.list() and productRepository.findByCode()
// route through the desktop bridge when available (offline) and fall back to the
// API when the bridge is absent (browser / non-desktop).
// ---------------------------------------------------------------------------

// Set the API base URL before any module loads, otherwise the api-client
// throws "API base URL is not configured" at import time.
process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.test.example.com/api/v1"

// Stub global fetch so API calls don't actually go to the network.
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function desktopProductResult(overrides?: {
  id?: string
  detalle?: string
  codigos?: string[]
  costoFinal?: string | null
  manejaStock?: boolean
  isProtected?: boolean
  iva?: string | null
}) {
  return {
    success: true as const,
    product: {
      id: overrides?.id ?? "prod-1",
      detalle: overrides?.detalle ?? "Leche Entera 1L",
      costoNeto: null,
      costoFinal: overrides?.costoFinal ?? "120.00",
      iva: overrides?.iva ?? null,
      cambioCosto: "fixed",
      cambioPrecio: "fixed",
      etiqueta: "",
      facturable: true,
      manejaStock: overrides?.manejaStock ?? true,
      codigos: overrides?.codigos ?? ["LEC-0001"],
      pricingMode: "fixed",
      isProtected: overrides?.isProtected ?? false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  }
}

function desktopNotFoundResult() {
  return { success: false as const, error: "Product not found by code" }
}

/** Stub window.marketDesktop.products with controlled return values */
function stubDesktopBridge(listResults: Array<{ success: boolean; product?: ReturnType<typeof desktopProductResult>["product"]; error?: string }>, findByCodeResult: { success: boolean; product?: ReturnType<typeof desktopProductResult>["product"]; error?: string }) {
  const productsBridge = {
    create: vi.fn().mockResolvedValue({ success: true, product: { id: "mock-new", detalle: "Mock New", costoNeto: null, costoFinal: "100.00", iva: null, cambioCosto: "fixed", cambioPrecio: "fixed", etiqueta: "", facturable: true, manejaStock: true, codigos: ["MOCK-001"], pricingMode: "fixed", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } }),
    update: vi.fn().mockResolvedValue({ success: true, product: { id: "mock-upd", detalle: "Mock Updated", costoNeto: null, costoFinal: "200.00", iva: null, cambioCosto: "fixed", cambioPrecio: "fixed", etiqueta: "", facturable: true, manejaStock: true, codigos: ["MOCK-UPD"], pricingMode: "fixed", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    list: vi.fn().mockResolvedValue(listResults),
    findByCode: vi.fn().mockResolvedValue(findByCodeResult),
    get: vi.fn(),
  }

  vi.stubGlobal("window", {
    marketDesktop: {
      products: productsBridge,
    },
  })

  return productsBridge
}

function clearDesktopBridge() {
  vi.stubGlobal("window", undefined)
}

// ---------------------------------------------------------------------------
// We import the module AFTER setting environment because it creates the
// API repo singleton at load time.
// ---------------------------------------------------------------------------
async function getRepository() {
  const mod = await import("../product-repository-instance")
  return mod.productRepository
}

// ---------------------------------------------------------------------------
// Tests: bridge ABSENT → API fallback
// ---------------------------------------------------------------------------

describe("productRepository (desktop bridge ABSENT)", () => {
  beforeEach(async () => {
    clearDesktopBridge()
    mockFetch.mockReset()
    vi.stubGlobal("fetch", mockFetch)
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("list() calls the API repository when desktop bridge is absent", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )

    const repo = await getRepository()
    await repo.list({ search: "leche", page: 2, limit: 10 })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("search=leche")
    expect(url).toContain("page=2")
    expect(url).toContain("limit=10")
  })

  it("findByCode() calls the API repository when desktop bridge is absent", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "api-1",
          detalle: "From API",
          codigos: ["API-001"],
          costo_final: "10.00",
          maneja_stock: true,
        }),
        { status: 200 },
      ),
    )

    const repo = await getRepository()
    const result = await repo.findByCode("API-001")

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("/code/API-001")
    expect(result).not.toBeNull()
    expect(result!.name).toBe("From API")
  })

  it("forward all query parameters to the API", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          meta: { page: 3, limit: 25, total: 0, totalPages: 0, hasNext: false },
        }),
        { status: 200 },
      ),
    )

    const repo = await getRepository()
    await repo.list({ search: "queso", page: 3, limit: 25, sort: "detalle:asc" })

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("search=queso")
    expect(url).toContain("page=3")
    expect(url).toContain("limit=25")
    expect(url).toContain("sort=detalle%3Aasc")
  })
})

// ---------------------------------------------------------------------------
// Tests: bridge AVAILABLE → desktop routing
// ---------------------------------------------------------------------------

describe("productRepository (desktop bridge AVAILABLE)", () => {
  beforeEach(async () => {
    mockFetch.mockReset()
    vi.resetModules()
    // We set up the bridge BEFORE importing the module because
    // isDesktopProductsAvailable() is checked at singleton creation time.
    stubDesktopBridge(
      [desktopProductResult({ id: "d1", detalle: "Leche Entera 1L" })],
      desktopProductResult({ id: "d42", detalle: "Leche" }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("list() — desktop search", () => {
    it("calls desktopAdapter.list() and does NOT call the API", async () => {
      const repo = await getRepository()
      await repo.list({ search: "leche" })

      // API fetch should NOT have been called
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns a ProductPage with client-side pagination from desktop results", async () => {
      // Override the stub with 5 products
      vi.unstubAllGlobals()
      stubDesktopBridge(
        Array.from({ length: 5 }, (_, i) =>
          desktopProductResult({
            id: `d${i + 1}`,
            detalle: `Product ${i + 1}`,
            codigos: [`CODE-${i + 1}`],
          }),
        ),
        desktopNotFoundResult(),
      )

      const repo = await getRepository()
      const page = await repo.list({ page: 1, limit: 3 })

      expect(page.products).toHaveLength(3)
      expect(page.meta.total).toBe(5)
      expect(page.meta.page).toBe(1)
      expect(page.meta.limit).toBe(3)
      expect(page.meta.totalPages).toBe(2)
      expect(page.meta.hasNext).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns the last page with correct hasNext=false", async () => {
      vi.unstubAllGlobals()
      stubDesktopBridge(
        Array.from({ length: 5 }, (_, i) =>
          desktopProductResult({ id: `d${i + 1}`, detalle: `Product ${i + 1}` }),
        ),
        desktopNotFoundResult(),
      )

      const repo = await getRepository()
      const page = await repo.list({ page: 2, limit: 3 })

      expect(page.products).toHaveLength(2)
      expect(page.meta.page).toBe(2)
      expect(page.meta.hasNext).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("maps desktop product fields to the domain Product shape", async () => {
      vi.unstubAllGlobals()
      stubDesktopBridge(
        [
          desktopProductResult({
            id: "prod-x",
            detalle: "Agua Mineral",
            codigos: ["AGU-0001", "7790001"],
            costoFinal: "95.00",
            manejaStock: false,
          }),
        ],
        desktopNotFoundResult(),
      )

      const repo = await getRepository()
      const page = await repo.list()

      const product = page.products[0]
      expect(product.id).toBe("prod-x")
      expect(product.name).toBe("Agua Mineral")
      expect(product.sku).toBe("AGU-0001")
      expect(product.price).toBe(95)
      expect(product.manejaStock).toBe(false)
      expect(product.stock).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("filters out failed desktop results", async () => {
      vi.unstubAllGlobals()
      stubDesktopBridge(
        [
          desktopProductResult({ id: "ok", detalle: "OK" }),
          { success: false, error: "DB error" },
          desktopProductResult({ id: "also-ok", detalle: "Also OK" }),
        ],
        desktopNotFoundResult(),
      )

      const repo = await getRepository()
      const page = await repo.list()

      expect(page.products).toHaveLength(2)
      expect(page.products[0].id).toBe("ok")
      expect(page.products[1].id).toBe("also-ok")
      expect(page.meta.total).toBe(2)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("uses default pagination when query is undefined", async () => {
      vi.unstubAllGlobals()
      stubDesktopBridge([], desktopNotFoundResult())

      const repo = await getRepository()
      const page = await repo.list()

      expect(page.meta.page).toBe(1)
      expect(page.meta.limit).toBe(100)
      expect(page.meta.total).toBe(0)
      expect(page.meta.totalPages).toBe(1)
      expect(page.meta.hasNext).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe("findByCode() — desktop barcode lookup", () => {
    it("calls desktopAdapter.findByCode() and does NOT call the API", async () => {
      const repo = await getRepository()
      await repo.findByCode("BAR-123")

      // API fetch should NOT have been called
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns null when the desktop bridge finds no match", async () => {
      vi.unstubAllGlobals()
      stubDesktopBridge([], desktopNotFoundResult())

      const repo = await getRepository()
      const result = await repo.findByCode("NONEXISTENT")

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("maps the desktop result to a domain Product", async () => {
      vi.unstubAllGlobals()
      stubDesktopBridge(
        [],
        desktopProductResult({
          id: "prod-bc",
          detalle: "Pan Lactal",
          codigos: ["PAN-042", "7790042"],
          costoFinal: "180.00",
          manejaStock: true,
        }),
      )

      const repo = await getRepository()
      const product = await repo.findByCode("7790042")

      expect(product).not.toBeNull()
      expect(product!.id).toBe("prod-bc")
      expect(product!.name).toBe("Pan Lactal")
      expect(product!.sku).toBe("PAN-042")
      expect(product!.price).toBe(180)
      expect(product!.manejaStock).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("preserves isProtected from desktop results", async () => {
      vi.unstubAllGlobals()
      stubDesktopBridge(
        [],
        desktopProductResult({
          id: "manual-price",
          detalle: "Precio Manual",
          codigos: ["3"],
          costoFinal: "0.00",
          isProtected: true,
        }),
      )

      const repo = await getRepository()
      const product = await repo.findByCode("3")

      expect(product).not.toBeNull()
      expect(product!.isProtected).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns null when the desktop result has success:false", async () => {
      vi.unstubAllGlobals()
      stubDesktopBridge([], { success: false, error: "Product not found by code" })

      const repo = await getRepository()
      const result = await repo.findByCode("GHOST")

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})


    // ---------------------------------------------------------------------------
    // Tests: bridge BECOMES available AFTER module import (lazy resolution)
    // ---------------------------------------------------------------------------
    //
    // These tests prove the fix for the module-level frozen adapter bug:
    // when the desktop bridge is NOT available at module load time but
    // becomes available later (e.g., Electron preload timing), operations
    // MUST still route through the desktop bridge on each call.
    //
    // With the old frozen-adapter pattern, these tests would FAIL because
    // desktopAdapter was set to null at import time and never re-evaluated.

    describe('productRepository (bridge ABSENT at import, then BECOMES AVAILABLE)', () => {
      beforeEach(async () => {
        mockFetch.mockReset()
        vi.stubGlobal('fetch', mockFetch)
        vi.resetModules()
        // IMPORTANT: bridge is ABSENT at module import time
        clearDesktopBridge()
      })

      afterEach(() => {
        vi.unstubAllGlobals()
      })

      it('list() routes through desktop when bridge appears after import', async () => {
        // Import with bridge absent -> desktopAdapter should be null internally
        const repo = await getRepository()

        // Bridge becomes available AFTER import
        stubDesktopBridge(
          [desktopProductResult({ id: 'late-1', detalle: 'Late Product' })],
          desktopNotFoundResult(),
        )

        const page = await repo.list({ search: 'late' })

        // Must route through desktop, NOT API
        expect(mockFetch).not.toHaveBeenCalled()
        expect(page.products).toHaveLength(1)
        expect(page.products[0].name).toBe('Late Product')
      })

      it('findByCode() routes through desktop when bridge appears after import', async () => {
        const repo = await getRepository()

        stubDesktopBridge(
          [],
          desktopProductResult({
            id: 'late-bc',
            detalle: 'Late Barcode Product',
            codigos: ['LATE-001'],
          }),
        )

        const product = await repo.findByCode('LATE-001')

        expect(mockFetch).not.toHaveBeenCalled()
        expect(product).not.toBeNull()
        expect(product!.name).toBe('Late Barcode Product')
      })

      it('update() routes through desktop when bridge appears after import', async () => {
        const repo = await getRepository()

        stubDesktopBridge(
          [],
          desktopProductResult({
            id: 'late-upd',
            detalle: 'Updated Late',
            costoFinal: '250.00',
            iva: '21.00',
          }),
        )

        const result = await repo.update({
          id: 'late-upd',
          name: 'Updated Late',
          price: 250,
          sku: 'LATE-UPD',
          manejaStock: true,
          iva: 21,
        })

        expect(mockFetch).not.toHaveBeenCalled()
        expect(result.name).toBe('Updated Late')
      })

      it('create() routes through desktop when bridge appears after import', async () => {
        const repo = await getRepository()

        const bridge = stubDesktopBridge(
          [],
          desktopProductResult({
            id: 'late-new',
            detalle: 'New Late Product',
            costoFinal: '300.00',
          }),
        )

        const result = await repo.create({
          name: 'New Late Product',
          price: 300,
          sku: 'LATE-NEW',
          manejaStock: true,
        })

        expect(mockFetch).not.toHaveBeenCalled()
        expect(bridge.create).toHaveBeenCalledWith(
          expect.objectContaining({
            detalle: 'New Late Product',
            codigos: ['LATE-NEW'],
          }),
        )
        expect(result.name).toBe('New Late Product')
      })

      it('update() forwards SKU changes to desktop codigos', async () => {
        const repo = await getRepository()

        const bridge = stubDesktopBridge([], desktopNotFoundResult())

        await repo.update({
          id: 'late-upd',
          name: 'Updated Late',
          price: 250,
          sku: 'LATE-UPD',
          manejaStock: true,
          iva: 21,
        })

        expect(mockFetch).not.toHaveBeenCalled()
        expect(bridge.update).toHaveBeenCalledWith(
          'late-upd',
          expect.objectContaining({ codigos: ['LATE-UPD'] }),
        )
      })

      it('delete() routes through desktop when bridge appears after import', async () => {
        const repo = await getRepository()

        stubDesktopBridge([], desktopNotFoundResult())

        // delete should not throw
        await expect(repo.delete('late-del')).resolves.toBeUndefined()
        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('falls back to API when bridge never appears', async () => {
        const repo = await getRepository()
        // Bridge never set up

        mockFetch.mockResolvedValue(
          new Response(JSON.stringify([]), { status: 200 }),
        )

        await repo.list({ search: 'nobridge' })

        // Must fall through to API
        expect(mockFetch).toHaveBeenCalledTimes(1)
        const url = mockFetch.mock.calls[0][0] as string
        expect(url).toContain('search=nobridge')
      })
    })

    // ---------------------------------------------------------------------------
    // browser/API create() wired through idempotent lifecycle
    // ---------------------------------------------------------------------------
    const STORE_KEY = "supermarket-management:productos:pending-product-creation:v1"
    const FAKE_UUID = "550e8400-e29b-41d4-a716-446655440000"

    describe("productRepository.create() — browser/API idempotent wiring (bridge ABSENT)", () => {
      beforeEach(async () => {
        clearDesktopBridge()
        mockFetch.mockReset()
        vi.stubGlobal("fetch", mockFetch)
        vi.stubGlobal("crypto", { randomUUID: vi.fn(() => FAKE_UUID) })
        localStorage.clear()
        vi.resetModules()
      })

      afterEach(() => {
        vi.unstubAllGlobals()
      })

      function stub201Response() {
        mockFetch.mockResolvedValue(
          new Response(
            JSON.stringify({
              id: "api-new",
              detalle: "New Product",
              codigos: ["NEW-001"],
              costo_final: "100.00",
              maneja_stock: true,
            }),
            { status: 201 }
          )
        )
      }

      it("sends Idempotency-Key header and cleans up after success", async () => {
            stub201Response()
            const repo = await getRepository()

            await repo.create({
              name: "New Product",
              sku: "NEW-001",
              price: 100,
              manejaStock: true,
            })

            const [, options] = mockFetch.mock.calls[0]
            expect(options?.method).toBe("POST")
            expect((options?.headers as Headers).get("Idempotency-Key")).toBe(FAKE_UUID)
            // Cleanup: no pending operation after success
            const store = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
            expect(store.operations ?? []).toHaveLength(0)
          })

      it("persists pending operation to localStorage before fetch", async () => {
        let capturedStore: string | null = null
        mockFetch.mockImplementation(async () => {
          capturedStore = localStorage.getItem(STORE_KEY)
          return new Response(
            JSON.stringify({
              id: "api-new",
              detalle: "New Product",
              codigos: ["NEW-001"],
              costo_final: "100.00",
              maneja_stock: true,
            }),
            { status: 201 }
          )
        })

        const repo = await getRepository()
        await repo.create({
          name: "New Product",
          sku: "NEW-001",
          price: 100,
          manejaStock: true,
        })

        expect(capturedStore).not.toBeNull()
        const parsed = JSON.parse(capturedStore!)
        expect(parsed.version).toBe(1)
        expect(parsed.operations).toHaveLength(1)
        expect(parsed.operations[0].idempotencyKey).toBe(FAKE_UUID)
        const payload = JSON.parse(parsed.operations[0].serializedPayload)
        expect(payload.detalle).toBe("New Product")
        expect(payload.codigos).toEqual(["NEW-001"])
        expect(payload.costo_final).toBe("100.00")
      })

      it("retains pending operation in localStorage after 500 error", async () => {
        mockFetch.mockRejectedValue(Object.assign(new Error("Server error"), { status: 500 }))
        const repo = await getRepository()

        await expect(
          repo.create({
            name: "Retry Product",
            sku: "RET-001",
            price: 100,
            manejaStock: true,
          })
        ).rejects.toThrow()

        const store = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
        expect(store.operations).toHaveLength(1)
        expect(store.operations[0].idempotencyKey).toBe(FAKE_UUID)
      })

      it("reuses same key and payload on retry after indeterminate error", async () => {
        mockFetch
          .mockRejectedValueOnce(Object.assign(new Error("Server error"), { status: 500 }))
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                id: "api-new",
                detalle: "New Product",
                codigos: ["NEW-001"],
                costo_final: "100.00",
                maneja_stock: true,
              }),
              { status: 201 }
            )
          )

        const repo = await getRepository()

        await expect(
          repo.create({
            name: "New Product",
            sku: "NEW-001",
            price: 100,
            manejaStock: true,
          })
        ).rejects.toThrow()

        // Retry — must reuse same key and frozen payload
        await repo.create({
          name: "New Product",
          sku: "NEW-001",
          price: 100,
          manejaStock: true,
        })

        const [, retryOptions] = mockFetch.mock.calls[1]
        expect((retryOptions?.headers as Headers).get("Idempotency-Key")).toBe(FAKE_UUID)
        expect(retryOptions?.method).toBe("POST")
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })

    describe("productRepository.create() — desktop path stays non-idempotent", () => {
      beforeEach(async () => {
        mockFetch.mockReset()
        vi.stubGlobal("fetch", mockFetch)
        vi.stubGlobal("crypto", { randomUUID: vi.fn(() => FAKE_UUID) })
        localStorage.clear()
        vi.resetModules()
        stubDesktopBridge(
          [desktopProductResult({ id: "d1", detalle: "Existing" })],
          desktopProductResult({ id: "d42", detalle: "Existing" }),
        )
      })

      afterEach(() => {
        vi.unstubAllGlobals()
      })

      it("routes through desktop bridge without HTTP or localStorage idempotency", async () => {
            const repo = await getRepository()

            await repo.create({
              name: "Desktop Product",
              sku: "DESK-001",
              price: 200,
              manejaStock: true,
            })

            // Desktop path must not call fetch or write idempotency store
            expect(mockFetch).not.toHaveBeenCalled()
            const store = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
            expect(store.operations ?? []).toHaveLength(0)
          })
    })
