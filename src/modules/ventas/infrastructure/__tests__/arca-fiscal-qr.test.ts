import { describe, expect, it, vi } from "vitest"
import {
  buildArcaQrPayload,
  generateArcaQrDataUrl,
  type ArcaQrInput,
} from "../arca-fiscal-qr"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidInput(overrides: Partial<ArcaQrInput> = {}): ArcaQrInput {
  return {
    saleDate: "2026-07-31T14:23:45.000Z",
    cuit: "27-93973280-8",
    ptoVta: "001",
    cbteTipo: "6",
    cbteNro: "00001234",
    cae: "12345678901234",
    importe: 15250.50,
    ...overrides,
  }
}

function decodeBase64Url(encoded: string): string {
  // Reverse base64url → standard base64
  let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
  // Restore padding
  while (base64.length % 4 !== 0) {
    base64 += "="
  }
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (c) => c.codePointAt(0) ?? 0)
  return new TextDecoder().decode(bytes)
}

// ---------------------------------------------------------------------------
// Tests — buildArcaQrPayload
// ---------------------------------------------------------------------------

describe("buildArcaQrPayload", () => {
  // ── Valid payload construction ─────────────────────────────────────

  it("builds a valid ARCA QR URL with the expected prefix", () => {
    const result = buildArcaQrPayload(makeValidInput())

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    expect(result.url).toMatch(/^https:\/\/www\.afip\.gob\.ar\/fe\/qr\/\?p=/)
  })

  it("produces exactly 13 fields in the decoded payload", () => {
    const result = buildArcaQrPayload(makeValidInput())

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    const encoded = result.url.replace("https://www.afip.gob.ar/fe/qr/?p=", "")
    const json = decodeBase64Url(encoded)
    const payload = JSON.parse(json)

    expect(Object.keys(payload)).toHaveLength(13)
    expect(payload.ver).toBe(1)
    expect(payload.fecha).toBe("2026-07-31")
    expect(payload.cuit).toBe("27939732808")
    expect(payload.ptoVta).toBe(1)
    expect(payload.tipoCmp).toBe(6)
    expect(payload.nroCmp).toBe(1234)
    expect(payload.importe).toBe(15250.50)
    expect(payload.moneda).toBe("PES")
    expect(payload.ctz).toBe(1.0)
    expect(payload.tipoDocRec).toBe(99)
    expect(payload.nroDocRec).toBe(0)
    expect(payload.tipoCodAut).toBe("E")
    expect(payload.codAut).toBe(12345678901234)
  })

  // ── Date formatting ────────────────────────────────────────────────

  it('derives YYYY-MM-DD from an ISO timestamp', () => {
    const result = buildArcaQrPayload(makeValidInput({ saleDate: "2026-07-31T14:23:45.000Z" }))

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    const encoded = result.url.replace("https://www.afip.gob.ar/fe/qr/?p=", "")
    const payload = JSON.parse(decodeBase64Url(encoded))
    expect(payload.fecha).toBe("2026-07-31")
  })

  it("accepts a plain YYYY-MM-DD date string", () => {
    const result = buildArcaQrPayload(makeValidInput({ saleDate: "2026-12-25" }))

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    const encoded = result.url.replace("https://www.afip.gob.ar/fe/qr/?p=", "")
    const payload = JSON.parse(decodeBase64Url(encoded))
    expect(payload.fecha).toBe("2026-12-25")
  })

  it("returns missing when saleDate is empty", () => {
    const result = buildArcaQrPayload(makeValidInput({ saleDate: "" }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("missing")
    expect(result.reason).toContain("saleDate")
  })

  it("returns invalid when saleDate is present but not a valid date", () => {
    const result = buildArcaQrPayload(makeValidInput({ saleDate: "not-a-date" }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("invalid")
    expect(result.reason).toContain("saleDate")
  })

  // ── CUIT normalization ─────────────────────────────────────────────

  it("removes hyphens from CUIT", () => {
    const result = buildArcaQrPayload(makeValidInput({ cuit: "27-93973280-8" }))

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    const encoded = result.url.replace("https://www.afip.gob.ar/fe/qr/?p=", "")
    const payload = JSON.parse(decodeBase64Url(encoded))
    expect(payload.cuit).toBe("27939732808")
  })

  it("returns invalid for CUIT with too few digits", () => {
    const result = buildArcaQrPayload(makeValidInput({ cuit: "27-93973280" }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("invalid")
    expect(result.reason).toContain("cuit")
  })

  it("returns invalid for CUIT with too many digits", () => {
    const result = buildArcaQrPayload(makeValidInput({ cuit: "279397328081" }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("invalid")
    expect(result.reason).toContain("cuit")
  })

  it("returns invalid for malformed CUIT with letters", () => {
    const result = buildArcaQrPayload(makeValidInput({ cuit: "invalid-cuit" }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("invalid")
    expect(result.reason).toContain("cuit")
  })

  // ── Numeric field parsing ──────────────────────────────────────────

  it("parses fiscal fields as integers", () => {
    const result = buildArcaQrPayload(
      makeValidInput({
        ptoVta: "001",
        cbteTipo: "6",
        cbteNro: "00001234",
        cae: "12345678901234",
      })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    const encoded = result.url.replace("https://www.afip.gob.ar/fe/qr/?p=", "")
    const payload = JSON.parse(decodeBase64Url(encoded))

    expect(payload.ptoVta).toBe(1)
    expect(payload.tipoCmp).toBe(6)
    expect(payload.nroCmp).toBe(1234)
    expect(payload.codAut).toBe(12345678901234)
  })

  it("returns invalid when ptoVta is non-numeric", () => {
    const result = buildArcaQrPayload(makeValidInput({ ptoVta: "ABC" }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("invalid")
    expect(result.reason).toContain("ptoVta")
  })

  it("returns invalid when cbteTipo is non-numeric", () => {
    const result = buildArcaQrPayload(makeValidInput({ cbteTipo: "XYZ" }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("invalid")
    expect(result.reason).toContain("cbteTipo")
  })

  it("returns invalid when cae is non-numeric", () => {
    const result = buildArcaQrPayload(makeValidInput({ cae: "not-a-number" }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("invalid")
    expect(result.reason).toContain("cae")
  })

  // ── Importe ────────────────────────────────────────────────────────

  it("uses the passed final total as importe", () => {
    const result = buildArcaQrPayload(makeValidInput({ importe: 10000.0 }))

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    const encoded = result.url.replace("https://www.afip.gob.ar/fe/qr/?p=", "")
    const payload = JSON.parse(decodeBase64Url(encoded))
    expect(payload.importe).toBe(10000.0)
  })

  it("preserves cents in importe", () => {
    const result = buildArcaQrPayload(makeValidInput({ importe: 5250.50 }))

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    const encoded = result.url.replace("https://www.afip.gob.ar/fe/qr/?p=", "")
    const payload = JSON.parse(decodeBase64Url(encoded))
    expect(payload.importe).toBe(5250.50)
  })

  it("returns invalid when importe is negative", () => {
    const result = buildArcaQrPayload(makeValidInput({ importe: -10 }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("invalid")
    expect(result.reason).toContain("importe")
  })

  it("returns invalid when importe is NaN", () => {
    const result = buildArcaQrPayload(makeValidInput({ importe: NaN }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("invalid")
    expect(result.reason).toContain("importe")
  })

  // ── Base64url encoding ─────────────────────────────────────────────

  it("produces base64url without +, /, or = padding", () => {
    const result = buildArcaQrPayload(makeValidInput())

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    const encoded = result.url.replace("https://www.afip.gob.ar/fe/qr/?p=", "")

    expect(encoded).not.toContain("+")
    expect(encoded).not.toContain("/")
    expect(encoded).not.toContain("=")
  })

  // ── Missing field detection ────────────────────────────────────────

  it("returns missing when ptoVta is empty", () => {
    const result = buildArcaQrPayload(makeValidInput({ ptoVta: "" }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("missing")
    expect(result.reason).toContain("ptoVta")
  })

  it("returns missing when cae is empty", () => {
    const result = buildArcaQrPayload(makeValidInput({ cae: "" }))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("missing")
    expect(result.reason).toContain("cae")
  })
})

// ---------------------------------------------------------------------------
// Tests — generateArcaQrDataUrl
// ---------------------------------------------------------------------------

describe("generateArcaQrDataUrl", () => {
  // Hoisted mock so both tests share the same mocked qrcode instance
  const { mockToDataURL } = vi.hoisted(() => ({
    mockToDataURL: vi.fn(),
  }))

  vi.mock("qrcode", () => ({
    default: {
      toDataURL: mockToDataURL,
    },
  }))

  it("returns a data URL for a valid QR payload URL", async () => {
    mockToDataURL.mockResolvedValue("data:image/png;base64,ABC123")

    const payloadResult = buildArcaQrPayload(makeValidInput())
    if (!payloadResult.ok) throw new Error("Expected ok payload")

    const result = await generateArcaQrDataUrl(payloadResult.url)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it("returns render failure when the QR library throws", async () => {
    mockToDataURL.mockRejectedValue(new Error("Canvas rendering error"))

    const result = await generateArcaQrDataUrl("https://www.afip.gob.ar/fe/qr/?p=SOMEVALIDBASE64")

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.kind).toBe("render")
    expect(result.reason).toContain("QR library error")
  })
})
