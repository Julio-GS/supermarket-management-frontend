"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser"
import { Camera, X, RotateCcw, AlertTriangle, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CatalogProduct } from "../application/catalog-query-port"

// Singleton reader instance — reused across open/close cycles
const barcodeReader = new BrowserMultiFormatReader()

// ── Types ──────────────────────────────────────────────────────

export type CameraScanResult =
  | { status: "matched"; product: CatalogProduct }
  | { status: "not-found" }
  | { status: "error"; message: string }

type ScannerState =
  | { kind: "init" }
  | { kind: "scanning" }
  | { kind: "matched"; code: string }
  | { kind: "not-found"; code: string }
  | { kind: "error"; message: string }
  | { kind: "denied" }

export interface PosCameraScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDecode: (code: string) => Promise<CameraScanResult>
}

// ── Component ──────────────────────────────────────────────────

export function PosCameraScanner({ open, onOpenChange, onDecode }: PosCameraScannerProps) {
  const [state, setState] = useState<ScannerState>({ kind: "init" })
  const controlsRef = useRef<IScannerControls | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lockedRef = useRef(false)
  const mountedRef = useRef(true)

  // ── Idempotent cleanup ─────────────────────────────────────

  const cleanup = useCallback(() => {
    lockedRef.current = true
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // ── Start decoding ─────────────────────────────────────────

  const startDecoding = useCallback(async () => {
    if (!mountedRef.current) return

    // Guard: insecure context (non-HTTPS, non-localhost)
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setState({
        kind: "error",
        message:
          "La cámara requiere una conexión segura (HTTPS). Abrí la app desde https://",
      })
      return
    }

    cleanup()
    lockedRef.current = false
    setState({ kind: "scanning" })

    try {
      const controls = await barcodeReader.decodeFromConstraints(
        {
          video: { facingMode: { ideal: "environment" } },
        },
        "zxing-video-preview",
        async (result) => {
          // Ignore frame-level ZXing misses (null results)
          if (!result) return

          // Decode lock: suppress duplicates from same frame cycle
          if (lockedRef.current) return
          lockedRef.current = true

          const code = result.getText()
          setState({ kind: "scanning" })

          try {
            const scanResult = await onDecode(code)

            if (!mountedRef.current) return

            if (scanResult.status === "matched") {
              setState({ kind: "matched", code })
              // Stop camera after successful match
              cleanup()
              // Stay locked on success; user must explicitly re-arm
            } else if (scanResult.status === "not-found") {
              setState({ kind: "not-found", code })
              // Re-arm after not-found so user can continue scanning
              lockedRef.current = false
            } else {
              setState({ kind: "error", message: scanResult.message })
              lockedRef.current = false
            }
          } catch {
            if (mountedRef.current) {
              cleanup()
              setState({ kind: "error", message: "Error al procesar el código" })
            }
            lockedRef.current = false
          }
        }
      )

      if (!mountedRef.current) {
        controls.stop()
        return
      }

      controlsRef.current = controls

      // ZXing attaches the stream to preview element via srcObject;
      // extract it for explicit track cleanup on unmount
      const videoEl = document.getElementById("zxing-video-preview") as HTMLVideoElement | null
      if (videoEl?.srcObject) {
        streamRef.current = videoEl.srcObject as MediaStream
      }
    } catch (err) {
      if (!mountedRef.current) return

      const domErr = err as DOMException
      if (domErr.name === "NotAllowedError") {
        setState({ kind: "denied" })
      } else {
        setState({
          kind: "error",
          message:
            domErr.message || "No se pudo acceder a la cámara. Verificá que esté disponible.",
        })
      }
    }
  }, [onDecode, cleanup])

  // ── Effect: start / cleanup on open ─────────────────────────

  useEffect(() => {
    mountedRef.current = true

    if (open) {
      startDecoding()
    }

    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [open, startDecoding, cleanup])

  // ── Handlers ────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    cleanup()
    onOpenChange(false)
  }, [cleanup, onOpenChange])

  const handleRetry = useCallback(() => {
    startDecoding()
  }, [startDecoding])

  // ── Render: not open ────────────────────────────────────────

  if (!open) return null

  // ── Render: denied ──────────────────────────────────────────

  if (state.kind === "denied") {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-lg"
      >
        <ShieldAlert className="size-10 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-semibold text-destructive">Permiso de cámara denegado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Activá el permiso de cámara desde la configuración del navegador o ingresá el código
            manualmente.
          </p>
        </div>
        <Button variant="outline" onClick={handleClose} className="min-h-[44px] min-w-[44px]">
          Cerrar
        </Button>
      </div>
    )
  }

  // ── Render: error ───────────────────────────────────────────

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-lg"
      >
        <AlertTriangle className="size-10 text-amber-500" aria-hidden="true" />
        <div>
          <p className="font-semibold">Cámara no disponible</p>
          <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRetry} className="min-h-[44px] min-w-[44px]">
            <RotateCcw className="mr-2 size-4" />
            Reintentar
          </Button>
          <Button variant="ghost" onClick={handleClose} className="min-h-[44px] min-w-[44px]">
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  // ── Render: matched ─────────────────────────────────────────

  if (state.kind === "matched") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-lg"
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-green-100">
          <Camera className="size-5 text-green-600" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-green-700">Producto escaneado</p>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{state.code}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Se agregó una unidad al carrito.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleRetry} className="min-h-[44px] min-w-[44px]">
            <RotateCcw className="mr-2 size-4" />
            Escanear otro
          </Button>
          <Button variant="ghost" onClick={handleClose} className="min-h-[44px] min-w-[44px]">
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  // ── Render: not-found ───────────────────────────────────────

  if (state.kind === "not-found") {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-xl border border-yellow-200 bg-card p-6 text-center shadow-lg"
      >
        <AlertTriangle className="size-10 text-yellow-600" aria-hidden="true" />
        <div>
          <p className="font-semibold">Producto no encontrado</p>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{state.code}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No se encontró ningún producto con este código. La cámara sigue activa.
          </p>
        </div>
        <Button variant="outline" onClick={handleClose} className="min-h-[44px] min-w-[44px]">
          Cerrar
        </Button>
      </div>
    )
  }

  // ── Render: scanning (or init) ──────────────────────────────

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-black shadow-lg">
      {/* Camera preview area */}
      <div className="relative flex aspect-[3/4] w-full items-center justify-center bg-black sm:aspect-[4/3]">
        {/* ZXing renders its own <video> — we provide a container */}
        <video
          id="zxing-video-preview"
          className="h-full w-full object-cover"
          autoPlay
          playsInline
          muted
        />

        {/* Close button overlay */}
        <Button
          variant="secondary"
          size="icon"
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 min-h-[44px] min-w-[44px] rounded-full bg-background/80 shadow backdrop-blur hover:bg-background"
          aria-label="Cerrar cámara"
        >
          <X className="size-5" />
        </Button>

        {/* Scanning indicator */}
        {state.kind === "scanning" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-4 py-1.5 text-sm font-medium text-foreground shadow backdrop-blur">
            Apuntá la cámara al código de barras
          </div>
        )}
      </div>
    </div>
  )
}
