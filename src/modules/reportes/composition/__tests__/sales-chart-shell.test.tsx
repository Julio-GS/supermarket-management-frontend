import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { render } from "@/test/render"
import { SalesChartShell } from "../sales-chart-shell"

vi.mock("../../presentation/sales-chart", () => ({
  SalesChart: () => <div>Ventas de la semana</div>,
}))

describe("SalesChartShell", () => {
  it("renders a loading skeleton and then resolves to the chart", async () => {
    render(<SalesChartShell />)

    expect(screen.getByTestId("chart-skeleton")).toBeInTheDocument()
    expect(await screen.findByText("Ventas de la semana")).toBeInTheDocument()
  })
})
