import { Suspense, type ReactNode } from "react"

import { act, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { render } from "@/test/render"

const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
}))

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/modules/ventas", async () => {
  const actual = await vi.importActual<typeof import("@/modules/ventas")>("@/modules/ventas")
  return {
    ...actual,
    createApiSalesRepository: () => ({
      getById: mocks.getById,
    }),
  }
})

import SaleDetailPage from "./page"

describe("SaleDetailPage", () => {
  it("renders final discount lines from backend sale details", async () => {
    mocks.getById.mockResolvedValue({
      id: "V-100",
      createdAt: "2026-07-08T12:00:00.000Z",
      updatedAt: "2026-07-08T12:00:00.000Z",
      customer: "Mostrador",
      items: [
        {
          productId: "P001",
          name: "Producto promocionado",
          quantity: 3,
          unitPrice: "100.00",
          subtotal: "300.00",
          discountAmount: "300.00",
          appliedPromotions: [
            {
              promotionId: "promo-1",
              promotionScope: "product",
              promotionType: "percentage",
              discountAmount: "300.00",
            },
          ],
          appliedPromotionId: "promo-1",
          appliedPromotionType: "percentage",
        },
      ],
      total: "300.00",
      paymentMethods: [{ method: "cash", amount: "300.00" }],
      invoiceStatus: "none",
      cae: null,
      caeVto: null,
      cbteNro: null,
      cbteTipo: null,
      ptoVta: null,
      invoiceRequestedAt: null,
      splitTicketGroups: null,
    })

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <SaleDetailPage params={Promise.resolve({ saleId: "V-100" })} />
        </Suspense>
      )
    })

    expect(await screen.findByText("Venta #V-100")).toBeInTheDocument()
    expect(screen.getByText("Producto promocionado")).toBeInTheDocument()
    expect(screen.getByText("Producto: %")).toBeInTheDocument()
    // Discount amount appears twice: in the applied-promotion line and the "Descuento total" line
    expect(screen.getAllByText(/-\$\s*300,00/)).toHaveLength(2)
    expect(screen.getByText("Descuento total")).toBeInTheDocument()
  })

  it("does not render a discount line when the backend sale item has no discount", async () => {
    mocks.getById.mockResolvedValue({
      id: "V-101",
      createdAt: "2026-07-08T12:00:00.000Z",
      updatedAt: "2026-07-08T12:00:00.000Z",
      customer: "Mostrador",
      items: [
        {
          productId: "P002",
          name: "Producto sin descuento",
          quantity: 2,
          unitPrice: "150.00",
          subtotal: "300.00",
          discountAmount: "0.00",
          appliedPromotions: [],
          appliedPromotionId: null,
          appliedPromotionType: "percentage",
        },
      ],
      total: "300.00",
      paymentMethods: [{ method: "cash", amount: "300.00" }],
      invoiceStatus: "none",
      cae: null,
      caeVto: null,
      cbteNro: null,
      cbteTipo: null,
      ptoVta: null,
      invoiceRequestedAt: null,
      splitTicketGroups: null,
    })

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <SaleDetailPage params={Promise.resolve({ saleId: "V-101" })} />
        </Suspense>
      )
    })

    expect(await screen.findByText("Venta #V-101")).toBeInTheDocument()
    expect(screen.getByText("Producto sin descuento")).toBeInTheDocument()
    expect(screen.queryByText("Descuento total")).not.toBeInTheDocument()
    expect(screen.queryByText(/-\$\s*0,00/)).not.toBeInTheDocument()
  })
})
