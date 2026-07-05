import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { render } from "@/test/render"
import { ReportesShell } from "../reportes-shell"

describe("ReportesShell", () => {
  it("renders the window selector and shows error state when report fails", async () => {
    render(<ReportesShell />)

    // Window selector is always visible
    expect(screen.getByText("Hoy")).toBeInTheDocument()
    expect(screen.getByText("Semana")).toBeInTheDocument()
    expect(screen.getByText("Mes")).toBeInTheDocument()

    // Without a real /reports backend, we expect an error state after fetch attempt
    // (the test environment has no backend, so fetch will fail)
    await waitFor(
      () => {
        expect(screen.getByText("No se pudieron cargar los reportes")).toBeInTheDocument()
      },
      { timeout: 5000 }
    )
  })
})
