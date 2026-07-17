import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import type {
  ProviderPurchase,
  ProviderPurchaseInput,
  ProviderPurchaseReport,
  ReportWindow,
} from "../../domain/provider-purchase"
import { ProviderPurchasesShell } from "../provider-purchases-shell"

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockList = vi.fn<() => Promise<ProviderPurchase[]>>()
const mockCreate = vi.fn<
  (input: ProviderPurchaseInput) => Promise<ProviderPurchase>
>()
const mockUpdate = vi.fn<
  (id: string, patch: Partial<ProviderPurchaseInput>) => Promise<ProviderPurchase>
>()
const mockDelete = vi.fn<(id: string) => Promise<void>>()
const mockReport = vi.fn<
  (window: ReportWindow) => Promise<ProviderPurchaseReport>
>()

vi.mock("../../infrastructure/api-provider-purchase-repository", () => ({
  providerPurchaseRepository: {
    list: () => mockList(),
    create: (input: ProviderPurchaseInput) => mockCreate(input),
    update: (id: string, patch: Partial<ProviderPurchaseInput>) =>
      mockUpdate(id, patch),
    delete: (id: string) => mockDelete(id),
    report: (window: ReportWindow) => mockReport(window),
  },
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePurchase(
  overrides: Partial<ProviderPurchase> = {}
): ProviderPurchase {
  return {
    id: "pp-1",
    providerName: "Distribuidora ABC",
    amount: "15000.00",
    paymentMethod: "transferencia",
    createdAt: "2026-07-10T12:00:00.000Z",
    updatedAt: "2026-07-10T12:00:00.000Z",
    ...overrides,
  }
}

function makeReport(
  overrides: Partial<ProviderPurchaseReport> = {}
): ProviderPurchaseReport {
  return {
    window: "day",
    range: {
      startsAt: "2026-07-14T00:00:00.000+00:00",
      endsAt: "2026-07-14T23:59:59.000+00:00",
    },
    totalAmount: "25000.00",
    purchaseCount: 3,
    paymentMethodBreakdown: [
      { method: "transferencia", amount: "15000.00" },
      { method: "efectivo", amount: "10000.00" },
    ],
    ...overrides,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createWrapper(queryClient?: QueryClient) {
  const qc =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ProviderPurchasesShell", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  // ── Loading state ────────────────────────────────────────────────────────

  it("shows loading skeleton while list is loading", () => {
    mockList.mockReturnValue(new Promise(() => {})) // never resolves
    mockReport.mockReturnValue(new Promise(() => {}))

    render(<ProviderPurchasesShell />, { wrapper: createWrapper(queryClient) })

    expect(document.querySelector(".animate-pulse")).toBeTruthy()
  })

  // ── Empty state ──────────────────────────────────────────────────────────

  it("shows empty state when no purchases exist", async () => {
    mockList.mockResolvedValue([])
    mockReport.mockResolvedValue(makeReport())

    render(<ProviderPurchasesShell />, { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(
        screen.getByText(/no hay compras registradas/i)
      ).toBeInTheDocument()
    })
  })

  // ── Data rendering ───────────────────────────────────────────────────────

  it("renders purchases in table with provider name", async () => {
    mockList.mockResolvedValue([
      makePurchase(),
      makePurchase({
        id: "pp-2",
        providerName: "Otro Proveedor",
        amount: "5000.00",
        paymentMethod: "efectivo",
      }),
    ])
    mockReport.mockResolvedValue(makeReport())

    render(<ProviderPurchasesShell />, { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument()
    })

    expect(screen.getByText("Otro Proveedor")).toBeInTheDocument()
  })

  // ── Report widget ────────────────────────────────────────────────────────

  it("renders report with total and breakdown after data loads", async () => {
    mockList.mockResolvedValue([makePurchase()])
    mockReport.mockResolvedValue(makeReport())

    render(<ProviderPurchasesShell />, { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(
        screen.getByText(/total gastado en compras a proveedores/i)
      ).toBeInTheDocument()
    })

    // Transferencia and Efectivo appear in the report breakdown AND in payment method labels
    const transferNodes = screen.getAllByText("Transferencia")
    expect(transferNodes.length).toBeGreaterThanOrEqual(1)
    expect(transferNodes[0]).toBeInTheDocument()

    const efectivoNodes = screen.getAllByText("Efectivo")
    expect(efectivoNodes.length).toBeGreaterThanOrEqual(1)
  })

  // ── Create flow ──────────────────────────────────────────────────────────

  it("opens create dialog, validates empty provider name, and shows error", async () => {
    mockList.mockResolvedValue([])
    mockReport.mockResolvedValue(makeReport())

    render(<ProviderPurchasesShell />, { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(
        screen.getByText(/no hay compras registradas/i)
      ).toBeInTheDocument()
    })

    // Click "Nueva Compra" button
    fireEvent.click(screen.getByRole("button", { name: /nueva compra/i }))

    // Wait for dialog to open
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeVisible()
    })

    const dialog = screen.getByRole("dialog")

    // Dialog should be open — try submitting with empty fields
    fireEvent.click(within(dialog).getByRole("button", { name: /guardar/i }))

    // Should show validation error
    await waitFor(() => {
      expect(
        within(dialog).getByText(/el nombre del proveedor es obligatorio/i)
      ).toBeInTheDocument()
    })

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("creates a purchase successfully", async () => {
    mockList.mockResolvedValue([])
    mockReport.mockResolvedValue(makeReport())
    const created = makePurchase({
      id: "pp-new",
      providerName: "Nuevo Proveedor",
      amount: "8000.00",
      paymentMethod: "qr",
    })
    mockCreate.mockResolvedValue(created)

    render(<ProviderPurchasesShell />, { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(
        screen.getByText(/no hay compras registradas/i)
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /nueva compra/i }))

    // Scope to the dialog element to avoid inert background matches
    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      expect(within(dialog).getByLabelText(/proveedor/i)).toBeVisible()
    })

    const dialog = screen.getByRole("dialog")

    // Fill form within the dialog
    fireEvent.change(within(dialog).getByLabelText(/proveedor/i), {
      target: { value: "Nuevo Proveedor" },
    })
    fireEvent.change(within(dialog).getByLabelText(/monto/i), {
      target: { value: "8000" },
    })

    // Select payment method
    fireEvent.change(within(dialog).getByLabelText(/método de pago/i), {
      target: { value: "qr" },
    })

    fireEvent.click(within(dialog).getByRole("button", { name: /guardar/i }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        providerName: "Nuevo Proveedor",
        amount: "8000",
        paymentMethod: "qr",
      })
    })
  })

  // ── Edit flow ────────────────────────────────────────────────────────────

  it("opens edit dialog pre-filled with existing data", async () => {
    mockList.mockResolvedValue([makePurchase()])
    mockReport.mockResolvedValue(makeReport())

    render(<ProviderPurchasesShell />, { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument()
    })

    // Click edit button
    const editButtons = screen.getAllByRole("button", { name: /editar/i })
    fireEvent.click(editButtons[0])

    // Dialog should show existing values
    await waitFor(() => {
      const providerInput = screen.getByDisplayValue("Distribuidora ABC")
      expect(providerInput).toBeInTheDocument()
    })
  })

  // ── Delete flow ──────────────────────────────────────────────────────────

  it("shows delete confirmation and deletes on confirm", async () => {
    mockList.mockResolvedValue([makePurchase()])
    mockReport.mockResolvedValue(makeReport())
    mockDelete.mockResolvedValue(undefined)

    render(<ProviderPurchasesShell />, { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(screen.getByText("Distribuidora ABC")).toBeInTheDocument()
    })

    // Click delete button
    const deleteButtons = screen.getAllByRole("button", { name: /eliminar/i })
    fireEvent.click(deleteButtons[0])

    // Confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText(/eliminar compra/i)).toBeInTheDocument()
    })

    // Confirm delete
    const confirmButtons = screen.getAllByRole("button", { name: /eliminar/i })
    // The confirm button in the dialog is the last "Eliminar" button
    fireEvent.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("pp-1")
    })
  })

  // ── Error state ──────────────────────────────────────────────────────────

  it("shows error message when load fails", async () => {
    mockList.mockRejectedValue(new Error("Failed to load"))
    mockReport.mockResolvedValue(makeReport())

    render(<ProviderPurchasesShell />, { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })
})
