import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { render } from "@/test/render"
import { SettingsTabsShell } from "../settings-tabs-shell"

describe("SettingsTabsShell", () => {
  it("renders the settings tabs with injected repository data", async () => {
    render(<SettingsTabsShell />)

    expect(await screen.findByText("Datos de la tienda")).toBeInTheDocument()
    expect(await screen.findByDisplayValue("AUTOSERVICIO LOS CHICOS")).toBeInTheDocument()
    expect(screen.getByText("Identidad fiscal actual")).toBeInTheDocument()
    expect(screen.getByText("CAMACHO ROMERO LILA GLADYS")).toBeInTheDocument()
    expect(screen.getByText("1553547-9")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Equipo" }))
    expect(await screen.findByText("Miembros del equipo")).toBeInTheDocument()
    expect(screen.getByText("Ana López")).toBeInTheDocument()
  })
})
