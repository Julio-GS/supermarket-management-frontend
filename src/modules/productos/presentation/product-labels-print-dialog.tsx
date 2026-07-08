"use client"

import { useRef } from "react"
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
        Print-only area: rendered outside the Dialog so it's always in the DOM.
        CSS @media print hides everything except this div.
      */}
      <div id="label-print-area" aria-hidden="true" style={{ display: "none" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 48mm)",
            gridTemplateRows: "repeat(5, 56mm)",
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
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Tag className="size-5 text-primary" />
              <DialogTitle>Etiquetas pendientes de imprimir</DialogTitle>
            </div>
            <DialogDescription>
              {queue.length} {queue.length === 1 ? "etiqueta lista" : "etiquetas listas"} para
              imprimir. Se imprimen {Math.min(queue.length, 20)} por hoja A4.
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

      {/* Global print styles injected inline via a style tag */}
      <style>{`
        @media print {
          body > * {
            display: none !important;
          }
          #label-print-area {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
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
