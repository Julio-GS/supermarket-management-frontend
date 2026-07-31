import QRCode from "qrcode"

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export interface ArcaQrInput {
  saleDate: string
  cuit: string
  ptoVta: string
  cbteTipo: string
  cbteNro: string
  cae: string
  importe: number
}

export type ArcaQrPayloadResult =
  | { ok: true; url: string }
  | { ok: false; kind: "missing" | "invalid"; reason: string }

export type ArcaQrImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; kind: "render"; reason: string }

// ---------------------------------------------------------------------------
// ARCA fiscal QR payload (RG 4290)
// ---------------------------------------------------------------------------

export function buildArcaQrPayload(input: ArcaQrInput): ArcaQrPayloadResult {
  // ── saleDate → fecha (YYYY-MM-DD) ────────────────────────────────
  const fecha = deriveFecha(input.saleDate)
  if (!fecha) {
    const kind = isMissing(input.saleDate) ? "missing" : "invalid"
    return { ok: false, kind, reason: `${kind === "missing" ? "missing" : "invalid"} field: saleDate` }
  }

  // ── CUIT normalization ────────────────────────────────────────────
  const cuit = normalizeCuit(input.cuit)
  if (!cuit) {
    return { ok: false, kind: "invalid", reason: "invalid field: cuit" }
  }

  // ── Fiscal numbers ─────────────────────────────────────────────────
  if (isMissing(input.ptoVta)) {
    return { ok: false, kind: "missing", reason: "missing field: ptoVta" }
  }
  const ptoVta = parseFiscalInt(input.ptoVta, "ptoVta")
  if (ptoVta === null) {
    return { ok: false, kind: "invalid", reason: "invalid numeric field: ptoVta" }
  }

  if (isMissing(input.cbteTipo)) {
    return { ok: false, kind: "missing", reason: "missing field: cbteTipo" }
  }
  const tipoCmp = parseFiscalInt(input.cbteTipo, "cbteTipo")
  if (tipoCmp === null) {
    return { ok: false, kind: "invalid", reason: "invalid numeric field: cbteTipo" }
  }

  if (isMissing(input.cbteNro)) {
    return { ok: false, kind: "missing", reason: "missing field: cbteNro" }
  }
  const nroCmp = parseFiscalInt(input.cbteNro, "cbteNro")
  if (nroCmp === null) {
    return { ok: false, kind: "invalid", reason: "invalid numeric field: cbteNro" }
  }

  if (isMissing(input.cae)) {
    return { ok: false, kind: "missing", reason: "missing field: cae" }
  }
  const codAut = parseFiscalInt(input.cae, "cae")
  if (codAut === null) {
    return { ok: false, kind: "invalid", reason: "invalid numeric field: cae" }
  }

  // ── Importe ────────────────────────────────────────────────────────
  if (!Number.isFinite(input.importe) || input.importe < 0) {
    return { ok: false, kind: "invalid", reason: "invalid field: importe" }
  }
  const importe = roundCurrency(input.importe)

  // ── Build payload ──────────────────────────────────────────────────
  const payload = {
    ver: 1,
    fecha,
    cuit,
    ptoVta,
    tipoCmp,
    nroCmp,
    importe,
    moneda: "PES",
    ctz: 1.0,
    tipoDocRec: 99,
    nroDocRec: 0,
    tipoCodAut: "E",
    codAut,
  }

  const base64url = encodeBase64Url(JSON.stringify(payload))
  const url = `https://www.afip.gob.ar/fe/qr/?p=${base64url}`

  return { ok: true, url }
}

// ---------------------------------------------------------------------------
// QR image generation
// ---------------------------------------------------------------------------

export async function generateArcaQrDataUrl(url: string): Promise<ArcaQrImageResult> {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "L",
      margin: 1,
      width: 220,
      type: "image/png",
    })
    return { ok: true, dataUrl }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown QR render error"
    return { ok: false, kind: "render", reason: `QR library error: ${message}` }
  }
}

// ---------------------------------------------------------------------------
// Input validation & normalisation
// ---------------------------------------------------------------------------

function deriveFecha(iso: string): string | null {
  if (!iso || typeof iso !== "string") return null

  // Direct ISO slice — spec fixture "2026-07-31T14:23:45.000Z"
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})(T|$)/)
  if (match) return match[1]

  // Fallback: parse via Date
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null

  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function normalizeCuit(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null

  const digits = raw.replace(/[\s-]/g, "")
  if (!/^\d{11}$/.test(digits)) return null

  return digits
}

function parseFiscalInt(value: string, _field: string): number | null {
  if (!value || typeof value !== "string") return null

  const trimmed = value.trim()
  if (trimmed === "") return null

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null

  return parsed
}

function isMissing(value: string): boolean {
  return !value || typeof value !== "string" || value.trim() === ""
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

// ---------------------------------------------------------------------------
// Base64url encoding (RFC 4648 §5, no padding)
// ---------------------------------------------------------------------------

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const binary = Array.from(bytes, (b) => String.fromCodePoint(b)).join("")
  const base64 = btoa(binary)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}
