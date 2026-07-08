import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"

import { render } from "@/test/render"
import type { Promotion } from "../../domain/promotion"

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock("sonner", async () => {
  const actual = await vi.importActual<typeof import("sonner")>("sonner")

  return {
    ...actual,
    toast: {
      ...actual.toast,
      success: toastMocks.success,
      error: toastMocks.error,
    },
  }
})

const promotionMocks = vi.hoisted(() => {
  let promotions: Promotion[] = []

  const repository = {
    getPromotions: vi.fn(async () => promotions.map((promotion) => ({ ...promotion }))),
    createPromotion: vi.fn(async (promotion: Omit<Promotion, "id">) => {
      const created: Promotion = {
        id: `promo-${promotions.length + 1}`,
        ...promotion,
      }

      promotions = [...promotions, created]
      return created
    }),
    updatePromotion: vi.fn(async (id: string, patch: Partial<Promotion>) => {
      const existing = promotions.find((promotion) => promotion.id === id)
      if (!existing) {
        throw new Error("Promotion not found")
      }

      const updated = { ...existing, ...patch }
      promotions = promotions.map((promotion) => (promotion.id === id ? updated : promotion))
      return updated
    }),
    deletePromotion: vi.fn(async (id: string) => {
      promotions = promotions.map((promotion) =>
        promotion.id === id ? { ...promotion, active: false } : promotion
      )
    }),
  }

  return {
    repository,
    setPromotions(next: Promotion[]) {
      promotions = next.map((promotion) => ({ ...promotion }))
      repository.getPromotions.mockClear()
      repository.createPromotion.mockClear()
      repository.updatePromotion.mockClear()
      repository.deletePromotion.mockClear()
      toastMocks.success.mockClear()
      toastMocks.error.mockClear()
    },
  }
})

vi.mock("../../infrastructure/api-promotion-repository", () => ({
  promotionRepository: promotionMocks.repository,
}))

import { PromotionsShell } from "../promotions-shell"

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "promo-1",
    name: "Promo de ejemplo",
    description: "Descripción base",
    type: "percentage",
    discount_percent: 10,
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-31T00:00:00.000Z",
    weekdays: null,
    active: true,
    productIds: ["P001"],
    ...overrides,
  }
}

function getRowByName(name: string) {
  const row = screen.getByText(name).closest("tr")
  if (!row) {
    throw new Error(`Row for ${name} not found`)
  }

  return row
}

describe("PromotionsShell", () => {
  beforeEach(() => {
    promotionMocks.setPromotions([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates a promotion and refreshes the displayed list", async () => {
    promotionMocks.setPromotions([
      makePromotion({ id: "promo-1", name: "Promo inicial", productIds: ["P001"] }),
    ])

    render(<PromotionsShell />)

    expect(await screen.findByText("Promo inicial")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Nueva Promoción" }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Promo nueva" },
    })
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Nuevo descuento" },
    })
    fireEvent.change(screen.getByLabelText("Producto"), {
      target: { value: "P002" },
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

    await waitFor(() => {
      expect(promotionMocks.repository.createPromotion).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Promo nueva",
          description: "Nuevo descuento",
          type: "percentage",
          discount_percent: 15,
          productIds: ["P002"],
          active: true,
          startDate: "2026-08-01T00:00:00.000Z",
          endDate: "2026-08-31T00:00:00.000Z",
          weekdays: null,
        })
      )
    })

    expect(await screen.findByText("Promo nueva")).toBeInTheDocument()

    const newRow = getRowByName("Promo nueva")
    expect(within(newRow).getByText("Sí")).toBeInTheDocument()
  })

  it("sends only the changed fields when editing a promotion", async () => {
    promotionMocks.setPromotions([
      makePromotion({
        id: "promo-1",
        name: "Promo original",
        description: "Descripción original",
        productIds: ["P001"],
      }),
    ])

    render(<PromotionsShell />)

    expect(await screen.findByText("Promo original")).toBeInTheDocument()

    const row = getRowByName("Promo original")
    fireEvent.click(within(row).getByRole("button", { name: "Editar" }))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Promo renombrada" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => {
      expect(promotionMocks.repository.updatePromotion).toHaveBeenCalledWith("promo-1", {
        name: "Promo renombrada",
      })
    })

    expect(await screen.findByText("Promo renombrada")).toBeInTheDocument()
    expect(screen.queryByText("Promo original")).not.toBeInTheDocument()
  })

  it("deactivates a promotion when the delete action is confirmed", async () => {
    promotionMocks.setPromotions([
      makePromotion({
        id: "promo-1",
        name: "Promo para eliminar",
        productIds: ["P001"],
      }),
    ])

    vi.spyOn(window, "confirm").mockReturnValue(true)

    render(<PromotionsShell />)

    expect(await screen.findByText("Promo para eliminar")).toBeInTheDocument()

    const row = getRowByName("Promo para eliminar")
    fireEvent.click(within(row).getByRole("button", { name: "Eliminar" }))

    await waitFor(() => {
      expect(promotionMocks.repository.deletePromotion).toHaveBeenCalledWith("promo-1")
    })

    const updatedRow = getRowByName("Promo para eliminar")
    expect(within(updatedRow).getByText("No")).toBeInTheDocument()
  })

  it("blocks creating a second active promotion for the same product", async () => {
    promotionMocks.setPromotions([
      makePromotion({
        id: "promo-1",
        name: "Promo activa",
        productIds: ["P001"],
        active: true,
      }),
    ])

    render(<PromotionsShell />)

    expect(await screen.findByText("Promo activa")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Nueva Promoción" }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Promo duplicada" },
    })
    fireEvent.change(screen.getByLabelText("Producto"), {
      target: { value: "P001" },
    })
    fireEvent.change(screen.getByLabelText("Descuento porcentual"), {
      target: { value: "20" },
    })
    fireEvent.change(screen.getByLabelText("Fecha de inicio"), {
      target: { value: "2026-09-01" },
    })
    fireEvent.change(screen.getByLabelText("Fecha de fin"), {
      target: { value: "2026-09-30" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This product already has an active promotion."
    )
    expect(promotionMocks.repository.createPromotion).not.toHaveBeenCalled()
  })

  it("blocks re-enabling a disabled promotion when another active one already exists", async () => {
    promotionMocks.setPromotions([
      makePromotion({
        id: "promo-1",
        name: "Promo activa",
        productIds: ["P001"],
        active: true,
      }),
      makePromotion({
        id: "promo-2",
        name: "Promo desactivada",
        productIds: ["P001"],
        active: false,
      }),
    ])

    render(<PromotionsShell />)

    expect(await screen.findByText("Promo desactivada")).toBeInTheDocument()

    const row = getRowByName("Promo desactivada")
    fireEvent.click(within(row).getByRole("button", { name: "Editar" }))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Activa"))
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This product already has an active promotion."
    )
    expect(promotionMocks.repository.updatePromotion).not.toHaveBeenCalled()
  })
})
