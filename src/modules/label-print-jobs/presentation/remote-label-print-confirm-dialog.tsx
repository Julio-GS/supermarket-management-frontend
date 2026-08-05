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
  onSuccess: () => void
  onFailure: () => void
  onCancel: () => void
  isProcessing: boolean
}

export function RemoteLabelPrintConfirmDialog({
  open,
  jobCount,
  onSuccess,
  onFailure,
  onCancel,
  isProcessing,
}: RemoteLabelPrintConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            <DialogTitle>Confirmar impresión remota</DialogTitle>
          </div>
          <DialogDescription>
            Se enviaron{" "}
            <strong>
              {jobCount} {jobCount === 1 ? "etiqueta" : "etiquetas"}
            </strong>{" "}
            a la impresora. ¿Se imprimieron correctamente?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onFailure}
            disabled={isProcessing}
            className="gap-2"
          >
            <XCircle className="size-4" />
            No, falló
          </Button>
          <Button
            onClick={onSuccess}
            disabled={isProcessing}
            className="gap-2"
          >
            <CheckCircle className="size-4" />
            Sí, correcto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
