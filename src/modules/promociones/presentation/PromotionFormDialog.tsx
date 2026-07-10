import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { type Promotion, type PromotionScope } from "../domain/promotion"

type ScheduleMode = "range" | "weekdays"

interface PromotionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Omit<Promotion, "id" | "createdAt" | "updatedAt">) => Promise<void>
  initialData?: Promotion | null
}

interface PromotionFormState {
  name: string
  description: string
  scope: PromotionScope
  type: Promotion["type"]
  discountPercent: string
  productCode: string
  enabled: boolean
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
    scope: initialData?.scope ?? "product",
    type: initialData?.type ?? "percentage",
    discountPercent: initialData?.discountPercent?.toString() ?? "",
    productCode: initialData?.productId ?? "",
    enabled: initialData?.enabled ?? true,
    scheduleMode: useWeekdays ? "weekdays" : "range",
    startDate: toDateInputValue(initialData?.startDate ?? null),
    endDate: toDateInputValue(initialData?.endDate ?? null),
    weekdays: initialData?.weekdays ?? [],
  }
}

function buildPromotionPayload(state: PromotionFormState):
  | { error: string }
  | { data: Omit<Promotion, "id" | "createdAt" | "updatedAt"> } {
  if (!state.name.trim()) {
    return { error: "El nombre de la promoción es obligatorio." }
  }

  if (state.scope === "product") {
    if (!state.productCode.trim()) {
      return { error: "Ingresá el código del producto para la promoción con alcance de producto." }
    }
  }

  if (state.scope === "store" && state.productCode.trim()) {
    return { error: "Las promociones de tienda no deben tener un producto asignado." }
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
      description: state.description.trim() || null,
      scope: state.scope,
      type: state.type,
      discountPercent: state.type === "percentage" ? Number(state.discountPercent) : null,
      productId: state.scope === "product" ? state.productCode.trim() : null,
      enabled: state.enabled,
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
  const isEditing = Boolean(initialData)
  const title = isEditing ? "Editar" : "Crear"

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

          {/* Scope selector */}
          <div className="space-y-2">
            <Label>Alcance</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  value="product"
                  checked={formState.scope === "product"}
                  onChange={() => updateField("scope", "product")}
                  disabled={isEditing}
                />
                Producto
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  value="store"
                  checked={formState.scope === "store"}
                  onChange={() => updateField("scope", "store")}
                  disabled={isEditing}
                />
                Tienda
              </label>
            </div>
          </div>

          {formState.scope === "store" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ⚠️ Esta promoción aplicará a <strong>todos</strong> los productos de la tienda.
            </div>
          )}

          {/* Product code input — only for product scope. The entered barcode/code is resolved to a UUID before sending to the backend. */}
          {formState.scope === "product" && (
            <div className="space-y-2">
              <Label htmlFor="productCode">Código de producto</Label>
              <Input
                id="productCode"
                value={formState.productCode}
                onChange={(event) => updateField("productCode", event.target.value)}
                placeholder="Ej. P001, LAC-0001"
                disabled={isEditing}
              />
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  El producto asignado no se puede modificar al editar. Si necesitás cambiarlo, creá una nueva promoción.
                </p>
              )}
            </div>
          )}

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

          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formState.enabled}
                onChange={(event) => updateField("enabled", event.target.checked)}
              />
              <Label htmlFor="enabled">Activa</Label>
            </div>
          )}

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
