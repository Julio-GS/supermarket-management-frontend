import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { render } from "@/test/render"
import { PosTerminalShell } from "../pos-terminal-shell"

describe("PosTerminalShell", () => {
  it("injects catalog and checkout ports into the presentation component", async () => {
    render(
      <SidebarProvider>
        <PosTerminalShell
          initialProducts={[
            {
              id: "P001",
              name: "Test Product",
              category: "Bebidas",
              sku: "TEST-0001",
              price: 100,
              stock: 50,
              unit: "u",
            },
          ]}
        />
      </SidebarProvider>
    )

    expect(await screen.findByText("Test Product")).toBeInTheDocument()
  })
})
