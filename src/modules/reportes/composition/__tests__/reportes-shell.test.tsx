import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { render } from "@/test/render"
import { ReportesShell } from "../reportes-shell"

describe("ReportesShell", () => {
  it("renders the report sections with injected repository data", async () => {
    render(<ReportesShell />)

    expect(await screen.findByText("Ventas de la semana")).toBeInTheDocument()
    expect(screen.getByText("Ventas por categoría")).toBeInTheDocument()
    expect(screen.getByText("Productos más vendidos")).toBeInTheDocument()
    expect(screen.getByText("Leche Entera 1L")).toBeInTheDocument()
  })
})
