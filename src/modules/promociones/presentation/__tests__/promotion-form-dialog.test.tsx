import { fireEvent, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { render } from "@/test/render"

import { PromotionFormDialog } from "../PromotionFormDialog"

describe("PromotionFormDialog", () => {
  it("submits a percentage promotion with a date-range schedule", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()

    render(<PromotionFormDialog open onOpenChange={onOpenChange} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Promo verano" },
    })
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Descuento de temporada" },
    })
    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "percentage" },
    })
    fireEvent.change(screen.getByLabelText("Descuento porcentual"), {
      target: { value: "10" },
    })
    fireEvent.change(screen.getByLabelText("Producto"), {
      target: { value: "P001" },
    })
    fireEvent.change(screen.getByLabelText("Fecha de inicio"), {
      target: { value: "2026-07-01" },
    })
    fireEvent.change(screen.getByLabelText("Fecha de fin"), {
      target: { value: "2026-07-31" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Promo verano",
          description: "Descuento de temporada",
          type: "percentage",
          discount_percent: 10,
          productIds: ["P001"],
          active: true,
          startDate: "2026-07-01T00:00:00.000Z",
          endDate: "2026-07-31T00:00:00.000Z",
          weekdays: null,
        })
      )
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("submits a 2x1 promotion with weekday scheduling and no discount percent", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()

    render(<PromotionFormDialog open onOpenChange={onOpenChange} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Combo fin de semana" },
    })
    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "two_x_one" },
    })
    fireEvent.change(screen.getByLabelText("Producto"), {
      target: { value: "P002" },
    })
    fireEvent.click(screen.getByLabelText("Días de la semana"))
    fireEvent.click(screen.getByLabelText("Lun"))
    fireEvent.click(screen.getByLabelText("Vie"))

    expect(screen.queryByLabelText("Descuento porcentual")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "two_x_one",
          discount_percent: null,
          productIds: ["P002"],
          startDate: null,
          endDate: null,
          weekdays: [1, 5],
        })
      )
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("renders backend validation errors inline", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("El backend rechazó la promoción"))
    const onOpenChange = vi.fn()

    render(<PromotionFormDialog open onOpenChange={onOpenChange} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Promo inválida" },
    })
    fireEvent.change(screen.getByLabelText("Producto"), {
      target: { value: "P003" },
    })
    fireEvent.change(screen.getByLabelText("Descuento porcentual"), {
      target: { value: "15" },
    })
    fireEvent.change(screen.getByLabelText("Fecha de inicio"), {
      target: { value: "2026-08-01" },
    })
    fireEvent.change(screen.getByLabelText("Fecha de fin"), {
      target: { value: "2026-08-31" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El backend rechazó la promoción"
    )
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
