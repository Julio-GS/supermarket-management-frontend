"use client"

import { CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface RemoteLabelPrintConfirmDialogProps {
  open: boolean
  jobCount: number
  onComplete: () => void
  onRequeue: () => void
  onBlock: () => void
  isProcessing: boolean
  /** Present when a previous settlement attempt left unresolved jobs. */
  pendingMessage?: string | null
  onRetry?: () => void
}

export function RemoteLabelPrintConfirmDialog({
  open,
  jobCount,
  onComplete,
  onRequeue,
  onBlock,
  isProcessing,
  pendingMessage,
  onRetry,
}: RemoteLabelPrintConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        // The outcome must be resolved explicitly; ignore Escape/backdrop/close.
        if (!nextOpen) eventDetails.cancel()
      }}
    >
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            <DialogTitle>Resultado de impresión</DialogTitle>
          </div>
          <DialogDescription>
            Se enviaron{" "}
            <strong>
              {jobCount} {jobCount === 1 ? "etiqueta" : "etiquetas"}
            </strong>{" "}
            a la impresora. Indicá el resultado para continuar.
          </DialogDescription>
        </DialogHeader>

        {pendingMessage ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-destructive" role="alert">
              {pendingMessage}
            </p>
            <Button onClick={onRetry} disabled={isProcessing} className="gap-2">
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={onBlock}
              disabled={isProcessing}
              className="gap-2"
            >
              <AlertTriangle className="size-4" />
              Resultado incierto
            </Button>
            <Button
              variant="destructive"
              onClick={onRequeue}
              disabled={isProcessing}
              className="gap-2"
            >
              <XCircle className="size-4" />
              No se imprimió
            </Button>
            <Button
              onClick={onComplete}
              disabled={isProcessing}
              className="gap-2"
            >
              <CheckCircle className="size-4" />
              Impreso correctamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
