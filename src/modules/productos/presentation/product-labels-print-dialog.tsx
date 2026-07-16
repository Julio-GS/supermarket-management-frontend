"use client"

import { useRef } from "react"
import { createPortal } from "react-dom"
import { Printer, Trash2, X, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"
import { ProductLabel } from "./product-label"
import type { LabelItem } from "./use-label-queue"

interface ProductLabelsPrintDialogProps {
  open: boolean
  onClose: () => void
  queue: LabelItem[]
  onClearQueue: () => void
}

export function ProductLabelsPrintDialog({
  open,
  onClose,
  queue,
  onClearQueue,
}: ProductLabelsPrintDialogProps) {
  const printAreaRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {/*
        Portal: #label-print-area se monta como hijo DIRECTO de document.body.
        Esto lo pone al mismo nivel que el root de React y los portales de Radix.

        CSS @media print:
          body > * { display: none }          → oculta TODO (root, dialog portal, etc.)
          body > #label-print-area { display: block } → muestra SOLO las etiquetas

        Esta es la única técnica 100% confiable:
        - Evita el problema de herencia de display:none (el fix anterior)
        - Evita que visibility:hidden genere páginas en blanco extra (bug actual):
          visibility:hidden oculta visualmente pero el elemento SIGUE ocupando espacio
          en el layout de impresión → el dialog genera una segunda página vacía.
      */}
      {createPortal(
        <div
          id="label-print-area"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: "210mm",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 65mm)",
              gridAutoRows: "30mm",
              gap: "2mm",
              padding: "5mm",
              width: "210mm",
              boxSizing: "border-box",
            }}
          >
            {queue.map((item) => (
              <ProductLabel key={item.product.id} item={item} compact />
            ))}
          </div>
        </div>,
        document.body
      )}

      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Tag className="size-5 text-primary" />
              <DialogTitle>Etiquetas pendientes de imprimir</DialogTitle>
            </div>
            <DialogDescription>
              {queue.length} {queue.length === 1 ? "etiqueta lista" : "etiquetas listas"} para
              imprimir.
            </DialogDescription>
          </DialogHeader>

          {/* Preview grid */}
          <div
            ref={printAreaRef}
            className="flex-1 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4"
          >
            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Tag className="size-10 opacity-30" />
                <p className="text-sm">No hay etiquetas en cola.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {queue.map((item) => (
                  <ProductLabel key={item.product.id} item={item} />
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onClearQueue}
              disabled={queue.length === 0}
            >
              <Trash2 className="size-4" />
              Limpiar cola
            </Button>
            <div className="flex gap-2">
              <DialogClose render={<Button variant="outline" />}>
                <X className="size-4" />
                Cerrar
              </DialogClose>
              <Button onClick={handlePrint} disabled={queue.length === 0}>
                <Printer className="size-4" />
                Imprimir {queue.length > 0 ? `(${queue.length})` : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          /* Oculta TODO lo que es hijo directo de body (React root, portales de Radix, etc.) */
          body > * {
            display: none !important;
          }
          /* Muestra SOLO el área de impresión, que ahora es hijo directo de body via Portal */
          body > #label-print-area {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            pointer-events: none;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </>
  )
}
