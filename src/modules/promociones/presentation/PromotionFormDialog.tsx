import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { type Promotion } from "../domain/promotion"

type ScheduleMode = "range" | "weekdays"

interface PromotionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Omit<Promotion, "id">) => Promise<void>
  initialData?: Promotion | null
}

interface PromotionFormState {
  name: string
  description: string
  type: Promotion["type"]
  discountPercent: string
  productId: string
  isActive: boolean
  scheduleMode: ScheduleMode
  startDate: string
  endDate: string
  weekdays: number[]
}

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
] as const

function toDateInputValue(value: string | null): string {
  if (!value) return ""
  return value.includes("T") ? value.slice(0, 10) : value
}

function toIsoDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString()
}

function createInitialState(initialData?: Promotion | null): PromotionFormState {
  const useWeekdays = Boolean(initialData?.weekdays?.length)

  return {
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    type: initialData?.type ?? "percentage",
    discountPercent: initialData?.discount_percent?.toString() ?? "",
    productId: initialData?.productIds?.[0] ?? "",
    isActive: initialData?.active ?? true,
    scheduleMode: useWeekdays ? "weekdays" : "range",
    startDate: toDateInputValue(initialData?.startDate ?? null),
    endDate: toDateInputValue(initialData?.endDate ?? null),
    weekdays: initialData?.weekdays ?? [],
  }
}

function buildPromotionPayload(state: PromotionFormState):
  | { error: string }
  | { data: Omit<Promotion, "id"> } {
  if (!state.name.trim()) {
    return { error: "El nombre de la promoción es obligatorio." }
  }

  if (!state.productId.trim()) {
    return { error: "Seleccioná un producto para la promoción." }
  }

  if (state.type === "percentage") {
    const discount = Number(state.discountPercent)
    if (!Number.isFinite(discount) || discount <= 0 || discount >= 100) {
      return { error: "El descuento porcentual debe estar entre 1 y 99." }
    }
  }

  if (state.scheduleMode === "range") {
    if (!state.startDate || !state.endDate) {
      return { error: "Completa la fecha de inicio y fin de la promoción." }
    }

    if (state.endDate < state.startDate) {
      return { error: "La fecha de fin no puede ser anterior a la de inicio." }
    }
  }

  if (state.scheduleMode === "weekdays" && state.weekdays.length === 0) {
    return { error: "Seleccioná al menos un día de la semana." }
  }

  return {
    data: {
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      type: state.type,
      discount_percent: state.type === "percentage" ? Number(state.discountPercent) : null,
      productIds: [state.productId.trim()],
      active: state.isActive,
      startDate: state.scheduleMode === "range" ? toIsoDate(state.startDate) : null,
      endDate: state.scheduleMode === "range" ? toIsoDate(state.endDate) : null,
      weekdays: state.scheduleMode === "weekdays" ? state.weekdays : null,
    },
  }
}

export function PromotionFormDialog({
  open,
  onOpenChange,
  onSave,
  initialData,
}: PromotionFormDialogProps) {
  const [formState, setFormState] = useState<PromotionFormState>(() =>
    createInitialState(initialData)
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const title = initialData ? "Editar" : "Crear"

  const updateField = <K extends keyof PromotionFormState>(field: K, value: PromotionFormState[K]) => {
    setFormState((current) => ({ ...current, [field]: value }))
    setSubmitError(null)
  }

  const toggleWeekday = (weekday: number) => {
    setFormState((current) => {
      const weekdays = current.weekdays.includes(weekday)
        ? current.weekdays.filter((value) => value !== weekday)
        : [...current.weekdays, weekday]

      return { ...current, weekdays }
    })
    setSubmitError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload = buildPromotionPayload(formState)
    if ("error" in payload) {
      setSubmitError(payload.error)
      return
    }

    setIsSaving(true)
    setSubmitError(null)

    try {
      await onSave(payload.data)
      onOpenChange(false)
    } catch (exception) {
      setSubmitError(
        exception instanceof Error ? exception.message : "No se pudo guardar la promoción."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title} promoción</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={formState.name} onChange={(event) => updateField("name", event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={formState.description}
              onChange={(event) => updateField("description", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <select
              id="type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={formState.type}
              onChange={(event) => updateField("type", event.target.value as Promotion["type"])}
            >
              <option value="percentage">Porcentaje</option>
              <option value="two_x_one">2x1</option>
            </select>
          </div>

          {formState.type === "percentage" && (
            <div className="space-y-2">
              <Label htmlFor="discountPercent">Descuento porcentual</Label>
              <Input
                id="discountPercent"
                type="number"
                min="1"
                max="99"
                step="1"
                value={formState.discountPercent}
                onChange={(event) => updateField("discountPercent", event.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="productId">Producto</Label>
            <Input
              id="productId"
              value={formState.productId}
              onChange={(event) => updateField("productId", event.target.value)}
              placeholder="Ej. P001"
            />
          </div>

          <div className="space-y-2">
            <Label>Horario</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scheduleMode"
                  value="range"
                  checked={formState.scheduleMode === "range"}
                  onChange={() => updateField("scheduleMode", "range")}
                />
                Rango de fechas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scheduleMode"
                  value="weekdays"
                  checked={formState.scheduleMode === "weekdays"}
                  onChange={() => updateField("scheduleMode", "weekdays")}
                />
                Días de la semana
              </label>
            </div>
          </div>

          {formState.scheduleMode === "range" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha de inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formState.startDate}
                  onChange={(event) => updateField("startDate", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha de fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formState.endDate}
                  onChange={(event) => updateField("endDate", event.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Días activos</Label>
              <div className="flex flex-wrap gap-3">
                {WEEKDAY_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formState.weekdays.includes(option.value)}
                      onChange={() => toggleWeekday(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formState.isActive}
              onChange={(event) => updateField("isActive", event.target.checked)}
            />
            <Label htmlFor="isActive">Activa</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
