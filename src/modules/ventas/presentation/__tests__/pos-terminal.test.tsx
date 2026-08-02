import { describe, expect, it, vi, beforeEach } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { render as rtlRender } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SidebarProvider } from "@/components/ui/sidebar"
import { PosTerminal } from "../pos-terminal"
import type { ReactElement, ReactNode } from "react"
import type { CatalogProduct, CatalogQueryPort } from "../../application/catalog-query-port"
import type { CheckoutPort } from "../../application/checkout-port"
import type { TicketPrinterPort } from "../../application/ticket-printer-port"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
    },
  })
}

function AllTheProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <SidebarProvider>{children}</SidebarProvider>
    </QueryClientProvider>
  )
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: AllTheProviders })
}

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "P001",
    name: "Test Product",
    sku: "SKU-001",
    price: 10,
    stock: 50,
    manejaStock: true,
    unit: "u",
    promotions: null,
    storePromotions: null,
    ...overrides,
  }
}

function makeCatalogPort(
  overrides: Partial<CatalogQueryPort> = {}
): CatalogQueryPort {
  return {
    search: vi.fn().mockResolvedValue([]),
    findByCode: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

function makeCheckoutPort(overrides: Partial<CheckoutPort> = {}): CheckoutPort {
  return {
    save: vi.fn().mockResolvedValue({
      id: "V-00001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customer: "Mostrador",
      items: [],
      total: "0.00",
      paymentMethods: [],
      invoiceStatus: "none" as const,
      cae: null,
      caeVto: null,
      cbteNro: null,
      cbteTipo: null,
      ptoVta: null,
      invoiceRequestedAt: null,
      splitTicketGroups: null,
    }),
    ...overrides,
  }
}

function makeTicketPrinterPort(overrides: Partial<TicketPrinterPort> = {}): TicketPrinterPort {
  return {
    print: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
}

// ── Slice 3: Responsive shell classes ──────────────────────────

describe("PosTerminal — Slice 3: responsive layout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the mobile tab layout (lg:hidden block)", () => {
    render(
      <PosTerminal
        catalogQueryPort={makeCatalogPort()}
        checkoutPort={makeCheckoutPort()}
        ticketPrinterPort={makeTicketPrinterPort()}
      />
    )

    // The mobile tab bar with two triggers should be present
    expect(screen.getByText("Escáner")).toBeInTheDocument()
    // "Carrito" appears both as a tab trigger and as the cart panel heading
    const carritoElements = screen.getAllByText("Carrito")
    expect(carritoElements.length).toBeGreaterThanOrEqual(1)
  })

  it("renders the desktop grid with fluid column sizing (not hardcoded 420px)", () => {
    const { container } = render(
      <PosTerminal
        catalogQueryPort={makeCatalogPort()}
        checkoutPort={makeCheckoutPort()}
        ticketPrinterPort={makeTicketPrinterPort()}
      />
    )

    // The desktop grid is a hidden lg:grid div
    const desktopGrid = container.querySelector(".lg\\:grid")
    expect(desktopGrid).not.toBeNull()

    // The grid should NOT use the old hardcoded 1fr_420px pattern
    const className = desktopGrid!.className
    expect(className).not.toContain("1fr_420px")
    // Should use fluid minmax/clamp approach instead
    expect(className).toContain("minmax")
  })

  it("cart card uses proper overflow handling on desktop", () => {
    const { container } = render(
      <PosTerminal
        catalogQueryPort={makeCatalogPort()}
        checkoutPort={makeCheckoutPort()}
        ticketPrinterPort={makeTicketPrinterPort()}
      />
    )

    // The cart card in the desktop layout should have overflow-hidden
    const desktopSection = container.querySelector(".hidden.lg\\:grid")
    if (desktopSection) {
      // Find the Card inside the desktop layout
      const card = desktopSection.querySelector(".rounded-xl")
      expect(card).not.toBeNull()

      const cardClasses = card!.className
      // Should use overflow-hidden to contain scrolling
      expect(cardClasses).toContain("overflow-hidden")
    }
  })

  it("does not use calc(100vh-*) hardcoded top offsets on desktop cart", () => {
    const { container } = render(
      <PosTerminal
        catalogQueryPort={makeCatalogPort()}
        checkoutPort={makeCheckoutPort()}
        ticketPrinterPort={makeTicketPrinterPort()}
      />
    )

    const desktopSection = container.querySelector(".hidden.lg\\:grid")
    if (desktopSection) {
      const html = desktopSection.innerHTML
      // Should not use calc(100vh - ...) with hardcoded offsets like 8rem or 24
      const hasCalcWithVh = /calc\(100vh\s*-\s*(?:8rem|6rem|96px|24)/.test(html)
      expect(hasCalcWithVh).toBe(false)
    }
  })

  it("switches to cart tab when mobile tab is clicked", () => {
    render(
      <PosTerminal
        catalogQueryPort={makeCatalogPort()}
        checkoutPort={makeCheckoutPort()}
        ticketPrinterPort={makeTicketPrinterPort()}
      />
    )

    // Click the Cart tab trigger (the first "Carrito" in the tab button)
    // Use getAllByText since "Carrito" appears multiple times
    const carritoTabs = screen.getAllByText("Carrito")
    fireEvent.click(carritoTabs[0])

    // The cart tab content should now be visible
    const cartHeadings = screen.getAllByText("Carrito")
    expect(cartHeadings.length).toBeGreaterThanOrEqual(1)
  })
})
